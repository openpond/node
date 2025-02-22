FROM node:18-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY ../package.json ../pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY ../. .

# Expose the port the server runs on
EXPOSE 3000

# Start the server
CMD ["pnpm", "run", "server"] 