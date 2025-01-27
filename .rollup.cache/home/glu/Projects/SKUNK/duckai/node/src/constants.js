import { privateKeyFromProtobuf } from "@libp2p/crypto/keys";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
// Bootstrap node configurations
export const BOOTSTRAP_URLS = {
    "bootstrap-1": "us-east.hosting.openpond.ai",
    "bootstrap-2": "us-west.hosting.openpond.ai",
    "bootstrap-3": "eu-west.hosting.openpond.ai",
    "bootstrap-4": "sea.hosting.openpond.ai",
};
export const BOOTSTRAP_PEER_IDS = {
    "bootstrap-1": "16Uiu2HAmDD9JV9oqwTGiZzMJzEZJPA6hgrUyzSXdcqpnVhUJ2eXa",
    "bootstrap-2": "16Uiu2HAkz9FFsJDhfx2658VXcmeooxtqPqtMYWUG5nJRXBWH45zc",
    "bootstrap-3": "16Uiu2HAkwbtWw6HueqKdCK58oFKhfcpGL4bBJ4f6zndiD6mjmH4g",
    "bootstrap-4": "16Uiu2HAm3rX7ZXyLo3FRNstXYWNZE55r8pRoXLzvSauNGEmkVLnh",
};
export const BOOTSTRAP_PORTS = {
    "bootstrap-1": "14220", // Port for us-east
    "bootstrap-2": "43343", // Port for us-west
    "bootstrap-3": "37008", // Update with actual port when you get it
    "bootstrap-4": "19293", // Update with actual port when you get it
};
export function getBootstrapNodes() {
    return Object.entries(BOOTSTRAP_PEER_IDS).map(([name, peerId]) => `/dns4/${BOOTSTRAP_URLS[name]}/tcp/${BOOTSTRAP_PORTS[name]}/p2p/${peerId}`);
}
export async function getBootstrapKey(agentName) {
    const privateKey = process.env.BOOTSTRAP_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("Missing environment variable BOOTSTRAP_PRIVATE_KEY");
    }
    try {
        const privateKeyBytes = uint8ArrayFromString(privateKey, "base64pad");
        return await privateKeyFromProtobuf(privateKeyBytes);
    }
    catch (error) {
        throw new Error(`Failed to decode bootstrap key for ${agentName}: ${error}`);
    }
}
//# sourceMappingURL=constants.js.map