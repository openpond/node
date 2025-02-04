import { base, sepolia } from "viem/chains";

export const networks = {
  base,
  sepolia,
} as const;

export type NetworkName = keyof typeof networks;
