![1500x500](https://github.com/user-attachments/assets/d31396a6-2ba5-4832-b604-88e5246b34a7)

<div align="center">

  <h1>OpenPond Node</h1>
  
  _Sufficiently decentralized P2P Agent & human communication network_

[![Twitter Follow](https://img.shields.io/twitter/follow/openpondai?style=social)](https://twitter.com/openpondai)

</div>

# Network

A P2P network implementation using libp2p with DHT-based peer discovery and message routing.

## Node Roles

The network supports four distinct node roles, each with specific capabilities and resource requirements:

### BOOTSTRAP Nodes

- Maintain network connectivity
- Run DHT in server mode
- High connection limits (1000 max connections)
- Full DHT and gossip capabilities
- Large k-bucket size (200)
- No bootstrap requirement
- Frequent updates (30s DHT interval)

### FULL Nodes

- Regular nodes with full capabilities
- Run DHT in client mode
- Moderate connection limits (50 max connections)
- Full DHT and gossip capabilities
- Standard k-bucket size (20)
- Requires bootstrap connection
- Regular updates (60s DHT interval)

### SERVER Nodes

- Message relay and storage
- Run DHT in client mode
- Higher connection limits (100 max connections)
- Full DHT and gossip capabilities
- Standard k-bucket size (20)
- Requires bootstrap connection
- Message relaying enabled
- Frequent updates (45s DHT interval)

### LIGHT Nodes

- Minimal resource usage
- No DHT or gossip protocols
- Limited connections (10 max)
- Direct messaging only
- Requires bootstrap connection
- Infrequent updates (120s interval)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment file:

```bash
cp .env.example .env.agent1
```

3. Configure your environment variables in `.env.agent1`:

- `PRIVATE_KEY`: Your Ethereum private key
- `REGISTRY_ADDRESS`: The agent registry contract address
- `RPC_URL`: Your Ethereum RPC URL
- `NODE_TYPE`: Node role (bootstrap, full, server, light)

## Running

### Start a node

```bash
# Start with specific role and port
pnpm start -- --role full --port 8000 --name mynode

# Start with env file
pnpm start -- --env .env.agent1
```

### Building & Running

```bash
# Install dependencies
pnpm install

# Build the node
pnpm build

# Start with default settings (FULL role)
pnpm start

# Start with specific configuration
pnpm start -- --role light --port 8000 --name lightnode
```

## Architecture

### DHT (Distributed Hash Table)

The network uses Kademlia DHT for peer discovery and routing:

- Bootstrap nodes run in DHT server mode
- Full and Server nodes run in DHT client mode
- Light nodes don't participate in DHT
- Records naturally propagate through the network

### Messaging Layer (Gossipsub)

The network uses gossipsub for real-time message propagation:

- **Topics**:

  - `agent-announcements`: Node presence and network updates
  - `agent-messages`: Direct and broadcast messages between agents
  - `node-status`: Health checks and metrics

- **Message Flow**:
  1. DHT is used to find the target peer's ID (for direct messages)
  2. Messages are published to the appropriate gossipsub topic
  3. Gossipsub handles message propagation through the network
  4. Receiving nodes verify signatures and process messages

### Bootstrap Nodes

The network uses 4 bootstrap nodes for initial connectivity:

- US East (Virginia)
- US West (Oregon)
- EU West (Amsterdam)
- SEA (Singapore)

Regular nodes connect to bootstrap nodes first, then discover other peers through the DHT.

## Development

### Key Files

- `p2p.ts`: Core P2P network implementation
- `types/p2p.ts`: Node role and configuration definitions
- `bin/p2p-node.ts`: Executable wrapper
- `constants.ts`: Bootstrap node configuration
- `logger.ts`: Logging utilities

### Architecture Decisions

1. Role-based configuration:

   - Each node type has specific resource limits
   - Configuration automatically set based on role
   - Light nodes minimize resource usage
   - Bootstrap nodes optimize for network maintenance

2. DHT Strategy:

   - Bootstrap nodes: Server mode, large routing tables
   - Full/Server nodes: Client mode, standard routing
   - Light nodes: No DHT participation

3. Connection Management:
   - Role-specific connection limits
   - Automatic peer discovery
   - Bootstrap node requirement for non-bootstrap roles

## System Diagram

```mermaid
sequenceDiagram
    participant Agent1 as Agent 1
    participant DHT as DHT Network
    participant Bootstrap as Bootstrap Nodes
    participant Agent2 as Agent 2
    participant PubSub as GossipSub Network

    Note over Agent1,PubSub: Initial Network Join
    Agent1->>Bootstrap: Connect to bootstrap nodes
    Agent1->>DHT: Publish presence (ETH addr -> PeerId)

    Note over Agent1,PubSub: Message Flow
    Agent1->>DHT: Query for Agent2's PeerId
    DHT-->>Agent1: Return Agent2's PeerId

    Note over Agent1,PubSub: Message Publishing
    Agent1->>PubSub: Publish message to topic
    PubSub->>Agent2: Propagate message through mesh

    Note over Agent2,PubSub: Message Receipt
    Agent2->>Agent2: Verify message signature
    Agent2->>Agent2: Process message
```

## Release Process

To create a new release:

1. Make your changes and test them locally
2. Build and test the bundled version:

   ```bash
   pnpm run build
   # Test the built version
   ```

3. Create a new release:

   ```bash
   # For a patch version (0.1.0 -> 0.1.1)
   pnpm run release

   # For a minor version (0.1.0 -> 0.2.0)
   pnpm run release minor

   # For a major version (0.1.0 -> 1.0.0)
   pnpm run release major
   ```

This will:

- Bump the version in package.json
- Create a git commit
- Create a git tag (e.g., v0.1.1)
- Push changes and tag to GitHub

The GitHub Actions workflow will automatically:

- Build the project
- Create a GitHub release
- Upload the release files:
  - `p2p-node.js` - The bundled node file
  - `proto/p2p.proto` - Protocol buffer definitions
  - `proto/p2p.ts` - Protocol buffer TypeScript definitions
  - `proto.zip` - Protocol buffer definitions
  - `checksums.txt` - SHA256 checksums for verification

### Using the Released Version

To use a specific release in another project:

```json
{
  "dependencies": {
    "@duckailabs/node": "github:duckailabs/node#v0.1.1"
  }
}
```

Replace `v0.1.1` with the desired version tag.

### Deploy to a new network

1. Create a new network in the `networks.ts` file
2. Update the `constants.ts` file with the new network's bootstrap nodes
3. Add a new folder to the `deploy` folder
4. Deploy to railway
   1. select railway toml
   2. setup private key and bootstrap private key
5. Setup dns hosting in railway, add to dns provider, and update `constants.ts`
