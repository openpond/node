import "./polyfills";
import type { PrivateKey } from "@libp2p/interface";
import { EventEmitter } from "events";
import { NetworkName } from "./networks";
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
 * P2PNetwork class implements a decentralized peer-to-peer network using libp2p.
 * It provides functionality for agent discovery, message exchange, and network maintenance.
 * @extends EventEmitter
 */
export declare class P2PNetwork extends EventEmitter {
    private agentName;
    private version;
    private metadata;
    private registryAddress;
    private rpcUrl;
    private networkName;
    private node;
    private account;
    private knownPeers;
    private registryContract;
    private publicKey;
    private privateKey;
    private useEncryption;
    private chain;
    private metrics;
    private peerId;
    private dht;
    private bootstrapMode;
    private updateInterval;
    private lastDHTUpdate;
    private readonly MIN_DHT_UPDATE_INTERVAL;
    private readonly MAX_CONNECTIONS;
    private bootstrapNodes;
    private nodeStatuses;
    private knownPeerToEthMap;
    private knownAgentNames;
    private readonly DHT_OPERATION_TIMEOUT;
    private readonly DHT_GET_TIMEOUT;
    private readonly DHT_PUT_TIMEOUT;
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
    constructor(privateKey: string, agentName: string, version: string, metadata: AgentMetadata, registryAddress?: string, rpcUrl?: string, networkName?: NetworkName, useEncryption?: boolean);
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
    start(port: number, bootstrapKey?: PrivateKey): Promise<any>;
    /**
     * Sets up the publish/subscribe system for the P2P network.
     * Subscribes to various channels including agent announcements, messages, and node status.
     * Sets up message handlers and starts periodic status broadcasts.
     *
     * @returns {Promise<void>}
     * @throws {Error} If pubsub setup fails
     */
    setupPubSub(): Promise<void>;
    /**
     * Shares the list of known peers with the network.
     * Broadcasts a list of known peer IDs and their corresponding Ethereum addresses.
     * This helps maintain network connectivity and peer discovery.
     *
     * @returns {Promise<void>}
     */
    private shareKnownPeers;
    /**
     * Verifies and processes an announcement from another agent.
     * Validates the announcement, stores peer mappings, and attempts to establish connections.
     *
     * @param {any} announcement - The announcement message containing peer information
     * @returns {Promise<boolean>} True if the announcement was processed successfully
     */
    private verifyAndProcessAnnouncement;
    /**
     * Handles incoming agent messages.
     * Verifies message signatures, decrypts content if encryption is enabled,
     * and emits the message event if it's intended for this agent.
     *
     * @param {P2PAgentMessage} message - The incoming P2P message
     * @returns {Promise<void>}
     */
    private handleAgentMessage;
    /**
     * Verifies if an agent is registered and not blocked in the registry contract.
     *
     * @param {string} agentId - Ethereum address of the agent to verify
     * @returns {Promise<boolean>} True if the agent is registered and not blocked
     */
    private verifyAgentRegistration;
    /**
     * Registers the agent with the registry contract on the blockchain.
     * If the agent is already registered, the function returns early.
     * Includes the agent's public key in the metadata for message encryption.
     *
     * @returns {Promise<string|void>} Transaction hash if registration was successful
     * @throws {Error} If registration fails for reasons other than already being registered
     */
    registerWithContract(): Promise<`0x${string}` | undefined>;
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
    sendMessage(toAgentId: string, content: string, conversationId?: string, replyTo?: string): Promise<string>;
    /**
     * Retrieves an agent's public key from their metadata in the registry contract.
     *
     * @param {string} address - Ethereum address of the agent
     * @returns {Promise<Uint8Array>} The agent's public key as a byte array
     * @throws {Error} If the public key cannot be retrieved or decoded
     */
    private getPublicKeyFromContract;
    /**
     * Returns the Ethereum address of this agent.
     *
     * @returns {string} The agent's Ethereum address
     */
    getAddress(): string;
    /**
     * Returns a list of known peer IDs in the network.
     *
     * @returns {string[]} Array of peer IDs
     */
    getPeers(): string[];
    /**
     * Establishes connections to bootstrap nodes.
     * For bootstrap nodes, connects to other bootstrap nodes.
     * For regular agents, attempts to connect to all bootstrap nodes.
     * Also sets up periodic DHT status checks for bootstrap nodes.
     *
     * @returns {Promise<void>}
     */
    private connectToBootstrapNodes;
    /**
     * Retrieves all known peer records from the DHT.
     * Combines information from connected peers and local peer mappings.
     * Used for network discovery and peer tracking.
     *
     * @returns {Promise<Record<string, any>>} Object mapping Ethereum addresses to peer information
     */
    getDHTRecords(): Promise<Record<string, any>>;
    /**
     * Waits for the DHT to be ready and functional.
     * Tests DHT functionality by attempting to put and get a test value.
     * Ensures connection to bootstrap nodes before proceeding.
     *
     * @returns {Promise<void>}
     * @throws {Error} If DHT is not ready after maximum attempts
     */
    private waitForDHT;
    getMetrics(): {
        uptime: number;
        peersCount: number;
        connectedPeers: number;
        messagesSent: number;
        messagesReceived: number;
        lastMessageTime: number;
        startTime: number;
    };
    getLibp2p(): any;
    /**
     * Publishes this agent's information to the DHT network.
     * Announces presence via both DHT and pubsub for redundancy.
     * Includes agent's multiaddrs for direct connection capability.
     *
     * @returns {Promise<void>}
     */
    private publishToDHT;
    /**
     * Looks up a peer's libp2p ID using their Ethereum address.
     * First checks local mappings, then queries the DHT if not found locally.
     *
     * @param {string} ethAddress - Ethereum address to look up
     * @returns {Promise<string|null>} The peer's libp2p ID if found, null otherwise
     */
    private lookupPeerIdByAddress;
    /**
     * Gracefully stops the P2P network node.
     * Clears update intervals and stops the libp2p node.
     *
     * @returns {Promise<void>}
     */
    stop(): Promise<void>;
    /**
     * Verifies that a bootstrap node is using the correct peer ID.
     * Loads the expected peer ID from the bootstrap keys file and compares it with the current node's peer ID.
     * Only applicable for bootstrap nodes.
     *
     * @returns {Promise<void>}
     * @throws {Error} If the peer ID verification fails or bootstrap key cannot be loaded
     */
    private verifyBootstrapNode;
    /**
     * Signs a message using the agent's Ethereum private key.
     * Used to ensure message authenticity and prevent tampering.
     *
     * @param {Omit<P2PAgentMessage, "signature">} message - Message to sign
     * @returns {Promise<`0x${string}`>} Ethereum signature of the message
     */
    private signMessage;
    /**
     * Verifies a message's signature to ensure it was sent by the claimed sender.
     *
     * @param {P2PAgentMessage} message - Message to verify
     * @returns {Promise<boolean>} True if the signature is valid
     */
    private verifyMessage;
    /**
     * Handles new peer connections to the network.
     * Enforces connection limits and drops excess connections.
     *
     * @param {any} connection - The new connection object
     * @returns {Promise<void>}
     */
    private handleNewConnection;
    /**
     * Retrieves a list of all connected agents in the network.
     * Queries the DHT for agent information and maps peer IDs to Ethereum addresses.
     *
     * @returns {Promise<Array<{ id: string; address: string }>>} Array of connected agents
     */
    getConnectedAgents(): Promise<Array<{
        id: string;
        address: string;
    }>>;
    /**
     * Waits for a successful connection to at least one bootstrap node.
     * Polls the connection status every second until connected.
     *
     * @returns {Promise<void>}
     */
    waitForBootstrapConnection(): Promise<void>;
    /**
     * Broadcasts the node's current status to the network.
     * Includes metrics, connected peers, and other node information.
     *
     * @returns {Promise<void>}
     */
    private broadcastStatus;
    /**
     * Handles status updates received from other nodes.
     * Verifies the status message signature and stores the latest status.
     *
     * @param {any} status - Status update message
     * @returns {Promise<void>}
     */
    private handleStatusUpdate;
    /**
     * Returns the current network status including all node statuses.
     * Cleans up old status entries older than 2 minutes.
     *
     * @returns {Array<any>} Array of node status objects
     */
    getNetworkStatus(): Array<any>;
    /**
     * Starts the peer discovery process.
     * For bootstrap nodes, connects to other bootstrap nodes.
     * For regular nodes, ensures connection to at least one bootstrap node.
     *
     * @returns {Promise<void>}
     * @throws {Error} If unable to connect to any bootstrap nodes
     */
    startDiscovery(): Promise<void>;
    /**
     * Announces this node's presence to the network.
     * Broadcasts node information including multiaddrs for direct connections.
     *
     * @returns {Promise<void>}
     */
    private announcePresence;
    /**
     * Updates and retrieves the current DHT records.
     *
     * @returns {Promise<Record<string, any>>}
     */
    private updateDHTRecords;
    /**
     * Returns the map of known peer IDs to their Ethereum addresses.
     *
     * @returns {Map<string, string>}
     */
    getKnownPeers(): Map<string, string>;
    /**
     * Starts periodic DHT maintenance tasks.
     * Publishes presence and updates DHT records every minute.
     *
     * @returns {Promise<void>}
     */
    private startDHTMaintenance;
    /**
     * Stores a mapping between a peer ID and their Ethereum address.
     *
     * @param {string} peerId - The peer's libp2p ID
     * @param {string} ethAddress - The peer's Ethereum address
     */
    private storePeerMapping;
}
export {};
