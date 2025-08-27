import mongoose from "mongoose";
import { connectDB } from "../../../db";

// Mock mongoose
jest.mock("mongoose", () => ({
  connect: jest.fn(),
  connection: {
    on: jest.fn(),
  },
}));

describe("Database Connection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console methods
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("connectDB", () => {
    it("should connect to MongoDB successfully", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      mockConnect.mockResolvedValue(mongoose);

      await connectDB();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith("MongoDB connected successfully");
    });

    it("should use override URI when provided", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      mockConnect.mockResolvedValue(mongoose);

      const overrideUri = "mongodb://override:27017/test";
      await connectDB(overrideUri);

      expect(mockConnect).toHaveBeenCalledWith(overrideUri);
    });

    it("should trim the URI", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      mockConnect.mockResolvedValue(mongoose);

      const uriWithSpaces = "  mongodb://test:27017/db  ";
      await connectDB(uriWithSpaces);

      expect(mockConnect).toHaveBeenCalledWith("mongodb://test:27017/db");
    });

    it("should log URI with hidden credentials", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      mockConnect.mockResolvedValue(mongoose);

      const uriWithCredentials = "mongodb://user:password@localhost:27017/db";
      await connectDB(uriWithCredentials);

      expect(console.log).toHaveBeenCalledWith("MongoDB URI:", "mongodb://****:****@localhost:27017/db");
    });

    it("should log URI without credentials as is", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      mockConnect.mockResolvedValue(mongoose);

      const uriWithoutCredentials = "mongodb://localhost:27017/db";
      await connectDB(uriWithoutCredentials);

      expect(console.log).toHaveBeenCalledWith("MongoDB URI:", uriWithoutCredentials);
    });

    it("should set up connection event listeners", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      const mockOn = mongoose.connection.on as jest.MockedFunction<typeof mongoose.connection.on>;
      mockConnect.mockResolvedValue(mongoose);

      await connectDB();

      expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith("disconnected", expect.any(Function));
    });

    it("should handle connection errors", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      const connectionError = new Error("Connection failed");
      mockConnect.mockRejectedValue(connectionError);

      await expect(connectDB()).rejects.toThrow("Connection failed");
      expect(console.error).toHaveBeenCalledWith("MongoDB connection error:", connectionError);
    });

    it("should handle connection error events", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      const mockOn = mongoose.connection.on as jest.MockedFunction<typeof mongoose.connection.on>;
      mockConnect.mockResolvedValue(mongoose);

      await connectDB();

      // Get the error handler function
      const errorHandler = mockOn.mock.calls.find(call => call[0] === "error")?.[1];
      expect(errorHandler).toBeDefined();

      if (errorHandler) {
        const testError = new Error("Test connection error");
        errorHandler(testError);
        expect(console.error).toHaveBeenCalledWith("MongoDB connection error:", testError);
      }
    });

    it("should handle disconnection events", async () => {
      const mockConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;
      const mockOn = mongoose.connection.on as jest.MockedFunction<typeof mongoose.connection.on>;
      mockConnect.mockResolvedValue(mongoose);

      await connectDB();

      // Get the disconnected handler function
      const disconnectedHandler = mockOn.mock.calls.find(call => call[0] === "disconnected")?.[1];
      expect(disconnectedHandler).toBeDefined();

      if (disconnectedHandler) {
        disconnectedHandler();
        expect(console.log).toHaveBeenCalledWith("MongoDB disconnected");
      }
    });
  });
});
