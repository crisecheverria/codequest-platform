import request from "supertest";
import { app } from "../../../index";

describe("Health API Integration Tests", () => {
  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });

    it("should have correct content type", async () => {
      const response = await request(app).get("/api/health");
      
      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    it("should respond quickly", async () => {
      const startTime = Date.now();
      const response = await request(app).get("/api/health");
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(100); // Should respond in under 100ms
    });
  });
});
