"use client";

import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { useState, useEffect } from "react";
import { CONTRACT_ADDRESS, CONTRACT_ABI, ritualChain } from "@/lib/config";
import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";

const RITUAL_CHAIN_ID = 1979;

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [dreamText, setDreamText] = useState("");
  const [language, setLanguage] = useState("id");
  const [status, setStatus] = useState<"idle" | "submitting" | "interpreting" | "storing" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [dreamId, setDreamId] = useState<number | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const { writeContract, data: txHash } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const log = (msg: string) => {
    console.log("[Dreamlog]", msg);
    setDebugLog(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    if (isConnected && chain && chain.id !== RITUAL_CHAIN_ID) {
      setIsWrongNetwork(true);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chain]);

  useEffect(() => {
    if (isConnected && isWrongNetwork) handleSwitchNetwork();
  }, [isConnected, isWrongNetwork]);

  const handleSwitchNetwork = async () => {
    try { switchChain({ chainId: RITUAL_CHAIN_ID }); } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eth = (window as any).ethereum;
        if (eth) await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: `0x${RITUAL_CHAIN_ID.toString(16)}`, chainName: "Ritual Testnet", nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 }, rpcUrls: ["https://rpc.ritualfoundation.org"], blockExplorerUrls: ["https://explorer.ritualfoundation.org"] }] });
      } catch (e) { console.error("Failed to add chain:", e); }
    }
  };

  const encodeLLMRequest = (): Hex => {
    const sys = 'You are a dream interpreter. Analyze the dream and reply with ONLY a JSON object: {"symbols":["sym1","sym2"],"emotion":"emotion","archetype":"archetype","interpretation":"2-3 sentences","mood":"mystical|dark|zen|wonder|horror|confused"}. No markdown, just JSON.';
    const msg = JSON.stringify([{ role: "system", content: sys }, { role: "user", content: dreamText }]);

    // Encode the 25-field LLM request
    // Field 0: executor (must be non-zero, from TEEServiceRegistry)
    const encoded = encodeAbiParameters(
      parseAbiParameters([
        "address, bytes[], uint256, bytes[], bytes,",
        "string, string, int256, string, bool, int256, string, string,",
        "uint256, bool, int256, string, bytes, int256, string, string, bool,",
        "int256, bytes, bytes, int256, int256, string, bool,",
        "(string,string,string)"
      ].join("")),
      [
        "0xB42e435c4252A5a2E7440e37B609F00c61a0c91B" as `0x${string}`, // TEE executor (registered in TEEServiceRegistry)
        [],           // encryptedSecrets
        300n,         // ttl (blocks)
        [],           // secretSignatures
        "0x" as Hex,  // userPublicKey (empty = plaintext)
        msg,          // messagesJson (field 5)
        "zai-org/GLM-4.7-FP8", // model (field 6)
        0n,           // frequencyPenalty
        "",           // logitBias
        false,        // logprobs
        4096n,        // maxCompletionTokens
        "",           // n
        "",           // parallelToolCalls
        1n,           // presencePenalty
        true,         // responseFormat
        0n,           // seed
        "medium",     // serviceTier
        "0x" as Hex,  // stop
        -1n,          // stream
        "auto",       // temperature
        "",           // toolChoice
        false,        // tools
        700n,         // topLogprobs
        "0x" as Hex,  // topP
        "0x" as Hex,  // topLogprobs
        -1n,          // topP
        1000n,        // convoHistory
        "",           // ...
        false,        // ...
        ["", "", ""]  // convoHistory tuple
      ]
    );
    return encoded;
  };

  const handleSubmit = async () => {
    if (!dreamText.trim() || !isConnected || isWrongNetwork) return;
    setStatus("submitting"); setErrorMessage(""); setDreamId(null);
    try {
      log("Step 1: Submitting dream...");
      writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "submitDream", args: [dreamText, language] }, {
        onSuccess: () => { log("Dream submitted! Calling LLM via contract..."); setStatus("interpreting"); callLLMViaContract(); },
        onError: (error) => { setStatus("error"); setErrorMessage(`Submit: ${error.message}`); log(`Error: ${error.message}`); },
      });
    } catch (err: unknown) { setStatus("error"); setErrorMessage(err instanceof Error ? err.message : "Unknown"); }
  };

  const callLLMViaContract = async () => {
    try {
      log("Encoding LLM request (25-field ABI)...");
      const llmInput = encodeLLMRequest();
      log(`Encoded: ${llmInput.length / 2} bytes`);

      log("Step 2: Calling contract.interpretDream()...");
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "interpretDream",
        args: [BigInt(dreamId ?? 0), llmInput]
      }, {
        onSuccess: () => { log("✅ interpretDream TX sent! LLM processing on-chain..."); setStatus("storing"); },
        onError: (error) => { setStatus("error"); setErrorMessage(`LLM: ${error.message}`); log(`Error: ${error.message}`); },
      });
    } catch (err: unknown) { setStatus("error"); const m = err instanceof Error ? err.message : "LLM encoding failed"; setErrorMessage(m); log(`Error: ${m}`); }
  };

  useEffect(() => {
    if (isConfirmed && txHash && dreamId === null) {
      (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eth = (window as any).ethereum;
          const r = await eth.request({ method: "eth_getTransactionReceipt", params: [txHash] });
          if (r?.logs) for (const l of r.logs) { if (l.topics?.length >= 2) { const id = parseInt(l.topics[1], 16); if (id >= 0) { setDreamId(id); log(`Dream ID: ${id}`); break; } } }
        } catch {}
      })();
    }
    if (isConfirmed && txHash && status === "storing") {
      log("✅ LLM interpretation complete! Dream saved on-chain.");
      setStatus("done");
    }
  }, [isConfirmed, txHash, dreamId, status]);

  const languages = [{ code: "id", label: "🇮🇩 Indonesia" }, { code: "en", label: "🇬🇧 English" }, { code: "ja", label: "🇯🇵 Japan" }, { code: "ko", label: "🇰🇷 Korea" }, { code: "ar", label: "🇸🇦 Arabic" }, { code: "es", label: "🇪🇸 Spanish" }, { code: "pt", label: "🇧🇷 Portuguese" }, { code: "zh", label: "🇨🇳 Chinese" }];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">🌙 Ritual Dreamlog</h1>
        <p className="text-gray-400 text-sm">On-chain dream journal powered by Ritual LLM Precompile</p>
        <p className="text-gray-500 text-xs mt-1">Chain ID: 1979 • Contract: {CONTRACT_ADDRESS.slice(0, 10)}...</p>
      </div>

      <div className="mb-6">
        {isConnected ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-700">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isWrongNetwork ? "bg-red-400" : "bg-green-400"}`} />
              <span className="text-sm text-gray-300">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${isWrongNetwork ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>{isWrongNetwork ? `Wrong (${chain?.name})` : "Ritual Testnet"}</span>
              <button onClick={() => disconnect()} className="text-xs text-gray-500 hover:text-red-400">Disconnect</button>
            </div>
            {isWrongNetwork && <button onClick={handleSwitchNetwork} className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">⚡ Switch to Ritual</button>}
          </div>
        ) : <button onClick={() => connect({ connector: connectors[0] })} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-purple-500/20">Connect Wallet</button>}
      </div>

      {isConnected && isWrongNetwork && <div className="w-full max-w-md mb-4 p-3 bg-orange-900/20 border border-orange-800/30 rounded-lg"><p className="text-sm text-orange-400 text-center">⚠️ Switch ke Ritual Testnet dulu!</p></div>}

      {isConnected && !isWrongNetwork && (
        <div className="w-full max-w-md">
          <div className="mb-4"><label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Bahasa / Language</label><select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500">{languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
          <div className="mb-4"><label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Ceritakan Mimpimu</label><textarea value={dreamText} onChange={(e) => setDreamText(e.target.value)} placeholder="Aku bermimpi terbang di atas kota..." rows={4} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none" /></div>
          <button onClick={handleSubmit} disabled={!dreamText.trim() || ["submitting", "interpreting", "storing"].includes(status)} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 disabled:from-gray-700 disabled:text-gray-500 text-white py-3 rounded-lg font-medium shadow-lg shadow-purple-500/20 disabled:shadow-none">
            {status === "idle" && "🌙 Interpret & Save On-Chain"}
            {status === "submitting" && "📝 Submitting..."}
            {status === "interpreting" && "🤖 AI Interpreting..."}
            {status === "storing" && "💾 Saving..."}
            {status === "done" && "✅ Dream Saved!"}
            {status === "error" && "❌ Error — Try Again"}
          </button>
          {txHash && <div className="mt-4 text-center"><a href={`https://explorer.ritualfoundation.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400">View on Explorer →</a></div>}
          {status === "interpreting" && <div className="mt-4 text-center"><div className="inline-flex items-center gap-2 text-sm text-gray-400"><div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />LLM interpreting on-chain...</div></div>}
          {status === "error" && errorMessage && <div className="mt-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg"><p className="text-xs text-red-400 break-all">{errorMessage}</p></div>}
          {status === "done" && <div className="mt-6 p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-800/30 rounded-xl"><p className="text-center text-sm text-gray-300">✨ Dream interpreted and saved!</p></div>}
          {debugLog.length > 0 && <div className="mt-4 p-2 bg-gray-900/50 rounded-lg border border-gray-800"><p className="text-xs text-gray-500 mb-1">Debug:</p>{debugLog.map((e, i) => <p key={i} className="text-xs text-gray-400 font-mono">{e}</p>)}</div>}
        </div>
      )}
      <div className="mt-12 text-center"><p className="text-xs text-gray-600">Powered by Ritual Chain • LLM Precompile 0x0802</p></div>
    </main>
  );
}
