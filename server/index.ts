import { config } from "dotenv";
import path from "path";
import { Logger } from "../src/utils/logger.js";
import { APIServer } from "./server.js";

// Only load .env file if ENV_FILE is explicitly set (for local development)
if (process.env.ENV_FILE) {
  config({ path: path.resolve(process.cwd(), process.env.ENV_FILE) });
  console.log("Loading environment from file:", process.env.ENV_FILE);
} else {
  console.log("Using environment variables from system");
}

// Validate required environment variables
const requiredEnvVars = ["API_PRIVATE_KEY", "REGISTRY_ADDRESS", "RPC_URL"];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize and start API server
async function main() {
  // Initialize logger first
  await Logger.init("api-server");

  const server = new APIServer(
    parseInt(process.env.PORT || process.env.API_PORT || "3000"),
    process.env.API_PRIVATE_KEY!,
    process.env.REGISTRY_ADDRESS!,
    process.env.RPC_URL!,
    (process.env.NETWORK || "base") as "base" | "mode"
  );

  try {
    await server.start();
    Logger.info("API", "API server started successfully");
  } catch (error) {
    Logger.error("API", "Failed to start API server", { error });
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    Logger.info("API", "Shutting down API server...");
    await server.stop();
    await Logger.cleanup();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    Logger.info("API", "Shutting down API server...");
    await server.stop();
    await Logger.cleanup();
    process.exit(0);
  });
}

main();
