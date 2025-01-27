export declare const mode: {
    readonly id: 34443;
    readonly name: "Mode";
    readonly nativeCurrency: {
        readonly decimals: 18;
        readonly name: "Ether";
        readonly symbol: "ETH";
    };
    readonly rpcUrls: {
        readonly default: {
            readonly http: readonly ["https://mainnet.mode.network"];
        };
        readonly public: {
            readonly http: readonly ["https://mainnet.mode.network"];
        };
    };
};
export declare const networks: {
    readonly mode: {
        readonly id: 34443;
        readonly name: "Mode";
        readonly nativeCurrency: {
            readonly decimals: 18;
            readonly name: "Ether";
            readonly symbol: "ETH";
        };
        readonly rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://mainnet.mode.network"];
            };
            readonly public: {
                readonly http: readonly ["https://mainnet.mode.network"];
            };
        };
    };
    readonly base: {
        blockExplorers: {
            readonly default: {
                readonly name: "Basescan";
                readonly url: "https://basescan.org";
                readonly apiUrl: "https://api.basescan.org/api";
            };
        };
        contracts: {
            readonly disputeGameFactory: {
                readonly 1: {
                    readonly address: "0x43edB88C4B80fDD2AdFF2412A7BebF9dF42cB40e";
                };
            };
            readonly l2OutputOracle: {
                readonly 1: {
                    readonly address: "0x56315b90c40730925ec5485cf004d835058518A0";
                };
            };
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 5022;
            };
            readonly portal: {
                readonly 1: {
                    readonly address: "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e";
                    readonly blockCreated: 17482143;
                };
            };
            readonly l1StandardBridge: {
                readonly 1: {
                    readonly address: "0x3154Cf16ccdb4C6d922629664174b904d80F2C35";
                    readonly blockCreated: 17482143;
                };
            };
            readonly gasPriceOracle: {
                readonly address: "0x420000000000000000000000000000000000000F";
            };
            readonly l1Block: {
                readonly address: "0x4200000000000000000000000000000000000015";
            };
            readonly l2CrossDomainMessenger: {
                readonly address: "0x4200000000000000000000000000000000000007";
            };
            readonly l2Erc721Bridge: {
                readonly address: "0x4200000000000000000000000000000000000014";
            };
            readonly l2StandardBridge: {
                readonly address: "0x4200000000000000000000000000000000000010";
            };
            readonly l2ToL1MessagePasser: {
                readonly address: "0x4200000000000000000000000000000000000016";
            };
        };
        id: 8453;
        name: "Base";
        nativeCurrency: {
            readonly name: "Ether";
            readonly symbol: "ETH";
            readonly decimals: 18;
        };
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://mainnet.base.org"];
            };
        };
        sourceId: 1;
        testnet?: boolean | undefined;
        custom?: Record<string, unknown> | undefined;
        fees?: import("node_modules/viem/_types").ChainFees<undefined> | undefined;
        formatters: {
            readonly block: {
                exclude: [] | undefined;
                format: (args: import("node_modules/viem/_types/chains").OpStackRpcBlock) => {
                    baseFeePerGas: bigint | null;
                    blobGasUsed: bigint;
                    difficulty: bigint;
                    excessBlobGas: bigint;
                    extraData: import("node_modules/viem/_types").Hex;
                    gasLimit: bigint;
                    gasUsed: bigint;
                    hash: `0x${string}` | null;
                    logsBloom: `0x${string}` | null;
                    miner: import("node_modules/viem/_types").Address;
                    mixHash: import("node_modules/viem/_types").Hash;
                    nonce: `0x${string}` | null;
                    number: bigint | null;
                    parentBeaconBlockRoot?: import("node_modules/viem/_types").Hex | undefined;
                    parentHash: import("node_modules/viem/_types").Hash;
                    receiptsRoot: import("node_modules/viem/_types").Hex;
                    sealFields: import("node_modules/viem/_types").Hex[];
                    sha3Uncles: import("node_modules/viem/_types").Hash;
                    size: bigint;
                    stateRoot: import("node_modules/viem/_types").Hash;
                    timestamp: bigint;
                    totalDifficulty: bigint | null;
                    transactions: `0x${string}`[] | import("node_modules/viem/_types/chains").OpStackTransaction<boolean>[];
                    transactionsRoot: import("node_modules/viem/_types").Hash;
                    uncles: import("node_modules/viem/_types").Hash[];
                    withdrawals?: import("node_modules/viem/_types").Withdrawal[] | undefined;
                    withdrawalsRoot?: import("node_modules/viem/_types").Hex | undefined;
                } & {};
                type: "block";
            };
            readonly transaction: {
                exclude: [] | undefined;
                format: (args: import("node_modules/viem/_types/chains").OpStackRpcTransaction) => ({
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    from: import("node_modules/viem/_types").Address;
                    gas: bigint;
                    hash: import("node_modules/viem/_types").Hash;
                    input: import("node_modules/viem/_types").Hex;
                    nonce: number;
                    r: import("node_modules/viem/_types").Hex;
                    s: import("node_modules/viem/_types").Hex;
                    to: import("node_modules/viem/_types").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("node_modules/viem/_types").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    gasPrice?: undefined;
                    maxFeePerBlobGas?: undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: boolean;
                    mint?: bigint | undefined;
                    sourceHash: import("node_modules/viem/_types").Hex;
                    type: "deposit";
                } | {
                    r: import("node_modules/viem/_types").Hex;
                    s: import("node_modules/viem/_types").Hex;
                    v: bigint;
                    to: import("node_modules/viem/_types").Address | null;
                    from: import("node_modules/viem/_types").Address;
                    gas: bigint;
                    nonce: number;
                    value: bigint;
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    hash: import("node_modules/viem/_types").Hash;
                    input: import("node_modules/viem/_types").Hex;
                    transactionIndex: number | null;
                    typeHex: import("node_modules/viem/_types").Hex | null;
                    accessList?: undefined;
                    authorizationList?: undefined;
                    blobVersionedHashes?: undefined;
                    chainId?: number | undefined;
                    yParity?: undefined;
                    type: "legacy";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined;
                    maxFeePerGas?: undefined;
                    maxPriorityFeePerGas?: undefined;
                    isSystemTx?: undefined;
                    mint?: undefined;
                    sourceHash?: undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    from: import("node_modules/viem/_types").Address;
                    gas: bigint;
                    hash: import("node_modules/viem/_types").Hash;
                    input: import("node_modules/viem/_types").Hex;
                    nonce: number;
                    r: import("node_modules/viem/_types").Hex;
                    s: import("node_modules/viem/_types").Hex;
                    to: import("node_modules/viem/_types").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("node_modules/viem/_types").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("node_modules/viem/_types").AccessList;
                    authorizationList?: undefined;
                    blobVersionedHashes?: undefined;
                    chainId: number;
                    type: "eip2930";
                    gasPrice: bigint;
                    maxFeePerBlobGas?: undefined;
                    maxFeePerGas?: undefined;
                    maxPriorityFeePerGas?: undefined;
                    isSystemTx?: undefined;
                    mint?: undefined;
                    sourceHash?: undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    from: import("node_modules/viem/_types").Address;
                    gas: bigint;
                    hash: import("node_modules/viem/_types").Hash;
                    input: import("node_modules/viem/_types").Hex;
                    nonce: number;
                    r: import("node_modules/viem/_types").Hex;
                    s: import("node_modules/viem/_types").Hex;
                    to: import("node_modules/viem/_types").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("node_modules/viem/_types").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("node_modules/viem/_types").AccessList;
                    authorizationList?: undefined;
                    blobVersionedHashes?: undefined;
                    chainId: number;
                    type: "eip1559";
                    gasPrice?: undefined;
                    maxFeePerBlobGas?: undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined;
                    mint?: undefined;
                    sourceHash?: undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    from: import("node_modules/viem/_types").Address;
                    gas: bigint;
                    hash: import("node_modules/viem/_types").Hash;
                    input: import("node_modules/viem/_types").Hex;
                    nonce: number;
                    r: import("node_modules/viem/_types").Hex;
                    s: import("node_modules/viem/_types").Hex;
                    to: import("node_modules/viem/_types").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("node_modules/viem/_types").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("node_modules/viem/_types").AccessList;
                    authorizationList?: undefined;
                    blobVersionedHashes: readonly import("node_modules/viem/_types").Hex[];
                    chainId: number;
                    type: "eip4844";
                    gasPrice?: undefined;
                    maxFeePerBlobGas: bigint;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined;
                    mint?: undefined;
                    sourceHash?: undefined;
                } | {
                    blockHash: `0x${string}` | null;
                    blockNumber: bigint | null;
                    from: import("node_modules/viem/_types").Address;
                    gas: bigint;
                    hash: import("node_modules/viem/_types").Hash;
                    input: import("node_modules/viem/_types").Hex;
                    nonce: number;
                    r: import("node_modules/viem/_types").Hex;
                    s: import("node_modules/viem/_types").Hex;
                    to: import("node_modules/viem/_types").Address | null;
                    transactionIndex: number | null;
                    typeHex: import("node_modules/viem/_types").Hex | null;
                    v: bigint;
                    value: bigint;
                    yParity: number;
                    accessList: import("node_modules/viem/_types").AccessList;
                    authorizationList: import("node_modules/viem/_types/experimental").SignedAuthorizationList;
                    blobVersionedHashes?: undefined;
                    chainId: number;
                    type: "eip7702";
                    gasPrice?: undefined;
                    maxFeePerBlobGas?: undefined;
                    maxFeePerGas: bigint;
                    maxPriorityFeePerGas: bigint;
                    isSystemTx?: undefined;
                    mint?: undefined;
                    sourceHash?: undefined;
                }) & {};
                type: "transaction";
            };
            readonly transactionReceipt: {
                exclude: [] | undefined;
                format: (args: import("node_modules/viem/_types/chains").OpStackRpcTransactionReceipt) => {
                    blobGasPrice?: bigint | undefined;
                    blobGasUsed?: bigint | undefined;
                    blockHash: import("node_modules/viem/_types").Hash;
                    blockNumber: bigint;
                    contractAddress: import("node_modules/viem/_types").Address | null | undefined;
                    cumulativeGasUsed: bigint;
                    effectiveGasPrice: bigint;
                    from: import("node_modules/viem/_types").Address;
                    gasUsed: bigint;
                    logs: import("node_modules/viem/_types").Log<bigint, number, false>[];
                    logsBloom: import("node_modules/viem/_types").Hex;
                    root?: import("node_modules/viem/_types").Hash | undefined;
                    status: "success" | "reverted";
                    to: import("node_modules/viem/_types").Address | null;
                    transactionHash: import("node_modules/viem/_types").Hash;
                    transactionIndex: number;
                    type: import("node_modules/viem/_types").TransactionType;
                    l1GasPrice: bigint | null;
                    l1GasUsed: bigint | null;
                    l1Fee: bigint | null;
                    l1FeeScalar: number | null;
                } & {};
                type: "transactionReceipt";
            };
        };
        serializers: {
            readonly transaction: typeof import("node_modules/viem/_types/chains").serializeTransactionOpStack;
        };
    };
};
export type NetworkName = keyof typeof networks;
