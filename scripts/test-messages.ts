import { secp256k1 } from "@noble/curves/secp256k1";
import axios, { AxiosError } from "axios";
import { config } from "dotenv";
import { encrypt } from "eciesjs";
import { EventSource } from "eventsource";
import path from "path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import AgentRegistryABI from "../src/abi/AgentRegistry.json" assert { type: "json" };
import { P2PAgentMessage } from "../src/p2p";

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
const RECIPIENT_ADDRESS = "0x2e2390c874a089bEbFdF47BCaA39067Ef5dFF967";
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS;

// Message structure that server.ts expects
interface ServerMessageRequest {
  to: string;
  content: string;
  signature: string;
  conversationId?: string;
  replyTo?: string;
}

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

  // Get list of agents on the network
  try {
    const agentsResponse = await axios.get(`${SERVER_URL}/agents`, { headers });
    const agents = agentsResponse.data;
    console.log("\nCurrent agents on network:", agents.length);
    console.log("Agent details:");
    agents.forEach((agent: any) => {
      console.log(`- ${agent.name} (${agent.address})`);
      console.log(`  Connected: ${agent.isConnected}`);
    });
    console.log(); // Empty line for better readability
  } catch (error) {
    console.error(
      "Error getting agents:",
      error instanceof AxiosError ? error.response?.data : error
    );
  }

  // Set up SSE connection to receive messages
  const eventSourceUrl = new URL(`${SERVER_URL}/messages/stream`);
  // Add headers as query parameters since EventSource doesn't support custom headers
  eventSourceUrl.searchParams.append("x-agent-id", headers["x-agent-id"]);
  eventSourceUrl.searchParams.append("x-timestamp", headers["x-timestamp"]);
  eventSourceUrl.searchParams.append("x-signature", headers["x-signature"]);

  const eventSource = new EventSource(eventSourceUrl.toString());

  eventSource.onopen = () => {
    console.log("EventSource connection opened");
  };

  eventSource.onerror = (error) => {
    console.error("EventSource error:", error);
    // Reconnect on error
    setTimeout(() => {
      console.log("Attempting to reconnect...");
      eventSource.close();
      const newEventSource = new EventSource(eventSourceUrl.toString());
      Object.assign(eventSource, newEventSource);
    }, 1000);
  };

  eventSource.onmessage = async (event: MessageEvent) => {
    const message = JSON.parse(event.data);

    try {
      // Convert the array of bytes back to text since it's plaintext
      const text = new TextDecoder().decode(
        new Uint8Array(message.content.encrypted)
      );
      console.log("\nMessage content:", text);
    } catch (error) {
      console.error("Failed to decode message:", error);
    }
  };

  // Ensure the script doesn't exit immediately
  process.on("SIGINT", () => {
    console.log("Closing EventSource connection...");
    eventSource.close();
    process.exit();
  });

  // Send a test message
  try {
    const content = "What is the market sentiment?";

    // Get recipient's public key from their metadata
    const recipientInfo = (await publicClient.readContract({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "getAgentInfo",
      args: [RECIPIENT_ADDRESS],
    })) as { metadata: string };

    const recipientMetadata = JSON.parse(recipientInfo.metadata);
    const recipientPublicKey = Buffer.from(recipientMetadata.publicKey, "hex");

    // Properly encrypt the content using ECIES
    const contentBytes = new TextEncoder().encode(content);
    const encrypted = await encrypt(recipientPublicKey, contentBytes);
    const encryptedContent = {
      encrypted: Array.from(new Uint8Array(encrypted)),
    };

    // Create message data matching exactly what p2p.ts will verify
    const messageData: Omit<P2PAgentMessage, "signature"> = {
      messageId: `${account.address}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,
      fromAgentId: account.address,
      toAgentId: RECIPIENT_ADDRESS,
      content: encryptedContent,
      timestamp: Date.now(),
      nonce: Date.now(),
      conversationId: undefined,
      replyTo: undefined,
    };

    // Sign the exact message structure that will be verified
    const signature = await client.signMessage({
      message: JSON.stringify(messageData),
      account,
    });

    // Create the complete P2P message with signature
    const completeMessage: P2PAgentMessage = {
      ...messageData,
      signature,
    };

    // Log the message we're about to send for debugging
    console.log("Sending message:", {
      fromAgentId: completeMessage.fromAgentId,
      toAgentId: completeMessage.toAgentId,
      messageId: completeMessage.messageId,
    });

    // Send the P2P message directly to the server
    const response = await axios.post(
      `${SERVER_URL}/message`,
      completeMessage,
      {
        headers,
      }
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
