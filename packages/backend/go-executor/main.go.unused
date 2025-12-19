package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
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

type ExecutionRequest struct {
	UserCode     string     `json:"userCode"`
	TestCases    []TestCase `json:"testCases"`
	FunctionName string     `json:"functionName"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s <request-file>\n", os.Args[0])
		os.Exit(1)
	}

	requestFile := os.Args[1]
	data, err := ioutil.ReadFile(requestFile)
	if err != nil {
		outputError(fmt.Sprintf("Failed to read request file: %v", err))
		return
	}

	var req ExecutionRequest
	if err := json.Unmarshal(data, &req); err != nil {
		outputError(fmt.Sprintf("Failed to parse request: %v", err))
		return
	}

	results := executeUserCode(req)
	outputResults(results)
}

func executeUserCode(req ExecutionRequest) []TestResult {
	// Create temporary directory for plugin
	tmpDir, err := ioutil.TempDir("/tmp", "go-plugin-")
	if err != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Failed to create temp dir: %v", err),
		}}
	}
	defer os.RemoveAll(tmpDir)

	// Extract user function from code
	userFunc, err := extractUserFunction(req.UserCode, req.FunctionName)
	if err != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Failed to extract function: %v", err),
		}}
	}

	// Generate plugin source code
	pluginSource := generatePluginSource(userFunc, req.FunctionName)
	pluginFile := filepath.Join(tmpDir, "plugin.go")
	
	if err := ioutil.WriteFile(pluginFile, []byte(pluginSource), 0644); err != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Failed to write plugin: %v", err),
		}}
	}

	// Build plugin
	pluginPath := filepath.Join(tmpDir, "plugin.so")
	cmd := exec.Command("go", "build", "-buildmode=plugin", "-o", pluginPath, pluginFile)
	cmd.Env = append(os.Environ(), "CGO_ENABLED=1") // Required for plugins
	
	if output, err := cmd.CombinedOutput(); err != nil {
		return []TestResult{{
			Passed: false,
			Error:  fmt.Sprintf("Compilation failed: %v\nOutput: %s", err, string(output)),
		}}
	}

	// Load and execute plugin
	return loadAndExecutePlugin(pluginPath, req.TestCases, req.FunctionName)
}

func extractUserFunction(code, functionName string) (string, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "", code, parser.ParseComments)
	if err != nil {
		return "", fmt.Errorf("parse error: %v", err)
	}

	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok {
			if fn.Name.Name == functionName {
				start := fset.Position(fn.Pos()).Offset
				end := fset.Position(fn.End()).Offset
				return code[start:end], nil
			}
		}
	}

	return "", fmt.Errorf("function %s not found", functionName)
}

func generatePluginSource(userFunc, functionName string) string {
	return fmt.Sprintf(`package main

import (
	"encoding/json"
	"fmt"
	"reflect"
)

// User's function
%s

// Plugin exports
func ExecuteFunction(inputsJSON string) (string, error) {
	var inputs []interface{}
	if err := json.Unmarshal([]byte(inputsJSON), &inputs); err != nil {
		return "", err
	}
	
	// Call user function with proper type conversion
	result := callUserFunction(inputs)
	
	resultJSON, err := json.Marshal(result)
	return string(resultJSON), err
}

func callUserFunction(inputs []interface{}) interface{} {
	// This is a simplified version - in practice, you'd need proper type reflection
	// For now, handle common cases
	switch len(inputs) {
	case 0:
		return %s()
	case 1:
		return %s(convertInput(inputs[0]))
	case 2:
		return %s(convertInput(inputs[0]), convertInput(inputs[1]))
	default:
		return fmt.Sprintf("Unsupported number of parameters: %%d", len(inputs))
	}
}

func convertInput(input interface{}) interface{} {
	// Handle common type conversions
	switch v := input.(type) {
	case float64:
		// JSON numbers are float64, convert to int if needed
		if v == float64(int(v)) {
			return int(v)
		}
		return v
	default:
		return v
	}
}
`, userFunc, functionName, functionName, functionName)
}

func loadAndExecutePlugin(pluginPath string, testCases []TestCase, functionName string) []TestResult {
	// Since Go plugins have limitations, let's use a different approach:
	// Build a temporary executable instead
	return buildAndExecuteTemp(pluginPath, testCases, functionName)
}

func buildAndExecuteTemp(pluginDir string, testCases []TestCase, functionName string) []TestResult {
	// For simplicity, let's create a temporary executable approach
	// This is more reliable than plugins in containerized environments
	
	results := make([]TestResult, len(testCases))
	for i, testCase := range testCases {
		results[i] = TestResult{
			Expected:    testCase.Expected,
			Description: testCase.Description,
			Passed:      false,
			Error:       "Plugin execution not yet implemented - using fallback",
		}
	}
	
	return results
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