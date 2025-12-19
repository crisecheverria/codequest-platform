import { spawn } from "child_process";
import { TestCase, ExecutionResult, SubmissionResult } from "../types";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { config } from "../config";

interface ChallengeMetadata {
  functionName: string;
  parameterTypes: string[];
  returnType: string;
}

interface GoExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  exitCode: number;
}

export class NativeGoExecutor {
  private readonly TIMEOUT_MS: number;

  constructor() {
    this.TIMEOUT_MS = config.executor.nativeGoTimeout;
    console.log(
      `Native Go Executor initialized with ${this.TIMEOUT_MS}ms timeout for compilation + execution`,
    );
    console.log(`Environment: ${config.environment}`);

    // Ensure cache directories exist
    this.ensureCacheDirectories();
  }

  /**
   * Ensure persistent cache directories exist for faster compilation
   */
  private async ensureCacheDirectories(): Promise<void> {
    try {
      const cacheDir =
        process.env.GOCACHE || path.join(os.tmpdir(), "codequest-gocache");
      const modCacheDir =
        process.env.GOMODCACHE ||
        path.join(os.tmpdir(), "codequest-gomodcache");

      await fs.mkdir(cacheDir, { recursive: true });
      await fs.mkdir(modCacheDir, { recursive: true });

      console.log(
        `Native Go cache directories ready: ${cacheDir}, ${modCacheDir}`,
      );
    } catch (error) {
      console.warn(`Warning: Failed to create Go cache directories: ${error}`);
      // Continue without persistent cache
    }
  }

  /**
   * Check if Go runtime is available on the system
   */
  private async checkGoAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const childProcess = spawn("go", ["version"]);
      let isResolved = false;
      let timeoutId: ReturnType<typeof setTimeout>;

      const resolveOnce = (result: boolean) => {
        if (!isResolved) {
          isResolved = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          resolve(result);
        }
      };

      childProcess.on("close", (code) => {
        resolveOnce(code === 0);
      });

      childProcess.on("error", () => {
        resolveOnce(false);
      });

      // Timeout after 5 seconds
      timeoutId = setTimeout(() => {
        childProcess.kill();
        resolveOnce(false);
      }, 5000);
    });
  }

  /**
   * Clean user Go code by removing package declarations, imports, and main function
   * Based on the CLI's code cleaning approach
   */
  private cleanGoUserCode(code: string): string {
    const lines = code.split("\n");
    const cleanedLines: string[] = [];
    let inImportBlock = false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    let _braceCount = 0;
    let inMainFunction = false;
    let mainFunctionBraceCount = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip package declarations
      if (trimmedLine.startsWith("package ")) {
        continue;
      }

      // Handle import blocks
      if (trimmedLine.startsWith("import (")) {
        inImportBlock = true;
        continue;
      }
      if (inImportBlock) {
        if (trimmedLine === ")") {
          inImportBlock = false;
        }
        continue;
      }

      // Skip single line imports
      if (trimmedLine.startsWith("import ")) {
        continue;
      }

      // Detect main function start
      if (
        trimmedLine.includes("func main()") ||
        trimmedLine.includes("func main() ")
      ) {
        inMainFunction = true;
        mainFunctionBraceCount = 0;
        // Count braces on the same line
        for (const char of line) {
          if (char === "{") mainFunctionBraceCount++;
          if (char === "}") mainFunctionBraceCount--;
        }
        continue;
      }

      // Skip main function content
      if (inMainFunction) {
        for (const char of line) {
          if (char === "{") mainFunctionBraceCount++;
          if (char === "}") mainFunctionBraceCount--;
        }
        if (mainFunctionBraceCount <= 0) {
          inMainFunction = false;
        }
        continue;
      }

      // Keep other lines
      cleanedLines.push(line);
    }

    return cleanedLines.join("\n");
  }

  /**
   * Generate test harness Go code with user function
   */
  private generateGoTestCode(
    userCode: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata,
  ): string {
    const cleanedUserCode = this.cleanGoUserCode(userCode);

    // Generate individual test case execution
    const testCaseExecutions = testCases
      .map((testCase, index) => {
        const inputs = Array.isArray(testCase.input)
          ? testCase.input
          : [testCase.input];
        const expected = testCase.expected;

        // Generate function call with proper type casting
        const functionCall = this.generateFunctionCall(metadata, inputs, index);

        return `
  // Test case ${index + 1}
  {
    var result interface{}
    var err error
    
    ${functionCall}
    
    testResult := TestResult{
      Passed: false,
      Expected: ${JSON.stringify(expected)},
      Actual: result,
      Error: "",
    }
    
    if err != nil {
      testResult.Error = err.Error()
    } else {
      // Compare results
      if compareValues(result, testResult.Expected) {
        testResult.Passed = true
      }
    }
    
    results = append(results, testResult)
  }`;
      })
      .join("\n");

    return `
package main

import (
  "encoding/json"
  "fmt"
  "os"
  "reflect"
)

type TestResult struct {
  Passed   bool        \`json:"passed"\`
  Expected interface{} \`json:"expected"\`
  Actual   interface{} \`json:"actual"\`
  Error    string      \`json:"error"\`
}

// User code
${cleanedUserCode}

// Helper function to compare values
func compareValues(actual, expected interface{}) bool {
  // Handle different numeric types
  if isNumeric(actual) && isNumeric(expected) {
    return fmt.Sprintf("%v", actual) == fmt.Sprintf("%v", expected)
  }
  
  // Use reflect for deep comparison
  return reflect.DeepEqual(actual, expected)
}

func isNumeric(v interface{}) bool {
  switch v.(type) {
  case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
    return true
  default:
    return false
  }
}

func main() {
  results := []TestResult{}
  
  ${testCaseExecutions}
  
  // Output results as JSON
  output, err := json.Marshal(results)
  if err != nil {
    fmt.Printf("Error marshaling results: %v", err)
    os.Exit(1)
  }
  
  fmt.Print(string(output))
}`;
  }

  /**
   * Generate function call with proper type casting
   */
  private generateFunctionCall(
    metadata: ChallengeMetadata,
    inputs: any[],
    // eslint-disable-next-line no-unused-vars
    _testIndex: number,
  ): string {
    const { functionName, parameterTypes } = metadata;

    if (inputs.length === 0) {
      return `result = ${functionName}()`;
    }

    // Generate type-specific argument casting
    const args = inputs
      .map((input, i) => {
        const paramType = parameterTypes[i] || "interface{}";
        const value = JSON.stringify(input);

        switch (paramType.toLowerCase()) {
          case "int":
            return typeof input === "number"
              ? input.toString()
              : `int(${value})`;
          case "string":
            return value;
          case "float64":
          case "float32":
            return typeof input === "number"
              ? input.toString()
              : `float64(${value})`;
          case "bool":
            return typeof input === "boolean"
              ? input.toString()
              : `bool(${value})`;
          default:
            return value;
        }
      })
      .join(", ");

    return `result = ${functionName}(${args})`;
  }

  /**
   * Execute Go code with test cases using native Go runtime
   */
  private async executeGoCode(
    goCode: string,
    timeoutMs: number,
  ): Promise<GoExecutionResult> {
    const startTime = Date.now();

    console.log(`🏗️  Starting Go execution with ${timeoutMs}ms timeout`);

    // Create unique execution directory
    const execDir = await fs.mkdtemp(path.join(os.tmpdir(), "go-native-"));
    console.log(`📁 Created execution directory: ${execDir}`);

    try {
      // Write Go code to main.go
      const mainFile = path.join(execDir, "main.go");
      await fs.writeFile(mainFile, goCode);
      console.log(`📝 Written Go code to ${mainFile} (${goCode.length} chars)`);

      // Initialize Go module
      console.log(`🔧 Initializing Go module...`);
      const initStartTime = Date.now();
      const initResult = await this.runCommand(
        "go",
        ["mod", "init", "solution"],
        execDir,
        10000,
      ); // 10s for init
      const initDuration = Date.now() - initStartTime;
      console.log(
        `🔧 Go module init completed in ${initDuration}ms (success: ${initResult.success})`,
      );

      if (!initResult.success) {
        return {
          success: false,
          output: "",
          error: `Go module initialization failed: ${initResult.error}`,
          duration: Date.now() - startTime,
          exitCode: initResult.exitCode,
        };
      }

      // Execute go run main.go
      console.log(`🚀 Starting Go compilation and execution...`);
      const runStartTime = Date.now();
      const runResult = await this.runCommand(
        "go",
        ["run", "main.go"],
        execDir,
        timeoutMs - initDuration,
      );
      const runDuration = Date.now() - runStartTime;
      console.log(
        `🚀 Go run completed in ${runDuration}ms (success: ${runResult.success})`,
      );

      if (!runResult.success && runResult.error?.includes("timed out")) {
        console.error(`⏰ Go execution timed out after ${runDuration}ms`);
        console.error(
          `📊 Timing breakdown: Init=${initDuration}ms, Run=${runDuration}ms, Total=${Date.now() - startTime}ms`,
        );
      }

      return {
        success: runResult.success,
        output: runResult.output,
        error: runResult.error,
        duration: Date.now() - startTime,
        exitCode: runResult.exitCode,
      };
    } finally {
      // Clean up execution directory
      try {
        await fs.rm(execDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Failed to cleanup directory ${execDir}:`, cleanupError);
      }
    }
  }

  /**
   * Run a command with timeout and capture output
   */
  private async runCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<{
    success: boolean;
    output: string;
    error?: string;
    exitCode: number;
  }> {
    return new Promise((resolve) => {
      // Set Go environment variables for optimal performance
      const env: Record<string, string> = {
        ...process.env,
        GOCACHE:
          process.env.GOCACHE || path.join(os.tmpdir(), "codequest-gocache"),
        GOMODCACHE:
          process.env.GOMODCACHE ||
          path.join(os.tmpdir(), "codequest-gomodcache"),
        GO111MODULE: "on", // Ensure module mode is enabled
        CGO_ENABLED: "0", // Disable CGO for faster compilation and better portability
        GOPROXY: "direct", // Use direct mode to avoid proxy delays
        GOSUMDB: "off", // Disable checksum database for faster builds
      };

      console.log(
        `🔨 Running: ${command} ${args.join(" ")} (timeout: ${timeoutMs}ms)`,
      );
      console.log(`📂 Working directory: ${cwd}`);
      console.log(
        `🌍 Environment: GOCACHE=${env.GOCACHE}, GO111MODULE=${env.GO111MODULE}, CGO_ENABLED=${env.CGO_ENABLED}`,
      );

      const childProcess = spawn(command, args, { cwd, env });

      let stdout = "";
      let stderr = "";
      let timeoutId: ReturnType<typeof setTimeout>;
      let isResolved = false;

      const resolveOnce = (result: any) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      };

      // Set timeout
      timeoutId = setTimeout(() => {
        childProcess.kill("SIGKILL");
        resolveOnce({
          success: false,
          output: stdout,
          error: `Command timed out after ${timeoutMs}ms`,
          exitCode: 124,
        });
      }, timeoutMs);

      childProcess.stdout?.on("data", (data: any) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on("data", (data: any) => {
        stderr += data.toString();
      });

      childProcess.on("close", (code: number | null) => {
        const success = code === 0;
        resolveOnce({
          success,
          output: stdout,
          error: success
            ? undefined
            : stderr || `Process exited with code ${code}`,
          exitCode: code || 0,
        });
      });

      childProcess.on("error", (error: Error) => {
        resolveOnce({
          success: false,
          output: stdout,
          error: error.message,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Process execution results and convert to platform format
   */
  private processResults(
    goResult: GoExecutionResult,
    testCases: TestCase[],
  ): SubmissionResult {
    try {
      if (!goResult.success) {
        const errorMessage = goResult.error?.includes("missing return")
          ? "Function is missing return statement. Make sure your function returns a value."
          : goResult.error?.includes("syntax error")
            ? "Syntax error in your Go code. Please check your code for errors."
            : goResult.error?.includes("build failed") ||
                goResult.error?.includes("compilation")
              ? "Go compilation failed. Please check your code for errors."
              : `Go execution error: ${goResult.error || "Unknown error"}`;

        return {
          success: false,
          results: testCases.map((testCase) => ({
            passed: false,
            error: `${errorMessage}\nOutput: ${goResult.output}`,
            testCase,
            executionTime: goResult.duration,
            memoryUsed: 0,
          })),
          metrics: {
            totalTime: goResult.duration,
            totalMemory: 0,
            passedTests: 0,
            totalTests: testCases.length,
          },
        };
      }

      // Parse JSON results from Go program
      let testResults;
      try {
        testResults = JSON.parse(goResult.output);
      } catch (parseError) {
        return {
          success: false,
          results: testCases.map((testCase) => ({
            passed: false,
            error: `Failed to parse test results: ${parseError}\nOutput: ${goResult.output}`,
            testCase,
            executionTime: goResult.duration,
            memoryUsed: 0,
          })),
          metrics: {
            totalTime: goResult.duration,
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
          executionTime: goResult.duration / testCases.length,
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
          totalTime: goResult.duration,
          totalMemory: 0,
          passedTests: passedCount,
          totalTests: testCases.length,
        },
      };
    } catch (error) {
      console.error("Error processing native Go results:", error);
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

  /**
   * Main execution method for Go challenges
   */
  async executeGo(
    code: string,
    testCases: TestCase[],
    metadata: ChallengeMetadata,
  ): Promise<SubmissionResult> {
    try {
      console.log("🚀 Native Go Executor: Starting execution");
      const startTime = Date.now();

      // Check Go availability
      const goAvailable = await this.checkGoAvailability();
      if (!goAvailable) {
        throw new Error(
          "Go runtime not available on system. Please install Go or use Docker executor.",
        );
      }

      // Generate test harness code
      const testCode = this.generateGoTestCode(code, testCases, metadata);
      console.log(`Generated test code (${testCode.length} chars)`);

      // Execute the code
      const goResult = await this.executeGoCode(testCode, this.TIMEOUT_MS);

      const totalTime = Date.now() - startTime;
      console.log(
        `🎯 Native Go Executor: Completed in ${totalTime}ms (${goResult.success ? "SUCCESS" : "FAILED"})`,
      );

      return this.processResults(goResult, testCases);
    } catch (error) {
      console.error("Native Go execution error:", error);

      return {
        success: false,
        results: testCases.map((testCase) => ({
          passed: false,
          error:
            error instanceof Error
              ? error.message
              : "Native Go execution failed",
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
    }
  }

  /**
   * Check if native Go execution is available
   */
  async isAvailable(): Promise<boolean> {
    return this.checkGoAvailability();
  }
}
