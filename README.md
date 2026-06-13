# 🌙 Ritual Dreamlog

> On-chain dream journal powered by Ritual Chain's LLM Precompile (0x0802)

## What is this?

A decentralized dApp where users write dreams in any language, and an AI interprets them **directly on-chain** using Ritual Chain's LLM precompile. Results are stored immutably on the blockchain.

## Features

- 🌍 **Multi-language** — Write dreams in any language (Indonesian, Japanese, Arabic, etc.)
- 🤖 **AI Interpretation ON-CHAIN** — LLM precompile 0x0802 analyzes dreams on-chain
- 🎨 **Mood-based Visual Cards** — 6 atmospheric themes (mystical, dark, zen, wonder, horror, confused)
- 🔗 **Dream Chaining** — Link dreams into storylines
- 🪙 **NFT Minting** — Turn dream cards into ERC-721 NFTs
- 📤 **Share to X** — Share dream cards on Twitter

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contract | Solidity ^0.8.24 + OpenZeppelin |
| Chain | Ritual Chain (ID 1979) |
| AI Inference | LLM Precompile 0x0802 |
| Framework | Hardhat |
| Frontend | Next.js + wagmi + Tailwind (coming soon) |

## How it Works

```
User writes dream (any language)
        ↓
LLM Precompile 0x0802 interprets ON-CHAIN
        ↓
Results stored immutably:
  • Symbols (Water, Darkness, City...)
  • Emotion (Curiosity, Fear, Longing...)
  • Archetype (The Seeker, The Shadow...)
  • Interpretation (English)
  • Mood (mystical, dark, zen...)
        ↓
Visual card generated (CSS → screenshot)
        ↓
Share to X or Mint as NFT
```

## Smart Contract

The core contract `Dreamlog.sol`:
- Submits dreams and triggers LLM interpretation in a single transaction
- Stores all dream data on-chain (immutable)
- Supports dream chaining (storylines)
- ERC-721 NFT minting for dream cards

## Setup

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Deploy to Ritual Testnet
npx hardhat run scripts/deploy.js --network ritual
```

## Chain Config

| Property | Value |
|----------|-------|
| Chain ID | 1979 |
| Currency | RITUAL (18 decimals) |
| RPC | https://rpc.ritualfoundation.org |
| Explorer | https://explorer.ritualfoundation.org |
| LLM Precompile | 0x0802 |

## License

MIT
