"use client";

import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { useState, useEffect } from "react";
import { CONTRACT_ADDRESS, CONTRACT_ABI, ritualChain } from "@/lib/config";
import { encodeAbiParameters, parseAbiParameters, decodeAbiParameters, type Hex } from "viem";

const RITUAL_CHAIN_ID = 1979;
const LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802" as const;
const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReceipt = any;

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [dreamText, setDreamText] = useState("");
  const [language, setLanguage] = useState("id");
  const [status, setStatus] = useState<"idle" | "submitting" | "interpreting" | "storing" | "done" | "error" | "depositing">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [dreamId, setDreamId] = useState<number | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [txType, setTxType] = useState<"deposit" | "submit" | null>(null);

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

  const handleDeposit = async () => {
    if (!isConnected) return;
    setStatus("depositing"); setErrorMessage(""); setTxType("deposit");
    try {
      writeContract({ address: RITUAL_WALLET, abi: [{ name: "deposit", type: "function", stateMutability: "payable", inputs: [{ name: "lockDuration", type: "uint256" }], outputs: [] }], functionName: "deposit", args: [5000n], value: BigInt("500000000000000000") });
      log("Depositing 0.5 RIT to RitualWallet...");
    } catch (err: unknown) { setStatus("error"); setErrorMessage(err instanceof Error ? err.message : "Deposit failed"); }
  };

  const handleSubmit = async () => {
    if (!dreamText.trim() || !isConnected || isWrongNetwork) return;
    setStatus("submitting"); setErrorMessage(""); setDreamId(null); setTxType("submit");
    try {
      log("Step 1: Submitting dream...");
      writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "submitDream", args: [dreamText, language] }, {
        onSuccess: () => { log("Dream submitted! Calling LLM..."); setStatus("interpreting"); callLLMPrecompile(); },
        onError: (error) => { setStatus("error"); setErrorMessage(`Submit: ${error.message}`); log(`Error: ${error.message}`); },
      });
    } catch (err: unknown) { setStatus("error"); setErrorMessage(err instanceof Error ? err.message : "Unknown"); }
  };

  const callLLMPrecompile = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("MetaMask not found");

      const sys = 'You are a dream interpreter. Analyze the dream and reply with ONLY a JSON object: {"symbols":["sym1","sym2"],"emotion":"emotion","archetype":"archetype","interpretation":"2-3 sentences","mood":"mystical|dark|zen|wonder|horror|confused"}. No markdown, just JSON.';
      const msg = JSON.stringify([{ role: "system", content: sys }, { role: "user", content: dreamText }]);

      log("Encoding LLM call...");
      const encoded = encodeAbiParameters(
        parseAbiParameters(["address, bytes[], uint256, bytes[], bytes,", "string, string, int256, string, bool, int256, string, string,", "uint256, bool, int256, string, bytes, int256, string, string, bool,", "int256, bytes, bytes, int256, int256, string, bool,", "(string,string,string)"].join("")),
        ["0x0000000000000000000000000000000000000000" as `0x${string}`, [], 300n, [], "0x" as Hex, msg, "zai-org/GLM-4.7-FP8", 0n, "", false, 4096n, "", "", 1n, true, 0n, "medium", "0x" as Hex, -1n, "auto", "", false, 700n, "0x" as Hex, "0x" as Hex, -1n, 1000n, "", false, ["", "", ""]]
      );

      log(`Sending to precompile (${encoded.length / 2} bytes)...`);
      const llmTxHash = await ethereum.request({ method: "eth_sendTransaction", params: [{ from: address, to: LLM_PRECOMPILE, data: encoded, gas: "0x2DC6C0" }] });
      log(`LLM TX: ${llmTxHash}`);

      // Wait for receipt
      const receipt: AnyReceipt = await waitForReceipt(llmTxHash);
      log(`Status: ${receipt.status}, logs: ${receipt.logs?.length || 0}, keys: ${Object.keys(receipt).join(",")}`);

      if (receipt.status !== "0x1") throw new Error("LLM TX failed on-chain");

      // Try extract from logs
      let interpretation = "";
      if (receipt.logs?.length > 0) {
        const result = extractLLMResult(receipt);
        if (result) { interpretation = decodeLLMResult(result); log(`Decoded: ${interpretation.slice(0, 80)}...`); }
      }

      // Try spcCalls
      if (!interpretation && receipt.spcCalls) {
        log("Trying spcCalls...");
        try {
          const sc = receipt.spcCalls;
          if (Array.isArray(sc)) for (const c of sc) { if (c.to?.toLowerCase() === LLM_PRECOMPILE.toLowerCase() && c.output) { interpretation = decodeLLMResult(c.output); log(`spcCalls: ${interpretation.slice(0, 80)}...`); break; } }
        } catch (e) { log(`spcCalls err: ${e}`); }
      }

      // Poll for settlement if no result yet
      if (!interpretation) {
        log("Polling for settlement (60s)...");
        const sr = await pollForSettlement(llmTxHash);
        if (sr) {
          if (sr.logs?.length > 0) { const r = extractLLMResult(sr); if (r) interpretation = decodeLLMResult(r); }
          if (!interpretation && sr.spcCalls) { try { const sc = sr.spcCalls; if (Array.isArray(sc)) for (const c of sc) { if (c.to?.toLowerCase() === LLM_PRECOMPILE.toLowerCase() && c.output) { interpretation = decodeLLMResult(c.output); break; } } } catch {} }
        }
      }

      if (!interpretation) throw new Error("No LLM result. Check RitualWallet deposit (must use deposit() function, not plain transfer).");

      log("Storing result...");
      setStatus("storing");
      writeContract({ address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "storeResult", args: [BigInt(dreamId ?? 0), interpretation] });
      setStatus("done"); log("Done!");
    } catch (err: unknown) { setStatus("error"); const m = err instanceof Error ? err.message : "LLM failed"; setErrorMessage(m); log(`Error: ${m}`); }
  };

  const waitForReceipt = async (hash: string): Promise<AnyReceipt> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum;
    for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 3000)); const r = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] }); if (r) return r; }
    throw new Error("Timeout (90s)");
  };

  const pollForSettlement = async (hash: string): Promise<AnyReceipt | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum;
    for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 5000)); try { const r = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] }); if (r?.logs?.length > 0) return r; } catch {} }
    return null;
  };

  const extractLLMResult = (receipt: { logs: { topics: string[]; data: string }[] }): string | null => {
    for (const log of receipt.logs) { if (log.data?.length > 10) { try { const d = decodeAbiParameters(parseAbiParameters("bytes, bytes"), log.data as Hex); return d[1] as string; } catch {} } }
    return null;
  };

  const decodeLLMResult = (hex: string): string => {
    try {
      const d = decodeAbiParameters(parseAbiParameters("bool, bytes, bytes, string"), hex as Hex);
      if (d[0]) throw new Error(`LLM: ${d[3]}`);
      const c = decodeAbiParameters(parseAbiParameters("string, string, uint256, string, string, string, uint256, bytes[], bytes"), d[1] as Hex);
      if (c[6] > 0n && c[7].length > 0) { const ch = decodeAbiParameters(parseAbiParameters("uint256, string, bytes"), c[7][0] as Hex); const m = decodeAbiParameters(parseAbiParameters("string, string, string, uint256, bytes[]"), ch[2] as Hex); return m[1] as string; }
      return "No interpretation";
    } catch (e) { return `Decode failed: ${e instanceof Error ? e.message : "unknown"}`; }
  };

  useEffect(() => {
    if (isConfirmed && txHash && dreamId === null && txType === "submit") {
      (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eth = (window as any).ethereum;
          const r = await eth.request({ method: "eth_getTransactionReceipt", params: [txHash] });
          if (r?.logs) for (const l of r.logs) { if (l.topics?.length >= 2) { const id = parseInt(l.topics[1], 16); if (id >= 0) { setDreamId(id); log(`Dream ID: ${id}`); break; } } }
        } catch {}
      })();
    }
    if (isConfirmed && txHash && txType === "deposit") {
      log("✅ Deposit confirmed! RitualWallet balance updated.");
      setStatus("idle");
    }
  }, [isConfirmed, txHash, dreamId, txType]);

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
          <div className="mb-4"><button onClick={handleDeposit} disabled={status === "depositing"} className="w-full bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-700 disabled:text-gray-500 text-white py-2 rounded-lg text-sm font-medium">{status === "depositing" ? "⏳ Depositing..." : "💰 Deposit 0.5 RIT to RitualWallet"}</button></div>
          <div className="mb-4"><label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Bahasa / Language</label><select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500">{languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
          <div className="mb-4"><label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Ceritakan Mimpimu</label><textarea value={dreamText} onChange={(e) => setDreamText(e.target.value)} placeholder="Aku bermimpi terbang di atas kota..." rows={4} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none" /></div>
          <button onClick={handleSubmit} disabled={!dreamText.trim() || ["submitting", "interpreting", "storing", "depositing"].includes(status)} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 disabled:from-gray-700 disabled:text-gray-500 text-white py-3 rounded-lg font-medium shadow-lg shadow-purple-500/20 disabled:shadow-none">
            {status === "idle" && "🌙 Interpret & Save On-Chain"}
            {status === "submitting" && "📝 Submitting..."}
            {status === "interpreting" && "🤖 AI Interpreting..."}
            {status === "storing" && "💾 Storing..."}
            {status === "depositing" && "💰 Depositing..."}
            {status === "done" && "✅ Dream Saved!"}
            {status === "error" && "❌ Error — Try Again"}
          </button>
          {txHash && <div className="mt-4 text-center"><a href={`https://explorer.ritualfoundation.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400">View on Explorer →</a></div>}
          {status === "interpreting" && <div className="mt-4 text-center"><div className="inline-flex items-center gap-2 text-sm text-gray-400"><div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />LLM interpreting...</div></div>}
          {status === "error" && errorMessage && <div className="mt-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg"><p className="text-xs text-red-400 break-all">{errorMessage}</p></div>}
          {status === "done" && <div className="mt-6 p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-800/30 rounded-xl"><p className="text-center text-sm text-gray-300">✨ Dream interpreted and saved!</p></div>}
          {debugLog.length > 0 && <div className="mt-4 p-2 bg-gray-900/50 rounded-lg border border-gray-800"><p className="text-xs text-gray-500 mb-1">Debug:</p>{debugLog.map((e, i) => <p key={i} className="text-xs text-gray-400 font-mono">{e}</p>)}</div>}
        </div>
      )}
      <div className="mt-12 text-center"><p className="text-xs text-gray-600">Powered by Ritual Chain • LLM Precompile 0x0802</p></div>
    </main>
  );
}
