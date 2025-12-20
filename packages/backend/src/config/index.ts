import dotenv from "dotenv";
import { Secret } from "jsonwebtoken";
import path from "path";

dotenv.config();

// Define types for config object
interface DockerConfig {
  memory: string;
  cpuQuota: string;
  timeout: string | number;
  goTimeout: string | number;
  tempDir: string;
}

interface ExecutorConfig {
  useNativeGo: boolean;
  nativeGoTimeout: number;
}

interface AIAssistanceConfig {
  apiKey: string;
  apiEndpoint: string;
  useExternalApi: boolean;
}

interface AppConfig {
  port: string | number;
  mongoUri: string;
  environment: string;
  docker: DockerConfig;
  executor: ExecutorConfig;
  github: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  jwt: {
    secret: Secret;
    expiresIn: string;
  };
  aiAssistance: AIAssistanceConfig;
}

// Parse MongoDB credentials from environment variables
const getMongoUri = (): string => {
  // Get the base URI
  const baseUri =
    process.env.MONGODB_URI?.replace(/\s/g, "") ||
    "mongodb://localhost:27017/code-challenges";

  // Check if the URI already contains authentication (like MongoDB Atlas connection string)
  if (baseUri.includes("@") || baseUri.startsWith("mongodb+srv://")) {
    return baseUri;
  }

  // Check if we need to add authentication
  const username = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  // If no credentials provided, return the base URI
  if (!username || !password) {
    return baseUri;
  }

  // Add authentication to the URI
  const mongoUrl = new URL(baseUri);
  mongoUrl.username = encodeURIComponent(username);
  mongoUrl.password = encodeURIComponent(password);

  // Add auth source parameter if not already in the URI
  if (!mongoUrl.searchParams.has("authSource")) {
    mongoUrl.searchParams.append("authSource", authSource);
  }

  return mongoUrl.toString();
};

export const config: AppConfig = {
  port: process.env.PORT || 3001,
  mongoUri: getMongoUri(),
  environment: process.env.NODE_ENV || "development",
  docker: {
    memory:
      process.env.DOCKER_MEMORY_LIMIT ||
      (process.env.NODE_ENV === "production" ? "512m" : "256m"),
    cpuQuota:
      process.env.DOCKER_CPU_QUOTA ||
      (process.env.NODE_ENV === "production" ? "200000" : "100000"),
    timeout:
      process.env.DOCKER_TIMEOUT ||
      (process.env.NODE_ENV === "production" ? "60000" : "30000"),
    goTimeout:
      process.env.DOCKER_GO_TIMEOUT ||
      (process.env.NODE_ENV === "production" ? "120000" : "60000"),
    tempDir: process.env.RUNNER_TEMP_DIR || path.join(process.cwd(), "temp"),
  },
  executor: {
    useNativeGo: process.env.USE_NATIVE_GO_EXECUTOR === "true",
    nativeGoTimeout: parseInt(
      process.env.NATIVE_GO_TIMEOUT ||
        (process.env.NODE_ENV === "production" ? "90000" : "45000"),
      10,
    ),
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL ||
      "http://localhost:3001/api/auth/github/callback",
  },
  jwt: {
    secret: (process.env.JWT_SECRET || "your-secret-key") as Secret,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  aiAssistance: {
    apiKey: process.env.AI_API_KEY || "",
    apiEndpoint:
      process.env.AI_API_ENDPOINT ||
      "https://api.openai.com/v1/chat/completions",
    useExternalApi: process.env.USE_EXTERNAL_AI_API === "true",
  },
};
