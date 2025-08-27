import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../../middleware/errorHandler";

describe("Error Handler Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    // Mock console.error
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("errorHandler", () => {
    it("should handle errors and return 500 status", () => {
      const testError = new Error("Test error message");
      testError.stack = "Error stack trace";

      errorHandler(testError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(console.error).toHaveBeenCalledWith("Error stack trace");
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: undefined, // NODE_ENV is not 'development' in test
      });
    });

    it("should include error message in development environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const testError = new Error("Test error message");

      errorHandler(testError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: "Test error message",
      });

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should handle errors without stack trace", () => {
      const testError = new Error("Test error message");
      delete testError.stack;

      errorHandler(testError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(console.error).toHaveBeenCalledWith(undefined);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it("should handle non-Error objects", () => {
      const testError = "String error" as any;

      errorHandler(testError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: undefined,
      });
    });

    it("should not call next function", () => {
      const testError = new Error("Test error message");

      errorHandler(testError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle errors with custom properties", () => {
      const testError = new Error("Test error message");
      (testError as any).customProperty = "custom value";

      errorHandler(testError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: undefined,
      });
    });
  });
});
