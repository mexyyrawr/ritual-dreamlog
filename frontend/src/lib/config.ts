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

// Contract address (PrecompileConsumer architecture)
export const CONTRACT_ADDRESS = "0xb1fB621c97e39235A06B660731C9EC409232e9BA" as const;

// Contract ABI (PrecompileConsumer architecture)
export const CONTRACT_ABI = [
  {
    name: "submitDream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dreamText", type: "string" },
      { name: "language", type: "string" },
    ],
    outputs: [{ name: "dreamId", type: "uint256" }],
  },
  {
    name: "interpretDream",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "dreamId", type: "uint256" },
      { name: "llmInput", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "depositForFees",
    type: "function",
    stateMutability: "payable",
    inputs: [],
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
    name: "getDream",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dreamId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "dreamer", type: "address" },
          { name: "dreamText", type: "string" },
          { name: "interpretation", type: "string" },
          { name: "mood", type: "string" },
          { name: "archetype", type: "string" },
          { name: "emotion", type: "string" },
          { name: "language", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "parentDreamId", type: "uint256" },
          { name: "minted", type: "bool" },
          { name: "interpreted", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getDreamsByAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dreamer", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getTotalDreams",
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
      { name: "dreamer", type: "address", indexed: true },
      { name: "language", type: "string", indexed: false },
    ],
  },
  {
    name: "DreamInterpreted",
    type: "event",
    inputs: [
      { name: "dreamId", type: "uint256", indexed: true },
      { name: "mood", type: "string", indexed: false },
      { name: "archetype", type: "string", indexed: false },
    ],
  },
] as const;
