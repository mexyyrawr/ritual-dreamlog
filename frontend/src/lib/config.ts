import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual Testnet",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.ritualfoundation.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Ritual Explorer",
      url: "https://explorer.ritualfoundation.org",
    },
  },
});

export const config = createConfig({
  chains: [ritualChain],
  connectors: [injected()],
  transports: {
    [ritualChain.id]: http(),
  },
});

// New contract address (PrecompileConsumer + receive() auto-deposit)
export const CONTRACT_ADDRESS = "0x4f055F663fa01FFc56cb95fD00464aCbc2E275eC" as const;

// TEE Executor (registered LLM executor on Ritual Testnet)
export const TEE_EXECUTOR = "0xB42e435c4252A5a2E7440e37B609F00c61a0c91B" as const;

// LLM Precompile
export const LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802" as const;

// RitualWallet
export const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const;

// Contract ABI
export const CONTRACT_ABI = [
  {
    name: "submitDream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "text", type: "string" },
    ],
    outputs: [{ name: "dreamId", type: "uint256" }],
  },
  {
    name: "interpretDream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dreamId", type: "uint256" },
      { name: "llmInput", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "storeResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dreamId", type: "uint256" },
      { name: "interpretation", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "dreams",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "text", type: "string" },
      { name: "timestamp", type: "uint256" },
      { name: "mood", type: "uint8" },
      { name: "interpretation", type: "string" },
      { name: "archetype", type: "string" },
    ],
  },
  {
    name: "dreamCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "DreamSubmitted",
    type: "event",
    inputs: [
      { name: "dreamId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "text", type: "string", indexed: false },
    ],
  },
  {
    name: "DreamInterpreted",
    type: "event",
    inputs: [
      { name: "dreamId", type: "uint256", indexed: true },
      { name: "interpretation", type: "string", indexed: false },
      { name: "mood", type: "uint8", indexed: false },
    ],
  },
] as const;
