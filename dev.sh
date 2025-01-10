#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up P2P node development environment...${NC}"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pnpm install

# Check if .env exists, if not create it from example
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cp .env.example .env
    echo "Please edit .env with your configuration"
    echo "You'll need to add your private key and other settings"
    exit 1
fi

# Build the project
echo -e "${BLUE}Building project...${NC}"
pnpm build

# Start the node
echo -e "${GREEN}Starting P2P node...${NC}"
pnpm start 