import { config } from 'dotenv';
import { P2PNetwork } from "../src/p2p";
config();
const SOULIE_KEY = process.env.SOULIE_PRIVATE_KEY || "";
const GLU_KEY = process.env.GLU_PRIVATE_KEY || "";
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "";
const RPC_URL = process.env.RPC_URL || "";
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function main() {
    // Create Soulie instance for sending messages
    const soulie = new P2PNetwork(SOULIE_KEY, "soulie", "1.0.0", { creators: "soulie" }, REGISTRY_ADDRESS, RPC_URL);
    // Create Glu instance for sending messages
    const glu = new P2PNetwork(GLU_KEY, "glu", "1.0.0", { creators: "glu" }, REGISTRY_ADDRESS, RPC_URL);
    // Start both networks
    await soulie.start(5001);
    await glu.start(5002);
    // Wait for connections to establish
    await delay(2000);
    // Simulate conversation
    console.log("Starting conversation...");
    await soulie.sendMessage(process.env.GLU_ADDRESS, "Hey Glu, how are you?");
    await delay(2000);
    await glu.sendMessage(process.env.SOULIE_ADDRESS, "Hi Soulie! I'm good, how about you?");
    await delay(2000);
    await soulie.sendMessage(process.env.GLU_ADDRESS, "Great! Just testing this p2p network!");
    // Keep the script running for a bit to ensure messages are delivered
    await delay(5000);
    console.log("Conversation complete!");
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=test-conversation.js.map