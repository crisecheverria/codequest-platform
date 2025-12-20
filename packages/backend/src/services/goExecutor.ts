import Docker from "dockerode";
import { TestCase, ExecutionResult, SubmissionResult } from "../types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { config } from "../config";
import { NativeGoExecutor } from "./nativeGoExecutor";

interface ChallengeMetadata {
  functionName: string;
  parameterTypes: string[];
  returnType: string;
}

export class GoExecutor {
  private docker: Docker;
  private nativeExecutor: NativeGoExecutor;
  private readonly tempDir: string;
  private readonly TIMEOUT_MS: number;

  constructor() {
    this.docker = new Docker();
    this.nativeExecutor = new NativeGoExecutor();

    // Use environment variable for temp directory with fallback
    this.tempDir = config.docker.tempDir || path.join(process.cwd(), "temp");

    // Set timeout from config (precompiled executor should be much faster)
    this.TIMEOUT_MS =
      typeof config.docker.timeout === "string"
        ? parseInt(config.docker.timeout, 10)
        : config.docker.timeout || 10000;

    // Log important configurations
    console.log(`Go Executor initialized with:
      - Native Go Executor: ${config.executor.useNativeGo ? "ENABLED" : "DISABLED"}
      - Temp directory: ${this.tempDir}
      - Timeout: ${this.TIMEOUT_MS}ms
      - Memory limit: ${config.docker.memory}
      - CPU quota: ${config.docker.cpuQuota}
    `);
  }

  private async ensureTempDir(): Promise<void> {
    try {
      // Check if directory exists and create if it doesn't
      await fs.access(this.tempDir).catch(async () => {
        console.log(`Creating temp directory: ${this.tempDir}`);
        await fs.mkdir(this.tempDir, { recursive: true });
      });

      // Make sure permissions are set correctly
      await fs.chmod(this.tempDir, 0o777);

      console.log(`Temp directory ready: ${this.tempDir}`);
    } catch (error) {
      console.error(`Failed to ensure temp directory: ${error}`);
      throw new Error(`Failed to prepare temp directory: ${error}`);
    }
  }

  private async ensureGoVolumes(): Promise<void> {
    try {
      // Create persistent volumes for Go cache to speed up compilation
      const volumeNames = ["go-mod-cache", "go-build-cache"];

      for (const volumeName of volumeNames) {
        try {
          // Check if volume exists
          await this.docker.getVolume(volumeName).inspect();
          console.log(`Go volume ${volumeName} already exists`);
        } catch (error) {
          // Volume doesn't exist, create it
          console.log(`Creating Go cache volume: ${volumeName}`);
          await this.docker.createVolume({
            Name: volumeName,
            Labels: {
              "codequest.cache": "go",
              "codequest.purpose": volumeName.includes("mod")
                ? "modules"
                : "build",
            },
          });
          console.log(`Successfully created Go cache volume: ${volumeName}`);
        }
      }
    } catch (error) {
      console.warn(
        `Warning: Failed to create Go cache volumes: ${error}. Continuing without persistent cache.`,
      );
      // Don't throw error - we can continue without persistent cache, just slower
    }
  }

  private async prepareGoFiles(
    code: string,
    containerId: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata,
  ): Promise<{
    userCodeFile: string;
    testCasesFile: string;
    metadataFile: string;
  }> {
    // Ensure temp directory exists with proper permissions
    await this.ensureTempDir();

    const userCodeFile = path.join(this.tempDir, `${containerId}-code.go`);
    const testCasesFile = path.join(this.tempDir, `${containerId}-tests.json`);
    const metadataFile = path.join(
      this.tempDir,
      `${containerId}-metadata.json`,
    );

    console.log(`Preparing Go files for precompiled executor:`);
    console.log(`- User code: ${userCodeFile}`);
    console.log(`- Test cases: ${testCasesFile}`);
    console.log(`- Metadata: ${metadataFile}`);

    // Save user code (as-is, executor will clean it)
    await fs.writeFile(userCodeFile, code, { mode: 0o666 });

    // Save test cases as JSON
    await fs.writeFile(testCasesFile, JSON.stringify(testCases, null, 2), {
      mode: 0o666,
    });

    // Save metadata as JSON
    const execMetadata = {
      functionName: metadata.functionName,
      parameterTypes: metadata.parameterTypes,
      returnType: metadata.returnType,
    };
    await fs.writeFile(metadataFile, JSON.stringify(execMetadata, null, 2), {
      mode: 0o666,
    });

    return { userCodeFile, testCasesFile, metadataFile };
  }

  private async getContainerLogs(container: Docker.Container): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      container.logs(
        {
          follow: true,
          stdout: true,
          stderr: true,
          timestamps: false,
        },
        (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          const chunks: Buffer[] = [];
          (stream as Readable).on("data", (chunk) => chunks.push(chunk));
          (stream as Readable).on("end", () => resolve(Buffer.concat(chunks)));
          (stream as Readable).on("error", reject);
        },
      );
    });
  }

  private processResults(
    logs: Buffer,
    testCases: TestCase[],
    executionTime: [number, number],
  ): SubmissionResult {
    try {
      const timeInMs = executionTime[0] * 1000 + executionTime[1] / 1000000;

      // Docker logs have an 8-byte header that needs to be stripped
      // Format: [STREAM_TYPE][0][0][0][SIZE][SIZE][SIZE][SIZE][DATA...]
      let outputStr = logs.toString("utf8");

      // Remove Docker log headers (8 bytes at the start of each log line)
      if (outputStr.length > 8 && outputStr.charCodeAt(0) === 1) {
        // Skip the 8-byte header and get the actual content
        outputStr = outputStr.substring(8);
      }

      if (outputStr.length > 200) {
        console.log(
          "Raw Go logs preview:",
          outputStr.substring(0, 200) + "...",
        );
      } else {
      }

      // Check for compilation and execution errors
      if (
        outputStr.includes("EXECUTION_ERROR:") ||
        outputStr.includes("missing return") ||
        outputStr.includes("syntax error") ||
        outputStr.includes("build failed")
      ) {
        const errorMsg = outputStr.includes("missing return")
          ? "Function is missing return statement. Make sure your function returns a value."
          : outputStr.includes("syntax error")
            ? "Syntax error in your Go code. Please check your code for errors."
            : outputStr.includes("build failed")
              ? "Go compilation failed. Please check your code for errors."
              : "Go execution error occurred.";

        return {
          success: false,
          results: testCases.map((testCase) => ({
            passed: false,
            error: `${errorMsg}\nDetails: ${outputStr.slice(0, 500)}`,
            testCase,
            executionTime: timeInMs,
            memoryUsed: 0,
          })),
          metrics: {
            totalTime: timeInMs,
            totalMemory: 0,
            passedTests: 0,
            totalTests: testCases.length,
          },
        };
      }

      // Try to parse JSON output from Go program
      let testResults;
      try {
        testResults = JSON.parse(outputStr);
      } catch (parseError) {
        console.error("Failed to parse Go output:", outputStr);
        return {
          success: false,
          results: testCases.map((testCase) => ({
            passed: false,
            error: `Parse error: ${parseError}. Output: ${outputStr}`,
            testCase,
            executionTime: timeInMs,
            memoryUsed: 0,
          })),
          metrics: {
            totalTime: timeInMs,
            totalMemory: 0,
            passedTests: 0,
            totalTests: testCases.length,
          },
        };
      }

      const results: ExecutionResult[] = testResults.map(
        (result: any, index: number) => ({
          passed: result.passed,
          error: result.error || null,
          testCase: testCases[index],
          executionTime: timeInMs / testCases.length,
          memoryUsed: 0,
          expected: result.expected,
          actual: result.actual,
        }),
      );

      const allPassed = results.every((result) => result.passed);
      const passedCount = results.filter((result) => result.passed).length;

      return {
        success: allPassed,
        results,
        metrics: {
          totalTime: timeInMs,
          totalMemory: 0,
          passedTests: passedCount,
          totalTests: testCases.length,
        },
      };
    } catch (error) {
      console.error("Error processing Go results:", error);
      return {
        success: false,
        results: testCases.map((testCase) => ({
          passed: false,
          error: `Processing error: ${error}`,
          testCase,
          executionTime: 0,
          memoryUsed: 0,
        })),
        metrics: {
          totalTime: 0,
          totalMemory: 0,
          passedTests: 0,
          totalTests: testCases.length,
        },
      };
    }
  }

  async executeGo(
    code: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata,
  ): Promise<SubmissionResult> {
    // Use native executor if configured and available
    if (config.executor.useNativeGo) {
      try {
        const isAvailable = await this.nativeExecutor.isAvailable();

        if (isAvailable) {
          const result = await this.nativeExecutor.executeGo(
            code,
            testCases,
            metadata,
          );

          return result;
        } else {
          console.log(
            "⚠️ Native Go executor not available, falling back to Docker",
          );
        }
      } catch (error) {
        console.error(
          "❌ Native Go execution failed, falling back to Docker:",
          error,
        );
        // Continue to Docker execution below
      }
    }

    return this.executeGoWithDocker(code, testCases, metadata);
  }

  private async executeGoWithDocker(
    code: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata,
  ): Promise<SubmissionResult> {
    const containerId = uuidv4();
    let files: {
      userCodeFile: string;
      testCasesFile: string;
      metadataFile: string;
    } | null = null;
    let container: Docker.Container | null = null;

    try {
      files = await this.prepareGoFiles(code, containerId, testCases, metadata);

      const resolvedUserCodeFile = path.resolve(files.userCodeFile);
      const resolvedTestCasesFile = path.resolve(files.testCasesFile);
      const resolvedMetadataFile = path.resolve(files.metadataFile);

      console.log(`Starting Go container with precompiled executor`);

      // Create persistent volumes for Go cache if they don't exist
      await this.ensureGoVolumes();

      // Create container using precompiled executor (no AutoRemove to prevent race condition)
      container = await this.docker.createContainer({
        Image: "go-runner",
        name: `go-execution-${containerId}`,
        Cmd: [
          "go-executor",
          "/code/user-code.go",
          "/code/test-cases.json",
          "/code/metadata.json",
        ],
        HostConfig: {
          AutoRemove: false, // Manual cleanup to prevent race condition
          Memory:
            parseInt(config.docker.memory.replace("m", ""), 10) * 1024 * 1024,
          MemorySwap: -1,
          CpuQuota: parseInt(config.docker.cpuQuota, 10),
          NetworkMode: "none",
          Binds: [
            `${resolvedUserCodeFile}:/code/user-code.go:ro`,
            `${resolvedTestCasesFile}:/code/test-cases.json:ro`,
            `${resolvedMetadataFile}:/code/metadata.json:ro`,
            // Add persistent cache volumes for faster compilation
            "go-mod-cache:/go/pkg/mod",
            "go-build-cache:/go/cache",
          ],
        },
        WorkingDir: "/code",
      });

      console.log(`Go container created: ${container.id}`);

      const startTime = process.hrtime();
      console.log(
        `Starting Go container execution at: ${new Date().toISOString()}`,
      );

      await container.start();
      console.log(
        `Go container started: ${container.id} at: ${new Date().toISOString()}`,
      );

      // Wait for container to complete with timeout
      const containerPromise = container.wait();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log(
            `Go execution TIMEOUT after ${this.TIMEOUT_MS}ms at: ${new Date().toISOString()}`,
          );
          reject(
            new Error(
              `Go execution timeout - took longer than ${this.TIMEOUT_MS}ms`,
            ),
          );
        }, this.TIMEOUT_MS);
      });

      console.log(
        `Waiting for container to complete with ${this.TIMEOUT_MS}ms timeout...`,
      );

      // Add periodic status checking
      const statusCheckInterval = setInterval(async () => {
        try {
          if (container) {
            const containerInfo = await container.inspect();
            console.log(
              `Container ${container.id} status: ${containerInfo.State.Status}, Running: ${containerInfo.State.Running}`,
            );
          }
        } catch (error) {
          console.log(`Failed to inspect container: ${error}`);
        }
      }, 5000);

      let logs: Buffer;
      let executionTime: [number, number];

      try {
        await Promise.race([containerPromise, timeoutPromise]);
        clearInterval(statusCheckInterval);
        console.log(
          `Go container finished: ${container.id} at: ${new Date().toISOString()}`,
        );

        // Get logs immediately after container finishes (before cleanup)
        logs = await this.getContainerLogs(container);
        executionTime = process.hrtime(startTime);
      } catch (error) {
        clearInterval(statusCheckInterval);
        // Try to get logs even if there was an error
        try {
          logs = await this.getContainerLogs(container);
          executionTime = process.hrtime(startTime);
        } catch (logError) {
          console.error("Failed to get logs after error:", logError);
          throw error;
        }
        throw error;
      }

      console.log(`Go execution completed, processing results...`);
      return this.processResults(logs, testCases, executionTime);
    } catch (error) {
      console.error("Go execution error:", error);

      // Return timeout error result
      return {
        success: false,
        results: testCases.map((testCase) => ({
          passed: false,
          error: error instanceof Error ? error.message : "Go execution failed",
          testCase,
          executionTime: this.TIMEOUT_MS,
          memoryUsed: 0,
        })),
        metrics: {
          totalTime: this.TIMEOUT_MS,
          totalMemory: 0,
          passedTests: 0,
          totalTests: testCases.length,
        },
      };
    } finally {
      // Clean up container (now that AutoRemove is disabled)
      if (container) {
        try {
          console.log(`Cleaning up Go container: ${container.id}`);

          // Stop container if still running
          try {
            const containerInfo = await container.inspect();
            if (containerInfo.State.Running) {
              await container.stop({ t: 1 }); // 1 second grace period
            }
          } catch (stopError) {
            console.log(
              `Container stop error (expected if already stopped): ${stopError instanceof Error ? stopError.message : stopError}`,
            );
          }

          // Remove container
          try {
            await container.remove({ force: true });
            console.log(`Successfully removed Go container: ${container.id}`);
          } catch (removeError) {
            console.log(
              `Container remove error: ${removeError instanceof Error ? removeError.message : removeError}`,
            );
          }
        } catch (error) {
          console.error("Error cleaning up Go container:", error);
        }
      }

      // Clean up the temporary files
      try {
        if (files) {
          await fs.unlink(files.userCodeFile).catch(() => {
            // Ignore file removal errors
          });
          await fs.unlink(files.testCasesFile).catch(() => {
            // Ignore file removal errors
          });
          await fs.unlink(files.metadataFile).catch(() => {
            // Ignore file removal errors
          });
          console.log(`Cleaned up Go temp files for container: ${containerId}`);
        }
      } catch (cleanupError) {
        console.warn("Failed to clean up Go temp files:", cleanupError);
      }
    }
  }
}
