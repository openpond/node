import { privateKeyFromProtobuf } from "@libp2p/crypto/keys";
import type { PrivateKey } from "@libp2p/interface";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";

export type Network = "base" | "sepolia";

// Bootstrap node configurations
const BOOTSTRAP_URLS = {
  base: {
    "bootstrap-1": "us-east.hosting.openpond.ai",
    "bootstrap-2": "us-west.hosting.openpond.ai",
    "bootstrap-3": "eu-west.hosting.openpond.ai",
    "bootstrap-4": "sea.hosting.openpond.ai",
  },
  sepolia: {
    "bootstrap-1": "us-east.sepolia.openpond.ai",
    "bootstrap-2": "us-west.sepolia.openpond.ai",
    "bootstrap-3": "eu-west.sepolia.openpond.ai",
    "bootstrap-4": "sea.sepolia.openpond.ai",
  },
} as const;

const BOOTSTRAP_PEER_IDS = {
  base: {
    "bootstrap-1": "16Uiu2HAmDD9JV9oqwTGiZzMJzEZJPA6hgrUyzSXdcqpnVhUJ2eXa",
    "bootstrap-2": "16Uiu2HAkz9FFsJDhfx2658VXcmeooxtqPqtMYWUG5nJRXBWH45zc",
    "bootstrap-3": "16Uiu2HAkwbtWw6HueqKdCK58oFKhfcpGL4bBJ4f6zndiD6mjmH4g",
    "bootstrap-4": "16Uiu2HAm3rX7ZXyLo3FRNstXYWNZE55r8pRoXLzvSauNGEmkVLnh",
  },
  sepolia: {
    "bootstrap-1": "16Uiu2HAmDD9JV9oqwTGiZzMJzEZJPA6hgrUyzSXdcqpnVhUJ2eXa",
    "bootstrap-2": "16Uiu2HAkz9FFsJDhfx2658VXcmeooxtqPqtMYWUG5nJRXBWH45zc",
    "bootstrap-3": "16Uiu2HAkwbtWw6HueqKdCK58oFKhfcpGL4bBJ4f6zndiD6mjmH4g",
    "bootstrap-4": "16Uiu2HAm3rX7ZXyLo3FRNstXYWNZE55r8pRoXLzvSauNGEmkVLnh",
  },
} as const;

const BOOTSTRAP_PORTS = {
  base: {
    "bootstrap-1": "14220", // Port for us-east
    "bootstrap-2": "43343", // Port for us-west
    "bootstrap-3": "37008", //
    "bootstrap-4": "19293", //
  },
  sepolia: {
    "bootstrap-1": "14220", // Port for us-east
    "bootstrap-2": "43343", // Port for us-west
    "bootstrap-3": "37008", //
    "bootstrap-4": "19293", //
  },
} as const;

export function getBootstrapNodes(network: Network) {
  return Object.entries(BOOTSTRAP_PEER_IDS[network]).map(
    ([name, peerId]) =>
      `/dns4/${
        BOOTSTRAP_URLS[network][
          name as keyof (typeof BOOTSTRAP_URLS)[typeof network]
        ]
      }/tcp/${
        BOOTSTRAP_PORTS[network][
          name as keyof (typeof BOOTSTRAP_PORTS)[typeof network]
        ]
      }/p2p/${peerId}`
  );
}

export async function getBootstrapKey(agentName: string): Promise<PrivateKey> {
  const privateKey = process.env.BOOTSTRAP_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing environment variable BOOTSTRAP_PRIVATE_KEY");
  }

  try {
    const privateKeyBytes = uint8ArrayFromString(privateKey, "base64pad");
    return await privateKeyFromProtobuf(privateKeyBytes);
  } catch (error) {
    throw new Error(
      `Failed to decode bootstrap key for ${agentName}: ${error}`
    );
  }
}

export function getBootstrapPort(network: Network, name: string) {
  return BOOTSTRAP_PORTS[network][
    name as keyof (typeof BOOTSTRAP_PORTS)[typeof network]
  ];
}

export function getBootstrapHostname(network: Network, name: string) {
  return BOOTSTRAP_URLS[network][
    name as keyof (typeof BOOTSTRAP_URLS)[typeof network]
  ];
}

export function getBootstrapPeerId(network: Network, name: string) {
  return BOOTSTRAP_PEER_IDS[network][
    name as keyof (typeof BOOTSTRAP_PEER_IDS)[typeof network]
  ];
}
