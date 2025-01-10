import { Chain } from 'viem'
import { base } from 'viem/chains'

export const mode = {
  id: 34443,
  name: 'Mode',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.mode.network'],
    },
    public: {
      http: ['https://mainnet.mode.network'],
    },
  },
} as const satisfies Chain

export const networks = {
  mode,
  base
} as const

export type NetworkName = keyof typeof networks 