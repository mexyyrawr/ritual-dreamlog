import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual",
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

// Contract address (deployed)
export const CONTRACT_ADDRESS = "0x597b9b030cb9e49fcb612e93eb8892b65dd8b296" as const;

// Contract ABI (minimal - only what frontend needs)
export const CONTRACT_ABI = [
  {
    name: "submitAndInterpret",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dreamText", type: "string" },
      { name: "language", type: "string" },
    ],
    outputs: [{ name: "dreamId", type: "uint256" }],
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
          { name: "symbols", type: "string[]" },
          { name: "emotion", type: "string" },
          { name: "archetype", type: "string" },
          { name: "interpretation", type: "string" },
          { name: "mood", type: "string" },
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
    name: "getTotalDreams",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
