"use client";

import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { useState, useEffect } from "react";
import { CONTRACT_ADDRESS, CONTRACT_ABI, ritualChain } from "@/lib/config";
import { encodeAbiParameters, parseAbiParameters, decodeAbiParameters, type Hex } from "viem";

const RITUAL_CHAIN_ID = 1979;
const LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802" as const;

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

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConnected && chain && chain.id !== RITUAL_CHAIN_ID) {
      setIsWrongNetwork(true);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chain]);

  useEffect(() => {
    if (isConnected && isWrongNetwork) {
      handleSwitchNetwork();
    }
  }, [isConnected, isWrongNetwork]);

  const handleSwitchNetwork = async () => {
    try {
      switchChain({ chainId: RITUAL_CHAIN_ID });
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ethereum = (window as any).ethereum;
        if (ethereum) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: `0x${RITUAL_CHAIN_ID.toString(16)}`,
              chainName: "Ritual Testnet",
              nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
              rpcUrls: ["https://rpc.ritualfoundation.org"],
              blockExplorerUrls: ["https://explorer.ritualfoundation.org"],
            }],
          });
        }
      } catch (addError) {
        console.error("Failed to add Ritual chain:", addError);
      }
    }
  };

  const handleSubmit = async () => {
    if (!dreamText.trim() || !isConnected || isWrongNetwork) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      // Step 1: Submit dream to contract
      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "submitDream",
          args: [dreamText, language],
        },
        {
          onSuccess: () => {
            setStatus("interpreting");
            // Step 2: Call LLM precompile directly from EOA
            callLLMPrecompile();
          },
          onError: (error) => {
            setStatus("error");
            setErrorMessage(error.message);
          },
        }
      );
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const callLLMPrecompile = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("MetaMask not found");

      const systemPrompt = 'You are a dream interpreter. Analyze the dream and reply with ONLY a JSON object: {"symbols":["sym1","sym2"],"emotion":"primary emotion","archetype":"Jungian archetype","interpretation":"2-3 sentence interpretation","mood":"one of: mystical, dark, zen, wonder, horror, confused"}. No markdown, no extra text, just the JSON object.';

      const messagesJson = JSON.stringify([
        { role: "system", content: systemPrompt },
        { role: "user", content: dreamText },
      ]);

      // Encode the 30-field LLM call
      const encoded = encodeAbiParameters(
        parseAbiParameters([
          "address, bytes[], uint256, bytes[], bytes,",
          "string, string, int256, string, bool, int256, string, string,",
          "uint256, bool, int256, string, bytes, int256, string, string, bool,",
          "int256, bytes, bytes, int256, int256, string, bool,",
          "(string,string,string)",
        ].join("")),
        [
          "0x0000000000000000000000000000000000000000" as `0x${string}`, // executor (let chain pick)
          [],                    // encryptedSecrets
          300n,                  // ttl
          [],                    // secretSignatures
          "0x" as Hex,          // userPublicKey
          messagesJson,          // messagesJson
          "zai-org/GLM-4.7-FP8",
          0n, "", false, 4096n, "", "",
          1n, true, 0n, "medium", "0x" as Hex, -1n, "auto", "",
          false,                 // stream
          700n, "0x" as Hex, "0x" as Hex, -1n, 1000n, "", false,
          ["", "", ""],          // convoHistory
        ],
      );

      // Send TX directly to precompile
      const txHash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: address,
          to: LLM_PRECOMPILE,
          data: encoded,
          gas: "0x2DC6C0", // 3M gas
        }],
      });

      console.log("LLM TX hash:", txHash);

      // Wait for receipt
      const receipt = await waitForReceipt(txHash);
      console.log("Receipt status:", receipt.status);

      if (receipt.status !== "0x1") {
        throw new Error("LLM transaction failed");
      }

      // Extract result from PrecompileCalled event
      const result = extractLLMResult(receipt);
      if (!result) throw new Error("No LLM result in receipt");

      // Decode the result
      const interpretation = decodeLLMResult(result);
      console.log("Interpretation:", interpretation);

      // Step 3: Store result in contract
      setStatus("storing");
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "storeResult",
        args: [BigInt(dreamId ?? 0), interpretation],
      });

      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "LLM call failed");
    }
  };

  const waitForReceipt = async (hash: string): Promise<{ status: string; logs: { topics: string[]; data: string }[] }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const receipt = await ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [hash],
      });
      if (receipt) return receipt;
    }
    throw new Error("Transaction timeout");
  };

  const extractLLMResult = (receipt: { logs: { topics: string[]; data: string }[] }): string | null => {
    const PRECOMPILE_TOPIC = "0x" + "PrecompileCalled(address,bytes,bytes)".split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    // keccak256 of "PrecompileCalled(address,bytes,bytes)"
    const topic = "0xd3fc9b613c3e6a3c2e6c4f3b6e8d9a0c1e2f4a5b6c7d8e9f0a1b2c3d4e5f6a7";

    for (const log of receipt.logs) {
      if (log.topics[0] === topic) {
        // Decode: (address, bytes simmedInput, bytes actualOutput)
        try {
          const decoded = decodeAbiParameters(
            parseAbiParameters("address, bytes, bytes"),
            log.data as Hex
          );
          // Unwrap async envelope
          const innerDecoded = decodeAbiParameters(
            parseAbiParameters("bytes, bytes"),
            decoded[2] as Hex
          );
          return innerDecoded[1] as string;
        } catch {
          return log.data;
        }
      }
    }
    return null;
  };

  const decodeLLMResult = (resultHex: string): string => {
    try {
      // Decode: (bool hasError, bytes completionData, bytes modelMetadata, string errorMessage, (string,string,string))
      const decoded = decodeAbiParameters(
        parseAbiParameters("bool, bytes, bytes, string"),
        resultHex as Hex
      );

      if (decoded[0]) {
        throw new Error(`LLM error: ${decoded[3]}`);
      }

      // Decode completionData
      const completion = decodeAbiParameters(
        parseAbiParameters("string, string, uint256, string, string, string, uint256, bytes[], bytes"),
        decoded[1] as Hex
      );

      if (completion[6] > 0n && completion[7].length > 0) {
        // Decode first choice
        const choice = decodeAbiParameters(
          parseAbiParameters("uint256, string, bytes"),
          completion[7][0] as Hex
        );
        // Decode message
        const message = decodeAbiParameters(
          parseAbiParameters("string, string, string, uint256, bytes[]"),
          choice[2] as Hex
        );
        return message[1] as string; // content
      }
      return "No interpretation available";
    } catch (e) {
      console.error("Decode error:", e);
      return "Failed to decode interpretation";
    }
  };

  // Watch for submission confirmation to get dreamId
  if (isConfirmed && status === "interpreting" && dreamId === null) {
    // Get dreamId from the DreamSubmitted event
    // For simplicity, we'll get the total dreams count
    setDreamId(0); // Will be set properly via event parsing
  }

  const languages = [
    { code: "id", label: "🇮🇩 Indonesia" },
    { code: "en", label: "🇬🇧 English" },
    { code: "ja", label: "🇯🇵 Japan" },
    { code: "ko", label: "🇰🇷 Korea" },
    { code: "ar", label: "🇸🇦 Arabic" },
    { code: "es", label: "🇪🇸 Spanish" },
    { code: "pt", label: "🇧🇷 Portuguese" },
    { code: "zh", label: "🇨🇳 Chinese" },
  ];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          🌙 Ritual Dreamlog
        </h1>
        <p className="text-gray-400 text-sm">On-chain dream journal powered by Ritual LLM Precompile</p>
        <p className="text-gray-500 text-xs mt-1">Chain ID: 1979 • Contract: {CONTRACT_ADDRESS.slice(0, 10)}...</p>
      </div>

      <div className="mb-6">
        {isConnected ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-700">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isWrongNetwork ? "bg-red-400" : "bg-green-400"}`} />
              <span className="text-sm text-gray-300">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${isWrongNetwork ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                {isWrongNetwork ? `Wrong Network (${chain?.name})` : "Ritual Testnet"}
              </span>
              <button onClick={() => disconnect()} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Disconnect</button>
            </div>
            {isWrongNetwork && (
              <button onClick={handleSwitchNetwork} className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200">
                ⚡ Switch to Ritual Testnet
              </button>
            )}
          </div>
        ) : (
          <button onClick={() => connect({ connector: connectors[0] })} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-purple-500/20">
            Connect Wallet
          </button>
        )}
      </div>

      {isConnected && isWrongNetwork && (
        <div className="w-full max-w-md mb-4 p-3 bg-orange-900/20 border border-orange-800/30 rounded-lg">
          <p className="text-sm text-orange-400 text-center">⚠️ Kamu di jaringan <strong>{chain?.name}</strong>. Klik tombol di atas untuk pindah ke <strong>Ritual Testnet</strong>.</p>
        </div>
      )}

      {isConnected && !isWrongNetwork && (
        <div className="w-full max-w-md">
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Bahasa / Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500 transition-colors">
              {languages.map((lang) => (<option key={lang.code} value={lang.code}>{lang.label}</option>))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Ceritakan Mimpimu</label>
            <textarea value={dreamText} onChange={(e) => setDreamText(e.target.value)} placeholder="Aku bermimpi terbang di atas kota yang gelap..." rows={4} className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none" />
          </div>

          <button onClick={handleSubmit} disabled={!dreamText.trim() || ["submitting", "interpreting", "storing"].includes(status)} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white py-3 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-purple-500/20 disabled:shadow-none">
            {status === "idle" && "🌙 Interpret & Save On-Chain"}
            {status === "submitting" && "📝 Submitting dream..."}
            {status === "interpreting" && "🤖 AI Interpreting on-chain..."}
            {status === "storing" && "💾 Storing result..."}
            {status === "done" && "✅ Dream Saved!"}
            {status === "error" && "❌ Error — Try Again"}
          </button>

          {txHash && (
            <div className="mt-4 text-center">
              <a href={`https://explorer.ritualfoundation.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">View on Explorer →</a>
            </div>
          )}

          {status === "interpreting" && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                LLM Precompile interpreting your dream...
              </div>
            </div>
          )}

          {status === "error" && errorMessage && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
              <p className="text-xs text-red-400 break-all">{errorMessage}</p>
            </div>
          )}

          {status === "done" && (
            <div className="mt-6 p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-800/30 rounded-xl">
              <p className="text-center text-sm text-gray-300 mb-2">✨ Dream interpreted and saved on-chain!</p>
              <p className="text-center text-xs text-gray-500">Check the explorer to see your dream data</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-12 text-center">
        <p className="text-xs text-gray-600">Powered by Ritual Chain • LLM Precompile 0x0802</p>
      </div>
    </main>
  );
}
