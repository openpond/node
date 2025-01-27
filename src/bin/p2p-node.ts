#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { startGrpcServer } from "../grpc/p2p-service";
import { P2PNetwork } from "../p2p";
import { Logger } from "../utils/logger";

// Only run if this is the main module
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

async function main() {
  try {
    // Load environment variables first
    config();

    // Parse command line arguments
    const program = new Command();
    program
      .option("-p, --port <number>", "gRPC port to listen on", "50051")
      .option("-n, --name <string>", "Agent name", "agent-1")
      .option("-k, --private-key <string>", "Ethereum private key")
      .option("-e, --env-file <path>", "Path to env file")
      .parse(process.argv);

    const options = program.opts();

    // Load specific env file if provided
    if (options.envFile) {
      config({ path: options.envFile });
    }

    // Required configuration
    const privateKey = options.privateKey || process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error("Private key is required");
      process.exit(1);
    }

    // Initialize logger once
    const name = options.name || "agent1";
    await Logger.init(name, {
      useStdout: process.env.LOG_TO_CONSOLE === "true",
      useFile: true,
    });

    Logger.debug("P2P", "p2p-node binary starting");

    // Create P2P network first
    const network = new P2PNetwork(
      privateKey,
      name,
      "1.0.0",
      {},
      process.env.REGISTRY_ADDRESS,
      process.env.RPC_URL,
      "base",
      true
    );

    // Start the P2P network
    Logger.info("P2P", "Starting P2P network...", { port: 8000 });
    await network.start(8000);
    Logger.info("P2P", "P2P network started successfully");

    // Start gRPC server with the network instance
    const grpcPort = parseInt(options.port);
    Logger.info("P2P", "Starting gRPC server...", { port: grpcPort });

    // Start gRPC server
    const server = await startGrpcServer(grpcPort, network);
    Logger.info("P2P", "gRPC server started successfully");

    // Handle process signals
    const cleanup = async () => {
      Logger.info("P2P", "Shutting down...");
      await network.stop();
      server.forceShutdown();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (error) {
    Logger.error("P2P", "Fatal error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Add error handler for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

// Only run main if this is the main module
if (isMainModule) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main };
