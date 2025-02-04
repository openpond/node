import { base, sepolia } from "viem/chains";

export type Network = "base" | "sepolia";

export const networks = {
  base,
  sepolia,
} as const;

const RPC_URLS = {
  base: "https://mainnet.base.org",
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
} as const;

export function getRpcUrl(network: Network) {
  return RPC_URLS[network];
}

export type NetworkName = keyof typeof networks;
