import blessed from "blessed";
import * as contrib from "blessed-contrib";
import { config } from "dotenv";
import fs from "fs/promises";
import OpenAI from "openai";
import path from "path";
import { Network } from "../src/networks.js";
import { P2PNetwork } from "../src/p2p.js";
import { NodeRole } from "../src/types/p2p.js";
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

// Get agent color based on agent name
const agentName = process.env.AGENT_NAME || `agent-${agentNum}`;
const agentColor = agentName === "Ducky" ? "blue" : "green";

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
    // Add artificial delay
    await new Promise((resolve) => setTimeout(resolve, 500));

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
    Logger.error("Explorer", "OpenAI API error", { error });
    return "Sorry, I encountered an error processing your message.";
  }
}

export async function startExplorer() {
  const agentName = process.env.AGENT_NAME || `agent-${agentNum}`;

  // Initialize logger with file logging only, no stdout
  await Logger.init(agentName, { useStdout: true, useFile: true });

  // Set up UI-only logging handler
  Logger.setLogHandler((level, namespace, message, meta) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    const logLine = `[${timestamp}] [${level}] [${namespace}] ${message}${metaStr}`;
    logBox.log(logLine);
    screen.render();
  });

  // Clean log file on startup
  //await cleanLogFile(agentNum);

  let selectedPeer: { ethAddr: string; peerId: string } | null = null;

  // Create screen first
  const screen = blessed.screen({
    smartCSR: true,
    title: "Network Explorer",
    fullUnicode: true,
  });

  // Create layout grid
  const grid = new contrib.grid({
    rows: 12,
    cols: 12,
    screen: screen,
  });

  // Add title box at the top
  const titleBox = grid.set(0, 0, 3, 8, blessed.box, {
    border: "line",
    style: {
      border: { fg: agentColor },
      fg: agentColor,
    },
    content: `
     ██████  ██████  ███████ ███    ██ ██████   ██████  ███    ██ ██████  
    ██    ██ ██   ██ ██      ████   ██ ██   ██ ██    ██ ████   ██ ██   ██ 
    ██    ██ ██████  █████   ██ ██  ██ ██████  ██    ██ ██ ██  ██ ██   ██ 
    ██    ██ ██      ██      ██  ██ ██ ██      ██    ██ ██  ██ ██ ██   ██ 
     ██████  ██      ███████ ██   ████ ██       ██████  ██   ████ ██████  
                       S W A R M S   N E T W O R K
                           by DuckAI Labs`,
    align: "center",
  });

  // Add network map below title
  const map = grid.set(3, 0, 5, 8, contrib.map, {
    label: "Network Map",
    border: "line",
    style: {
      border: { fg: agentColor },
      fg: agentColor,
    },
    showLegend: true,
    legendWidth: 20,
    markers: [
      { lat: 52.3676, lon: 4.9041, color: agentColor, char: "⬤", size: 1 }, // Amsterdam
      { lat: 37.7749, lon: -122.4194, color: agentColor, char: "⬤", size: 1 }, // Oregon
      { lat: 1.3521, lon: 103.8198, color: agentColor, char: "⬤", size: 1 }, // Singapore
      { lat: 37.5483, lon: -77.4527, color: agentColor, char: "⬤", size: 1 }, // Virginia
    ],
  });

  // Add legend/instructions box with dynamic content
  const legendBox = grid.set(0, 8, 2, 4, blessed.box, {
    label: "Instructions",
    border: "line",
    tags: true,
    style: {
      border: { fg: agentColor },
      fg: "white",
    },
    content: [
      "🎮 Controls:",
      " [{white-fg}Tab{/}] - Switch between panels",
      " [{white-fg}i{/}] - Focus input box",
      " [{white-fg}p{/}] - Focus peer list",
      " [{white-fg}Enter{/}] - Select peer/Send message",
      " [{white-fg}q{/}] - Quit",
      "",
      "📝 Steps:",
      " 1. Select a peer from the list",
      " 2. Type message in input box",
      " 3. Press Enter to send",
    ].join("\n"),
  });

  // Function to highlight an instruction temporarily
  function highlightInstruction(key: string) {
    const instructions = [
      "🎮 Controls:",
      ` [{${
        key === "Tab" ? agentColor : "white"
      }-fg}Tab{/}] - Switch between panels`,
      ` [{${key === "i" ? agentColor : "white"}-fg}i{/}] - Focus input box`,
      ` [{${key === "p" ? agentColor : "white"}-fg}p{/}] - Focus peer list`,
      ` [{${
        key === "Enter" ? agentColor : "white"
      }-fg}Enter{/}] - Select peer/Send message`,
      ` [{${key === "q" ? agentColor : "white"}-fg}q{/}] - Quit`,
      "",
      "📝 Steps:",
      " 1. Select a peer from the list",
      " 2. Type message in input box",
      " 3. Press Enter to send",
    ];

    // Show highlighted version
    legendBox.setContent(instructions.join("\n"));
    screen.render();

    // Reset after a short delay
    setTimeout(() => {
      const normalInstructions = [
        "🎮 Controls:",
        " [{white-fg}Tab{/}] - Switch between panels",
        " [{white-fg}i{/}] - Focus input box",
        " [{white-fg}p{/}] - Focus peer list",
        " [{white-fg}Enter{/}] - Select peer/Send message",
        " [{white-fg}q{/}] - Quit",
        "",
        "📝 Steps:",
        " 1. Select a peer from the list",
        " 2. Type message in input box",
        " 3. Press Enter to send",
      ];
      legendBox.setContent(normalInstructions.join("\n"));
      screen.render();
    }, 500);
  }

  // Add peer selection list with adjusted position
  const peerSelection = grid.set(2, 8, 4, 4, blessed.list, {
    label: " 🟢 Agents Online ",
    border: "line",
    style: {
      selected: { bg: agentColor, fg: "black", bold: true },
      item: { fg: agentColor },
      border: { fg: agentColor },
      scrollbar: {
        bg: agentColor,
      },
    },
    tags: true,
    keys: true,
    mouse: true,
    scrollbar: true,
    scrollable: true,
    alwaysScroll: true,
    padding: 1,
  });

  // Keep track of known agents for flashing effect
  let knownAgents = new Set<string>();

  // Add peer info box with adjusted position (smaller height)
  const peerInfo = grid.set(6, 8, 2, 4, blessed.box, {
    label: "Network Info",
    border: "line",
    style: {
      border: { fg: agentColor },
      fg: "white",
    },
    content: "",
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
  });

  // Add chat box with more height
  const chatBox = grid.set(8, 0, 4, 8, blessed.log, {
    label: " 💬 Chat ",
    tags: true,
    border: "line",
    style: {
      border: { fg: agentColor },
    },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    padding: 1,
  });

  // Add input box below chat
  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 1,
    left: 1,
    height: 3,
    width: "60%",
    keys: true,
    mouse: true,
    inputOnFocus: true,
    border: "line",
    style: {
      fg: agentColor,
      border: { fg: agentColor },
      focus: {
        border: { fg: agentColor },
      },
    },
  });

  // Add input box key handlers
  inputBox.key(["escape", "C-c"], () => {
    inputBox.cancel();
    inputBox.clearValue();
    screen.render();
  });

  inputBox.key(["tab"], () => {
    inputBox.cancel();
    peerSelection.focus();
    screen.render();
  });

  // Focus handling
  screen.key(["i"], () => {
    highlightInstruction("i");
    inputBox.focus();
    screen.render();
  });

  screen.key(["p"], () => {
    highlightInstruction("p");
    peerSelection.focus();
    screen.render();
  });

  screen.key(["tab"], () => {
    highlightInstruction("Tab");
    if (screen.focused === peerSelection) {
      inputBox.focus();
    } else {
      peerSelection.focus();
    }
    screen.render();
  });

  // Move logs to bottom right
  const logBox = grid.set(8, 8, 4, 4, blessed.log, {
    label: "Logs",
    border: "line",
    style: {
      border: { fg: agentColor },
      fg: "white",
    },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
  });

  // Set up logger handler to write to our UI
  Logger.setLogHandler((level, namespace, message, meta) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    const logLine = `[${timestamp}] [${level}] [${namespace}] ${message}${metaStr}`;
    logBox.log(logLine);
    screen.render();
  });

  try {
    // Initialize P2P network
    const network = new P2PNetwork(
      process.env.PRIVATE_KEY || "",
      process.env.AGENT_NAME || `agent-${agentNum}`,
      "1.0.0",
      {},
      NodeRole.FULL,
      process.env.REGISTRY_ADDRESS,
      process.env.RPC_URL,
      process.env.NETWORK as Network
    );

    // Log when network is started
    await network.start(
      parseInt(process.env.EXPLORER_PORT || defaultPort.toString())
    );
    Logger.info("Explorer", "P2P Network started successfully");

    // Subscribe to ALL network events to debug
    network.on("*", (eventName: string, ...args: any[]) => {
      Logger.debug("Explorer", `Network event received: ${eventName}`, {
        args,
      });
      screen.render();
    });

    // Subscribe to messages via pubsub with more detailed logging
    network
      .getLibp2p()
      .services.pubsub.addEventListener("message", async (evt: any) => {
        if (evt.detail.topic === "agent-messages") {
          try {
            Logger.debug("Explorer", "Received raw pubsub message", {
              topic: evt.detail.topic,
              data: new TextDecoder().decode(evt.detail.data),
            });

            const data = new TextDecoder().decode(evt.detail.data);
            const messageWrapper = JSON.parse(data);

            if (messageWrapper && messageWrapper.message) {
              const msg = messageWrapper.message;
              Logger.info("Explorer", "Processing received message", {
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
                  "Explorer",
                  "Message is for me, waiting for decryption"
                );
              }
            }
            screen.render();
          } catch (error) {
            Logger.error("Explorer", "Failed to parse message", { error });
          }
        }
      });

    // Subscribe to decrypted messages from the P2P network
    network.on("message", async (message: any) => {
      logBox.log(
        `[DEBUG] Got decrypted message event: ${JSON.stringify(message)}`
      );
      if (
        message.toAgentId.toLowerCase() === network.getAddress().toLowerCase()
      ) {
        logBox.log(`[DEBUG] Displaying decrypted message in chat`);
        chatBox.log(
          `{${agentColor}-fg}${message.fromAgentId.slice(0, 10)}...{/}: ${
            message.content
          }`
        );

        // Generate and send AI response
        try {
          const aiResponse = await getAIResponse(
            message.content,
            message.fromAgentId
          );

          // Log the response we're about to send
          Logger.info("Explorer", "Sending AI response", {
            to: message.fromAgentId,
            response: aiResponse,
          });

          // Send the response back
          //await network.sendMessage(message.fromAgentId, aiResponse);

          // Display in our chat
          /*  chatBox.log(
            `{${agentColor}-fg}You{/} to ${message.fromAgentId.slice(
              0,
              10
            )}...: ${aiResponse}`
          ); */
        } catch (error) {
          Logger.error("Explorer", "Failed to send AI response", { error });
          chatBox.log(
            `Error sending AI response: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }

        screen.render();
      }
    });

    // Also listen for any message-related events
    const messageEvents = [
      "message:received",
      "message:decrypted",
      "message:handled",
    ];
    messageEvents.forEach((event) => {
      network.on(event, (message: any) => {
        logBox.log(`[DEBUG] ${event} event: ${JSON.stringify(message)}`);
        screen.render();
      });
    });

    // Handle peer selection once, outside updateNetworkInfo
    peerSelection.on("select", async (item: blessed.Widgets.BoxElement) => {
      const agentName = item.content as string;
      const dhtRecords = (await network.getDHTRecords()) as Record<
        string,
        DHTRecord
      >;
      const record = Object.entries(dhtRecords).find(
        ([_, r]) => r.agentName === agentName
      );
      if (record) {
        const [ethAddr, { peerId }] = record;
        selectedPeer = { ethAddr, peerId };
        chatBox.log(`Selected agent: {bold}${agentName}{/bold}`);
        screen.render();
      }
    });

    // Handle chat input
    inputBox.key(["enter"], async () => {
      highlightInstruction("Enter");
      const message = inputBox.getValue();
      if (message.trim()) {
        if (!selectedPeer) {
          chatBox.log(
            "Please select a peer first (use Tab to focus peer list)"
          );
        } else {
          try {
            Logger.info("Explorer", "Attempting to send message", {
              to: selectedPeer.ethAddr,
              content: message,
              myAddress: network.getAddress(),
            });

            chatBox.log(
              `{${agentColor}-fg}You{/} to ${selectedPeer.ethAddr.slice(
                0,
                10
              )}...: ${message}`
            );

            await network.sendMessage(selectedPeer.ethAddr, message);
            Logger.info("Explorer", "Message sent successfully");
            inputBox.clearValue();
            screen.render();
          } catch (error) {
            Logger.error("Explorer", "Failed to send message", {
              error: error instanceof Error ? error.message : String(error),
            });
            chatBox.log(
              `Error sending message: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            screen.render();
          }
        }
      }
    });

    // Make chat box focusable and add explicit scroll handling
    chatBox.key(["up", "down"], (_ch: any, key: { name: string }) => {
      const amount = key.name === "up" ? -1 : 1;
      chatBox.scroll(amount);
      screen.render();
    });

    // Make chat box escapable
    chatBox.key("tab", () => {
      logBox.focus();
      screen.render();
    });

    // Make log box focusable
    logBox.key(["up", "down"], () => {
      logBox.scroll(screen.focused === logBox ? -1 : 1);
      screen.render();
    });

    // Make log box escapable
    logBox.key("tab", () => {
      inputBox.focus();
      screen.render();
    });

    // Update network info with enhanced logging
    const updateNetworkInfo = async () => {
      try {
        const dhtRecords = (await network.getDHTRecords()) as Record<
          string,
          DHTRecord
        >;
        const connectedPeers = network.getLibp2p().getPeers();

        // Update peer selection list with agent names
        const currentAgents = new Set<string>();

        // Add real agents from DHT
        Object.entries(dhtRecords).forEach(([ethAddr, record]) => {
          const agentName = record.agentName || `Agent ${ethAddr.slice(0, 6)}`;
          currentAgents.add(agentName);
        });

        // Check for new agents
        const newRealAgents = Object.entries(dhtRecords)
          .map(
            ([ethAddr, record]) =>
              record.agentName || `Agent ${ethAddr.slice(0, 6)}`
          )
          .filter((agent) => !knownAgents.has(agent));

        if (newRealAgents.length > 0) {
          // Flash the peer list border and title
          peerSelection.style.border.fg = "white";
          peerSelection.setLabel(" 🟡 New Agent Joined! ");
          screen.render();

          setTimeout(() => {
            peerSelection.style.border.fg = agentColor;
            peerSelection.setLabel(" 🟢 Agents Online ");
            screen.render();
          }, 1000);

          // Log new real agent joins
          newRealAgents.forEach((agent) => {
            chatBox.log(
              `{white-fg}${agent}{/white-fg} has joined the network!`
            );
          });
        }

        knownAgents = currentAgents;
        peerSelection.setItems([...currentAgents]);

        // Update peer info with connection status
        let content = "⚡ Network Status\n\n";
        content += `My Agent Name: ${process.env.AGENT_NAME}\n`;
        content += `My PeerId: ${network.getLibp2p().peerId.toString()}\n`;
        content += `My Address: ${network.getAddress()}\n\n`;
        content += `Online Agents: ${Object.keys(dhtRecords).length}\n`;
        content += `Connected Peers: ${connectedPeers.length}\n\n`;

        if (selectedPeer) {
          const isPeerConnected = connectedPeers.some(
            (p: string) => p.toString() === selectedPeer?.peerId
          );
          const selectedRecord = dhtRecords[selectedPeer.ethAddr.toLowerCase()];
          const selectedAgentName =
            selectedRecord?.agentName ||
            `Agent ${selectedPeer.ethAddr.slice(0, 6)}`;
          content += "🎯 Selected Agent:\n";
          content += `Name: {white-fg}${selectedAgentName}{/white-fg}\n`;
          content += `Status: ${
            isPeerConnected ? "🟢 Connected" : "🔴 Offline"
          }\n`;
        }

        peerInfo.setContent(content);
        screen.render();
      } catch (error) {
        logBox.log(`[ERROR] Error updating network info: ${error}`);
      }
    };

    // Update network info every 5 seconds
    const updateInterval = setInterval(updateNetworkInfo, 5000);
    updateNetworkInfo(); // Initial update

    // Clean shutdown function
    const shutdown = async () => {
      if (updateInterval) clearInterval(updateInterval);
      await network.stop();
      await Logger.cleanup();
      // Clean log file on shutdown
      //await cleanLogFile(agentNum);
      screen.destroy();
      process.exit(0);
    };

    // Handle key presses for exit
    screen.key(["escape", "q", "C-c"], () => {
      highlightInstruction("q");
      setTimeout(() => shutdown(), 500);
    });

    // Handle process signals
    process.on("SIGINT", () => shutdown());
    process.on("SIGTERM", () => shutdown());

    // Keep the script running
    await new Promise(() => {}); // Never resolves
  } catch (error) {
    logBox.log(`Error: ${error}`);
    screen.render();
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Show error for 5 seconds
    process.exit(1);
  }
}

// Start the explorer
startExplorer().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
