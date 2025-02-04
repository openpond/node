import { Chain } from "viem";
import { base, sepolia } from "viem/chains";
export const mode = {
  id: 34443,
  name: "Mode",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.mode.network"],
    },
    public: {
      http: ["https://mainnet.mode.network"],
    },
  },
} as const satisfies Chain;

export const networks = {
  mode,
  base,
  sepolia,
} as const;

export type NetworkName = keyof typeof networks;
