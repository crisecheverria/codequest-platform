import { PHPExecutor } from "./phpExecutor";
import { GoExecutor } from "./goExecutor";
import Docker from "dockerode";
import { TestCase, ExecutionResult, SubmissionResult } from "../types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { config } from "../config";

interface ChallengeMetadata {
  functionName: string;
  parameterTypes: string[];
  returnType: string;
}

export class CodeExecutor {
  private docker: Docker;
  private readonly tempDir: string;
  private readonly TIMEOUT_MS: number;
  private phpExecutor: PHPExecutor;
  private goExecutor: GoExecutor;

  constructor() {
    this.docker = new Docker();
    this.phpExecutor = new PHPExecutor();
    this.goExecutor = new GoExecutor();

    // Use environment variable for temp directory with fallback
    this.tempDir = config.docker.tempDir || path.join(process.cwd(), "temp");

    // Set timeout from config (convert string to number if needed)
    this.TIMEOUT_MS =
      typeof config.docker.timeout === "string"
        ? parseInt(config.docker.timeout, 10)
        : config.docker.timeout || 5000;

    // Log important configurations
    // eslint-disable-next-line no-console
    console.log(`Code Executor initialized with:
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
        // eslint-disable-next-line no-console
        console.log(`Creating temp directory: ${this.tempDir}`);
        await fs.mkdir(this.tempDir, { recursive: true });
      });

      // Make sure permissions are set correctly
      await fs.chmod(this.tempDir, 0o777);

      // eslint-disable-next-line no-console
      console.log(`Temp directory ready: ${this.tempDir}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to ensure temp directory: ${error}`);
      throw new Error(`Failed to prepare temp directory: ${error}`);
    }
  }

  private async saveCode(
    code: string,
    containerId: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata
  ): Promise<string> {
    // Ensure temp directory exists with proper permissions
    await this.ensureTempDir();

    const filePath = path.join(this.tempDir, `${containerId}.ts`);
    // eslint-disable-next-line no-console
    console.log(`Saving code to: ${filePath}`);

    // Create a self-contained TypeScript test file with proper types
    const wrappedCode = `/// <reference types="node" />

// Type definitions
interface TestCase {
  input: any[];
  expected: any;
  description?: string;
}

// User's solution
${code}

// Clean test cases by removing MongoDB-specific fields
const testCases = ${JSON.stringify(
      testCases.map((tc) => ({
        input: tc.input,
        expected: tc.expected,
        description: tc.description,
      })),
      null,
      2
    )};

// Run tests
function runTests() {
  testCases.forEach((testCase, index) => {
    try {
      // Determine how to call the function based on input
      let result;

      // Safely determine if we're dealing with a single array input or multiple params
      if (testCase.input.length === 1 && Array.isArray(testCase.input[0])) {
        // If input is a single array, pass it directly
        result = ${metadata.functionName}(testCase.input[0]);
      } else {
        // Input is multiple params, spread them
        result = ${metadata.functionName}(...testCase.input);
      }
      
      // Compare result
      let passed = false;
      if (Array.isArray(result) && Array.isArray(testCase.expected)) {
        passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
      } else if (typeof result === 'object' && result !== null && typeof testCase.expected === 'object' && testCase.expected !== null) {
        passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
      } else {
        passed = result === testCase.expected;
      }

      console.log(JSON.stringify({
        index,
        passed,
        output: result,
        error: null
      }));
    } catch (error: any) {
      console.log(JSON.stringify({
        index,
        passed: false,
        output: null,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  });
}

// Execute tests
runTests();`;

    // Write file with read/write permissions for all
    await fs.writeFile(filePath, wrappedCode, { mode: 0o666 });

    // eslint-disable-next-line no-console
    console.log(`File saved successfully to: ${filePath}`);
    // eslint-disable-next-line no-console
    console.log(`File absolute path: ${path.resolve(filePath)}`);

    return filePath;
  }

  async executeCode(
    code: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata,
    language: string
  ): Promise<SubmissionResult> {
    // Route to the appropriate executor based on language
    if (language === "php") {
      return this.phpExecutor.executePHP(code, testCases, metadata);
    } else if (language === "go") {
      return this.goExecutor.executeGo(code, testCases, metadata);
    } else {
      // Default for javascript/typescript
      return this.executeTypeScript(code, testCases, metadata);
    }
  }

  async executeTypeScript(
    code: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata
  ): Promise<SubmissionResult> {
    const containerId = uuidv4();
    let filePath: string;
    let container: Docker.Container | null = null;

    try {
      filePath = await this.saveCode(code, containerId, testCases, metadata);
      const resolvedFilePath = path.resolve(filePath);

      // eslint-disable-next-line no-console
      console.log(
        `Starting container for execution with file: ${resolvedFilePath}`
      );

      // Create container
      container = await this.docker.createContainer({
        Image: "code-runner",
        name: `ts-execution-${containerId}`,
        Cmd: [
          "ts-node",
          "--transpile-only",
          "--compiler-options",
          '{"module":"CommonJS","moduleResolution":"node","target":"ES2020","strict":false,"esModuleInterop":true,"allowSyntheticDefaultImports":true}',
          "/code/solution.ts"
        ],
        HostConfig: {
          AutoRemove: true,
          Memory:
            parseInt(config.docker.memory.replace("m", ""), 10) * 1024 * 1024,
          MemorySwap: -1,
          CpuQuota: parseInt(config.docker.cpuQuota, 10),
          NetworkMode: "none",
          Binds: [`${resolvedFilePath}:/code/solution.ts:ro`],
        },
        WorkingDir: "/code",
      });

      // eslint-disable-next-line no-console
      console.log(`Container created: ${container.id}`);

      const startTime = process.hrtime();
      await container.start();
      // eslint-disable-next-line no-console
      console.log(`Container started: ${container.id}`);

      // Create a promise that resolves with the logs
      const logsPromise = this.getContainerLogs(container);

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Execution timeout - took longer than ${this.TIMEOUT_MS}ms`
            )
          );
        }, this.TIMEOUT_MS);
      });

      // Race between logs and timeout
      const logs = await Promise.race([logsPromise, timeoutPromise]);
      const executionTime = process.hrtime(startTime);

      // eslint-disable-next-line no-console
      console.log(`Execution completed, processing results...`);
      return this.processResults(logs, testCases, executionTime);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Execution error:", error);

      // Return timeout error result
      return {
        success: false,
        results: testCases.map((testCase) => ({
          passed: false,
          error: error instanceof Error ? error.message : "Execution failed",
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
      // Make sure to force stop and remove the container in case of timeout
      if (container) {
        try {
          // eslint-disable-next-line no-console
          console.log(`Stopping container: ${container.id}`);
          await container
            .stop()
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.log(
                `Container stop error (expected if already stopped): ${err.message}`
              );
            });
          await container
            .remove()
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.log(
                `Container remove error (expected if auto-removed): ${err.message}`
              );
            });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error cleaning up container:", error);
        }
      }

      await this.cleanup(containerId);
    }
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
        }
      );
    });
  }

  private async cleanup(containerId: string): Promise<void> {
    try {
      const filePath = path.join(this.tempDir, `${containerId}.ts`);

      // eslint-disable-next-line no-console
      console.log(`Cleaning up file: ${filePath}`);

      await fs.unlink(filePath).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`Failed to remove file ${filePath}:`, err);
      });

      try {
        const container = await this.docker.getContainer(
          `ts-execution-${containerId}`
        );
        await container.stop().catch(() => {
          // Ignore stop errors - container might already be stopped
        });
        await container.remove().catch(() => {
          // Ignore remove errors - container might already be removed
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log("Container cleanup: container might already be removed");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Cleanup error:", error);
    }
  }

  private processResults(
    logs: Buffer,
    testCases: TestCase[],
    executionTime: [number, number]
  ): SubmissionResult {
    const outputStr = logs.toString("utf8");
    // eslint-disable-next-line no-console

    if (outputStr.length > 200) {
      // eslint-disable-next-line no-console
    } else {
      // eslint-disable-next-line no-console
    }

    const results: ExecutionResult[] = [];

    // Clean and parse the log output - improved parsing logic
    const outputLines = outputStr
      .split("\n")
      .map((line) => {
        try {
          // Find potential JSON data in the line
          const jsonStart = line.indexOf("{");
          const jsonEnd = line.lastIndexOf("}");

          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            return line.slice(jsonStart, jsonEnd + 1);
          }
          return "";
        } catch (e) {
          return "";
        }
      })
      .filter((line) => line.length > 0);

    // eslint-disable-next-line no-console
    console.log(`Found ${outputLines.length} result lines to parse`);

    for (const line of outputLines) {
      try {
        // eslint-disable-next-line no-console
        console.log("Parsing line:", line);
        const result = JSON.parse(line);

        const testCase = testCases[result.index];

        if (testCase) {
          results.push({
            passed: result.passed,
            error: result.error,
            output: result.output,
            testCase,
            executionTime: executionTime[0] * 1000 + executionTime[1] / 1000000,
            memoryUsed: 0,
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to parse result line:", line);
        // eslint-disable-next-line no-console
        console.error("Parse error:", error);
      }
    }

    // eslint-disable-next-line no-console
    console.log(`Processed ${results.length} results`);

    // If no results were parsed, create failed results for all test cases
    if (results.length === 0) {
      // Get total execution time in ms
      const totalExecTime =
        executionTime[0] * 1000 + executionTime[1] / 1000000;

      results.push(
        ...testCases.map((testCase) => ({
          passed: false,
          error:
            "Failed to parse test results. Check your code for syntax errors or infinite loops.",
          testCase,
          executionTime: totalExecTime,
          memoryUsed: 0,
        }))
      );

      // eslint-disable-next-line no-console
      console.log(
        `Created ${testCases.length} failure results due to no parsed output`
      );
    }

    const finalResult = {
      success: results.every((r) => r.passed),
      results,
      metrics: {
        totalTime: executionTime[0] * 1000 + executionTime[1] / 1000000,
        totalMemory: 0,
        passedTests: results.filter((r) => r.passed).length,
        totalTests: testCases.length,
      },
    };

    // eslint-disable-next-line no-console
    console.log(
      `Final result: success=${finalResult.success}, passedTests=${finalResult.metrics.passedTests}/${finalResult.metrics.totalTests}`
    );
    return finalResult;
  }
}
