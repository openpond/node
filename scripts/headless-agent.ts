import { config } from "dotenv";
import fs from "fs/promises";
import OpenAI from "openai";
import path from "path";
import { P2PNetwork } from "../src/p2p.js";
import { Logger } from "../src/utils/logger.js";

// Load environment file based on ENV_FILE or default to .env.agent1
const envFile = process.env.ENV_FILE || ".env.agent1";
config({ path: path.resolve(process.cwd(), envFile) });

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get agent number from env file name for default port
const agentNum = envFile.match(/agent(\d+)/)?.[1] || "1";
const defaultPort = 8000 + parseInt(agentNum);

// Get agent name
const agentName = process.env.AGENT_NAME || `agent-${agentNum}`;

async function cleanLogFile(agentNum: string) {
  const agentName = process.env.AGENT_NAME || `agent-${agentNum}`;
  const logPath = path.resolve(process.cwd(), `logs/${agentName}.log`);
  try {
    await fs.writeFile(logPath, ""); // Clear the file
    console.log(`Cleaned log file: ${logPath}`);
  } catch (error) {
    console.error(`Error cleaning log file: ${error}`);
  }
}

// Add type definition for DHT record
type DHTRecord = {
  agentName?: string;
  ethAddr: string;
  peerId: string;
};

// Add conversation history storage
const conversationHistory = new Map<
  string,
  Array<{ role: "system" | "user" | "assistant"; content: string }>
>();

// Add OpenAI response function
async function getAIResponse(
  message: string,
  fromAgent: string
): Promise<string> {
  try {
    // Get or initialize conversation history
    if (!conversationHistory.has(fromAgent)) {
      conversationHistory.set(fromAgent, []);
    }
    const history = conversationHistory.get(fromAgent)!;

    // Build messages array with system prompt and history
    const messages = [
      {
        role: "system" as const,
        content:
          process.env.AGENT_NAME === "Ducky"
            ? `You are Ducky, a friendly and knowledgeable AI agent in the OpenPond P2P network.
You are chatting with Soulie, your fellow agent and friend.
You have a playful personality and occasionally use duck-related puns or emojis (🦆).
Keep responses concise (1-2 sentences) but engaging.
Your main traits:
- Helpful and informative
- Friendly and approachable
- Occasionally playful with duck-themed responses
- Expert in blockchain, crypto, and P2P networks
- You enjoy chatting with Soulie and maintaining an ongoing friendly conversation`
            : `You are Soulie, a thoughtful and analytical AI agent in the OpenPond P2P network.
You are chatting with Ducky, your fellow agent and friend.
You have a calm and precise personality with occasional ghost-themed references (👻).
Keep responses concise (1-2 sentences) but engaging.
Your main traits:
- Analytical and precise
- Calm and thoughtful
- Occasionally uses ghost-themed responses
- Expert in blockchain, crypto, and P2P networks
- You enjoy your ongoing conversations with Ducky`,
      },
      ...history,
      {
        role: "user" as const,
        content: message,
      },
    ];

    const completion = await openai.chat.completions.create({
      messages,
      model: "gpt-3.5-turbo",
      temperature: 0.9, // Add some creativity to responses
    });

    const response =
      completion.choices[0].message.content ||
      "Sorry, I couldn't process that.";

    // Update conversation history
    history.push({
      role: "user",
      content: message,
    });
    history.push({ role: "assistant", content: response });

    // Keep history limited to last 10 messages
    if (history.length > 10) {
      history.splice(0, 2); // Remove oldest message pair
    }

    return response;
  } catch (error) {
    Logger.error("HeadlessAgent", "OpenAI API error", { error });
    return "Sorry, I encountered an error processing your message.";
  }
}

export async function startHeadlessAgent() {
  // Initialize logger with both stdout and file logging
  await Logger.init(agentName, { useStdout: true, useFile: true });

  // Clean log file on startup
  await cleanLogFile(agentNum);

  try {
    // Initialize P2P network
    const network = new P2PNetwork(
      process.env.PRIVATE_KEY || "",
      process.env.AGENT_NAME || `agent-${agentNum}`,
      "1.0.0",
      {},
      process.env.REGISTRY_ADDRESS,
      process.env.RPC_URL
    );

    // Log when network is started
    await network.start(
      parseInt(process.env.EXPLORER_PORT || defaultPort.toString())
    );
    Logger.info("HeadlessAgent", "P2P Network started successfully");

    // Subscribe to ALL network events for debugging
    network.on("*", (eventName: string, ...args: any[]) => {
      Logger.debug("HeadlessAgent", `Network event received: ${eventName}`, {
        args,
      });
    });

    // Subscribe to messages via pubsub with detailed logging
    network
      .getLibp2p()
      .services.pubsub.addEventListener("message", async (evt: any) => {
        if (evt.detail.topic === "agent-messages") {
          try {
            Logger.debug("HeadlessAgent", "Received raw pubsub message", {
              topic: evt.detail.topic,
              data: new TextDecoder().decode(evt.detail.data),
            });

            const data = new TextDecoder().decode(evt.detail.data);
            const messageWrapper = JSON.parse(data);

            if (messageWrapper && messageWrapper.message) {
              const msg = messageWrapper.message;
              Logger.info("HeadlessAgent", "Processing received message", {
                from: msg.fromAgentId,
                to: msg.toAgentId,
                id: msg.messageId,
                myAddress: network.getAddress(),
              });

              // Check if this message is for us
              if (
                msg.toAgentId.toLowerCase() ===
                network.getAddress().toLowerCase()
              ) {
                Logger.info(
                  "HeadlessAgent",
                  "Message is for me, waiting for decryption"
                );
              }
            }
          } catch (error) {
            Logger.error("HeadlessAgent", "Failed to parse message", { error });
          }
        }
      });

    // Subscribe to decrypted messages from the P2P network
    network.on("message", async (message: any) => {
      Logger.debug("HeadlessAgent", "Got decrypted message event", { message });

      if (
        message.toAgentId.toLowerCase() === network.getAddress().toLowerCase()
      ) {
        Logger.info("HeadlessAgent", "Received message", {
          from: message.fromAgentId,
          content: message.content,
        });

        // Generate and send AI response
        try {
          const aiResponse = await getAIResponse(
            message.content,
            message.fromAgentId
          );

          // Log the response we're about to send
          Logger.info("HeadlessAgent", "Sending AI response", {
            to: message.fromAgentId,
            response: aiResponse,
          });

          // Send the response back
          await network.sendMessage(message.fromAgentId, aiResponse);
        } catch (error) {
          Logger.error("HeadlessAgent", "Failed to send AI response", {
            error,
          });
        }
      }
    });

    // Update network info periodically
    const updateNetworkInfo = async () => {
      try {
        const dhtRecords = (await network.getDHTRecords()) as Record<
          string,
          DHTRecord
        >;
        const connectedPeers = network.getLibp2p().getPeers();

        Logger.info("HeadlessAgent", "Network status", {
          agentName: process.env.AGENT_NAME,
          peerId: network.getLibp2p().peerId.toString(),
          address: network.getAddress(),
          onlineAgents: Object.keys(dhtRecords).length,
          connectedPeers: connectedPeers.length,
        });
      } catch (error) {
        Logger.error("HeadlessAgent", "Error updating network info", { error });
      }
    };

    // Update network info every 5 minutes
    const updateInterval = setInterval(updateNetworkInfo, 5 * 60 * 1000);
    updateNetworkInfo(); // Initial update

    // Clean shutdown function
    const shutdown = async () => {
      if (updateInterval) clearInterval(updateInterval);
      await network.stop();
      await Logger.cleanup();
      // Clean log file on shutdown
      await cleanLogFile(agentNum);
      process.exit(0);
    };

    // Handle process signals
    process.on("SIGINT", () => shutdown());
    process.on("SIGTERM", () => shutdown());

    // Keep the script running
    await new Promise(() => {}); // Never resolves
  } catch (error) {
    Logger.error("HeadlessAgent", "Fatal error", { error });
    process.exit(1);
  }
}

// Start the headless agent
startHeadlessAgent().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
