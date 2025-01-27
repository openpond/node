import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { createPublicClient, http } from "viem";
import AgentRegistryABI from "../src/abi/AgentRegistry.json" assert { type: "json" };
import { networks } from "../src/networks.js";
import { P2PNetwork } from "../src/p2p.js";
import { Logger } from "../src/utils/logger.js";
export class APIServer {
    port;
    nodePrivateKey;
    registryAddress;
    rpcUrl;
    network;
    app;
    p2p;
    connectedClients;
    registryContract;
    publicClient;
    constructor(port = 3000, nodePrivateKey, registryAddress, rpcUrl, network = "base") {
        this.port = port;
        this.nodePrivateKey = nodePrivateKey;
        this.registryAddress = registryAddress;
        this.rpcUrl = rpcUrl;
        this.network = network;
        this.app = express();
        this.connectedClients = new Map();
        // Initialize the registry contract and public client
        const chain = networks[network];
        this.publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl),
        });
        this.registryContract = this.publicClient;
        // Initialize P2P node
        this.p2p = new P2PNetwork(nodePrivateKey, "api-node", "1.0.0", {}, registryAddress, rpcUrl, network, true // Use encryption
        );
        this.setupExpress();
        this.setupP2PHandlers();
    }
    setupExpress() {
        this.app.use(cors());
        this.app.use(bodyParser.json());
        // Authentication middleware
        this.app.use(async (req, res, next) => {
            const signature = req.headers["x-signature"];
            const timestamp = req.headers["x-timestamp"];
            const agentId = req.headers["x-agent-id"];
            // If no auth headers are present, assign a temporary identity
            if (!signature || !timestamp || !agentId) {
                // Generate a temporary ID for this request
                const tempId = `temp-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`;
                req.headers["x-temp-id"] = tempId;
                return next();
            }
            try {
                // Verify timestamp is within 5 minutes
                const timestampNum = parseInt(timestamp);
                const now = Date.now();
                if (Math.abs(now - timestampNum) > 5 * 60 * 1000) {
                    return res.status(401).json({ error: "Timestamp too old" });
                }
                // Verify signature
                const message = `Authenticate to OpenPond API at timestamp ${timestamp}`;
                const isValidSignature = await this.publicClient.verifyMessage({
                    address: agentId,
                    message,
                    signature: signature,
                });
                if (!isValidSignature) {
                    return res.status(401).json({ error: "Invalid signature" });
                }
                // Verify agent is registered
                const isRegistered = await this.registryContract.readContract({
                    address: this.registryAddress,
                    abi: AgentRegistryABI,
                    functionName: "isRegistered",
                    args: [agentId],
                });
                if (!isRegistered) {
                    return res.status(403).json({ error: "Agent not registered" });
                }
                // Get agent info to check if blocked
                const agentInfo = (await this.registryContract.readContract({
                    address: this.registryAddress,
                    abi: AgentRegistryABI,
                    functionName: "getAgentInfo",
                    args: [agentId],
                }));
                if (agentInfo.isBlocked) {
                    return res.status(403).json({ error: "Agent is blocked" });
                }
                // Store/update client connection
                this.updateClientConnection(agentId);
                next();
            }
            catch (error) {
                Logger.error("API", "Authentication error", { error });
                return res.status(500).json({ error: "Authentication failed" });
            }
        });
        // Add message route
        this.app.post("/message", this.handleMessage.bind(this));
        // Routes
        this.setupRoutes();
    }
    setupRoutes() {
        // Send message
        this.app.post("/message", async (req, res) => {
            const { to, content, conversationId, replyTo } = req.body;
            const fromAgentId = req.headers["x-agent-id"];
            try {
                const messageId = await this.p2p.sendMessage(to, content, conversationId, replyTo);
                res.json({ messageId });
            }
            catch (error) {
                Logger.error("API", "Send message error", { error });
                res.status(500).json({ error: "Failed to send message" });
            }
        });
        // Get network status
        this.app.get("/status", (_req, res) => {
            const status = this.p2p.getNetworkStatus();
            res.json(status);
        });
        // Get connected peers
        this.app.get("/peers", async (_req, res) => {
            try {
                const agents = await this.p2p.getConnectedAgents();
                res.json(agents);
            }
            catch (error) {
                Logger.error("API", "Get peers error", { error });
                res.status(500).json({ error: "Failed to get peers" });
            }
        });
        // Get all agents (both connected and from registry)
        this.app.get("/agents", async (_req, res) => {
            try {
                // Get all agents from the P2P network's DHT records
                const dhtRecords = await this.p2p.getDHTRecords();
                // Format the records into a consistent response
                const agents = Object.entries(dhtRecords).map(([ethAddr, record]) => ({
                    address: ethAddr,
                    peerId: record.peerId,
                    name: record.agentName || `Agent ${ethAddr.slice(0, 6)}`,
                    timestamp: record.timestamp,
                    isConnected: true, // These are all connected agents since they're in DHT
                }));
                res.json(agents);
            }
            catch (error) {
                Logger.error("API", "Get agents error", { error });
                res.status(500).json({ error: "Failed to get agents" });
            }
        });
        // WebSocket-style message streaming
        this.app.get("/messages/stream", (req, res) => {
            const agentId = req.headers["x-agent-id"];
            // Set up SSE
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            const messageCallback = (message) => {
                if (message.toAgentId === agentId) {
                    res.write(`data: ${JSON.stringify(message)}\n\n`);
                }
            };
            // Add callback to client's callbacks
            const client = this.connectedClients.get(agentId);
            if (client) {
                client.messageCallbacks.add(messageCallback);
            }
            // Remove callback when client disconnects
            req.on("close", () => {
                const client = this.connectedClients.get(agentId);
                if (client) {
                    client.messageCallbacks.delete(messageCallback);
                }
            });
        });
    }
    setupP2PHandlers() {
        // Handle incoming messages
        this.p2p.on("message", (message) => {
            const client = this.connectedClients.get(message.toAgentId);
            if (client) {
                // Forward message to all client's callbacks
                client.messageCallbacks.forEach((callback) => callback(message));
            }
        });
    }
    updateClientConnection(agentId) {
        const existing = this.connectedClients.get(agentId);
        if (existing) {
            existing.lastSeen = Date.now();
        }
        else {
            this.connectedClients.set(agentId, {
                agentId,
                lastSeen: Date.now(),
                messageCallbacks: new Set(),
            });
        }
    }
    startCleanupInterval() {
        // Clean up stale clients every minute
        setInterval(() => {
            const now = Date.now();
            for (const [agentId, client] of this.connectedClients.entries()) {
                if (now - client.lastSeen > 5 * 60 * 1000) {
                    // 5 minutes
                    this.connectedClients.delete(agentId);
                }
            }
        }, 60 * 1000);
    }
    async start() {
        try {
            // Start P2P node
            await this.p2p.start(8000); // Use port 8000 for P2P
            await this.p2p.registerWithContract();
            // Start API server
            this.app.listen(this.port, () => {
                Logger.info("API", `API server running on port ${this.port}`);
            });
            // Start cleanup interval
            this.startCleanupInterval();
        }
        catch (error) {
            Logger.error("API", "Failed to start API server", { error });
            throw error;
        }
    }
    async stop() {
        await this.p2p.stop();
    }
    async handleMessage(req, res) {
        try {
            const { to, content, conversationId, replyTo } = req.body;
            // Get sender ID - either agent ID or temporary ID
            const senderId = req.headers["x-agent-id"] || req.headers["x-temp-id"];
            if (!senderId) {
                return res.status(400).json({ error: "No sender ID found" });
            }
            // Send message through P2P network
            await this.p2p.sendMessage(to, content, conversationId, replyTo);
            Logger.info("API", "Message sent", { from: senderId, to });
            res.json({ success: true });
        }
        catch (error) {
            Logger.error("API", "Send message error", { error });
            res.status(500).json({ error: "Failed to send message" });
        }
    }
}
//# sourceMappingURL=server.js.map