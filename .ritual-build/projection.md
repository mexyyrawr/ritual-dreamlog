# RITUAL PROJECTION — Ritual Dreamlog

## Idea (verbatim)
On-chain dream journal. User writes a dream in any language, LLM precompile interprets it on-chain, results stored immutably. Visual card generated off-chain. Share to X. Optionally mint as NFT.

---

## Mapped Capabilities

| # | Capability | Ritual Primitive | Address | Notes |
|---|-----------|-----------------|---------|-------|
| 1 | Dream interpretation (AI text analysis) | LLM Precompile | `0x0802` | Short-running async. One per TX. Model: `zai-org/GLM-4.7-FP8` |
| 2 | On-chain state (dreams, interpretations) | Solidity storage | N/A | Mapping<uint256, Dream> struct |
| 3 | NFT minting (dream cards) | ERC-721 | N/A | Standard OpenZeppelin, optional per dream |
| 4 | Fee management | RitualWallet | `0x532F` | Deposit before async calls |
| 5 | Dream card visual rendering | Off-chain (CSS→screenshot) | N/A | Pure CSS mood themes, Puppeteer/Playwright |
| 6 | Share to X | Off-chain (Twitter intent URL) | N/A | `https://twitter.com/intent/tweet` |

---

## Architectural Constraints

1. **One short-running async precompile per TX** — LLM call (0x0802) is the only async call. Storage writes and NFT minting are synchronous, so they happen in the same fulfilled-replay TX as the LLM result.

2. **Sender lock** — One pending async job per EOA at a time. If user submits two dreams quickly, second TX will be rejected until first settles. Frontend must handle queue/UX for this.

3. **LLM output is on-chain** — The interpretation (symbols, emotion, archetype, text, mood) is stored in contract storage, making it immutable and verifiable.

4. **Visual cards are off-chain** — CSS rendering + screenshot requires browser environment. Not suitable for on-chain. Generated on-demand when user views or shares.

5. **Model pinned to `zai-org/GLM-4.7-FP8`** — Only confirmed live model. maxCompletionTokens >= 4096 (reasoning model). TTL >= 300 blocks.

6. **Structured output via response_format** — Force LLM to return JSON with specific schema (symbols, emotion, archetype, interpretation, mood). Best-effort; decoder must handle deviations.

---

## Implicit Requirements Added

- [x] RitualWallet deposit (~0.5 RIT) for LLM async fees
- [x] Executor discovery from TEEServiceRegistry (LLM capability = 1)
- [x] ConvoHistory StorageRef — required field, use empty `('','','')` for stateless per-call inference (no multi-turn needed)
- [x] maxCompletionTokens >= 4096 for GLM-4.7-FP8 reasoning headroom
- [x] TTL >= 300 blocks (~105s)
- [x] Response decoder that checks `hasError` before parsing `completionData`
- [x] Frontend sender-lock handling (disable submit while pending)

---

## Smart Contract Design

### Dream Struct
```solidity
struct Dream {
    uint256 id;
    address dreamer;
    string dreamText;         // Full text if < 256 chars, else hash
    string[] symbols;         // ["Water", "Darkness", "City"]
    string emotion;           // "Curiosity · Fear · Longing"
    string archetype;         // "The Seeker"
    string interpretation;    // Full English interpretation
    string mood;              // "mystical", "dark", "zen", "wonder", "horror", "confused"
    string language;          // "id", "jp", "ar", "en", etc.
    uint256 timestamp;
    uint256 parentDreamId;    // 0 if standalone, >0 if chained
    bool minted;              // Whether NFT has been minted
}
```

### Key Functions
```solidity
// 1. Submit + Interpret (single TX — LLM async + storage)
function submitAndInterpret(string calldata dreamText, string calldata language) external returns (uint256 dreamId);

// 2. Chain dreams (storyline)
function chainDream(uint256 dreamId, uint256 parentDreamId) external;

// 3. Mint dream card as NFT
function mintDreamCard(uint256 dreamId) external returns (uint256 tokenId);

// 4. View functions
function getDream(uint256 dreamId) external view returns (Dream memory);
function getDreamsByAddress(address dreamer) external view returns (uint256[] memory);
function getTotalDreams() external view returns (uint256);
```

### LLM Prompt Design
```
System: You are a dream interpreter. Analyze the given dream and return a JSON object with:
- "symbols": array of key symbols (max 5)
- "emotion": primary emotions detected (e.g., "Curiosity · Fear")
- "archetype": Jungian archetype (e.g., "The Seeker", "The Shadow")
- "interpretation": 2-3 sentence English interpretation
- "mood": one of ["mystical", "dark", "zen", "wonder", "horror", "confused"]

User: {dreamText}
```

### Response Format (structured output)
```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "dream_interpretation",
    "json_schema": {
      "type": "object",
      "properties": {
        "symbols": { "type": "array", "items": { "type": "string" }, "maxItems": 5 },
        "emotion": { "type": "string" },
        "archetype": { "type": "string" },
        "interpretation": { "type": "string" },
        "mood": { "type": "string", "enum": ["mystical", "dark", "zen", "wonder", "horror", "confused"] }
      },
      "required": ["symbols", "emotion", "archetype", "interpretation", "mood"]
    },
    "strict": true
  }
}
```

---

## Skills the Builder Should Load

| Phase | Skill | Purpose |
|-------|-------|---------|
| Contracts | `ritual-dapp-llm` | LLM precompile 30-field ABI, response decoding, fee estimation |
| Contracts | `ritual-dapp-contracts` | Consumer contract patterns, callback auth |
| Contracts | `ritual-dapp-wallet` | RitualWallet deposit/lock/withdraw |
| Contracts | `ritual-dapp-precompiles` | Full ABI reference |
| Frontend | `ritual-dapp-frontend` | wagmi hooks, async TX state machine, spcCalls parsing |
| Frontend | `ritual-dapp-design` | Dark-mode design system, mood themes |
| Deploy | `ritual-dapp-deploy` | Chain config (ID 1979), Foundry/Hardhat setup |
| Testing | `ritual-dapp-testing` | vm.mockCall for precompiles, Vitest |
| Debug | `ritual-dapp-overview` | Async lifecycle, sender lock, TEE trust model |

---

## Off-Chain Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js + wagmi + Tailwind | UI, wallet connection, dream form |
| Card Renderer | Puppeteer/Playwright | HTML→screenshot for shareable cards |
| Card Templates | Pure CSS + animations | 6 mood themes (dark, sad, fear, happy, zen, confused) |
| Twitter Share | Intent URL | Pre-composed tweet with card image |

---

## Reference Contracts

Check `examples/registry.json` for deployed contracts on Ritual Chain that use LLM precompile.

---

## Build Phases

### Phase 0 — Setup
- Init Next.js + Hardhat project
- Configure Ritual Testnet (Chain ID 1979)
- Install deps (viem, wagmi, hardhat, OpenZeppelin)

### Phase 1 — Smart Contract
- Write Dreamlog.sol with LLM precompile integration
- Implement submitAndInterpret with structured output
- Add NFT minting (ERC-721)
- Unit tests with vm.mockCall

### Phase 2 — Frontend Core
- Connect wallet (wagmi)
- Dream submission form
- Async TX state machine (submitting → interpreting → done)
- Dream card display

### Phase 3 — Visual Cards
- 6 CSS mood themes
- HTML→screenshot pipeline
- Share to X integration

### Phase 4 — Deploy & Verify
- Deploy to Ritual Testnet
- E2E test: submit dream → interpret → view card
- Verify on explorer
