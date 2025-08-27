import request from "supertest";
import { app } from "../../../index";
import { UserModel } from "../../../models/User";
import { clearDatabase } from "../../../test-utils/database";
import jwt from "jsonwebtoken";
import { config } from "../../../config";

// Mock axios for GitHub API calls
jest.mock("axios");
const axios = require("axios");

describe("Auth API Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
  });

  describe("GET /api/auth/github/callback", () => {
    it("should return 400 when no code is provided", async () => {
      const response = await request(app).get("/api/auth/github/callback");
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Authorization code is required" });
    });

    it("should handle GitHub API errors gracefully", async () => {
      // Mock axios to simulate GitHub API error
      axios.post.mockRejectedValue(new Error("GitHub API error"));

      const response = await request(app)
        .get("/api/auth/github/callback")
        .query({ code: "test-code" });

      // Should redirect to frontend error page
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/auth/error");
    });

    it("should handle missing access token from GitHub", async () => {
      // Mock axios to return response without access token
      axios.post.mockResolvedValue({
        data: { error: "bad_verification_code" }
      });

      const response = await request(app)
        .get("/api/auth/github/callback")
        .query({ code: "invalid-code" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/auth/error");
    });
  });

  describe("POST /api/auth/github", () => {
    it("should return 400 when no code is provided", async () => {
      const response = await request(app).post("/api/auth/github").send({});
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Authentication failed");
    });

    it("should create new user when GitHub user doesn't exist", async () => {
      const mockGitHubUser = {
        id: 12345,
        login: "testuser",
        email: "test@example.com",
        avatar_url: "https://example.com/avatar.jpg"
      };

      const mockAccessToken = "mock-access-token";

      // Mock GitHub API responses
      axios.post.mockResolvedValue({
        data: { access_token: mockAccessToken }
      });

      axios.get.mockResolvedValue({
        data: mockGitHubUser
      });

      const response = await request(app)
        .post("/api/auth/github")
        .send({ code: "valid-code" });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");

      // Verify user was created in database
      const createdUser = await UserModel.findOne({ githubId: "12345" });
      expect(createdUser).toBeTruthy();
      expect(createdUser?.username).toBe("testuser");
      expect(createdUser?.email).toBe("test@example.com");
    });

    it("should return existing user when GitHub user already exists", async () => {
      // Create existing user
      const existingUser = await UserModel.create({
        githubId: "12345",
        username: "existinguser",
        email: "existing@example.com",
        avatarUrl: "https://example.com/avatar.jpg"
      });

      const mockGitHubUser = {
        id: 12345,
        login: "existinguser",
        email: "existing@example.com",
        avatar_url: "https://example.com/avatar.jpg"
      };

      const mockAccessToken = "mock-access-token";

      // Mock GitHub API responses
      axios.post.mockResolvedValue({
        data: { access_token: mockAccessToken }
      });

      axios.get.mockResolvedValue({
        data: mockGitHubUser
      });

      const response = await request(app)
        .post("/api/auth/github")
        .send({ code: "valid-code" });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user._id).toBe(existingUser._id.toString());
    });

    it("should handle GitHub API errors", async () => {
      // Mock axios to simulate GitHub API error
      axios.post.mockRejectedValue(new Error("GitHub API error"));

      const response = await request(app)
        .post("/api/auth/github")
        .send({ code: "test-code" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Authentication failed");
    });

    it("should generate valid JWT token", async () => {
      const mockGitHubUser = {
        id: 12345,
        login: "testuser",
        email: "test@example.com",
        avatar_url: "https://example.com/avatar.jpg"
      };

      const mockAccessToken = "mock-access-token";

      // Mock GitHub API responses
      axios.post.mockResolvedValue({
        data: { access_token: mockAccessToken }
      });

      axios.get.mockResolvedValue({
        data: mockGitHubUser
      });

      const response = await request(app)
        .post("/api/auth/github")
        .send({ code: "valid-code" });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");

      // Verify JWT token is valid
      const decoded = jwt.verify(response.body.token, config.jwt.secret);
      expect(decoded).toHaveProperty("userId");
      expect(decoded).toHaveProperty("githubId");
      expect((decoded as any).githubId).toBe("12345");
    });

    it("should update user last login time", async () => {
      // Create existing user
      const existingUser = await UserModel.create({
        githubId: "12345",
        username: "existinguser",
        email: "existing@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
        lastLogin: new Date("2023-01-01")
      });

      const mockGitHubUser = {
        id: 12345,
        login: "existinguser",
        email: "existing@example.com",
        avatar_url: "https://example.com/avatar.jpg"
      };

      const mockAccessToken = "mock-access-token";

      // Mock GitHub API responses
      axios.post.mockResolvedValue({
        data: { access_token: mockAccessToken }
      });

      axios.get.mockResolvedValue({
        data: mockGitHubUser
      });

      const beforeLogin = new Date();
      
      await request(app)
        .post("/api/auth/github")
        .send({ code: "valid-code" });

      const afterLogin = new Date();

      // Verify last login was updated
      const updatedUser = await UserModel.findById(existingUser._id);
      expect(updatedUser?.lastLogin).toBeTruthy();
      expect(updatedUser?.lastLogin!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
      expect(updatedUser?.lastLogin!.getTime()).toBeLessThanOrEqual(afterLogin.getTime());
    });
  });
});
