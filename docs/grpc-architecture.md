# DuckAI Node & Agent gRPC Architecture

## Overview

The system consists of two main components:

1. **Node Service** (`@node` folder) - A P2P node binary that provides the core networking functionality
2. **Duck Agents** (`@duck-agents` folder) - The client applications that connect to and use the P2P node service

## gRPC Interface

The communication between agents and nodes is handled via gRPC, defined in `p2p.proto`. The service provides three main RPC methods:

```protobuf
service P2PNode {
  rpc Connect(ConnectRequest) returns (stream P2PEvent);
  rpc SendMessage(Message) returns (SendResult);
  rpc Stop(StopRequest) returns (StopResponse);
}
```

### Key Operations:

1. **Connect**: Establishes a streaming connection to receive P2P events
2. **SendMessage**: Sends messages to other peers
3. **Stop**: Gracefully shuts down the P2P node

## Build & Sync Process

The project uses a combination of tools to build and sync between components:

1. **Proto Generation**:

   - Source proto file: `src/proto/p2p.proto`
   - Command: `pnpm proto:gen`
   - Generates TypeScript types from proto definitions

2. **Build Process**:

   - Uses Rollup for bundling: `pnpm build`
   - Outputs binary to `dist/p2p-node.js`

3. **Sync Script**:
   To sync the node binary and proto types with duck-agents, run:
   ```bash
   ./scripts/sync-duck-agents.sh
   ```
   This script:
   - Generates proto types
   - Builds the project
   - Copies generated types to duck-agents
   - Copies the binary to duck-agents SDK

## Dependencies

Both projects use compatible gRPC-related dependencies:

- `@grpc/grpc-js`: ^1.9.13
- `@grpc/proto-loader`: ^0.7.10
- `protobufjs`: ^7.4.0
- `long`: ^5.2.3 (required for proto types)

## Known Issues and Recommendations

1. **Proto File Location**:

   - Proto file is maintained in node's `src/proto` directory
   - Generated types are synced to duck-agents SDK

2. **Version Management**:

   - Both projects use the same major versions of gRPC dependencies
   - Consider implementing workspace-level version management

3. **Build Warnings**:
   - Rollup warns about `eval` usage from protobufjs (can be ignored)
   - External dependency warnings for proto-related modules

## Message Types

The gRPC service uses several message types for communication:

### Events

- `P2PEvent`: Main event type that wraps all possible events
- `ReadyEvent`: Indicates node is ready with peerId
- `PeerConnectedEvent`: Notifies when a peer connects
- `ErrorEvent`: Carries error information
- `MessageEvent`: Contains message data between peers

### Requests/Responses

- `ConnectRequest`: Contains port, name, and privateKey for connection
- `Message`: Contains destination and content for sending messages
- `SendResult`: Returns messageId after sending
- `StopRequest/StopResponse`: Used for graceful shutdown

## Development Workflow

1. Make changes to proto definitions in `src/proto/p2p.proto`
2. Run sync script to update both projects:
   ```bash
   ./scripts/sync-duck-agents.sh
   ```
3. Verify changes in both projects:
   - Check generated types in `duck-agents/sdk/src/proto`
   - Ensure binary is updated in `duck-agents/sdk/p2p-node.js`
