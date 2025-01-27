import axios from "axios";
// API server details
const API_URL = "http://localhost:3000";
const TARGET_AGENT = "0x87886DD580DE7daAe4bC0A204A50A73F89281B28";
async function sendMessage() {
    try {
        const response = await axios.post(`${API_URL}/message`, {
            to: TARGET_AGENT,
            content: "Hello agent2 from API!",
            conversationId: "test-1",
        }, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        console.log("Message sent successfully:", response.data);
    }
    catch (error) {
        console.error("Error sending message:", error.response?.data || error);
    }
}
async function getAgents() {
    try {
        const response = await axios.get(`${API_URL}/agents`);
        console.log("\nConnected Agents:");
        console.log("================");
        response.data.forEach((agent) => {
            console.log(`\nName: ${agent.name}`);
            console.log(`Address: ${agent.address}`);
            console.log(`Peer ID: ${agent.peerId}`);
            console.log(`Last Seen: ${new Date(agent.timestamp).toLocaleString()}`);
            console.log(`Status: ${agent.isConnected ? "🟢 Online" : "🔴 Offline"}`);
            console.log("-".repeat(50));
        });
    }
    catch (error) {
        console.error("Error getting agents:", error.response?.data || error);
    }
}
async function main() {
    const command = process.argv[2];
    switch (command) {
        case "send":
            await sendMessage();
            break;
        case "agents":
            await getAgents();
            break;
        default:
            console.log("Usage: ts-node test-api.ts [send|agents]");
            console.log("  send   - Send a test message to an agent");
            console.log("  agents - Get list of all agents in the network");
    }
}
main();
//# sourceMappingURL=test-api.js.map