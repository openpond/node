import bodyParser from "body-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { Chain, createPublicClient, http, PublicClient } from "viem";
import AgentRegistryABI from "../src/abi/AgentRegistry.json" assert { type: "json" };
import { networks } from "../src/networks.js";
import { P2PAgentMessage, P2PNetwork } from "../src/p2p.js";
import { NodeRole } from "../src/types/p2p.js";
import { Logger } from "../src/utils/logger.js";
interface ConnectedClient {
  agentId: string;
  lastSeen: number;
  messageCallbacks: Set<(message: any) => void>;
}

interface AgentInfo {
  name: string;
  metadata: string;
  reputation: bigint;
  isActive: boolean;
  isBlocked: boolean;
  registrationTime: bigint;
}

export class APIServer {
  private app: express.Application;
  private p2p: P2PNetwork;
  private connectedClients: Map<string, ConnectedClient>;
  private registryContract: PublicClient;
  private publicClient: PublicClient;

  constructor(
    private port: number = 3000,
    private nodePrivateKey: string,
    private registryAddress: string,
    private rpcUrl: string,
    private network: "base" | "sepolia" = "base"
  ) {
    this.app = express();
    this.connectedClients = new Map();

    // Initialize the registry contract and public client
    const chain = networks[network] as Chain;
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    this.registryContract = this.publicClient;

    // Initialize P2P node
    this.p2p = new P2PNetwork(
      nodePrivateKey,
      "api-node",
      "1.0.0",
      {},
      NodeRole.SERVER,
      registryAddress,
      rpcUrl,
      network,
      true // useEncryption
    );

    this.setupExpress();
    this.setupP2PHandlers();
  }

  private setupExpress(): void {
    this.app.use(cors());
    this.app.use(bodyParser.json());

    // Authentication middleware
    this.app.use(async (req: Request, res: Response, next: NextFunction) => {
      const signature = req.headers["x-signature"] as string;
      const timestamp = req.headers["x-timestamp"] as string;
      const agentId = req.headers["x-agent-id"] as string;

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
          address: agentId as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });

        if (!isValidSignature) {
          return res.status(401).json({ error: "Invalid signature" });
        }

        // Verify agent is registered
        const isRegistered = await this.registryContract.readContract({
          address: this.registryAddress as `0x${string}`,
          abi: AgentRegistryABI,
          functionName: "isRegistered",
          args: [agentId],
        });

        if (!isRegistered) {
          return res.status(403).json({ error: "Agent not registered" });
        }

        // Get agent info to check if blocked
        const agentInfo = (await this.registryContract.readContract({
          address: this.registryAddress as `0x${string}`,
          abi: AgentRegistryABI,
          functionName: "getAgentInfo",
          args: [agentId],
        })) as AgentInfo;

        if (agentInfo.isBlocked) {
          return res.status(403).json({ error: "Agent is blocked" });
        }

        // Store/update client connection
        this.updateClientConnection(agentId);
        next();
      } catch (error) {
        Logger.error("API", "Authentication error", { error });
        return res.status(500).json({ error: "Authentication failed" });
      }
    });

    // Routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Send message
    this.app.post(
      "/message",
      async (req: Request<{}, {}, P2PAgentMessage>, res: Response) => {
        const fromAgentId = req.headers["x-agent-id"] as string;
        const message = req.body as P2PAgentMessage;

        // Verify the message matches the authenticated sender
        if (message.fromAgentId.toLowerCase() !== fromAgentId.toLowerCase()) {
          return res.status(403).json({
            error: "Message sender does not match authenticated user",
          });
        }

        try {
          // Pass the complete message to sendMessage for relaying
          const messageId = await this.p2p.sendMessage(
            message.toAgentId || "broadcast",
            message
          );
          res.json({ messageId });
        } catch (error) {
          Logger.error("API", "Send message error", { error });
          res.status(500).json({ error: "Failed to send message" });
        }
      }
    );

    // Get network status
    this.app.get("/status", (_req: Request, res: Response) => {
      const status = this.p2p.getNetworkStatus();
      res.json(status);
    });

    // Get connected peers
    this.app.get("/peers", async (_req: Request, res: Response) => {
      try {
        const agents = await this.p2p.getConnectedAgents();
        res.json(agents);
      } catch (error) {
        Logger.error("API", "Get peers error", { error });
        res.status(500).json({ error: "Failed to get peers" });
      }
    });

    // Get all agents (both connected and from registry)
    this.app.get("/agents", async (_req: Request, res: Response) => {
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
      } catch (error) {
        Logger.error("API", "Get agents error", { error });
        res.status(500).json({ error: "Failed to get agents" });
      }
    });

    // WebSocket-style message streaming
    this.app.get("/messages/stream", async (req: Request, res: Response) => {
      // Get auth headers from query params for EventSource
      const signature = (req.query["x-signature"] ||
        req.headers["x-signature"]) as string;
      const timestamp = (req.query["x-timestamp"] ||
        req.headers["x-timestamp"]) as string;
      const agentId = (req.query["x-agent-id"] ||
        req.headers["x-agent-id"]) as string;

      if (!signature || !timestamp || !agentId) {
        return res
          .status(401)
          .json({ error: "Missing authentication parameters" });
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
          address: agentId as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });

        if (!isValidSignature) {
          return res.status(401).json({ error: "Invalid signature" });
        }

        // Store/update client connection
        this.updateClientConnection(agentId);

        // Set up SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const messageCallback = (message: any) => {
          if (message.toAgentId.toLowerCase() === agentId.toLowerCase()) {
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
      } catch (error) {
        Logger.error("API", "EventSource authentication error", { error });
        return res.status(500).json({ error: "Authentication failed" });
      }
    });
  }

  private setupP2PHandlers(): void {
    // Handle incoming messages
    this.p2p.on("message", (message: any) => {
      const client = this.connectedClients.get(message.toAgentId);
      if (client) {
        // Forward message to all client's callbacks
        client.messageCallbacks.forEach((callback) => callback(message));
      }
    });
  }

  private updateClientConnection(agentId: string): void {
    const existing = this.connectedClients.get(agentId);
    if (existing) {
      existing.lastSeen = Date.now();
    } else {
      this.connectedClients.set(agentId, {
        agentId,
        lastSeen: Date.now(),
        messageCallbacks: new Set(),
      });
    }
  }

  private startCleanupInterval(): void {
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

  async start(): Promise<void> {
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
    } catch (error) {
      Logger.error("API", "Failed to start API server", { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.p2p.stop();
  }
}
