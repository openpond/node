import axios from "axios";
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs/promises";
import readline from "readline";
import { P2PNetwork } from "../src/p2p";
import { Logger } from "../src/utils/logger";

dotenv.config();

// Configuration from env or arguments
const config = {
  name: process.env.AGENT_NAME || process.argv[2],
  port: parseInt(process.env.P2P_PORT || process.argv[3] || "8000"),
  privateKey: process.env.PRIVATE_KEY || process.argv[4],
  registryAddress: process.env.REGISTRY_ADDRESS || process.argv[5],
  rpcUrl: process.env.RPC_URL || process.argv[6],
  network: process.env.NETWORK || "mode",
};

// Simple color selection
const getAgentColor = (name: string) => {
  const colors = [
    chalk.blue,
    chalk.green,
    chalk.yellow,
    chalk.magenta,
    chalk.cyan,
  ];
  const index = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

let CLI_MODE = process.env.CLI_MODE || "direct";
const API_URL = "http://localhost:3000";

async function startChatClient() {
  // Check required config
  if (
    !process.env.PRIVATE_KEY ||
    !process.env.AGENT_NAME ||
    !process.env.REGISTRY_ADDRESS ||
    !process.env.RPC_URL
  ) {
    throw new Error(
      "Missing required configuration. Need: name, privateKey, registryAddress, rpcUrl"
    );
  }

  Logger.info("ChatClient", "Initializing agent", {
    agent: config.name,
    port: config.port,
  });

  const node = new P2PNetwork(
    config.privateKey,
    config.name,
    "1.0.0",
    {},
    config.registryAddress,
    config.rpcUrl,
    config.network as any,
    false
  );

  try {
    await node.start(config.port);
    await node.registerWithContract();
  } catch (error) {
    Logger.error("ChatClient", "Failed to start node", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }

  // If CLI_MODE is 'none', just show logs
  if (CLI_MODE === "none") {
    Logger.info("ChatClient", "Running in log-only mode");
    return;
  }

  // Setup UI
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Handle Ctrl+C
  rl.on("SIGINT", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });

  const agentColor = getAgentColor(config.name);
  console.clear();
  console.log(
    "╔═════════════════════════════════════════════════��═════════════════╗"
  );
  // Ensure consistent padding for the header
  const headerText = `Connected as ${config.name}`;
  const padding = 53 - headerText.length; // 53 is the width between ║ chars
  console.log(`║ ${agentColor(headerText.padEnd(padding))} ║`);
  console.log(
    "╚═══════════════════════════════════════════════════════════════════╝"
  );
  console.log(`${chalk.dim("Address:").padEnd(12)} ${node.getAddress()}`);
  console.log(`${chalk.dim("Registry:").padEnd(12)} ${config.registryAddress}`);
  console.log(chalk.dim("\nCommands:"));
  console.log(chalk.dim("  @<address> <message>  - Send direct message"));
  console.log(chalk.dim("  all: <message>       - Broadcast message"));
  console.log(chalk.dim("  /help, /h           - Show this help"));
  console.log(chalk.dim("  /quit, /q           - Exit chat"));
  console.log(chalk.dim("  /logs               - Show recent logs"));
  console.log(chalk.dim("  /http               - Switch to HTTP mode"));
  console.log(chalk.dim("  /p2p                - Switch to P2P mode\n"));

  const getPrompt = () => `${agentColor(config.name)} [${CLI_MODE}]> `;
  rl.setPrompt(getPrompt());
  rl.prompt();

  // Handle user input
  rl.on("line", async (line) => {
    const input = line.trim();

    if (input === "/help" || input === "/h") {
      console.log(chalk.dim("\nCommands:"));
      console.log(chalk.dim("  @<address> <message>  - Send direct message"));
      console.log(chalk.dim("  all: <message>       - Broadcast message"));
      console.log(chalk.dim("  /help, /h           - Show this help"));
      console.log(chalk.dim("  /quit, /q           - Exit chat"));
      console.log(chalk.dim("  /logs               - Show recent logs"));
      console.log(chalk.dim("  /http               - Switch to HTTP mode"));
      console.log(chalk.dim("  /p2p                - Switch to P2P mode\n"));
    } else if (input === "/quit" || input === "/q") {
      process.exit(0);
    } else if (input === "/logs") {
      try {
        const logs = await fs.readFile("swarm.log", "utf8");
        const lastLogs = logs
          .split("\n")
          .filter(Boolean)
          .slice(-10) // Show last 10 logs
          .map((log) => {
            const entry = JSON.parse(log);
            return `[${entry.timestamp}] ${entry.level} [${entry.component}] ${entry.message}`;
          })
          .join("\n");
        console.log(chalk.dim("\nRecent logs:"));
        console.log(lastLogs + "\n");
      } catch (error) {
        console.log(chalk.red("No logs found or error reading logs"));
      }
    } else if (input === "/http") {
      CLI_MODE = "http";
      console.log(chalk.green("Switched to HTTP mode"));
      rl.setPrompt(getPrompt());
    } else if (input === "/p2p") {
      CLI_MODE = "direct";
      console.log(chalk.green("Switched to P2P mode"));
      rl.setPrompt(getPrompt());
    } else {
      try {
        if (input.startsWith("@")) {
          const match = input.match(/@(\w+)\s+(.*)/);
          if (match) {
            const [, to, content] = match;
            if (CLI_MODE === "http") {
              await axios.post(`${API_URL}/send`, { to, message: content });
            } else {
              await node.sendMessage(to, content);
            }
            console.log(chalk.dim(`Message sent to ${to}`));
          }
        } else if (input.startsWith("all:")) {
          const content = input.slice(4).trim();
          if (CLI_MODE === "http") {
            await axios.post(`${API_URL}/broadcast`, { message: content });
          } else {
            //await node.sendMessage(content);
          }
          console.log(chalk.dim("Broadcast message sent"));
        } else {
          console.log(
            chalk.red(
              'Invalid format. Use "@address message" or "all: message"'
            )
          );
        }
      } catch (error) {
        console.error(chalk.red("Error sending message:", error));
      }
    }

    rl.prompt();
  });

  // Handle incoming messages
  node.on("message", async (message: any) => {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    console.log(`${chalk.blue(message.fromAgentId)}: ${message.content}`);
    rl.prompt(true);
  });
}

// Only start if not in bootstrap mode
if (process.env.MODE !== "bootstrap") {
  startChatClient().catch((error) => {
    Logger.error("ChatClient", "Failed to start", { error });
    process.exit(1);
  });
}
