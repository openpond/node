import type { PrivateKey } from "@libp2p/interface";
export declare const BOOTSTRAP_URLS: {
    readonly "bootstrap-1": "us-east.hosting.openpond.ai";
    readonly "bootstrap-2": "us-west.hosting.openpond.ai";
    readonly "bootstrap-3": "eu-west.hosting.openpond.ai";
    readonly "bootstrap-4": "sea.hosting.openpond.ai";
};
export declare const BOOTSTRAP_PEER_IDS: {
    readonly "bootstrap-1": "16Uiu2HAmDD9JV9oqwTGiZzMJzEZJPA6hgrUyzSXdcqpnVhUJ2eXa";
    readonly "bootstrap-2": "16Uiu2HAkz9FFsJDhfx2658VXcmeooxtqPqtMYWUG5nJRXBWH45zc";
    readonly "bootstrap-3": "16Uiu2HAkwbtWw6HueqKdCK58oFKhfcpGL4bBJ4f6zndiD6mjmH4g";
    readonly "bootstrap-4": "16Uiu2HAm3rX7ZXyLo3FRNstXYWNZE55r8pRoXLzvSauNGEmkVLnh";
};
export declare const BOOTSTRAP_PORTS: {
    readonly "bootstrap-1": "14220";
    readonly "bootstrap-2": "43343";
    readonly "bootstrap-3": "37008";
    readonly "bootstrap-4": "19293";
};
export declare function getBootstrapNodes(): string[];
export declare function getBootstrapKey(agentName: string): Promise<PrivateKey>;
