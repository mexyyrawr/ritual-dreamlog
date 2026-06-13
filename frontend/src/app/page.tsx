"use client";

import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/config";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [dreamText, setDreamText] = useState("");
  const [language, setLanguage] = useState("id");
  const [dreamId, setDreamId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "interpreting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const { writeContract, data: txHash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubmit = async () => {
    if (!dreamText.trim()) return;
    if (!isConnected) {
      alert("Connect wallet dulu!");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "submitAndInterpret",
          args: [dreamText, language],
        },
        {
          onSuccess: () => {
            setStatus("interpreting");
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

  // Watch for transaction confirmation
  if (isConfirmed && status === "interpreting") {
    setStatus("done");
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

  const moodColors: Record<string, string> = {
    mystical: "from-blue-900/30 to-purple-900/30",
    dark: "from-gray-900/30 to-red-900/20",
    zen: "from-teal-900/30 to-green-900/20",
    wonder: "from-purple-900/30 to-pink-900/20",
    horror: "from-red-900/30 to-black/30",
    confused: "from-gray-900/30 to-indigo-900/20",
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          🌙 Ritual Dreamlog
        </h1>
        <p className="text-gray-400 text-sm">
          On-chain dream journal powered by Ritual LLM Precompile
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Chain ID: 1979 • Contract: {CONTRACT_ADDRESS.slice(0, 10)}...
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="mb-6">
        {isConnected ? (
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-700">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-300">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button
              onClick={() => disconnect()}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-purple-500/20"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Dream Form */}
      {isConnected && (
        <div className="w-full max-w-md">
          {/* Language Selector */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">
              Bahasa / Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500 transition-colors"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dream Input */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">
              Ceritakan Mimpimu
            </label>
            <textarea
              value={dreamText}
              onChange={(e) => setDreamText(e.target.value)}
              placeholder="Aku bermimpi terbang di atas kota yang gelap..."
              rows={4}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!dreamText.trim() || status === "submitting" || status === "interpreting"}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white py-3 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-purple-500/20 disabled:shadow-none"
          >
            {status === "idle" && "🌙 Interpret & Save On-Chain"}
            {status === "submitting" && "⏳ Submitting..."}
            {status === "interpreting" && "🤖 AI Interpreting on-chain..."}
            {status === "done" && "✅ Dream Saved!"}
            {status === "error" && "❌ Error — Try Again"}
          </button>

          {/* Status Messages */}
          {txHash && (
            <div className="mt-4 text-center">
              <a
                href={`https://explorer.ritualfoundation.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                View on Explorer →
              </a>
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
              <p className="text-xs text-red-400">{errorMessage}</p>
            </div>
          )}

          {status === "done" && (
            <div className="mt-6 p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-800/30 rounded-xl">
              <p className="text-center text-sm text-gray-300 mb-2">
                ✨ Dream interpreted and saved on-chain!
              </p>
              <p className="text-center text-xs text-gray-500">
                Refresh the explorer to see your dream data
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-xs text-gray-600">
          Powered by Ritual Chain • LLM Precompile 0x0802
        </p>
      </div>
    </main>
  );
}
