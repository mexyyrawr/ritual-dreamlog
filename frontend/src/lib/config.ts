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

// New contract with submitAndInterpret (1 popup!)
export const CONTRACT_ADDRESS = "0xa7454662c5ceeB6b07d264C445e73Ab270C2583B" as const;

export const TEE_EXECUTOR = "0xB42e435c4252A5a2E7440e37B609F00c61a0c91B" as const;
export const LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802" as const;
export const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const;

export const CONTRACT_ABI = [
  {
    name: "submitAndInterpret",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "text", type: "string" },
      { name: "llmInput", type: "bytes" },
    ],
    outputs: [{ name: "dreamId", type: "uint256" }],
  },
  {
    name: "submitDream",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "text", type: "string" }],
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
