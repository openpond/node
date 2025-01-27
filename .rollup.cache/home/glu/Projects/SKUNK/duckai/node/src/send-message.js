import { config } from 'dotenv';
import { P2PNetwork } from "./p2p";
config();
const PRIVATE_KEY = process.env.DUCKY_PRIVATE_KEY || "";
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "";
const RPC_URL = process.env.RPC_URL || "";
async function main() {
    // Get target address from command line
    const targetAddress = process.argv[2];
    const message = process.argv[3];
    if (!targetAddress || !message) {
        console.error("Usage: bun run send-message.ts <target-address> <message>");
        process.exit(1);
    }
    const network = new P2PNetwork(PRIVATE_KEY, "ducky", "1.0.0", { creators: "test" }, REGISTRY_ADDRESS, RPC_URL);
    // Start the network
    await network.start(5001); // Different port than the listener
    // Send the message
    console.log(`Sending message to ${targetAddress}...`);
    const messageId = await network.sendMessage(targetAddress, message);
    console.log(`Message sent! ID: ${messageId}`);
    // Wait a bit for the message to be sent
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=send-message.js.map