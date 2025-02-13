#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { startGrpcServer } from "../grpc/p2p-service";
import { NetworkName } from "../networks";
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
      .option(
        "-p, --grpc-port <number>",
        "gRPC port to listen on",
        process.env.GRPC_PORT || "50051"
      )
      .option(
        "--p2p-port <number>",
        "P2P network port to listen on",
        process.env.P2P_PORT || "8000"
      )
      .option(
        "-n, --name <string>",
        "Agent name",
        process.env.AGENT_NAME || "agent-1"
      )
      .option(
        "-k, --private-key <string>",
        "Ethereum private key",
        process.env.PRIVATE_KEY
      )
      .option("-e, --env-file <path>", "Path to env file")
      .option(
        "-v, --version <string>",
        "Agent version",
        process.env.AGENT_VERSION || "1.0.0"
      )
      .option(
        "-r, --registry-address <string>",
        "Registry contract address",
        process.env.REGISTRY_ADDRESS ||
          "0x05430ECEc2E4D86736187B992873EA8D5e1f1e32"
      )
      .option(
        "-u, --rpc-url <string>",
        "RPC URL",
        process.env.RPC_URL || "https://mainnet.base.org"
      )
      .option(
        "-w, --network <string>",
        "Network name (base, mainnet, etc)",
        process.env.NETWORK || "base"
      )
      .option(
        "--encryption <boolean>",
        "Use encryption",
        process.env.USE_ENCRYPTION === "true"
      )
      .option(
        "--metadata <json>",
        "Agent metadata as JSON string",
        process.env.AGENT_METADATA || "{}"
      )
      .parse(process.argv);

    const options = program.opts();

    // Load specific env file if provided and merge with existing env
    if (options.envFile) {
      config({ path: options.envFile, override: true });
    }

    // Required configuration
    const privateKey = options.privateKey || process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error("Private key is required");
      process.exit(1);
    }

    // Initialize logger once
    const name = options.name || process.env.AGENT_NAME || "agent1";
    await Logger.init(name, {
      useStdout: process.env.LOG_TO_CONSOLE === "true",
      useFile: true,
    });

    Logger.debug("P2P", "p2p-node binary starting");

    // Parse metadata
    let metadata = {};
    try {
      metadata = JSON.parse(options.metadata);
    } catch (error) {
      Logger.warn("P2P", "Failed to parse metadata JSON, using empty object", {
        error,
      });
    }

    // Log startup configuration (excluding private key)
    Logger.info("P2P", "Starting with configuration", {
      name,
      grpcPort: options.grpcPort,
      p2pPort: options.p2pPort,
      version: options.version,
      network: options.network,
      registryAddress: options.registryAddress,
      rpcUrl: options.rpcUrl,
      encryption: options.encryption,
      metadata,
      usingEnvFile: !!options.envFile,
    });

    // Create P2P network first
    const network = new P2PNetwork(
      privateKey,
      name,
      options.version,
      metadata,
      options.registryAddress,
      options.rpcUrl,
      options.network as NetworkName,
      options.encryption
    );

    // Start the P2P network
    const p2pPort = parseInt(options.p2pPort);
    Logger.info("P2P", "Starting P2P network...", { port: p2pPort });
    await network.start(p2pPort);
    Logger.info("P2P", "P2P network started successfully");

    // Start gRPC server with the network instance
    const grpcPort = parseInt(options.grpcPort);
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

    Logger.info("P2P", "Node startup complete", {
      p2pPort,
      grpcPort,
      network: options.network,
    });
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
