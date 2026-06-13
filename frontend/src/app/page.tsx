"use client";

import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { useState, useEffect } from "react";
import { CONTRACT_ADDRESS, CONTRACT_ABI, ritualChain } from "@/lib/config";

const RITUAL_CHAIN_ID = 1979;

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [dreamText, setDreamText] = useState("");
  const [language, setLanguage] = useState("id");
  const [status, setStatus] = useState<"idle" | "submitting" | "interpreting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Check if on correct network
  useEffect(() => {
    if (isConnected && chain && chain.id !== RITUAL_CHAIN_ID) {
      setIsWrongNetwork(true);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chain]);

  // Auto-switch to Ritual when connected
  useEffect(() => {
    if (isConnected && isWrongNetwork) {
      handleSwitchNetwork();
    }
  }, [isConnected, isWrongNetwork]);

  const handleSwitchNetwork = async () => {
    try {
      // Try to switch chain
      switchChain({ chainId: RITUAL_CHAIN_ID });
    } catch {
      // If chain not added, add it manually via wallet_addEthereumChain
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ethereum = (window as any).ethereum;
        if (ethereum) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${RITUAL_CHAIN_ID.toString(16)}`,
                chainName: "Ritual Testnet",
                nativeCurrency: {
                  name: "RITUAL",
                  symbol: "RITUAL",
                  decimals: 18,
                },
                rpcUrls: ["https://rpc.ritualfoundation.org"],
                blockExplorerUrls: ["https://explorer.ritualfoundation.org"],
              },
            ],
          });
        }
      } catch (addError) {
        console.error("Failed to add Ritual chain:", addError);
      }
    }
  };

  const handleConnect = () => {
    connect({ connector: connectors[0] });
  };

  const handleSubmit = async () => {
    if (!dreamText.trim()) return;
    if (!isConnected) {
      alert("Connect wallet dulu!");
      return;
    }
    if (isWrongNetwork) {
      alert("Switch ke Ritual Testnet dulu!");
      handleSwitchNetwork();
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
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-700">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isWrongNetwork ? "bg-red-400" : "bg-green-400"}`} />
              <span className="text-sm text-gray-300">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${isWrongNetwork ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                {isWrongNetwork ? `Wrong Network (${chain?.name})` : "Ritual Testnet"}
              </span>
              <button
                onClick={() => disconnect()}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            </div>

            {isWrongNetwork && (
              <button
                onClick={handleSwitchNetwork}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              >
                ⚡ Switch to Ritual Testnet
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-purple-500/20"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Wrong Network Banner */}
      {isConnected && isWrongNetwork && (
        <div className="w-full max-w-md mb-4 p-3 bg-orange-900/20 border border-orange-800/30 rounded-lg">
          <p className="text-sm text-orange-400 text-center">
            ⚠️ Kamu di jaringan <strong>{chain?.name}</strong>. Klik tombol di atas untuk pindah ke <strong>Ritual Testnet</strong>.
          </p>
        </div>
      )}

      {/* Dream Form */}
      {isConnected && !isWrongNetwork && (
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
              <p className="text-xs text-red-400 break-all">{errorMessage}</p>
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
