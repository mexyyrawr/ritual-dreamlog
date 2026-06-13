"use client";

import DreamCard from "@/components/DreamCard";

const demoDreams = [
  {
    dreamId: 1,
    dreamText:
      "Aku jalan di hutan gelap yang nggak ada ujungnya. Terus ketemu sungai besar, airnya jernih banget tapi ada kota cahaya di bawah permukaan. Aku mau nyebur tapi takut...",
    symbols: ["Water", "Darkness", "City", "Forest"],
    emotion: "Curiosity · Fear · Longing",
    archetype: "THE SEEKER",
    interpretation:
      "You're in a phase of deep inner exploration. The endless dark forest represents the unknown territory of your subconscious. The river — clear yet hiding a luminous city beneath — symbolizes a truth you can almost see but aren't ready to confront. Your hesitation to dive in isn't weakness; it's respect for the depth of what you might find.",
    mood: "mystical",
    language: "id",
    timestamp: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    dreamId: 2,
    dreamText:
      "暗い廊下を歩いていると、壁が迫ってくる。どこからともなく囁き声が聞こえる。振り返ると、自分の影が別の形に変わっていた...",
    symbols: ["Corridor", "Shadow", "Whispers", "Transformation"],
    emotion: "Dread · Trapped · Confrontation",
    archetype: "THE PRISONER",
    interpretation:
      "The closing walls represent mounting pressure — from work, relationships, or expectations you've absorbed. The whispers are your own suppressed thoughts trying to reach you. Your shadow changing shape: you're becoming someone different, and that transformation frightens you.",
    mood: "dark",
    language: "ja",
    timestamp: Math.floor(Date.now() / 1000) - 7200,
  },
  {
    dreamId: 3,
    dreamText:
      "Aku duduk di tepi danau yang sangat tenang. Airnya seperti cermin. Tiba-tiba muncul bola-bola cahaya melayang pelan di atas permukaan air. Aku merasa sangat damai...",
    symbols: ["Lake", "Mirror", "Light", "Calm"],
    emotion: "Peace · Serenity · Wonder",
    archetype: "THE MEDITATOR",
    interpretation:
      "The mirror-like lake reflects your current state of mind — clarity and inner peace. The floating orbs of light represent moments of insight that come naturally when you stop searching. This dream is a confirmation: you're exactly where you need to be.",
    mood: "zen",
    language: "id",
    timestamp: Math.floor(Date.now() / 1000) - 10800,
  },
  {
    dreamId: 4,
    dreamText:
      "I was flying over a city made of light. Every building was transparent and I could see people inside living their lives. I felt free, euphoric, like nothing could stop me...",
    symbols: ["Flying", "City", "Light", "Freedom"],
    emotion: "Euphoria · Freedom · Joy",
    archetype: "THE LIBERATOR",
    interpretation:
      "This dream captures a moment of transcendence. The city of transparent buildings suggests you're seeing through illusions — people's true natures are visible to you. Your ability to fly represents a breakthrough in self-belief. Hold onto this feeling.",
    mood: "wonder",
    language: "en",
    timestamp: Math.floor(Date.now() / 1000) - 14400,
  },
  {
    dreamId: 5,
    dreamText:
      "Aku dikejar sesuatu di lorong gelap. Makin lari makin sempit. Tiba-tiba ada mata-mata merah yang mengintip dari kegelapan. Aku terbangun dengan jantung berdebar...",
    symbols: ["Chase", "Corridor", "Eyes", "Darkness"],
    emotion: "Terror · Panic · Helplessness",
    archetype: "THE HUNTED",
    interpretation:
      "The chase represents something you're avoiding in waking life — a conversation, a decision, a truth. The narrowing corridor suggests the situation is closing in. The red eyes are your own conscience watching. This dream is urgent: stop running, turn around.",
    mood: "horror",
    language: "id",
    timestamp: Math.floor(Date.now() / 1000) - 18000,
  },
  {
    dreamId: 6,
    dreamText:
      "Eu estava em um lugar que mudava a cada passo. Uma escada levava a lugar nenhum. Pessoas usavam máscaras e eu não conseguia entender o que diziam...",
    symbols: ["Stairs", "Masks", "Shifting", "Confusion"],
    emotion: "Disorientation · Alienation · Confusion",
    archetype: "THE WANDERER",
    interpretation:
      "The shifting environment reflects your current uncertainty about direction. The stairs to nowhere represent efforts that feel pointless. The masked people are aspects of yourself you haven't integrated yet. This dream asks: what are you hiding from yourself?",
    mood: "confused",
    language: "pt",
    timestamp: Math.floor(Date.now() / 1000) - 21600,
  },
];

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#08080d] py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          🌙 Dream Gallery
        </h1>
        <p className="text-gray-400 text-sm">
          6 mood themes — every dream gets a unique atmosphere
        </p>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-[960px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {demoDreams.map((dream) => (
          <div key={dream.dreamId} className="flex flex-col items-center">
            <DreamCard {...dream} />
            <span className="mt-2 text-[10px] text-gray-600 uppercase tracking-wider">
              {dream.mood} theme
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center mt-12">
        <a
          href="/"
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          ← Back to Dreamlog
        </a>
      </div>
    </main>
  );
}
