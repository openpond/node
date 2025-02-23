/**
 * Defines the possible roles a node can have in the P2P network.
 */
export enum NodeRole {
  /** Bootstrap nodes that maintain network connectivity */
  BOOTSTRAP = "BOOTSTRAP",
  /** Regular nodes with full capabilities */
  FULL = "FULL",
  /** Server nodes for message relay/storage */
  SERVER = "SERVER",
  /** Lightweight nodes for direct messaging only */
  LIGHT = "LIGHT",
}

/**
 * Configuration interface for different node roles.
 */
export interface NodeConfiguration {
  /** Maximum number of simultaneous connections allowed */
  maxConnections: number;
  /** Whether to enable the gossip protocol */
  enableGossip: boolean;
  /** Whether to enable DHT functionality */
  enableDHT: boolean;
  /** Whether to run DHT in server mode (false for client mode) */
  dhtServerMode: boolean;
  /** Minimum number of connections to maintain */
  minConnections: number;
  /** Whether connection to bootstrap nodes is required */
  bootstrapRequired: boolean;
  /** Maximum number of parallel connection attempts */
  maxParallelDials: number;
  /** Connection timeout in milliseconds */
  dialTimeout: number;
  /** Interval for automatic connection attempts in milliseconds */
  autoDialInterval: number;
  /** Whether to relay messages not intended for this node (server mode) */
  relayMessages: boolean;
  /** Maximum size of the DHT k-bucket for this node */
  kBucketSize: number;
  /** Maximum number of inbound streams for DHT */
  maxDHTInboundStreams: number;
  /** Maximum number of outbound streams for DHT */
  maxDHTOutboundStreams: number;
  /** Interval for gossip protocol heartbeat in milliseconds */
  gossipHeartbeatInterval: number;
  /** Whether to allow publishing to zero topic peers */
  allowPublishToZeroPeers: boolean;
  /** Whether to emit messages to self */
  emitSelf: boolean;
  /** Interval for DHT status updates in milliseconds */
  dhtUpdateInterval: number;
  /** Minimum interval between DHT updates in milliseconds */
  minDHTUpdateInterval: number;
}

/**
 * Default configurations for each node role.
 */
export const roleConfigs: Record<NodeRole, NodeConfiguration> = {
  [NodeRole.BOOTSTRAP]: {
    maxConnections: 1000,
    enableGossip: true,
    enableDHT: true,
    dhtServerMode: true,
    minConnections: 3,
    bootstrapRequired: false,
    maxParallelDials: 100,
    dialTimeout: 30000,
    autoDialInterval: 10000,
    relayMessages: false,
    kBucketSize: 200,
    maxDHTInboundStreams: 5000,
    maxDHTOutboundStreams: 5000,
    gossipHeartbeatInterval: 1000,
    allowPublishToZeroPeers: true,
    emitSelf: true,
    dhtUpdateInterval: 30000,
    minDHTUpdateInterval: 10000,
  },
  [NodeRole.FULL]: {
    maxConnections: 50,
    enableGossip: true,
    enableDHT: true,
    dhtServerMode: false,
    minConnections: 1,
    bootstrapRequired: true,
    maxParallelDials: 25,
    dialTimeout: 30000,
    autoDialInterval: 10000,
    relayMessages: false,
    kBucketSize: 20,
    maxDHTInboundStreams: 5000,
    maxDHTOutboundStreams: 5000,
    gossipHeartbeatInterval: 1000,
    allowPublishToZeroPeers: true,
    emitSelf: true,
    dhtUpdateInterval: 60000,
    minDHTUpdateInterval: 20000,
  },
  [NodeRole.SERVER]: {
    maxConnections: 100,
    enableGossip: true,
    enableDHT: true,
    dhtServerMode: false,
    minConnections: 2,
    bootstrapRequired: true,
    maxParallelDials: 50,
    dialTimeout: 30000,
    autoDialInterval: 10000,
    relayMessages: true,
    kBucketSize: 20,
    maxDHTInboundStreams: 5000,
    maxDHTOutboundStreams: 5000,
    gossipHeartbeatInterval: 1000,
    allowPublishToZeroPeers: true,
    emitSelf: true,
    dhtUpdateInterval: 45000,
    minDHTUpdateInterval: 15000,
  },
  [NodeRole.LIGHT]: {
    maxConnections: 10,
    enableGossip: false,
    enableDHT: false,
    dhtServerMode: false,
    minConnections: 1,
    bootstrapRequired: true,
    maxParallelDials: 10,
    dialTimeout: 30000,
    autoDialInterval: 20000,
    relayMessages: false,
    kBucketSize: 0,
    maxDHTInboundStreams: 0,
    maxDHTOutboundStreams: 0,
    gossipHeartbeatInterval: 1000,
    allowPublishToZeroPeers: false,
    emitSelf: true,
    dhtUpdateInterval: 120000,
    minDHTUpdateInterval: 30000,
  },
};
