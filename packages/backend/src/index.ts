import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { connectDB } from "./db";
import { errorHandler } from "./middleware/errorHandler";
import challengeRoutes from "./routes/challenges";
import submissionRoutes from "./routes/submissions";
import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import healthRoutes from "./routes/health";
import learningRoutes from "./routes/learning";
import progressRoutes from "./routes/progress";
import aiAssistanceRoutes from "./routes/aiAssistance";
import certificatesRoutes from "./routes/certificates";
import leaderboardRoutes from "./routes/leaderboard";
import tutorialRoutes from "./routes/tutorials";

export const app: Express = express();
const port = config.port;
// Add startup logging
console.log("Starting application...");
console.log("Environment variables:", {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  // Log other non-sensitive env variables
});
// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://quest.cristianecheverria.com",
      "https://api.quest.cristianecheverria.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Conttent-Length", "ETag"],
  })
);
app.use(helmet());
app.use(express.json());

// Routes
app.use("/api", progressRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/ai-assistance", aiAssistanceRoutes);
app.use("/api", certificatesRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/tutorials", tutorialRoutes);

// Error handling
app.use(errorHandler);

// Function to start the server
const startServer = async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    // Connect to MongoDB
    await connectDB();
    console.log("MongoDB connected successfully");

    // Start the Express server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${config.environment}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};
if (require.main === module) {
// Start the server
startServer().catch((error) => {
  console.error("Startup error:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
  // Close server & exit process
    process.exit(1);
  });
}
