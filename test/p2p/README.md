# P2P Network Testing

This directory contains the test framework for the P2P network, allowing you to spin up multiple agents and test their interactions in a controlled environment.

## Overview

The test framework creates:

- Local bootstrap nodes (simulating the production bootstrap network)
- Multiple test agents that connect to these bootstrap nodes
- Tests message passing between agents
- Verifies network connectivity and message delivery

## Running Tests

```bash
# Run the P2P network test
pnpm test:p2p
```

## Test Structure

### Bootstrap Nodes

- Creates 2 local bootstrap nodes on ports 14221 and 14222
- These nodes form the backbone of the test network
- Other test agents connect to these bootstrap nodes

### Test Agents

- Creates 10 test agents (configurable)
- Each agent:
  - Gets a unique private key
  - Registers with the registry contract on Base Sepolia
  - Connects to the bootstrap nodes
  - Can send/receive messages to other agents

### Test Scenarios

1. **Message Test**
   - Each agent sends a message to every other agent
   - Verifies all messages are received
   - Checks message content and signatures

## Test Output

The test provides a detailed summary including:

- Total number of tests run
- Number of passed/failed tests
- Duration of each test
- Message statistics (sent/received)
- Any errors encountered

Example output:

```
=== Test Summary ===
Total Tests: 1
Passed: 1
Failed: 0
Duration: 15000ms

Detailed Results:
message-test:
  Success: true
  Messages Sent: 90
  Messages Received: 90
  Duration: 15000ms
```

## Configuration

- Registry Contract: Base Sepolia testnet
- RPC URL: Base Sepolia RPC
- Number of agents: Configurable (default: 10)
- Bootstrap nodes: 2 local nodes
- Test timeout: 5 seconds per message test

## Cleanup

The framework ensures proper cleanup:

- All agent nodes are stopped
- Bootstrap nodes are stopped
- Network ports are released
- Test data is cleared
