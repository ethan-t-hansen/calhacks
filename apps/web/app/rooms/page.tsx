"use client";

import { useRouter } from "next/navigation";

export default function Rooms() {
  const rooms = [
    {
      id: 1,
      name: "Design Studio",
      subtitle: "Ideate & iterate on UX",
      description:
        "Brainstorming new features, synthesizing team input into design briefs, generating Figma-ready component specs.",
    },
    {
      id: 2,
      name: "Eng Lab",
      subtitle: "Build, debug & deploy faster",
      description:
        "Provides technical insight, code reviews, and architecture recommendations aligned with your org's tech stack and deployment flow.",
    },
    {
      id: 3,
      name: "Market Desk",
      subtitle: "Track trends & competitors",
      description:
        "Analyzes industry signals, competitor activity, and customer feedback to generate concise market intelligence summaries.",
    },
    {
      id: 4,
      name: "Growth",
      subtitle: "Optimize performance",
      description:
        "Crafts campaign ideas, models growth experiments, and surfaces data-driven insights to accelerate acquisition and retention.",
    },
    {
      id: 5,
      name: "People Ops",
      subtitle: "Streamline team workflows",
      description:
        "Centralizes onboarding, policy Q&A, and team recognition initiatives to support culture and people operations.",
    },
    {
      id: 6,
      name: "Finance",
      subtitle: "Budgeting & forecasting",
      description:
        "Builds quick financial breakdowns, runs what-if scenarios, and ensures transparent burn and revenue visibility.",
    },
  ];

  const router = useRouter();

  return (
    <div className="px-10 py-16 max-w-[1400px] mx-auto">
      <h1 className="text-center text-5xl font-normal mb-16">rooms</h1>

      <div className="grid grid-cols-3 gap-6">
        {rooms.map((room) => (
          <button
            key={room.name}
            onClick={() => router.push(`/rooms/${room.id}`)}
            className="border border-gray-800 p-8 rounded-none min-h-[200px] flex flex-col gap-3 cursor-pointer hover:bg-gray-50 transition"
          >
            <h2 className="text-2xl font-semibold m-0">{room.name}</h2>
            <p className="text-sm m-0 opacity-80">{room.subtitle}</p>
            <p className="text-sm m-0 mt-2 leading-relaxed">
              {room.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
