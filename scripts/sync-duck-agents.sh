#!/bin/bash

# Exit on error
set -e

echo "🔄 Syncing proto files and gRPC server with duck-agents..."

# Check if proto file exists
if [ ! -f "src/proto/p2p.proto" ]; then
    echo "❌ Error: Proto file not found at src/proto/p2p.proto"
    echo "Please create the proto file first"
    exit 1
fi

# Generate proto types in node
echo "🔧 Generating proto types..."
pnpm proto:gen

# Build the project
echo "🏗️ Building project..."
pnpm build

# Clean up old files in duck-agents sdk
echo "🧹 Cleaning up old files..."
rm -rf ../duck-agents/sdk/src/proto/*

# Copy proto files to duck-agents
echo "📋 Copying proto files to duck-agents..."
mkdir -p ../duck-agents/sdk/src/proto/proto
cp src/proto/p2p.proto ../duck-agents/sdk/src/proto/

# Copy gRPC server binary to duck-agents
echo "📦 Copying gRPC server to duck-agents/sdk..."
cp dist/p2p-node.js ../duck-agents/sdk/p2p-node.js

echo "✅ Sync complete!"
echo "Proto files:"
echo "  - Source proto: ./src/proto/p2p.proto"
echo "  - Generated types: ../duck-agents/sdk/src/proto/p2p.ts"
echo "gRPC server location: ../duck-agents/sdk/p2p-node.js"

# Verify the setup
echo "🔍 Verifying setup..."
if [ ! -f "../duck-agents/sdk/src/proto/p2p.proto" ]; then
    echo "❌ Error: Proto file not found!"
    exit 1
fi
if [ ! -f "../duck-agents/sdk/src/proto/p2p.ts" ]; then
    echo "❌ Error: Generated proto types not found!"
    exit 1
fi
if [ ! -f "../duck-agents/sdk/p2p-node.js" ]; then
    echo "❌ Error: gRPC server not found!"
    exit 1
fi
echo "✅ Verification passed!" 