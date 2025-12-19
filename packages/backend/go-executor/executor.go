package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type TestCase struct {
	Input       []interface{} `json:"input"`
	Expected    interface{}   `json:"expected"`
	Description string        `json:"description"`
}

type TestResult struct {
	Passed      bool        `json:"passed"`
	Error       string      `json:"error,omitempty"`
	Expected    interface{} `json:"expected"`
	Actual      interface{} `json:"actual,omitempty"`
	Description string      `json:"description"`
}

type ExecutionMetadata struct {
	FunctionName   string   `json:"functionName"`
	ParameterTypes []string `json:"parameterTypes"`
	ReturnType     string   `json:"returnType"`
}

func main() {
	if len(os.Args) < 4 {
		fmt.Fprintf(os.Stderr, "Usage: %s <user-code-file> <test-cases-file> <metadata-file>\n", os.Args[0])
		os.Exit(1)
	}

	userCodeFile := os.Args[1]
	testCasesFile := os.Args[2]
	metadataFile := os.Args[3]

	// Read user code
	userCode, err := ioutil.ReadFile(userCodeFile)
	if err != nil {
		outputError(fmt.Sprintf("Failed to read user code: %v", err))
		return
	}

	// Read test cases
	testCasesData, err := ioutil.ReadFile(testCasesFile)
	if err != nil {
		outputError(fmt.Sprintf("Failed to read test cases: %v", err))
		return
	}

	var testCases []TestCase
	if err := json.Unmarshal(testCasesData, &testCases); err != nil {
		outputError(fmt.Sprintf("Failed to parse test cases: %v", err))
		return
	}

	// Read metadata
	metadataData, err := ioutil.ReadFile(metadataFile)
	if err != nil {
		outputError(fmt.Sprintf("Failed to read metadata: %v", err))
		return
	}

	var metadata ExecutionMetadata
	if err := json.Unmarshal(metadataData, &metadata); err != nil {
		outputError(fmt.Sprintf("Failed to parse metadata: %v", err))
		return
	}

	// Execute user code
	results := executeCode(string(userCode), testCases, metadata)
	outputResults(results)
}

func executeCode(userCode string, testCases []TestCase, metadata ExecutionMetadata) []TestResult {
	// Use a more predictable temp directory location to leverage volume mounts
	tmpDir := "/tmp/go-exec"
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Failed to create temp dir: %v", err),
		}}
	}
	defer os.RemoveAll(tmpDir)

	// Clean user code (remove package and imports)
	cleanedCode := cleanUserCode(userCode)

	// Generate optimized test executable
	executableCode := generateExecutableCode(cleanedCode, testCases, metadata)

	codeFile := filepath.Join(tmpDir, "main.go")
	if err := ioutil.WriteFile(codeFile, []byte(executableCode), 0644); err != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Failed to write code file: %v", err),
		}}
	}

	// Build executable with optimizations for faster compilation
	execPath := filepath.Join(tmpDir, "test-exec")

	// Set shorter timeout for builds since cache should be warm
	buildTimeout := 15 * time.Second
	buildCtx, buildCancel := context.WithTimeout(context.Background(), buildTimeout)
	defer buildCancel()

	buildCmd := exec.CommandContext(buildCtx, "go", "build", "-ldflags", "-s -w", "-o", execPath, codeFile)
	buildCmd.Env = append(os.Environ(),
		"CGO_ENABLED=0",
		"GOCACHE=/go/cache",      // Use persistent cache from volume mount
		"GOMODCACHE=/go/pkg/mod", // Use persistent module cache
		"GOPROXY=direct",         // Skip proxy for faster local builds
		"GOSUMDB=off",            // Skip checksum verification for speed
	)

	if output, err := buildCmd.CombinedOutput(); err != nil {
		if buildCtx.Err() == context.DeadlineExceeded {
			return []TestResult{{
				Passed: false,
				Error:  fmt.Sprintf("Compilation timeout after %v\nPartial output: %s", buildTimeout, string(output)),
			}}
		}
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Compilation failed: %v\nOutput: %s", err, string(output)),
		}}
	}

	// Execute the binary with timeout
	execTimeout := 10 * time.Second // Increased from 5s for complex test cases

	// Create context with timeout for cleaner cancellation
	ctx, cancel := context.WithTimeout(context.Background(), execTimeout)
	defer cancel()

	execCmd := exec.CommandContext(ctx, execPath)
	execCmd.Dir = tmpDir

	// Execute with timeout
	output, execErr := execCmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Execution timeout after %v", execTimeout),
		}}
	}

	if execErr != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Execution failed: %v\nOutput: %s", execErr, string(output)),
		}}
	}

	// Parse results
	var results []TestResult
	if err := json.Unmarshal(output, &results); err != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Failed to parse results: %v\nOutput: %s", err, string(output)),
		}}
	}

	return results
}

func cleanUserCode(code string) string {
	lines := strings.Split(code, "\n")
	var cleanedLines []string

	inImportBlock := false
	inMainFunction := false
	braceCount := 0

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Skip package declarations
		if strings.HasPrefix(trimmed, "package ") {
			continue
		}

		// Skip imports (executor provides its own imports)
		if strings.HasPrefix(trimmed, "import ") && !strings.Contains(trimmed, "(") {
			continue
		}

		if strings.HasPrefix(trimmed, "import (") {
			inImportBlock = true
			continue
		}

		if inImportBlock {
			if trimmed == ")" {
				inImportBlock = false
			}
			continue
		}

		// Skip user's main function
		if strings.HasPrefix(trimmed, "func main(") {
			inMainFunction = true
			braceCount = 0
			// Count opening brace on the same line
			for _, r := range line {
				if r == '{' {
					braceCount++
				}
			}
			if braceCount == 0 {
				// No opening brace on same line, need to find it
				continue
			}
		}

		if inMainFunction {
			// Count braces to know when main function ends
			for _, r := range line {
				if r == '{' {
					braceCount++
				} else if r == '}' {
					braceCount--
				}
			}

			if braceCount <= 0 {
				inMainFunction = false
			}
			continue
		}

		cleanedLines = append(cleanedLines, line)
	}

	// Remove empty lines at the beginning and end
	for len(cleanedLines) > 0 && strings.TrimSpace(cleanedLines[0]) == "" {
		cleanedLines = cleanedLines[1:]
	}
	for len(cleanedLines) > 0 && strings.TrimSpace(cleanedLines[len(cleanedLines)-1]) == "" {
		cleanedLines = cleanedLines[:len(cleanedLines)-1]
	}

	return strings.Join(cleanedLines, "\n")
}

func generateExecutableCode(userCode string, testCases []TestCase, metadata ExecutionMetadata) string {
	testCasesCode := generateTestCasesCode(testCases, metadata.FunctionName)

	return fmt.Sprintf(`package main

import (
	"encoding/json"
	"fmt"
	"reflect"
)

type TestResult struct {
	Passed      bool        `+"`json:\"passed\"`"+`
	Error       string      `+"`json:\"error,omitempty\"`"+`
	Expected    interface{} `+"`json:\"expected\"`"+`
	Actual      interface{} `+"`json:\"actual,omitempty\"`"+`
	Description string      `+"`json:\"description\"`"+`
}

%s

func main() {
	results := []TestResult{}
	
	%s
	
	jsonOutput, _ := json.Marshal(results)
	fmt.Println(string(jsonOutput))
}`, userCode, testCasesCode)
}

func generateTestCasesCode(testCases []TestCase, functionName string) string {
	var testCode strings.Builder

	for testCaseIndex, testCase := range testCases {
		// Convert inputs to Go code
		var inputs []string
		for _, input := range testCase.Input {
			switch v := input.(type) {
			case string:
				inputs = append(inputs, fmt.Sprintf(`"%s"`, v))
			case float64:
				if v == float64(int(v)) {
					inputs = append(inputs, fmt.Sprintf("%d", int(v)))
				} else {
					inputs = append(inputs, fmt.Sprintf("%g", v))
				}
			case bool:
				inputs = append(inputs, fmt.Sprintf("%t", v))
			case []interface{}:
				// Handle arrays
				var arrayElements []string
				for _, elem := range v {
					switch e := elem.(type) {
					case float64:
						if e == float64(int(e)) {
							arrayElements = append(arrayElements, fmt.Sprintf("%d", int(e)))
						} else {
							arrayElements = append(arrayElements, fmt.Sprintf("%g", e))
						}
					case string:
						arrayElements = append(arrayElements, fmt.Sprintf(`"%s"`, e))
					default:
						arrayElements = append(arrayElements, fmt.Sprintf("%v", e))
					}
				}
				inputs = append(inputs, fmt.Sprintf("[]int{%s}", strings.Join(arrayElements, ", ")))
			default:
				inputs = append(inputs, fmt.Sprintf("%v", v))
			}
		}

		// Convert expected output
		var expected string
		switch v := testCase.Expected.(type) {
		case string:
			expected = fmt.Sprintf(`"%s"`, v)
		case float64:
			if v == float64(int(v)) {
				expected = fmt.Sprintf("%d", int(v))
			} else {
				expected = fmt.Sprintf("%g", v)
			}
		case bool:
			expected = fmt.Sprintf("%t", v)
		case []interface{}:
			var arrayElements []string
			for _, elem := range v {
				switch e := elem.(type) {
				case float64:
					if e == float64(int(e)) {
						arrayElements = append(arrayElements, fmt.Sprintf("%d", int(e)))
					} else {
						arrayElements = append(arrayElements, fmt.Sprintf("%g", e))
					}
				case string:
					arrayElements = append(arrayElements, fmt.Sprintf(`"%s"`, e))
				default:
					arrayElements = append(arrayElements, fmt.Sprintf("%v", e))
				}
			}
			expected = fmt.Sprintf("[]int{%s}", strings.Join(arrayElements, ", "))
		default:
			expected = fmt.Sprintf("%v", v)
		}

		testCode.WriteString(fmt.Sprintf(`
	// Test case %d: %s
	{
		expected := %s
		actual := %s(%s)
		result := TestResult{
			Expected:    expected,
			Actual:      actual,
			Description: "%s",
		}
		
		if reflect.DeepEqual(actual, expected) {
			result.Passed = true
		} else {
			result.Passed = false
			result.Error = fmt.Sprintf("Expected %%v, got %%v", expected, actual)
		}
		
		results = append(results, result)
	}
`, testCaseIndex+1, testCase.Description, expected, functionName, strings.Join(inputs, ", "), testCase.Description))
	}

	return testCode.String()
}

func outputResults(results []TestResult) {
	output, _ := json.Marshal(results)
	fmt.Println(string(output))
}

func outputError(message string) {
	result := []TestResult{{
		Passed: false,
		Error:  message,
	}}
	output, _ := json.Marshal(result)
	fmt.Println(string(output))
}
