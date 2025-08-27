import request from "supertest";
import { app } from "../../../index";
import { ConceptModel } from "../../../models/Concept";
import { ChallengeModel } from "../../../models/Challenge";
import { UserModel } from "../../../models/User";
import { clearDatabase } from "../../../test-utils/database";
import jwt from "jsonwebtoken";
import { config } from "../../../config";

describe("Learning API Integration Tests", () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    await clearDatabase();

    // Create test user
    testUser = await UserModel.create({
      githubId: "12345",
      username: "testuser",
      email: "test@example.com",
      completedChallenges: ["test-challenge-1", "test-challenge-2"]
    });

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser._id.toString(), githubId: testUser.githubId },
      config.jwt.secret,
      { expiresIn: "1h" }
    );

    // Create test concepts
    await ConceptModel.create([
      {
        name: "Variables",
        slug: "variables-ts",
        description: "Learn about variables",
        category: "fundamentals",
        language: "typescript",
        order: 1,
        resources: [
          {
            title: "Variables Guide",
            url: "https://example.com/variables",
            type: "documentation"
          }
        ]
      },
      {
        name: "Functions",
        slug: "functions-ts",
        description: "Learn about functions",
        category: "fundamentals",
        language: "typescript",
        order: 2,
        dependencies: ["variables-ts"],
        resources: [
          {
            title: "Functions Guide",
            url: "https://example.com/functions",
            type: "documentation"
          }
        ]
      }
    ]);

    // Create test challenges
    await ChallengeModel.create([
      {
        title: "Test Challenge 1",
        slug: "test-challenge-1",
        description: "First test challenge",
        difficulty: "easy",
        language: "typescript",
        functionName: "testFunction1",
        parameterTypes: ["number"],
        returnType: "number",
        template: "function testFunction1(n: number): number {\n  // Write your code here\n}",
        testCases: [
          {
            input: [5],
            expected: 10,
            description: "should double the input"
          }
        ],
        conceptTags: ["variables-ts"],
        timeLimit: 5000,
        memoryLimit: 128
      },
      {
        title: "Test Challenge 2",
        slug: "test-challenge-2",
        description: "Second test challenge",
        difficulty: "medium",
        language: "typescript",
        functionName: "testFunction2",
        parameterTypes: ["string"],
        returnType: "string",
        template: "function testFunction2(s: string): string {\n  // Write your code here\n}",
        testCases: [
          {
            input: ["hello"],
            expected: "HELLO",
            description: "should convert to uppercase"
          }
        ],
        conceptTags: ["functions-ts"],
        timeLimit: 5000,
        memoryLimit: 128
      },
      {
        title: "Test Challenge 3",
        slug: "test-challenge-3",
        description: "Third test challenge",
        difficulty: "hard",
        language: "typescript",
        functionName: "testFunction3",
        parameterTypes: ["number[]"],
        returnType: "number",
        template: "function testFunction3(arr: number[]): number {\n  // Write your code here\n}",
        testCases: [
          {
            input: [[1, 2, 3]],
            expected: 6,
            description: "should sum the array"
          }
        ],
        conceptTags: ["variables-ts", "functions-ts"],
        timeLimit: 5000,
        memoryLimit: 128
      }
    ]);
  });

  describe("GET /api/learning/path", () => {
    it("should return learning path for TypeScript", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "typescript" });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);

      // Check concepts
      expect(response.body[0].name).toBe("Variables");
      expect(response.body[1].name).toBe("Functions");

      // Check that concepts have challenges
      expect(response.body[0]).toHaveProperty("challenges");
      expect(response.body[1]).toHaveProperty("challenges");
    });

    it("should return learning path for all languages when no language specified", async () => {
      // Create a concept with language "all"
      await ConceptModel.create({
        name: "General Programming",
        slug: "general-programming",
        description: "General programming concepts",
        category: "fundamentals",
        language: "all",
        order: 3,
        resources: [
          {
            title: "General Guide",
            url: "https://example.com/general",
            type: "documentation"
          }
        ]
      });

      const response = await request(app).get("/api/learning/path");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // When no language is specified, it defaults to "all", which only returns concepts with language "all"
      expect(response.body).toHaveLength(1); // Only the "all" language concept
      
      // Should only include the "General Programming" concept since language defaults to "all"
      expect(response.body[0].name).toBe("General Programming");
      expect(response.body[0].language).toBe("all");
    });

    it("should include completion status for authenticated users", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "typescript" })
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Check that completed challenges are marked
      const variablesConcept = response.body.find((c: any) => c.name === "Variables");
      const completedChallenge = variablesConcept.challenges.find((c: any) => c.slug === "test-challenge-1");
      expect(completedChallenge.completed).toBe(true);

      const incompleteChallenge = variablesConcept.challenges.find((c: any) => c.slug === "test-challenge-3");
      expect(incompleteChallenge.completed).toBe(false);
    });

    it("should work without authentication (guest mode)", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "typescript" });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // All challenges should be marked as not completed for guests
      const variablesConcept = response.body.find((c: any) => c.name === "Variables");
      variablesConcept.challenges.forEach((challenge: any) => {
        expect(challenge.completed).toBe(false);
      });
    });

    it("should handle invalid language parameter gracefully", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "invalid-language" });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it("should return concepts in correct order", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "typescript" });

      expect(response.status).toBe(200);
      expect(response.body[0].order).toBe(1);
      expect(response.body[1].order).toBe(2);
    });

    it("should include concept dependencies", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "typescript" });

      expect(response.status).toBe(200);
      const functionsConcept = response.body.find((c: any) => c.name === "Functions");
      expect(functionsConcept.dependencies).toContain("variables-ts");
    });

    it("should organize challenges by concept tags", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "typescript" });

      expect(response.status).toBe(200);
      
      // Challenge 3 should appear in both concepts since it has both tags
      const variablesConcept = response.body.find((c: any) => c.name === "Variables");
      const functionsConcept = response.body.find((c: any) => c.name === "Functions");
      
      const challenge3InVariables = variablesConcept.challenges.find((c: any) => c.slug === "test-challenge-3");
      const challenge3InFunctions = functionsConcept.challenges.find((c: any) => c.slug === "test-challenge-3");
      
      expect(challenge3InVariables).toBeTruthy();
      expect(challenge3InFunctions).toBeTruthy();
    });

    it("should handle malformed authorization header gracefully", async () => {
      const response = await request(app)
        .get("/api/learning/path")
        .query({ language: "typescript" })
        .set("Authorization", "Bearer Invalid-Token");

      // The auth middleware returns 401 for invalid tokens
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid token");
    });
  });
});
