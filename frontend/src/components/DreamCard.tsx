"use client";

import MoodBackground from "./MoodBackground";

interface DreamCardProps {
  dreamId: number;
  dreamText: string;
  symbols: string[];
  emotion: string;
  archetype: string;
  interpretation: string;
  mood: string;
  language: string;
  timestamp: number;
  txHash?: string;
}

const languageFlags: Record<string, string> = {
  id: "🇮🇩",
  en: "🇬🇧",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ar: "🇸🇦",
  es: "🇪🇸",
  pt: "🇧🇷",
  zh: "🇨🇳",
};

const moodLabels: Record<string, string> = {
  mystical: "🌊 Mystical · Deep",
  dark: "⚡ Dark · Intense",
  zen: "🌿 Zen · Calm",
  wonder: "✨ Wonder · Euphoric",
  horror: "🩸 Horror · Dread",
  confused: "🌀 Confused · Lost",
};

const symbolEmojis: Record<string, string> = {
  water: "🌊",
  darkness: "🌑",
  city: "🏙️",
  forest: "🌲",
  fire: "🔥",
  sky: "☁️",
  earth: "🌍",
  light: "💡",
  shadow: "👤",
  door: "🚪",
  mirror: "🪞",
  animal: "🐾",
  blood: "🩸",
  death: "💀",
  flying: "🕊️",
  falling: "⬇️",
  chase: "🏃",
  ocean: "🌊",
  mountain: "⛰️",
  house: "🏠",
  road: "🛤️",
  bridge: "🌉",
  key: "🔑",
  book: "📖",
  star: "⭐",
  moon: "🌙",
  sun: "☀️",
  rain: "🌧️",
  storm: "⛈️",
  snow: "❄️",
};

export default function DreamCard({
  dreamId,
  dreamText,
  symbols,
  emotion,
  archetype,
  interpretation,
  mood,
  language,
  timestamp,
  txHash,
}: DreamCardProps) {
  const date = new Date(timestamp * 1000);
  const dateStr = date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <MoodBackground mood={mood}>
      <div className="p-8 text-white">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">🌙</span>
            <span className="text-xs tracking-[3px] uppercase opacity-60 font-light">
              Ritual Dreamlog
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs opacity-40 font-light tracking-wider">
              Dream #{String(dreamId).padStart(4, "0")}
            </span>
            <span className="block text-[9px] opacity-50 mt-0.5">
              {dateStr} · {timeStr}
            </span>
          </div>
        </div>

        {/* Original Dream Text */}
        <div className="relative mb-2">
          <div className="border-l-2 border-white/15 pl-4">
            <p className="text-sm leading-relaxed font-light italic opacity-90">
              &ldquo;{dreamText}&rdquo;
            </p>
          </div>
          <span className="absolute top-0 right-0 text-[9px] px-2 py-0.5 rounded-full bg-white/8 text-white/40 tracking-wider not-italic font-normal">
            {languageFlags[language] || "🌐"} {language.toUpperCase()}
          </span>
        </div>

        {/* Divider */}
        <div className="text-center my-4 opacity-30 text-[10px] tracking-[8px]">
          · · · · ·
        </div>

        {/* Symbols */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {symbols.map((symbol, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full text-[11px] tracking-wide bg-white/10 border border-white/10 backdrop-blur-sm"
            >
              {symbolEmojis[symbol.toLowerCase()] || "🔮"} {symbol}
            </span>
          ))}
        </div>

        {/* Emotion */}
        <div className="text-xs opacity-75 mb-3 flex items-center gap-2">
          <span className="opacity-50 text-[10px] tracking-wider uppercase">
            Emotion
          </span>
          <span>{emotion}</span>
        </div>

        {/* Mood Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase bg-white/10 text-white/80 border border-white/15 mb-4">
          {moodLabels[mood] || mood}
        </div>

        {/* Archetype */}
        <div className="text-xl tracking-[3px] mb-3 font-light opacity-90">
          🏛️ {archetype}
        </div>

        {/* Interpretation Box */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
          <div className="text-[9px] tracking-wider uppercase opacity-40 mb-2 flex items-center gap-2">
            🔮 AI Interpretation
          </div>
          <p className="text-xs leading-relaxed font-light opacity-85">
            {interpretation}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center opacity-30 text-[9px] tracking-wider pt-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span>Ritual Chain · Verified</span>
          </div>
          {txHash && (
            <a
              href={`https://explorer.ritualfoundation.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-purple-400 transition-colors"
            >
              TX: {txHash.slice(0, 8)}...{txHash.slice(-6)}
            </a>
          )}
        </div>
      </div>
    </MoodBackground>
  );
}
