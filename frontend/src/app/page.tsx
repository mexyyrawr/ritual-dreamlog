'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { writeContractAsync } from 'wagmi/actions';
import { injected } from 'wagmi/connectors';
import { encodeAbiParameters, parseAbiParameters, decodeAbiParameters, createPublicClient, http } from 'viem';
import { config, ritualChain, CONTRACT_ADDRESS, CONTRACT_ABI, TEE_EXECUTOR } from '@/lib/config';
import MoodBackground from '@/components/MoodBackground';

const moodNames: Record<number, string> = {
  0: 'Unknown', 1: 'Mystical', 2: 'Dark', 3: 'Zen', 4: 'Wonder', 5: 'Horror', 6: 'Confused'
};

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [dreamText, setDreamText] = useState('');
  const [language, setLanguage] = useState('id');
  const [result, setResult] = useState<string | null>(null);
  const [mood, setMood] = useState(0);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'interpreting' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [needsNetworkSwitch, setNeedsNetworkSwitch] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { data: dreamCountData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'dreamCount',
  });

  const addLog = (msg: string) => {
    setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    if (isConnected && chain) {
      setNeedsNetworkSwitch(chain.id !== 1979);
    }
  }, [isConnected, chain]);

  const switchToRitual = async () => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7BB' }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7BB',
            chainName: 'Ritual Testnet',
            nativeCurrency: { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
            rpcUrls: ['https://rpc.ritualfoundation.org'],
            blockExplorerUrls: ['https://explorer.ritualfoundation.org'],
          }],
        });
      }
    }
  };

  const encodeLLMRequest = (dreamText: string, lang: string) => {
    const systemPrompt = lang === 'id'
      ? 'Kamu adalah interpreter mimpi on-chain. Analisis mimpi dan berikan interpretasi dalam format JSON: {"mood":"mystical|dark|zen|wonder|horror|confused","archetype":"The Seeker|The Shadow|The Guardian|The Trickster|The Healer|The Visionary","interpretation":"...","message":"...","advice":"..."}. Mood harus salah satu dari: mystical, dark, zen, wonder, horror, confused. Reply ONLY with JSON, no markdown.'
      : 'You are an on-chain dream interpreter. Analyze dreams and provide interpretation in JSON format: {"mood":"mystical|dark|zen|wonder|horror|confused","archetype":"The Seeker|The Shadow|The Guardian|The Trickster|The Healer|The Visionary","interpretation":"...","message":"...","advice":"..."}. Mood must be one of: mystical, dark, zen, wonder, horror, confused. Reply ONLY with JSON, no markdown.';

    const messagesJson = JSON.stringify([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Dream: "${dreamText}"` }
    ]);

    const encoded = encodeAbiParameters(
      parseAbiParameters([
        'address, bytes[], uint256, bytes[], bytes,',
        'string, string, int256, string, bool, int256, string, string,',
        'uint256, bool, int256, string, bytes, int256, string, string, bool,',
        'int256, bytes, bytes, int256, int256, string, bool,',
        '(string,string,string)',
      ].join('')),
      [
        TEE_EXECUTOR,
        [], 300n, [], '0x',
        messagesJson,
        'zai-org/GLM-4.7-FP8',
        0n, '', false, 4096n, '', '',
        1n, true, 0n, 'medium', '0x', -1n, 'auto', '',
        false,       // stream
        700n,        // temperature
        '0x', '0x', -1n, 1000n, '',
        false,       // piiEnabled
        ['', '', ''], // convoHistory: no history
      ],
    );

    return encoded;
  };

  const handleSubmit = async () => {
    if (!dreamText.trim()) return;
    if (needsNetworkSwitch) {
      await switchToRitual();
      return;
    }

    setStatus('submitting');
    setError('');
    setResult(null);
    setDebugLogs([]);

    try {
      addLog('Encoding LLM request with viem (30 fields)...');
      const encoded = encodeLLMRequest(dreamText, language);
      addLog(`Encoded ${encoded.length} bytes`);

      addLog('Sending submitAndInterpret (1 TX, 1 popup)...');
      const hash = await writeContractAsync(config, {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'submitAndInterpret',
        args: [dreamText, encoded],
      });

      setTxHash(hash);
      addLog(`TX sent: ${hash}`);

      setStatus('interpreting');
      addLog('Waiting for TX receipt (10-40s for LLM)...');

      const publicClient = createPublicClient({
        chain: ritualChain,
        transport: http(),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120000 });
      addLog(`TX Status: ${receipt.status === 'success' ? 'SUCCESS ✅' : 'FAILED ❌'}`);

      if (receipt.status === 'success') {
        // Check spcCalls for LLM result
        const spcCalls = (receipt as any).spcCalls;
        if (spcCalls && spcCalls.length > 0) {
          addLog(`Found ${spcCalls.length} spcCalls!`);
          for (const call of spcCalls) {
            if (call.output) {
              try {
                const [simmedInput, actualOutput] = decodeAbiParameters(
                  parseAbiParameters('bytes, bytes'),
                  call.output as `0x${string}`
                );
                const [hasError, completionData, , errorMessage] = decodeAbiParameters(
                  parseAbiParameters('bool, bytes, bytes, string'),
                  actualOutput as `0x${string}`
                );
                if (hasError) {
                  addLog(`LLM Error: ${errorMessage}`);
                  setError(errorMessage);
                  setStatus('error');
                } else {
                  const [, , , , , , , choicesData] = decodeAbiParameters(
                    parseAbiParameters('string, string, uint256, string, string, string, uint256, bytes[], bytes'),
                    completionData as `0x${string}`
                  );
                  if (choicesData && choicesData.length > 0) {
                    const [, , messageData] = decodeAbiParameters(
                      parseAbiParameters('uint256, string, bytes'),
                      choicesData[0] as `0x${string}`
                    );
                    const [, content] = decodeAbiParameters(
                      parseAbiParameters('string, string, string, uint256, bytes[]'),
                      messageData as `0x${string}`
                    );
                    addLog(`LLM Result: ${content.substring(0, 100)}...`);
                    setResult(content);
                    setMood(1);
                    setStatus('done');
                  }
                }
              } catch (e) {
                addLog(`Decode error: ${e}`);
              }
            }
          }
        } else {
          // Fallback: read dream from contract
          addLog('No spcCalls, reading dream from contract...');
          const count = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: 'dreamCount',
          });
          const dreamId = Number(count) - 1;
          const dreamData = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: 'dreams',
            args: [BigInt(dreamId)],
          });
          const [, , , moodVal, interpretation] = dreamData as [string, string, bigint, number, string, string];
          if (interpretation && interpretation.length > 0) {
            setResult(interpretation);
            setMood(moodVal);
            setStatus('done');
            addLog(`Result from contract! Mood: ${moodNames[moodVal]}`);
          } else {
            setError('LLM result not found. TX succeeded but no interpretation.');
            setStatus('error');
          }
        }
      } else {
        setError('Transaction failed');
        setStatus('error');
      }
    } catch (e: any) {
      addLog(`Error: ${e.message?.substring(0, 200)}`);
      setError(e.message?.substring(0, 300) || 'Unknown error');
      setStatus('error');
    }
  };

  const currentMood = mood > 0 ? moodNames[mood].toLowerCase() : 'mystical';

  return (
    <main className="relative min-h-screen overflow-hidden">
      <MoodBackground mood={currentMood} />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-xl">🔮</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Ritual Dreamlog</h1>
              <p className="text-xs text-gray-400">On-chain dream interpretation • 1 TX only</p>
            </div>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-3">
              {needsNetworkSwitch && (
                <button onClick={switchToRitual} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30">
                  Switch to Ritual
                </button>
              )}
              <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
              <button onClick={() => disconnect()} className="text-gray-400 hover:text-white text-sm">Disconnect</button>
            </div>
          ) : (
            <button onClick={() => connect({ connector: injected() })} className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:opacity-90">
              Connect Wallet
            </button>
          )}
        </header>

        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>Contract: {CONTRACT_ADDRESS.slice(0, 10)}...</span>
            <span>Dreams: {dreamCountData ? Number(dreamCountData) : '...'}</span>
            <span>Chain: Ritual Testnet (1979)</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            {status === 'done' && result ? (
              <div className="space-y-6">
                <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">✨</span>
                    <h2 className="text-xl font-bold text-white">Dream Interpreted</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-purple-400 uppercase tracking-wider">Mood</span>
                      <p className="text-lg text-white font-medium">{moodNames[mood]}</p>
                    </div>
                    <div>
                      <span className="text-xs text-purple-400 uppercase tracking-wider">Interpretation</span>
                      <p className="text-gray-300 leading-relaxed mt-1 whitespace-pre-wrap">{result}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setStatus('idle'); setResult(null); setDreamText(''); }}
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                >
                  Dream Again
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-4xl font-bold text-white">What did you dream?</h2>
                  <p className="text-gray-400">AI interprets your dream on-chain in 1 transaction</p>
                </div>

                <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-8 space-y-6">
                  <textarea
                    value={dreamText}
                    onChange={(e) => setDreamText(e.target.value)}
                    placeholder="Describe your dream..."
                    className="w-full h-40 bg-transparent text-white text-lg placeholder-gray-500 resize-none focus:outline-none"
                    disabled={status !== 'idle'}
                  />

                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <button onClick={() => setLanguage('id')} className={`px-3 py-1 rounded-lg text-sm ${language === 'id' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-400'}`}>ID</button>
                      <button onClick={() => setLanguage('en')} className={`px-3 py-1 rounded-lg text-sm ${language === 'en' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-400'}`}>EN</button>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!dreamText.trim() || status !== 'idle'}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {status === 'submitting' ? '⏳ Sending...' :
                     status === 'interpreting' ? '🔮 Interpreting on-chain...' :
                     status === 'error' ? '❌ Error — Try Again' :
                     'Submit Dream ✨'}
                  </button>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm break-all">
                    {error}
                  </div>
                )}

                {debugLogs.length > 0 && (
                  <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                    <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Debug Logs</h3>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {debugLogs.map((log, i) => (
                        <p key={i} className="text-xs text-gray-400 font-mono">{log}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="p-6 text-center text-gray-600 text-xs">
          Powered by Ritual Chain • LLM Precompile 0x0802 • zai-org/GLM-4.7-FP8
        </footer>
      </div>
    </main>
  );
}
