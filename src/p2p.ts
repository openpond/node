import "./polyfills";

import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import type { PrivateKey } from "@libp2p/interface";
import { kadDHT } from "@libp2p/kad-dht";
import { peerIdFromString } from "@libp2p/peer-id";
import { tcp } from "@libp2p/tcp";
import { multiaddr, Multiaddr } from "@multiformats/multiaddr";
import { decrypt, encrypt } from "eciesjs";
import { EventEmitter } from "events";
import fs from "fs/promises";
import { createLibp2p } from "libp2p";
import secp256k1 from "secp256k1";
import { Chain, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import AgentRegistryABI from "./abi/AgentRegistry.json" assert { type: "json" };
import {
  getBootstrapHostname,
  getBootstrapNodes,
  getBootstrapPort,
} from "./constants";
import { NetworkName, networks } from "./networks";
import { Logger } from "./utils/logger";
const { publicKeyCreate } = secp256k1;

/**
 * Metadata associated with an agent in the P2P network.
 * @interface AgentMetadata
 */
interface AgentMetadata {
  /** Optional creator information */
  creators?: string;
  /** Optional token address associated with the agent */
  tokenAddress?: string;
}

/**
 * Represents an agent's information from the registry contract.
 * @interface Agent
 */
interface Agent {
  /** The name of the agent */
  name: string;
  /** JSON string containing agent metadata */
  metadata: string;
  /** Agent's reputation score */
  reputation: bigint;
  /** Whether the agent is currently active */
  isActive: boolean;
  /** Whether the agent is blocked */
  isBlocked: boolean;
  /** Timestamp of when the agent was registered */
  registrationTime: bigint;
}

/**
 * Structure for encrypted message content.
 * @interface EncryptedMessage
 */
interface EncryptedMessage {
  /** The encrypted content as a byte array */
  encrypted: Uint8Array | number[];
}

/**
 * Structure for P2P messages exchanged between agents.
 * @interface P2PAgentMessage
 */
interface P2PAgentMessage {
  /** Unique identifier for the message */
  messageId: string;
  /** Ethereum address of the sending agent */
  fromAgentId: string;
  /** Optional Ethereum address of the receiving agent */
  toAgentId?: string;
  /** Encrypted content of the message */
  content: EncryptedMessage;
  /** Unix timestamp of when the message was created */
  timestamp: number;
  /** Signature of the message content */
  signature: string;
  /** Optional conversation ID for threaded messages */
  conversationId?: string;
  /** Optional reference to a message being replied to */
  replyTo?: string;
  /** Nonce value for message uniqueness */
  nonce: number;
}

/**
 * P2PNetwork class implements a decentralized peer-to-peer network using libp2p.
 * It provides functionality for agent discovery, message exchange, and network maintenance.
 * @extends EventEmitter
 */
export class P2PNetwork extends EventEmitter {
  private node: any;
  private account: any;
  private knownPeers: Set<string> = new Set();
  private registryContract: any;
  private publicKey: Uint8Array;
  private privateKey: string;
  private useEncryption: boolean = false;
  private chain: Chain;
  private metrics = {
    connectedPeers: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastMessageTime: 0,
    startTime: Date.now(),
  };
  private peerId: any;
  private dht: any;
  private bootstrapMode: boolean = false;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private lastDHTUpdate: number = 0;
  private readonly MIN_DHT_UPDATE_INTERVAL = 10_000; // 10 seconds instead of 60 seconds
  private readonly MAX_CONNECTIONS = this.bootstrapMode ? 1000 : 50;
  private bootstrapNodes: string[] = [];
  private nodeStatuses: Map<string, any> = new Map();
  private knownPeerToEthMap: Map<string, string> = new Map();
  private knownAgentNames: Map<string, string> = new Map();

  // Constants for DHT operations
  private readonly DHT_OPERATION_TIMEOUT = 30000; // 30 seconds
  private readonly DHT_GET_TIMEOUT = 10000; // 10 seconds
  private readonly DHT_PUT_TIMEOUT = 20000; // 20 seconds

  /**
   * Creates a new P2PNetwork instance.
   * @param {string} privateKey - Ethereum private key for the agent
   * @param {string} agentName - Name of the agent
   * @param {string} version - Version of the agent software
   * @param {AgentMetadata} metadata - Additional metadata for the agent
   * @param {string} registryAddress - Address of the agent registry contract
   * @param {string} rpcUrl - URL of the Ethereum RPC endpoint
   * @param {NetworkName} networkName - Name of the network (e.g., "base", "mainnet")
   * @param {boolean} useEncryption - Whether to use message encryption
   */
  constructor(
    privateKey: string,
    private agentName: string,
    private version: string,
    private metadata: AgentMetadata,
    private registryAddress: string = "0x05430ECEc2E4D86736187B992873EA8D5e1f1e32",
    private rpcUrl: string = "https://mainnet.base.org",
    private networkName: NetworkName = "base",
    useEncryption = false
  ) {
    super();
    this.useEncryption = useEncryption;
    this.chain = networks[networkName];
    this.privateKey = privateKey.replace("0x", "");
    this.account = privateKeyToAccount(`0x${this.privateKey}`);

    // Initialize registry contract client
    this.registryContract = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    });

    const privKeyBuffer = Buffer.from(this.privateKey, "hex");
    this.publicKey = publicKeyCreate(new Uint8Array(privKeyBuffer), false);

    // Set bootstrap mode based on the agent's address, not the name
    const bootstrapAddresses = getBootstrapNodes(this.networkName).map(
      (node) => {
        const [_, addr] = node.split("/p2p/");
        return addr;
      }
    );
    this.bootstrapMode = bootstrapAddresses.includes(
      this.account.address.toLowerCase()
    );

    // Set bootstrap nodes if we're not a bootstrap node
    if (!this.bootstrapMode) {
      this.bootstrapNodes = getBootstrapNodes(this.networkName);
    }
  }

  /**
   * Starts the P2P network node.
   * Initializes the libp2p node with the appropriate configuration based on whether it's a bootstrap node or regular agent.
   * Sets up DHT, pubsub, and connection handlers.
   *
   * @param {number} port - The port number to listen on
   * @param {PrivateKey} [bootstrapKey] - Optional libp2p private key for bootstrap nodes
   * @returns {Promise<any>} The initialized libp2p node
   * @throws {Error} If node initialization fails
   */
  async start(port: number, bootstrapKey?: PrivateKey) {
    try {
      Logger.info("P2P", "🌟 Starting P2P node...", {
        agentName: this.agentName,
        isBootstrap: this.agentName.startsWith("bootstrap-"),
        port,
      });

      // Create base options without sensitive data
      const options: any = {
        addresses: {
          listen: [`/ip4/0.0.0.0/tcp/${port}`],
          announce: [],
        },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        services: {
          pubsub: gossipsub({
            allowPublishToZeroTopicPeers: true,
            emitSelf: true,
            heartbeatInterval: 1000,
            directPeers: this.agentName.startsWith("bootstrap-")
              ? []
              : this.bootstrapNodes.map((addr) => ({
                  id: peerIdFromString(addr.split("/p2p/")[1]),
                  addrs: [multiaddr(addr)],
                })),
          }),
          identify: identify(),
          dht: kadDHT({
            clientMode: !this.agentName.startsWith("bootstrap-"),
            protocol: "/openpond/kad/1.0.0",
            maxInboundStreams: 5000,
            maxOutboundStreams: 5000,
            kBucketSize: this.agentName.startsWith("bootstrap-") ? 200 : 20,
            allowQueryWithZeroPeers: true,
          }),
        },
        connectionManager: {
          maxConnections: this.agentName.startsWith("bootstrap-") ? 1000 : 50,
          minConnections: this.agentName.startsWith("bootstrap-") ? 3 : 1,
          maxParallelDials: this.agentName.startsWith("bootstrap-") ? 100 : 25,
          dialTimeout: 30000,
          autoDialInterval: 10000,
        },
      };

      // If we're a bootstrap node, announce our public address
      if (this.agentName.startsWith("bootstrap-")) {
        const port = getBootstrapPort(this.networkName, this.agentName);
        const hostname = getBootstrapHostname(this.networkName, this.agentName);

        Logger.info(
          "P2P",
          `Bootstrap node announcing with hostname: ${hostname} and port: ${port}`
        );
        options.addresses.announce = [`/dns4/${hostname}/tcp/${port}`];

        // Add bootstrap-specific DHT configuration
        this.bootstrapMode = true;
        Logger.info("P2P", "Running in bootstrap mode with DHT server enabled");
        options.addresses.announce = [`/dns4/${hostname}/tcp/${port}`];
      }

      if (bootstrapKey) {
        options.privateKey = bootstrapKey;
        Logger.info("P2P", "Using bootstrap libp2p key");
      }

      // Create and start the node
      Logger.info("P2P", "Creating libp2p node...", options);
      this.node = await createLibp2p(options);

      if (!this.node) {
        throw new Error("Failed to create libp2p node");
      }

      Logger.info("P2P", "Starting libp2p node...");
      await this.node.start();
      Logger.info("P2P", "libp2p node started successfully", {
        peerId: this.node.peerId.toString(),
        multiaddrs: this.node.getMultiaddrs().map(String),
      });
      this.peerId = this.node.peerId;

      // Set up pubsub
      Logger.info("P2P", "Setting up pubsub...");
      await this.setupPubSub();
      Logger.info("P2P", "Pubsub setup complete");

      if (this.bootstrapMode) {
        // Start DHT server mode first for bootstrap nodes
        Logger.info("P2P", "Starting DHT in bootstrap mode");
        try {
          await this.node.services.dht.start();
          Logger.info("P2P", "DHT bootstrap mode started successfully", {
            routingTableSize: this.node.services.dht.routingTable.size,
          });
        } catch (error) {
          Logger.error("P2P", "Failed to start DHT in bootstrap mode", {
            error,
          });
          throw error;
        }

        // Then connect to other bootstrap nodes
        await this.connectToBootstrapNodes();
      } else {
        // For regular nodes, wait for bootstrap connection
        Logger.info("P2P", "Waiting for bootstrap connection...");
        await this.waitForBootstrapConnection();
      }

      // Start discovery and publish our DHT record
      await this.startDiscovery();
      await this.publishToDHT();

      // Start periodic DHT maintenance
      await this.startDHTMaintenance();

      return this.node;
    } catch (error) {
      Logger.error("P2P", "Failed to start node", { error });
      throw error;
    }
  }

  /**
   * Sets up the publish/subscribe system for the P2P network.
   * Subscribes to various channels including agent announcements, messages, and node status.
   * Sets up message handlers and starts periodic status broadcasts.
   *
   * @returns {Promise<void>}
   * @throws {Error} If pubsub setup fails
   */
  public async setupPubSub() {
    try {
      // Subscribe to agent announcements
      await this.node.services.pubsub.subscribe("agent-announcements");
      Logger.info("P2P", "Subscribed to agent-announcements");

      // Subscribe to agent messages
      await this.node.services.pubsub.subscribe("agent-messages");
      Logger.info("P2P", "Subscribed to agent-messages");

      // Subscribe to node status
      await this.node.services.pubsub.subscribe("node-status");
      Logger.info("P2P", "Subscribed to node-status");

      // Handle incoming messages
      this.node.services.pubsub.addEventListener(
        "message",
        async (evt: any) => {
          try {
            const data = new TextDecoder().decode(evt.detail.data);
            const messageWrapper = JSON.parse(data);

            if (evt.detail.topic === "agent-announcements") {
              if (messageWrapper && messageWrapper.message) {
                await this.verifyAndProcessAnnouncement(messageWrapper.message);
              }
            } else if (evt.detail.topic === "agent-messages") {
              if (messageWrapper && messageWrapper.message) {
                await this.handleAgentMessage(messageWrapper.message);
              }
            }
          } catch (error) {
            Logger.error("P2P", "Failed to process pubsub message", {
              error,
              topic: evt.detail.topic,
            });
          }
        }
      );

      // Start periodic status broadcast with reduced frequency
      await this.broadcastStatus();
      setInterval(() => this.broadcastStatus(), 60_000);

      // Announce our presence periodically and update DHT records
      await this.announcePresence();
      setInterval(async () => {
        await this.announcePresence();
        await this.updateDHTRecords();
      }, 10_000); // Every 30 seconds

      // Listen for new peer connections
      this.node.addEventListener("peer:connect", async (evt: any) => {
        const peerId = evt.detail.toString();
        Logger.info("P2P", "New peer connected", { peerId });

        // Try to get ETH address from DHT for this peer
        const ethKey = `/eth/${peerId.toLowerCase()}`;
        try {
          for await (const event of this.node.services.dht.get(
            new TextEncoder().encode(ethKey)
          )) {
            if (event.type === "VALUE") {
              const record = JSON.parse(new TextDecoder().decode(event.value));
              if (record.agentId) {
                Logger.info("P2P", "Found ETH address for new peer", {
                  peerId,
                  ethAddress: record.agentId,
                });
                this.knownPeerToEthMap.set(peerId, record.agentId);
              }
              break;
            }
          }
        } catch (error) {
          // Don't log DHT lookup failures
        }

        await this.updateDHTRecords();
      });
    } catch (error) {
      Logger.error("P2P", "Failed to setup pubsub", { error });
      throw error;
    }
  }

  /**
   * Shares the list of known peers with the network.
   * Broadcasts a list of known peer IDs and their corresponding Ethereum addresses.
   * This helps maintain network connectivity and peer discovery.
   *
   * @returns {Promise<void>}
   */
  private async shareKnownPeers() {
    try {
      const peers = Array.from(this.knownPeerToEthMap.entries()).map(
        ([peerId, ethAddress]) => ({
          peerId,
          ethAddress,
          agentName: this.knownAgentNames.get(ethAddress.toLowerCase()),
        })
      );

      if (peers.length > 0) {
        const message = {
          type: "peer-list",
          peers,
          timestamp: Date.now(),
          fromBootstrap: this.bootstrapMode,
        };

        await this.node.services.pubsub.publish(
          "agent-announcements",
          new TextEncoder().encode(JSON.stringify(message))
        );

        Logger.info("P2P", "Shared known peers", { peerCount: peers.length });
      }
    } catch (error) {
      Logger.error("P2P", "Failed to share known peers", { error });
    }
  }

  /**
   * Verifies and processes an announcement from another agent.
   * Validates the announcement, stores peer mappings, and attempts to establish connections.
   *
   * @param {any} announcement - The announcement message containing peer information
   * @returns {Promise<boolean>} True if the announcement was processed successfully
   */
  private async verifyAndProcessAnnouncement(announcement: any) {
    try {
      const { peerId, agentId, agentName, multiaddrs } = announcement;
      if (!peerId || !agentId || agentId === this.account.address) return false;

      // Store the agent name mapping - use the actual agent name from the announcement
      this.knownAgentNames.set(agentId.toLowerCase(), agentName);

      this.storePeerMapping(peerId, agentId);

      // Try to connect if we have multiaddrs
      if (Array.isArray(multiaddrs)) {
        for (const addr of multiaddrs) {
          try {
            await this.node.dial(multiaddr(addr));
            break;
          } catch (err) {
            continue;
          }
        }
      }

      return true;
    } catch (error) {
      Logger.error("P2P", "Failed to verify announcement", { error });
      return false;
    }
  }

  /**
   * Handles incoming agent messages.
   * Verifies message signatures, decrypts content if encryption is enabled,
   * and emits the message event if it's intended for this agent.
   *
   * @param {P2PAgentMessage} message - The incoming P2P message
   * @returns {Promise<void>}
   */
  private async handleAgentMessage(message: P2PAgentMessage) {
    Logger.info("P2P", "Handling agent message", {
      fromAgentId: message.fromAgentId,
      toAgentId: message.toAgentId,
      messageId: message.messageId,
    });

    // Verify message signature
    const isValid = await this.verifyMessage(message);
    Logger.info("P2P", "Message signature verification: valid", {
      fromAgentId: message.fromAgentId,
      messageId: message.messageId,
    });

    if (!isValid) {
      Logger.warn("P2P", "Invalid message signature", {
        fromAgentId: message.fromAgentId,
        messageId: message.messageId,
      });
      return;
    }

    if (!message.toAgentId) {
      Logger.warn("P2P", "Message has no recipient", {
        fromAgentId: message.fromAgentId,
        messageId: message.messageId,
      });
      return;
    }

    // Check if message is for us (case insensitive)
    const normalizedToAddress = message.toAgentId.toLowerCase();
    const normalizedMyAddress = this.account.address.toLowerCase();
    const isForMe = normalizedToAddress === normalizedMyAddress;

    Logger.info("P2P", "Checking message recipient", {
      toAgentId: message.toAgentId,
      myAddress: this.account.address,
      normalizedToAddress,
      normalizedMyAddress,
      isForMe,
    });

    if (isForMe) {
      Logger.info("P2P", "Message is for me, decrypting", {
        messageId: message.messageId,
      });

      try {
        let decryptedContent: string;
        // Convert the numbered object format to Uint8Array
        const contentArray = Object.values(
          message.content.encrypted
        ) as number[];
        const contentBytes = new Uint8Array(contentArray);

        // Always try to decrypt first
        try {
          Logger.info("P2P", "Message is encrypted, decrypting");
          const decrypted = await decrypt(this.privateKey, contentBytes);
          decryptedContent = new TextDecoder().decode(
            new Uint8Array(decrypted)
          );
        } catch (decryptError) {
          // If decryption fails, treat as unencrypted
          Logger.info("P2P", "Message was not encrypted");
          decryptedContent = new TextDecoder().decode(contentBytes);
        }

        // Create decrypted message object
        const decryptedMessage = {
          messageId: message.messageId,
          fromAgentId: message.fromAgentId,
          toAgentId: message.toAgentId,
          content: decryptedContent,
          timestamp: message.timestamp,
        };

        Logger.info("P2P", "Emitting decrypted message", {
          messageId: message.messageId,
          content: decryptedContent,
          listenerCount: this.listenerCount("message"),
          listeners: this.listeners("message").map(
            (fn) => fn.name || "anonymous"
          ),
        });

        // Emit decrypted message event
        this.emit("message", decryptedMessage);
        this.metrics.messagesReceived++;
      } catch (error) {
        Logger.error("P2P", "Failed to process message", {
          error,
          messageId: message.messageId,
        });
      }
    } else {
      Logger.info("P2P", "Message is not for me, ignoring", {
        messageId: message.messageId,
      });
    }
  }

  /**
   * Verifies if an agent is registered and not blocked in the registry contract.
   *
   * @param {string} agentId - Ethereum address of the agent to verify
   * @returns {Promise<boolean>} True if the agent is registered and not blocked
   */
  private async verifyAgentRegistration(agentId: string): Promise<boolean> {
    try {
      // Check if this Ethereum address is registered and not blocked
      const isRegistered = await this.registryContract.readContract({
        address: this.registryAddress,
        abi: AgentRegistryABI,
        functionName: "isRegistered",
        args: [agentId],
      });

      if (!isRegistered) {
        console.warn(`Unregistered agent attempted connection: ${agentId}`);
        return false;
      }

      // Then get full agent info to check blocked status
      const agentInfo: Agent = await this.registryContract.readContract({
        address: this.registryAddress,
        abi: AgentRegistryABI,
        functionName: "getAgentInfo",
        args: [agentId],
      });

      if (agentInfo.isBlocked) {
        console.warn(`Blocked agent attempted connection: ${agentId}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error verifying agent registration:", err);
      return false;
    }
  }

  /**
   * Registers the agent with the registry contract on the blockchain.
   * If the agent is already registered, the function returns early.
   * Includes the agent's public key in the metadata for message encryption.
   *
   * @returns {Promise<string|void>} Transaction hash if registration was successful
   * @throws {Error} If registration fails for reasons other than already being registered
   */
  async registerWithContract() {
    try {
      // First check if already registered
      const isRegistered = await this.registryContract.readContract({
        address: this.registryAddress,
        abi: AgentRegistryABI,
        functionName: "isRegistered",
        args: [this.account.address],
      });

      if (isRegistered) {
        Logger.info("P2P", "Agent already registered");
        return;
      }

      const walletClient = createWalletClient({
        account: this.account,
        chain: this.chain,
        transport: http(this.rpcUrl),
      });

      // Format metadata as a proper JSON string
      const metadataWithKey = JSON.stringify({
        ...this.metadata,
        publicKey: Buffer.from(this.publicKey).toString("hex"),
      });

      Logger.info("P2P", "Registering agent", {
        name: this.agentName,
        metadata: metadataWithKey,
      });

      const hash = await walletClient.writeContract({
        address: this.registryAddress as `0x${string}`,
        abi: AgentRegistryABI,
        functionName: "registerAgent",
        args: [this.agentName, metadataWithKey],
        account: this.account,
      });

      Logger.info("P2P", "Registration transaction sent", { hash });

      // Wait for transaction confirmation
      const publicClient = createPublicClient({
        chain: this.chain,
        transport: http(this.rpcUrl),
      });

      await publicClient.waitForTransactionReceipt({ hash });
      Logger.info("P2P", "Registration confirmed");

      return hash;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message?.includes("AgentAlreadyRegistered")
      ) {
        Logger.info("P2P", "Agent already registered");
        return;
      }
      Logger.error("P2P", "Failed to register agent", { error });
      throw error;
    }
  }

  /**
   * Sends a message to a specific agent in the network.
   * Handles peer discovery, message encryption, and signature generation.
   * Messages are broadcast through the pubsub system.
   *
   * @param {string} toAgentId - Ethereum address of the recipient
   * @param {string} content - Message content to send
   * @param {string} [conversationId] - Optional ID for threaded conversations
   * @param {string} [replyTo] - Optional ID of the message being replied to
   * @returns {Promise<string>} Message ID of the sent message
   * @throws {Error} If the recipient's PeerId cannot be found or message sending fails
   */
  async sendMessage(
    toAgentId: string,
    content: string,
    conversationId?: string,
    replyTo?: string
  ) {
    try {
      // Log current known peers for debugging
      Logger.info("P2P", "Current known peer mappings", {
        knownPeers: Object.fromEntries(this.knownPeerToEthMap.entries()),
      });

      // Automatically lookup PeerId from Ethereum address
      const targetPeerId = await this.lookupPeerIdByAddress(toAgentId);
      Logger.info("P2P", "Looked up target peer", {
        toAgentId,
        targetPeerId,
        myAddress: this.account.address,
      });

      if (!targetPeerId) {
        // Try to get it from connected peers first
        const connectedPeers = this.node.getPeers();
        Logger.info("P2P", "Looking up peer in connected peers", {
          toAgentId,
          connectedPeers: connectedPeers.map(String),
        });

        // If we can't find the PeerId, throw error
        throw new Error(`Could not find PeerId for address ${toAgentId}`);
      }

      // Try to establish direct connection if not already connected
      try {
        const peer = await this.node.peerStore.get(targetPeerId);
        if (!peer) {
          Logger.info("P2P", "Attempting to establish direct connection", {
            targetPeerId,
            multiaddrs: this.node.getMultiaddrs().map(String),
          });

          // Get peer's multiaddrs if available
          const peerMultiaddrs = await this.node.peerStore.addressBook.get(
            targetPeerId
          );
          if (peerMultiaddrs && peerMultiaddrs.length > 0) {
            Logger.info("P2P", "Found peer multiaddrs", {
              targetPeerId,
              multiaddrs: peerMultiaddrs.map(String),
            });
          }

          await this.node.dial(targetPeerId);
          Logger.info("P2P", "Successfully established direct connection", {
            targetPeerId,
          });
        }
      } catch (error) {
        Logger.warn("P2P", "Failed to establish direct connection", {
          targetPeerId,
          error,
        });
        // Continue anyway as message might route through other peers
      }

      let encryptedContent: EncryptedMessage;

      if (this.useEncryption) {
        const recipientPublicKey = await this.getPublicKeyFromContract(
          toAgentId
        );
        const contentBytes = new TextEncoder().encode(content);
        const encrypted = await encrypt(recipientPublicKey, contentBytes);
        encryptedContent = { encrypted: new Uint8Array(encrypted) };
        Logger.info("P2P", "Message encrypted successfully");
      } else {
        const contentBytes = Array.from(new TextEncoder().encode(content));
        encryptedContent = { encrypted: contentBytes };
        Logger.info("P2P", "Message prepared (unencrypted mode)");
      }

      const messageData = {
        messageId: `${this.account.address}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        fromAgentId: this.account.address,
        toAgentId,
        content: encryptedContent,
        timestamp: Date.now(),
        nonce: Date.now(),
      };

      Logger.info("P2P", "Preparing to send message", {
        messageId: messageData.messageId,
        fromAgentId: messageData.fromAgentId,
        toAgentId: messageData.toAgentId,
      });

      const signature = await this.signMessage(messageData);
      const message: P2PAgentMessage = { ...messageData, signature };

      Logger.info("P2P", "Publishing message to pubsub", {
        topic: "agent-messages",
        messageId: message.messageId,
      });

      // Wrap the message in the expected format
      const wrappedMessage = { message };
      await this.node.services.pubsub.publish(
        "agent-messages",
        new TextEncoder().encode(JSON.stringify(wrappedMessage))
      );

      Logger.info("P2P", "Message published successfully", {
        messageId: message.messageId,
      });

      this.metrics.messagesSent++;

      return message.messageId;
    } catch (error) {
      Logger.error("P2P", "Error sending message", { error, toAgentId });
      throw error;
    }
  }

  /**
   * Retrieves an agent's public key from their metadata in the registry contract.
   *
   * @param {string} address - Ethereum address of the agent
   * @returns {Promise<Uint8Array>} The agent's public key as a byte array
   * @throws {Error} If the public key cannot be retrieved or decoded
   */
  private async getPublicKeyFromContract(address: string): Promise<Uint8Array> {
    try {
      const agentInfo = await this.registryContract.readContract({
        address: this.registryAddress,
        abi: AgentRegistryABI,
        functionName: "getAgentInfo",
        args: [address],
      });

      const metadata = JSON.parse(agentInfo.metadata);
      return new Uint8Array(Buffer.from(metadata.publicKey, "hex"));
    } catch (error) {
      console.error("Error getting public key:", error);
      throw error;
    }
  }

  /**
   * Returns the Ethereum address of this agent.
   *
   * @returns {string} The agent's Ethereum address
   */
  getAddress(): string {
    return this.account.address;
  }

  /**
   * Returns a list of known peer IDs in the network.
   *
   * @returns {string[]} Array of peer IDs
   */
  getPeers(): string[] {
    return Array.from(this.knownPeers);
  }

  /**
   * Establishes connections to bootstrap nodes.
   * For bootstrap nodes, connects to other bootstrap nodes.
   * For regular agents, attempts to connect to all bootstrap nodes.
   * Also sets up periodic DHT status checks for bootstrap nodes.
   *
   * @returns {Promise<void>}
   */
  private async connectToBootstrapNodes() {
    if (!this.bootstrapMode) {
      Logger.info("P2P", "Connecting to bootstrap nodes");

      for (const addr of this.bootstrapNodes) {
        try {
          await this.node.dial(multiaddr(addr));
          Logger.info("P2P", "Connected to bootstrap node", { addr });
        } catch (err) {
          Logger.warn("P2P", "Failed to connect to bootstrap node", {
            addr,
            error: err,
          });
        }
      }
      return;
    }

    // For bootstrap nodes, connect to other bootstrap nodes
    Logger.info("P2P", "Bootstrap node connecting to peers", {
      addresses: this.bootstrapNodes.filter(
        (addr) => !addr.includes(this.node.peerId.toString())
      ),
    });

    for (const addr of this.bootstrapNodes) {
      if (!addr.includes(this.node.peerId.toString())) {
        try {
          await this.node.dial(multiaddr(addr));
          Logger.info("P2P", "Connected to peer", { addr });
        } catch (err) {
          Logger.warn("P2P", "Failed to connect to peer", {
            addr,
            error: err,
          });
        }
      }
    }

    // Start periodic DHT check for bootstrap nodes
    setInterval(async () => {
      try {
        // Get all DHT records
        const records = await this.getDHTRecords();

        Logger.info("P2P", "Bootstrap DHT Status", {
          routingTableSize: this.node.services.dht.routingTable.size,
          connectedPeers: this.node.getPeers().length,
          dhtRecords: records,
          myPeerId: this.node.peerId.toString(),
          myAddress: this.account.address,
        });
      } catch (error) {
        Logger.error("P2P", "Bootstrap DHT check failed", { error });
      }
    }, 30_000);
  }

  /**
   * Retrieves all known peer records from the DHT.
   * Combines information from connected peers and local peer mappings.
   * Used for network discovery and peer tracking.
   *
   * @returns {Promise<Record<string, any>>} Object mapping Ethereum addresses to peer information
   */
  public async getDHTRecords(): Promise<Record<string, any>> {
    const records: Record<string, any> = {};
    try {
      // Get all connected peers
      const peers = this.node.getPeers();

      // Use our local known peer mappings
      for (const [peerId, ethAddr] of this.knownPeerToEthMap.entries()) {
        const lowercaseAddr = ethAddr.toLowerCase();
        records[lowercaseAddr] = {
          peerId,
          timestamp: Date.now(),
          agentId: ethAddr,
          agentName:
            this.knownAgentNames.get(lowercaseAddr) ||
            `Agent ${ethAddr.slice(0, 6)}`,
        };
      }
    } catch (error) {
      Logger.error("P2P", "Failed to discover peers", { error });
    }
    return records;
  }

  /**
   * Waits for the DHT to be ready and functional.
   * Tests DHT functionality by attempting to put and get a test value.
   * Ensures connection to bootstrap nodes before proceeding.
   *
   * @returns {Promise<void>}
   * @throws {Error} If DHT is not ready after maximum attempts
   */
  private async waitForDHT(): Promise<void> {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Check if we're connected to any bootstrap nodes
        const connectedPeers = this.node.getPeers();
        const connectedToBootstrap = this.bootstrapNodes.some((addr) =>
          connectedPeers.some((peer: { toString: () => string }) =>
            addr.includes(peer.toString())
          )
        );

        if (!connectedToBootstrap) {
          Logger.warn(
            "P2P",
            "Not connected to any bootstrap nodes, retrying..."
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Try to put and get a test value in DHT
        const testKey = `/test/${this.node.peerId.toString()}`;
        const testValue = new TextEncoder().encode(
          JSON.stringify({ timestamp: Date.now() })
        );

        try {
          await this.node.services.dht.put(testKey, testValue);
          const retrieved = await this.node.services.dht.get(testKey);

          if (retrieved instanceof Uint8Array) {
            Logger.info("P2P", "DHT is ready", {
              connectedPeers: connectedPeers.length,
              bootstrapConnections: this.bootstrapNodes.filter((addr) =>
                connectedPeers.some((peer: { toString: () => string }) =>
                  addr.includes(peer.toString())
                )
              ),
            });
            return;
          }
        } catch (err) {
          Logger.warn("P2P", "DHT test failed", { error: err, attempt: i + 1 });
        }

        Logger.warn("P2P", "DHT not ready yet", {
          attempt: i + 1,
          maxAttempts,
          connectedPeers: connectedPeers.length,
        });
      } catch (err) {
        Logger.warn("P2P", "Error checking DHT readiness", {
          error: err,
          attempt: i + 1,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("DHT not ready after maximum attempts");
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      peersCount: this.knownPeers.size,
    };
  }

  // Getter for libp2p node
  getLibp2p() {
    return this.node;
  }

  /**
   * Publishes this agent's information to the DHT network.
   * Announces presence via both DHT and pubsub for redundancy.
   * Includes agent's multiaddrs for direct connection capability.
   *
   * @returns {Promise<void>}
   */
  private async publishToDHT() {
    try {
      // Provide our ETH address to the DHT network
      const ethKey = `/eth/${this.account.address.toLowerCase()}`;
      const encodedKey = new TextEncoder().encode(ethKey);

      try {
        // Use DHT's provide mechanism for peer discovery
        for await (const result of this.node.services.dht.provide(encodedKey)) {
          if (result.type === "FINAL_PEER") {
            Logger.info("P2P", "Successfully provided presence to DHT");
          }
        }
      } catch (err) {
        Logger.error("P2P", "Failed to provide to DHT", { error: err });
      }

      // Announce via pubsub for immediate peer updates
      const announcement = {
        peerId: this.node.peerId.toString(),
        timestamp: Date.now(),
        agentId: this.account.address,
        agentName: this.agentName,
        multiaddrs: this.node
          .getMultiaddrs()
          .map((addr: Multiaddr) => addr.toString()),
        isBootstrap: this.bootstrapMode,
      };

      await this.node.services.pubsub.publish(
        "agent-announcements",
        new TextEncoder().encode(JSON.stringify({ message: announcement }))
      );
    } catch (error) {
      Logger.error("P2P", "Failed to publish to network", { error });
    }
  }

  /**
   * Looks up a peer's libp2p ID using their Ethereum address.
   * First checks local mappings, then queries the DHT if not found locally.
   *
   * @param {string} ethAddress - Ethereum address to look up
   * @returns {Promise<string|null>} The peer's libp2p ID if found, null otherwise
   */
  private async lookupPeerIdByAddress(
    ethAddress: string
  ): Promise<string | null> {
    try {
      // First check our local known peers mapping
      const knownPeers = this.getKnownPeers();
      for (const [peerId, addr] of knownPeers.entries()) {
        if (addr.toLowerCase() === ethAddress.toLowerCase()) {
          Logger.info("P2P", "Found peer in local mapping", {
            ethAddress,
            peerId,
          });
          return peerId;
        }
      }

      // If not found locally, use DHT's findProviders
      const ethKey = `/eth/${ethAddress.toLowerCase()}`;
      const encodedKey = new TextEncoder().encode(ethKey);

      for await (const event of this.node.services.dht.findProviders(
        encodedKey
      )) {
        if (event.type === "PROVIDER") {
          const peerId = event.provider.toString();
          Logger.info("P2P", "Found peer via DHT", {
            ethAddress,
            peerId,
          });
          // Store in local mapping for future lookups
          this.storePeerMapping(peerId, ethAddress);
          return peerId;
        }
      }

      Logger.info("P2P", "No peer found for address in DHT", {
        ethAddress,
      });
      return null;
    } catch (error) {
      Logger.error("P2P", "DHT lookup failed", { error, ethAddress });
      return null;
    }
  }

  /**
   * Gracefully stops the P2P network node.
   * Clears update intervals and stops the libp2p node.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.node) {
      await this.node.stop();
    }
  }

  /**
   * Verifies that a bootstrap node is using the correct peer ID.
   * Loads the expected peer ID from the bootstrap keys file and compares it with the current node's peer ID.
   * Only applicable for bootstrap nodes.
   *
   * @returns {Promise<void>}
   * @throws {Error} If the peer ID verification fails or bootstrap key cannot be loaded
   */
  private async verifyBootstrapNode() {
    if (this.bootstrapMode) {
      try {
        const keyData = JSON.parse(
          await fs.readFile(
            `./bootstrap-keys/${this.agentName}-peer.json`,
            "utf8"
          )
        );

        const currentPeerId = this.node.peerId.toString();
        Logger.info("P2P", "Verifying bootstrap node PeerId", {
          expected: keyData.id,
          actual: currentPeerId,
        });

        if (currentPeerId !== keyData.id) {
          throw new Error(
            `Invalid PeerId for bootstrap node. Expected ${keyData.id}, got ${currentPeerId}`
          );
        }
      } catch (error) {
        throw new Error(
          `Failed to load bootstrap key for ${this.agentName}: ${error}`
        );
      }
    }
  }

  /**
   * Signs a message using the agent's Ethereum private key.
   * Used to ensure message authenticity and prevent tampering.
   *
   * @param {Omit<P2PAgentMessage, "signature">} message - Message to sign
   * @returns {Promise<`0x${string}`>} Ethereum signature of the message
   */
  private async signMessage(
    message: Omit<P2PAgentMessage, "signature">
  ): Promise<`0x${string}`> {
    const walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
    return await walletClient.signMessage({
      message: JSON.stringify(message),
      account: this.account,
    });
  }

  /**
   * Verifies a message's signature to ensure it was sent by the claimed sender.
   *
   * @param {P2PAgentMessage} message - Message to verify
   * @returns {Promise<boolean>} True if the signature is valid
   */
  private async verifyMessage(message: P2PAgentMessage): Promise<boolean> {
    const { signature, ...rest } = message;
    const publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
    return await publicClient.verifyMessage({
      address: message.fromAgentId as `0x${string}`,
      message: JSON.stringify(rest),
      signature: signature as `0x${string}`,
    });
  }

  /**
   * Handles new peer connections to the network.
   * Enforces connection limits and drops excess connections.
   *
   * @param {any} connection - The new connection object
   * @returns {Promise<void>}
   */
  private async handleNewConnection(connection: any) {
    const currentConnections = this.node.getConnections().length;
    if (currentConnections > this.MAX_CONNECTIONS) {
      Logger.warn("P2P", "Connection limit reached, dropping connection");
      await connection.close();
      return;
    }
  }

  /**
   * Retrieves a list of all connected agents in the network.
   * Queries the DHT for agent information and maps peer IDs to Ethereum addresses.
   *
   * @returns {Promise<Array<{ id: string; address: string }>>} Array of connected agents
   */
  async getConnectedAgents(): Promise<Array<{ id: string; address: string }>> {
    try {
      const agents = new Map<string, { id: string; address: string }>();
      this.emit("log", "🔍 Querying DHT for agents...");

      // Query all peers in our DHT routing table
      const peers = this.node.getPeers();
      for (const peer of peers) {
        try {
          // Try to get ETH address for each peer
          const value = await this.node.services.dht.get(
            `/eth-addresses/${peer.toString().toLowerCase()}`
          );
          if (value) {
            const address = new TextDecoder().decode(value);
            agents.set(address, {
              id: peer.toString(),
              address,
            });
            this.emit(
              "log",
              `✅ Found agent: ${address} (${peer
                .toString()
                .substring(0, 10)}...)`
            );
          }
        } catch (err) {
          // Skip peers without ETH address records
          continue;
        }
      }

      this.emit("log", `✨ Found ${agents.size} agents`);
      return Array.from(agents.values());
    } catch (error) {
      this.emit("log", `🚫 Agent query failed: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Waits for a successful connection to at least one bootstrap node.
   * Polls the connection status every second until connected.
   *
   * @returns {Promise<void>}
   */
  public async waitForBootstrapConnection(): Promise<void> {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        const peers = this.node.getPeers();
        if (peers.length > 0) {
          clearInterval(check);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Broadcasts the node's current status to the network.
   * Includes metrics, connected peers, and other node information.
   *
   * @returns {Promise<void>}
   */
  private async broadcastStatus() {
    try {
      const statusData = {
        messageId: `status-${this.account.address}-${Date.now()}`,
        fromAgentId: this.account.address,
        content: {
          encrypted: new TextEncoder().encode(
            JSON.stringify({
              peerId: this.node.peerId.toString(),
              metrics: {
                connectedPeers: this.node.getPeers().length,
                messagesSent: this.metrics.messagesSent,
                messagesReceived: this.metrics.messagesReceived,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                dhtSize: this.node.services.dht.routingTable.size,
                multiaddrs: this.node.getMultiaddrs().map(String),
                isBootstrap: this.agentName.startsWith("bootstrap-"),
                lastMessageTime: this.metrics.lastMessageTime,
              },
            })
          ),
        },
        timestamp: Date.now(),
        nonce: Date.now(),
      };

      const signature = await this.signMessage(statusData);
      const signedStatus = { ...statusData, signature };

      await this.node.services.pubsub.publish(
        "node-status",
        new TextEncoder().encode(JSON.stringify(signedStatus))
      );

      Logger.info("P2P", "Published node status");
    } catch (error) {
      Logger.error("P2P", "Failed to broadcast status", { error });
    }
  }

  /**
   * Handles status updates received from other nodes.
   * Verifies the status message signature and stores the latest status.
   *
   * @param {any} status - Status update message
   * @returns {Promise<void>}
   */
  private async handleStatusUpdate(status: any) {
    try {
      // Verify signature
      const isValid = await this.verifyMessage(status);
      if (!isValid) {
        Logger.warn("P2P", "Received status update with invalid signature", {
          fromAgentId: status.agentId,
        });
        return;
      }

      // Store latest status
      this.nodeStatuses.set(status.agentId, {
        ...status,
        receivedAt: Date.now(),
      });

      // Emit status update event
      this.emit("status-update", status);
    } catch (error) {
      Logger.error("P2P", "Failed to handle status update", { error });
    }
  }

  /**
   * Returns the current network status including all node statuses.
   * Cleans up old status entries older than 2 minutes.
   *
   * @returns {Array<any>} Array of node status objects
   */
  public getNetworkStatus(): Array<any> {
    // Clean up old statuses (older than 2 minutes)
    const now = Date.now();
    for (const [agentId, status] of this.nodeStatuses.entries()) {
      if (now - status.receivedAt > 120_000) {
        this.nodeStatuses.delete(agentId);
      }
    }

    return Array.from(this.nodeStatuses.values());
  }

  /**
   * Starts the peer discovery process.
   * For bootstrap nodes, connects to other bootstrap nodes.
   * For regular nodes, ensures connection to at least one bootstrap node.
   *
   * @returns {Promise<void>}
   * @throws {Error} If unable to connect to any bootstrap nodes
   */
  public async startDiscovery() {
    // Bootstrap nodes should connect to each other and share records
    if (this.agentName.startsWith("bootstrap-")) {
      const otherBootstrapNodes = getBootstrapNodes(this.networkName).filter(
        (addr) => !addr.includes(this.node.peerId.toString())
      );

      Logger.info("P2P", "Connecting to other bootstrap nodes", {
        addresses: otherBootstrapNodes,
      });

      // Try to connect to each bootstrap node multiple times
      for (const addr of otherBootstrapNodes) {
        let connected = false;
        for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
          try {
            // Use dns4 instead of ip4 to handle hostname resolution
            const dnsAddr = addr.replace("/ip4/", "/dns4/");
            await this.node.dial(multiaddr(dnsAddr), {
              signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            // Extract peerId and store mapping for other bootstrap node
            const peerId = addr.split("/p2p/")[1];
            // Each bootstrap node's ETH address is in their multiaddr
            const bootstrapAddrs = {
              "bootstrap-1": "0xb9AE5BEDEE9768A9347798BD69bd9FCF6E557ab1",
              "bootstrap-2": "0x87886dd580de7daae4bc0a204a50a73f89281b28",
              "bootstrap-3": "0x1d1c89b79fc02bbc6f56c256e8ab5c4db890b2c3",
              "bootstrap-4": "0x4d1c89b79fc02bbc6f56c256e8ab5c4db890b2c4",
            };

            // Find which bootstrap node this is
            const bootstrapNum = Object.entries(bootstrapAddrs).find(
              ([name, _]) => addr.includes(name.replace("bootstrap-", "us-"))
            )?.[0];

            if (
              bootstrapNum &&
              bootstrapAddrs[bootstrapNum as keyof typeof bootstrapAddrs]
            ) {
              const ethAddr =
                bootstrapAddrs[bootstrapNum as keyof typeof bootstrapAddrs];
              this.knownPeerToEthMap.set(peerId, ethAddr);

              // Also store in DHT
              const key = `/eth/${ethAddr.toLowerCase()}`;
              const record = {
                peerId,
                timestamp: Date.now(),
                agentId: ethAddr,
                agentName: this.agentName,
                multiaddrs: [addr],
              };
              await this.node.services.dht.put(
                key,
                new TextEncoder().encode(JSON.stringify(record))
              );

              Logger.info(
                "P2P",
                `Connected to and stored bootstrap node ${bootstrapNum}`,
                {
                  peerId,
                  ethAddr,
                  multiaddr: addr,
                }
              );
            }

            connected = true;
          } catch (error) {
            Logger.warn(
              "P2P",
              `Failed to connect to bootstrap node ${addr} (attempt ${attempt}/3)`,
              { error }
            );
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }
          }
        }
      }

      // Start DHT in bootstrap mode
      await this.node.services.dht.start();
      Logger.info("P2P", "Started DHT in bootstrap mode");
    }

    // For regular nodes, ensure we have at least one bootstrap connection
    else {
      let connected = false;
      for (let attempt = 1; attempt <= 5 && !connected; attempt++) {
        for (const addr of this.bootstrapNodes) {
          try {
            const dnsAddr = addr.replace("/ip4/", "/dns4/");
            await this.node.dial(multiaddr(dnsAddr), {
              signal: AbortSignal.timeout(10000),
            });
            Logger.info("P2P", `Connected to bootstrap node ${addr}`);
            connected = true;
            break;
          } catch (error) {
            Logger.warn(
              "P2P",
              `Failed to connect to bootstrap node ${addr} (attempt ${attempt}/5)`,
              { error }
            );
          }
        }
        if (!connected && attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      if (!connected) {
        throw new Error(
          "Failed to connect to any bootstrap nodes after 5 attempts"
        );
      }
    }
  }

  /**
   * Announces this node's presence to the network.
   * Broadcasts node information including multiaddrs for direct connections.
   *
   * @returns {Promise<void>}
   */
  private async announcePresence() {
    try {
      const announcement = {
        peerId: this.node.peerId.toString(),
        timestamp: Date.now(),
        agentId: this.account.address,
        agentName: this.agentName,
        multiaddrs: this.node
          .getMultiaddrs()
          .map((addr: Multiaddr) => addr.toString()),
        isBootstrap: this.bootstrapMode,
      };

      await this.node.services.pubsub.publish(
        "agent-announcements",
        new TextEncoder().encode(JSON.stringify({ message: announcement }))
      );
    } catch (error) {
      Logger.error("P2P", "Failed to announce presence", { error });
    }
  }

  /**
   * Updates and retrieves the current DHT records.
   *
   * @returns {Promise<Record<string, any>>}
   */
  private async updateDHTRecords() {
    const records = await this.getDHTRecords();
    return records;
  }

  /**
   * Returns the map of known peer IDs to their Ethereum addresses.
   *
   * @returns {Map<string, string>}
   */
  public getKnownPeers(): Map<string, string> {
    return this.knownPeerToEthMap;
  }

  /**
   * Starts periodic DHT maintenance tasks.
   * Publishes presence and updates DHT records every minute.
   *
   * @returns {Promise<void>}
   */
  private async startDHTMaintenance() {
    // Publish our presence immediately
    await this.publishToDHT();

    // Query DHT records every minute
    setInterval(async () => {
      try {
        // First announce our presence
        await this.publishToDHT();

        // Then get records from bootstrap nodes
        const records = await this.getDHTRecords();

        // Log the current state
        Logger.info("P2P", "DHT State", {
          type: this.bootstrapMode ? "bootstrap" : "agent",
          myAddress: this.account.address,
          myPeerId: this.node.peerId.toString(),
          connectedPeers: this.node.getPeers().length,
          knownPeers: Array.from(this.knownPeerToEthMap.entries()).map(
            ([peerId, addr]) => ({
              peerId,
              address: addr,
            })
          ),
          recordCount: Object.keys(records).length,
        });
      } catch (error) {
        Logger.error("P2P", "Failed to update DHT records", { error });
      }
    }, 60_000); // Every minute
  }

  /**
   * Stores a mapping between a peer ID and their Ethereum address.
   *
   * @param {string} peerId - The peer's libp2p ID
   * @param {string} ethAddress - The peer's Ethereum address
   */
  private storePeerMapping(peerId: string, ethAddress: string) {
    this.knownPeerToEthMap.set(peerId, ethAddress);
  }
}
