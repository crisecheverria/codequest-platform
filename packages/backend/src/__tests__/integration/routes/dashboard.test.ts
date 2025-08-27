import request from "supertest";
import { app } from "../../../index";
import { UserModel } from "../../../models/User";
import { ChallengeModel } from "../../../models/Challenge";
import { clearDatabase } from "../../../test-utils/database";
import jwt from "jsonwebtoken";
import { config } from "../../../config";

describe("Dashboard API Integration Tests", () => {
  let testUser: any;
  let authToken: string;
  let testChallenge: any;

  beforeEach(async () => {
    await clearDatabase();

    // Create test challenge
    testChallenge = await ChallengeModel.create({
      title: "Test Challenge",
      slug: "test-challenge",
      description: "Test challenge for dashboard",
      difficulty: "easy",
      language: "typescript",
      functionName: "testFunction",
      parameterTypes: ["number"],
      returnType: "number",
      template: "function testFunction(n: number): number {\n  // Write your code here\n}",
      testCases: [
        {
          input: [5],
          expected: 10,
          description: "should double the input"
        }
      ],
      conceptTags: ["variables"],
      timeLimit: 5000,
      memoryLimit: 128
    });

    // Create test user with submissions
    testUser = await UserModel.create({
      githubId: "12345",
      username: "testuser",
      email: "test@example.com",
      completedChallenges: ["test-challenge"],
      submissions: [
        {
          challengeSlug: "test-challenge",
          code: "function testFunction(n) { return n * 2; }",
          language: "typescript",
          status: "passed",
          timestamp: new Date("2023-01-15T10:00:00Z"),
          results: {
            passed: 1,
            failed: 0,
            total: 1,
            details: []
          }
        },
        {
          challengeSlug: "test-challenge",
          code: "function testFunction(n) { return n; }",
          language: "typescript",
          status: "failed",
          timestamp: new Date("2023-01-14T10:00:00Z"),
          results: {
            passed: 0,
            failed: 1,
            total: 1,
            details: []
          }
        }
      ]
    });

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser._id.toString(), githubId: testUser.githubId },
      config.jwt.secret,
      { expiresIn: "1h" }
    );
  });

  describe("GET /api/dashboard/stats", () => {
    it("should return dashboard statistics for authenticated user", async () => {
      const response = await request(app)
        .get("/api/dashboard/stats")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("totalChallenges");
      expect(response.body).toHaveProperty("completedChallenges");
      expect(response.body).toHaveProperty("totalSubmissions");
      expect(response.body).toHaveProperty("successRate");
      expect(response.body).toHaveProperty("submissionsByLanguage");
      expect(response.body).toHaveProperty("recentSubmissions");

      // Verify statistics values
      expect(response.body.totalChallenges).toBe(1);
      expect(response.body.completedChallenges).toBe(1);
      expect(response.body.totalSubmissions).toBe(2);
      expect(response.body.successRate).toBe(50); // 1 passed out of 2 submissions
      expect(response.body.submissionsByLanguage).toEqual({ typescript: 2 });
      expect(Array.isArray(response.body.recentSubmissions)).toBe(true);
      expect(response.body.recentSubmissions).toHaveLength(2);
    });

    it("should return correct recent submissions with challenge data", async () => {
      const response = await request(app)
        .get("/api/dashboard/stats")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      const recentSubmissions = response.body.recentSubmissions;
      expect(recentSubmissions).toHaveLength(2);
      
      // Should be sorted by timestamp (newest first)
      expect(new Date(recentSubmissions[0].timestamp).getTime())
        .toBeGreaterThan(new Date(recentSubmissions[1].timestamp).getTime());
      
      // Should include challenge data
      expect(recentSubmissions[0]).toHaveProperty("challenge");
      expect(recentSubmissions[0].challenge.title).toBe("Test Challenge");
      expect(recentSubmissions[0].challenge.slug).toBe("test-challenge");
    });

    it("should handle user with no submissions", async () => {
      // Create user without submissions
      const userWithoutSubmissions = await UserModel.create({
        githubId: "67890",
        username: "emptyuser",
        email: "empty@example.com",
        completedChallenges: [],
        submissions: []
      });

      const emptyUserToken = jwt.sign(
        { userId: userWithoutSubmissions._id.toString(), githubId: userWithoutSubmissions.githubId },
        config.jwt.secret,
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .get("/api/dashboard/stats")
        .set("Authorization", `Bearer ${emptyUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalChallenges).toBe(1);
      expect(response.body.completedChallenges).toBe(0);
      expect(response.body.totalSubmissions).toBe(0);
      expect(response.body.successRate).toBe(0);
      expect(response.body.submissionsByLanguage).toEqual({});
      expect(response.body.recentSubmissions).toEqual([]);
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/dashboard/stats");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Authentication required");
    });

    it("should handle invalid token", async () => {
      const response = await request(app)
        .get("/api/dashboard/stats")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid token");
    });
  });

  describe("GET /api/dashboard/submissions", () => {
    it("should return user submissions with challenge data", async () => {
      const response = await request(app)
        .get("/api/dashboard/submissions")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);

      // Should be sorted by timestamp (newest first)
      // Access timestamp from the Mongoose document's _doc property
      const firstTimestamp = new Date(response.body[0]._doc.timestamp).getTime();
      const secondTimestamp = new Date(response.body[1]._doc.timestamp).getTime();
      
      expect(firstTimestamp).toBeGreaterThan(secondTimestamp);

      // Should include challenge data
      expect(response.body[0]).toHaveProperty("challenge");
      expect(response.body[0].challenge.title).toBe("Test Challenge");
      expect(response.body[0].challenge.difficulty).toBe("easy");
      expect(response.body[0].challenge.language).toBe("typescript");
    });

    it("should return empty array for user with no submissions", async () => {
      // Create user without submissions
      const userWithoutSubmissions = await UserModel.create({
        githubId: "67890",
        username: "emptyuser",
        email: "empty@example.com",
        submissions: []
      });

      const emptyUserToken = jwt.sign(
        { userId: userWithoutSubmissions._id.toString(), githubId: userWithoutSubmissions.githubId },
        config.jwt.secret,
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .get("/api/dashboard/submissions")
        .set("Authorization", `Bearer ${emptyUserToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it("should handle non-existent user gracefully", async () => {
      // Create token for non-existent user
      const fakeToken = jwt.sign(
        { userId: "507f1f77bcf86cd799439011", githubId: "fake" },
        config.jwt.secret,
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .get("/api/dashboard/submissions")
        .set("Authorization", `Bearer ${fakeToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("User not found");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/dashboard/submissions");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Authentication required");
    });

    it("should handle invalid token", async () => {
      const response = await request(app)
        .get("/api/dashboard/submissions")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid token");
    });
  });
});
