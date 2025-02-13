import { secp256k1 } from "@noble/curves/secp256k1";
import axios, { AxiosError } from "axios";
import { config } from "dotenv";
import { EventSource } from "eventsource";
import path from "path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import AgentRegistryABI from "../src/abi/AgentRegistry.json" assert { type: "json" };

// Load environment variables
if (process.env.ENV_FILE) {
  config({ path: path.resolve(process.cwd(), process.env.ENV_FILE) });
  console.log("Loading environment from file:", process.env.ENV_FILE);
} else {
  console.log("Using environment variables from system");
}

// Validate required environment variables
const requiredEnvVars = ["PRIVATE_KEY_TESTER", "REGISTRY_ADDRESS", "RPC_URL"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Test configuration
const SERVER_URL = "http://localhost:3000";
const RECIPIENT_ADDRESS = "0xdB0A4657286773E24d44D92e33558bec3fF46e6d";
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS;

async function main() {
  // Create a test wallet for signing
  const privateKey = process.env.PRIVATE_KEY_TESTER as string;
  const account = privateKeyToAccount(`0x${privateKey.replace("0x", "")}`);

  // Generate public key
  const privKeyBuffer = Buffer.from(privateKey.replace("0x", ""), "hex");
  const publicKey = secp256k1.getPublicKey(privKeyBuffer, false);

  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
  });
  console.log("Wallet address:", account.address);

  // Check if we're registered
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
  });

  const isRegistered = await publicClient.readContract({
    address: REGISTRY_ADDRESS as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "isRegistered",
    args: [account.address],
  });

  if (!isRegistered) {
    console.log("Agent not registered. Registering...");

    const metadataWithKey = JSON.stringify({
      publicKey: Buffer.from(publicKey).toString("hex"),
    });

    const hash = await client.writeContract({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "registerAgent",
      args: ["test-agent", metadataWithKey],
    });

    console.log("Registration transaction sent:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Registration confirmed!");
  } else {
    console.log("Agent already registered");
  }

  // Create authentication headers
  const timestamp = Date.now();
  const message = `Authenticate to OpenPond API at timestamp ${timestamp}`;
  const signature = await client.signMessage({
    message,
    account,
  });

  const headers = {
    "x-agent-id": account.address,
    "x-timestamp": timestamp.toString(),
    "x-signature": signature,
  };

  // Set up SSE connection to receive messages
  const eventSource = new EventSource(`${SERVER_URL}/messages/stream`, {
    headers: headers,
  } as EventSourceInit & { headers: Record<string, string> });

  eventSource.onmessage = (event: MessageEvent) => {
    const message = JSON.parse(event.data);
    console.log("Received message:", message);
  };

  // Send a test message
  try {
    const response = await axios.post(
      `${SERVER_URL}/message`,
      {
        to: RECIPIENT_ADDRESS,
        content: "What is the market sentiment?",
      },
      { headers }
    );

    console.log("Message sent:", response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error(
        "Error sending message:",
        error.response?.data || error.message
      );
    } else {
      console.error("Error sending message:", error);
    }
  }

  // Keep script running to receive messages
  console.log("Listening for messages... Press Ctrl+C to exit");
}

main().catch(console.error);
