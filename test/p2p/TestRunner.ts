import { EventEmitter } from "events";
import { createPublicClient, createWalletClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { P2PNetwork } from "../../src/p2p";
import { Logger } from "./logger";

interface TestMessage {
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

interface TestResult {
  success: boolean;
  error?: Error;
  messagesSent: number;
  messagesReceived: number;
  startTime: number;
  endTime: number;
}

interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: Map<string, TestResult>;
  duration: number;
}

interface AgentCapabilities {
  canProcess: string[];
}

export class TestRunner extends EventEmitter {
  private bootstrapNodes: P2PNetwork[] = [];
  private agents: Map<string, P2PNetwork> = new Map();
  private messageLog: TestMessage[] = [];
  private results: Map<string, TestResult> = new Map();
  private funderClient: any;

  constructor(
    private readonly registryAddress: string,
    private readonly rpcUrl: string,
    private readonly funderPrivateKey: `0x${string}` // Private key of the wallet with funds
  ) {
    super();
  }

  async init() {
    // Initialize logging with both stdout and file output
    await Logger.init("p2p-test", {
      useStdout: true,
      useFile: true,
    });

    // Create wallet client for funding transactions
    const funderAccount = privateKeyToAccount(this.funderPrivateKey);
    this.funderClient = createWalletClient({
      account: funderAccount,
      chain: baseSepolia,
      transport: http(this.rpcUrl),
    });
  }

  private async fundAgent(address: string): Promise<boolean> {
    try {
      Logger.info("Test", `Funding agent ${address} from funder wallet`);

      // Send 0.003 ETH to cover registration (est. 0.00186 ETH) and messaging costs
      const hash = await this.funderClient.sendTransaction({
        to: address,
        value: BigInt(5000000000000000n), // 0.003 ETH
      });

      // Wait for transaction confirmation
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(this.rpcUrl),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      Logger.info("Test", `Successfully funded agent ${address}`);
      return true;
    } catch (error) {
      Logger.error("Test", "Failed to fund agent", { error, address });
      return false;
    }
  }

  private generateAgentCapabilities(): AgentCapabilities {
    return {
      canProcess: ["market_sentiment", "financial_news", "market_trends"],
    };
  }

  private generatePrivateKey(): `0x${string}` {
    return generatePrivateKey();
  }

  async startBootstrapNodes(count: number = 2) {
    const startPort = 14221;
    for (let i = 0; i < count; i++) {
      const port = startPort + i;
      const privateKey = this.generatePrivateKey();

      // Create public client for balance check
      const account = privateKeyToAccount(privateKey);
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(this.rpcUrl),
      });

      // Check balance and fund if needed
      const balance = await client.getBalance({ address: account.address });
      if (balance === 0n) {
        const funded = await this.fundAgent(account.address);
        if (!funded) {
          throw new Error(`Failed to fund bootstrap node ${i}`);
        }
        Logger.info(
          "Test",
          `Funded bootstrap node ${i} at address ${account.address}`
        );
      }

      // Create bootstrap node
      const node = new P2PNetwork(
        privateKey,
        `bootstrap-${i}`,
        "1.0.0",
        {}, // Bootstrap nodes don't need capabilities
        this.registryAddress,
        this.rpcUrl
      );

      await node.start(port);
      await node.registerWithContract(); // Register bootstrap nodes too
      this.bootstrapNodes.push(node);
      Logger.info(
        "Test",
        `Bootstrap node ${i} started on port ${port} with address ${node.getAddress()}`
      );
    }

    // Wait for bootstrap nodes to be ready and announce themselves
    Logger.info("Test", "Waiting for bootstrap nodes to initialize DHT...");
    await new Promise((resolve) => setTimeout(resolve, 20000));

    // Verify bootstrap nodes are connected to each other
    for (const node of this.bootstrapNodes) {
      const peers = await node.getPeers();
      Logger.info("Test", `Bootstrap node peers:`, {
        address: node.getAddress(),
        peerCount: peers.length,
        peers: peers.map(String),
      });
    }
  }

  async createAgents(count: number) {
    const startPort = 14230;

    // Get bootstrap addresses
    const bootstrapAddresses = this.bootstrapNodes.map((node) =>
      node.getAddress()
    );
    Logger.info("Test", "Using bootstrap nodes", { bootstrapAddresses });

    // Create and register all agents first
    const agentPromises = [];
    for (let i = 0; i < count; i++) {
      const port = startPort + i;
      const privateKey = this.generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      // Check balance and fund if needed
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(this.rpcUrl),
      });
      const balance = await client.getBalance({ address: account.address });
      if (balance === 0n) {
        const funded = await this.fundAgent(account.address);
        if (!funded) {
          throw new Error(
            `Failed to fund agent ${i} at address ${account.address}`
          );
        }
        Logger.info("Test", `Funded agent ${i} at address ${account.address}`);
      }

      // Create agent with metadata including capabilities
      const capabilities = this.generateAgentCapabilities();
      const node = new P2PNetwork(
        privateKey,
        `test-agent-${i}`,
        "1.0.0",
        {
          creators: `Test Framework Agent ${i}`,
          tokenAddress: undefined,
          capabilities,
        },
        this.registryAddress,
        this.rpcUrl
      );

      // Register with contract first
      await node.registerWithContract();
      Logger.info("Test", `Agent ${i} registered with contract`);

      // Listen for messages
      node.on("message", (msg: any) => {
        this.messageLog.push({
          from: msg.fromAgentId,
          to: msg.toAgentId,
          content: msg.content,
          timestamp: Date.now(),
        });
      });

      // Start node and wait for bootstrap connection
      await node.start(port);
      await node.waitForBootstrapConnection();
      Logger.info("Test", `Agent ${i} connected to bootstrap nodes`);

      // Store agent
      this.agents.set(`test-agent-${i}`, node);
      Logger.info("Test", `Agent ${i} started on port ${port}`);

      // Wait between agent startups
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify DHT publishing
      const address = node.getAddress().toLowerCase();
      Logger.info("Test", `Verifying DHT records for agent ${i}`, { address });

      // Wait for DHT record to be published
      let published = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const records = await node.getDHTRecords();
          if (records[address]) {
            published = true;
            Logger.info(
              "Test",
              `Agent ${i} DHT record published successfully`,
              {
                record: records[address],
                allRecords: records,
              }
            );
            break;
          }
        } catch (error) {
          Logger.warn(
            "Test",
            `Attempt ${attempt + 1} to verify DHT record failed`,
            { error }
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (!published) {
        Logger.warn("Test", `Failed to verify DHT record for agent ${i}`);
      }
    }

    // Wait for peer discovery
    Logger.info("Test", "Waiting for peer discovery between agents...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Verify peer connections
    for (const [name, node] of this.agents) {
      const peers = await node.getPeers();
      const knownPeers = await node.getKnownPeers();
      Logger.info("Test", `Agent ${name} connected peers:`, {
        peerCount: peers.length,
        peers: peers.map(String),
        knownPeers,
      });
    }
  }

  async runMessageTest() {
    const startTime = Date.now();
    const result: TestResult = {
      success: true,
      messagesSent: 0,
      messagesReceived: 0,
      startTime,
      endTime: 0,
    };

    try {
      Logger.info("Test", "Starting message test");

      // Wait for peer discovery
      Logger.info("Test", "Waiting for peer discovery...");
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second wait for discovery

      // Log connected peers for each agent
      for (const [name, node] of this.agents) {
        const peers = await node.getPeers();
        Logger.info("Test", `Agent ${name} connected peers:`, {
          peerCount: peers.length,
        });
      }

      // Each agent sends a message to every other agent
      for (const [fromName, fromNode] of this.agents) {
        for (const [toName, toNode] of this.agents) {
          if (fromName === toName) continue;

          const message = `Test message from ${fromName} to ${toName}`;
          await fromNode.sendMessage(toNode.getAddress(), message);
          result.messagesSent++;
          // Small delay between messages to avoid overwhelming the network
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Wait longer for messages to be received
      Logger.info("Test", "Waiting for messages to be received...");
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Increased to 15 seconds

      // Verify messages
      const expectedMessages = this.agents.size * (this.agents.size - 1);
      result.messagesReceived = this.messageLog.length;

      if (result.messagesReceived !== expectedMessages) {
        throw new Error(
          `Expected ${expectedMessages} messages, but received ${result.messagesReceived}`
        );
      }
    } catch (error) {
      result.success = false;
      result.error = error as Error;
    }

    result.endTime = Date.now();
    this.results.set("message-test", result);
    return result;
  }

  generateSummary(): TestSummary {
    const summary: TestSummary = {
      totalTests: this.results.size,
      passedTests: 0,
      failedTests: 0,
      results: this.results,
      duration: 0,
    };

    for (const result of this.results.values()) {
      if (result.success) {
        summary.passedTests++;
      } else {
        summary.failedTests++;
      }
      summary.duration += result.endTime - result.startTime;
    }

    return summary;
  }

  async cleanup() {
    // Stop all agents
    for (const agent of this.agents.values()) {
      await agent.stop();
    }
    this.agents.clear();

    // Stop bootstrap nodes
    for (const node of this.bootstrapNodes) {
      await node.stop();
    }
    this.bootstrapNodes = [];

    // Clear test data
    this.messageLog = [];
    this.results.clear();
  }
}
