#!/usr/bin/env node
import { Command } from "commander";
import { config } from "dotenv";
import { createInterface } from "readline";
import { P2PNetwork } from "../p2p";
import { Logger } from "../utils/logger";
// Initialize logger first
await Logger.init("p2p-node", {
    useStdout: process.env.LOG_TO_CONSOLE === "true",
    useFile: true,
});
// Early debug logs
Logger.debug("P2P", "p2p-node script starting");
Logger.debug("P2P", "Process arguments", { argv: process.argv });
Logger.debug("P2P", "Environment variables", {
    NODE_ENV: process.env.NODE_ENV,
    DEBUG: process.env.DEBUG,
    PRIVATE_KEY: process.env.PRIVATE_KEY ? "set" : "not set",
    P2P_PORT: process.env.P2P_PORT,
    AGENT_NAME: process.env.AGENT_NAME,
});
async function main() {
    // Load environment variables
    config();
    // Parse command line arguments
    const program = new Command();
    program
        .option("-p, --port <number>", "Port to listen on", "8000")
        .option("-b, --bootstrap <addresses>", "Bootstrap peer addresses")
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
        Logger.error("P2P", "Private key is required");
        process.exit(1);
    }
    // Initialize P2P network
    const network = new P2PNetwork(privateKey, options.name, "1.0.0", {}, // Empty metadata for now
    process.env.REGISTRY_ADDRESS, process.env.RPC_URL, "base", true // Enable encryption
    );
    // Set up readline interface for stdin
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });
    // Helper to emit events
    function emitEvent(event) {
        process.stdout.write(JSON.stringify(event) + "\n");
    }
    // Handle incoming commands
    rl.on("line", async (line) => {
        try {
            const command = JSON.parse(line);
            switch (command.type) {
                case "connect":
                    await network.start(command.port || parseInt(options.port));
                    emitEvent({
                        type: "ready",
                        peerId: network.getAddress(),
                    });
                    break;
                case "send":
                    await network.sendMessage(command.peerId, command.data);
                    break;
                case "discover":
                    // Return known peers from the network
                    const knownPeers = network.getKnownPeers();
                    for (const [peerId] of knownPeers) {
                        emitEvent({
                            type: "peer_discovered",
                            peerId,
                            topics: ["agents"], // Default topic
                        });
                    }
                    break;
                case "subscribe":
                    // GossipSub handles subscriptions automatically
                    // Just acknowledge it
                    emitEvent({
                        type: "ready",
                        peerId: network.getAddress(),
                    });
                    break;
                case "shutdown":
                    await network.stop();
                    process.exit(0);
                    break;
                default:
                    emitEvent({
                        type: "error",
                        code: "INVALID_COMMAND",
                        message: `Unknown command type: ${command.type}`,
                    });
            }
        }
        catch (error) {
            emitEvent({
                type: "error",
                code: "COMMAND_FAILED",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });
    // Forward P2P network events
    network.on("peer:discovery", (peerId) => {
        emitEvent({
            type: "peer_discovered",
            peerId,
            topics: ["agents"],
        });
    });
    network.on("message", (fromPeerId, data) => {
        emitEvent({
            type: "message",
            from: fromPeerId,
            data,
        });
    });
    // Handle process signals
    process.on("SIGINT", async () => {
        await network.stop();
        process.exit(0);
    });
    process.on("SIGTERM", async () => {
        await network.stop();
        process.exit(0);
    });
    // Disable console.log and use stdout only for JSON messages
    console.log = () => { };
    Logger.setLogHandler((level, namespace, message, meta) => {
        emitEvent({
            type: "log",
            level,
            namespace,
            message,
            meta,
        });
    });
}
// Wrap main() in try-catch
try {
    Logger.debug("P2P", "Calling main()");
    main().catch((error) => {
        Logger.error("P2P", "Fatal error in main()", error);
        if (error?.stack) {
            Logger.error("P2P", "Error stack", { stack: error.stack });
        }
        process.exit(1);
    });
}
catch (error) {
    Logger.error("P2P", "Error starting p2p-node", error);
    if (error instanceof Error && error.stack) {
        Logger.error("P2P", "Error stack", { stack: error.stack });
    }
    process.exit(1);
}
//# sourceMappingURL=p2p-node.js.map