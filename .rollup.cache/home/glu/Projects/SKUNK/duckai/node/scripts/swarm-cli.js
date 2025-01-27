import chalk from "chalk";
import { Command } from "commander";
import { config } from "dotenv";
import fs from "fs";
import readline from "readline";
import { P2PNetwork } from "../src/p2p.js";
config();
const program = new Command();
const DUCKY_KEY = process.env.DUCKY_PRIVATE_KEY || "";
const SOULIE_KEY = process.env.SOULIE_PRIVATE_KEY || "";
const GLU_KEY = process.env.GLU_PRIVATE_KEY || "";
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "";
const RPC_URL = process.env.RPC_URL || "";
// Setup logging with colors
const logStream = fs.createWriteStream("swarm.log", { flags: "a" });
function log(message, type = "system") {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    logStream.write(logMessage);
    switch (type) {
        case "system":
            console.log(chalk.cyan(message));
            break;
        case "message":
            console.log(chalk.green(message));
            break;
        case "error":
            console.log(chalk.red(message));
            break;
    }
}
async function startNode(name, key, port, bootstrapNodes = []) {
    const network = new P2PNetwork(key, name, "1.0.0", { creators: name }, REGISTRY_ADDRESS, RPC_URL);
    log(`Starting ${name} node...`);
    await network.registerWithContract();
    await network.start(port);
    log(`${name} node is running on port ${port}`);
    return network;
}
async function startChat() {
    // Start all nodes
    log(chalk.bold("\n=== Starting Swarm Nodes ==="));
    const ducky = await startNode("ducky", DUCKY_KEY, 5000, []);
    const soulie = await startNode("soulie", SOULIE_KEY, 5001, [
        "/ip4/127.0.0.1/tcp/5000",
    ]);
    const glu = await startNode("glu", GLU_KEY, 5002, [
        "/ip4/127.0.0.1/tcp/5000",
    ]);
    // Setup CLI
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    let currentAgent = "ducky"; // Default agent
    function prompt() {
        console.log(chalk.yellow("\n=== Available Commands ==="));
        console.log(chalk.yellow("- use <agent>          # Switch to sending as another agent"));
        console.log(chalk.yellow("- msg <to> <message>   # Send message to an agent"));
        console.log(chalk.yellow("- clear                # Clear the screen"));
        console.log(chalk.yellow("- exit\n"));
        rl.question(chalk.blue(`${currentAgent}> `), async (input) => {
            const [command, ...args] = input.trim().split(" ");
            switch (command) {
                case "exit":
                    rl.close();
                    process.exit(0);
                    break;
                case "use":
                    const newAgent = args[0]?.toLowerCase();
                    if (!["ducky", "soulie", "glu"].includes(newAgent)) {
                        log("Invalid agent. Must be ducky, soulie, or glu", "error");
                    }
                    else {
                        currentAgent = newAgent;
                        log(`Switched to ${currentAgent}`, "system");
                    }
                    break;
                case "clear":
                    console.clear();
                    break;
                case "msg":
                    const [recipient, ...messageParts] = args;
                    const message = messageParts.join(" ");
                    if (!recipient || !message) {
                        log("Usage: msg <to> <message>", "error");
                        break;
                    }
                    if (!["ducky", "soulie", "glu"].includes(recipient.toLowerCase())) {
                        log("Invalid recipient. Must be ducky, soulie, or glu", "error");
                        break;
                    }
                    try {
                        const nodes = { ducky, soulie, glu };
                        const senderNode = nodes[currentAgent];
                        if (!senderNode) {
                            log("Invalid sender node", "error");
                            break;
                        }
                        const recipientAddress = {
                            ducky: process.env.DUCKY_ADDRESS,
                            soulie: process.env.SOULIE_ADDRESS,
                            glu: process.env.GLU_ADDRESS,
                        }[recipient.toLowerCase()];
                        await senderNode.sendMessage(recipientAddress, message);
                        log(`[${currentAgent}] to [${recipient}]: ${message}`, "message");
                    }
                    catch (error) {
                        log(`Error sending message: ${error}`, "error");
                    }
                    break;
                default:
                    log(`Unknown command: ${command}`, "error");
            }
            prompt();
        });
    }
    // Start CLI
    console.clear();
    log(chalk.bold("\n=== Swarm Chat CLI ==="));
    log("All nodes are running. Messages are being logged to swarm.log");
    log(chalk.italic("Messages are end-to-end encrypted"));
    log(chalk.bold(`Currently sending as: ${currentAgent}`));
    prompt();
}
program.name("swarm-cli").description("Swarm P2P Chat CLI").version("1.0.0");
program
    .command("start")
    .description("Start the Swarm chat network")
    .action(startChat);
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=swarm-cli.js.map