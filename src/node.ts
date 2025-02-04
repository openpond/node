import "./polyfills"; // Must be first import to ensure libp2p has access to CustomEvent

import { config as dotenvConfig } from "dotenv";
import path from "path";
import { getBootstrapKey, getBootstrapPeerId } from "./constants";
import { NetworkName } from "./networks";
import { P2PNetwork } from "./p2p";
import { Logger } from "./utils/logger";

// Only load .env file if ENV_FILE is explicitly set (for local development)
if (process.env.ENV_FILE) {
  dotenvConfig({ path: path.resolve(process.cwd(), process.env.ENV_FILE) });
  console.log("Loading environment from file:", process.env.ENV_FILE);
} else {
  console.log("Using environment variables from system");
}

// Validate required environment variables
if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable is required");
}

const NODE_TYPE = process.env.NODE_TYPE || "agent";
const config = {
  nodeType: NODE_TYPE,
  name:
    NODE_TYPE === "bootstrap"
      ? process.env.BOOTSTRAP_NAME || "bootstrap-1"
      : process.env.AGENT_NAME || "agent-1",
  port: parseInt(process.env.PORT || process.env.P2P_PORT || "8000"),
  privateKey: process.env.PRIVATE_KEY,
  registryAddress:
    process.env.REGISTRY_ADDRESS ||
    "0x05430ECEc2E4D86736187B992873EA8D5e1f1e32",
  rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
  network: process.env.NETWORK || "base",
  version: process.env.VERSION || "1.0.0",
  metadata: process.env.METADATA ? JSON.parse(process.env.METADATA) : {},
  useEncryption: process.env.USE_ENCRYPTION === "true",
};

let p2p: P2PNetwork;

/**
 * Initializes the P2P node with the provided configuration.
 * This function sets up either a bootstrap node or a regular agent node based on the configuration.
 * For bootstrap nodes, it uses a specific libp2p key, while regular nodes use their Ethereum private key.
 * After initialization, it registers the node with the contract and sets up message handling for non-bootstrap nodes.
 *
 * @throws {Error} If the private key configuration is missing
 * @returns {Promise<void>}
 */
async function initNode() {
  if (!config.privateKey) {
    throw new Error("Missing required private key configuration");
  }

  // Initialize logger first
  await Logger.init(config.name);

  Logger.info("Node", "Initializing P2P node", {
    name: config.name,
    nodeType: config.nodeType,
    port: config.port,
  });

  // Create P2P network with Ethereum private key
  p2p = new P2PNetwork(
    config.privateKey,
    config.name,
    config.version,
    config.metadata,
    config.registryAddress,
    config.rpcUrl,
    config.network as NetworkName,
    config.useEncryption
  );

  // If this is a bootstrap node, we need to use its specific libp2p key
  if (config.nodeType === "bootstrap") {
    const bootstrapKey = await getBootstrapKey(config.name);
    await p2p.start(config.port, bootstrapKey);
  } else {
    await p2p.start(config.port);
  }

  await p2p.registerWithContract();

  // If we're a bootstrap node
  if (config.nodeType === "bootstrap") {
    Logger.info("Node", "Starting bootstrap node", {
      name: config.name,
      expectedPeerId: getBootstrapPeerId(
        config.network as NetworkName,
        config.name
      ),
    });

    Logger.info("Node", "Bootstrap node started", {
      name: config.name,
      multiaddrs: p2p.getLibp2p().getMultiaddrs().map(String),
      peerId: p2p.getLibp2p().peerId.toString(),
    });
    return;
  }

  // Handle incoming messages for non-bootstrap nodes
  p2p.on("message", async (message: any) => {
    Logger.info("Node", "Received message", {
      from: message.fromAgentId,
      content: message.content,
    });
  });
}

/**
 * Handles graceful shutdown of the P2P node.
 * This function is called when the process receives SIGTERM or SIGINT signals.
 * It ensures that the P2P node is properly stopped before exiting the process.
 *
 * @returns {Promise<void>}
 */
async function shutdown() {
  Logger.info("Node", "Shutting down...");
  try {
    if (p2p) {
      await p2p.stop();
    }
    process.exit(0);
  } catch (error) {
    Logger.error("Node", "Error during shutdown", { error });
    process.exit(1);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

/**
 * Starts the P2P node.
 * This is the main entry point for the application.
 * It initializes the node and handles any errors that occur during startup.
 *
 * @returns {Promise<void>}
 */
async function start() {
  try {
    await initNode();
    Logger.info("Node", "Node started successfully");
  } catch (error) {
    Logger.error("Node", "Failed to start node", { error });
    process.exit(1);
  }
}

start();
