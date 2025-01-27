import { base } from 'viem/chains';
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
};
export const networks = {
    mode,
    base
};
//# sourceMappingURL=networks.js.map