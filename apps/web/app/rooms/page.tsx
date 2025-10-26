"use client"

import { useRouter } from "next/navigation";

export default function Rooms() {
    const rooms = [
      {
        id: 1,
        name: "Design Studio",
        subtitle: "Ideate & iterate on UX",
        description: "Brainstorming new features, synthesizing team input into design briefs, generating Figma-ready component specs."
      },
      {
        id: 2,
        name: "Eng Lab",
        subtitle: "Build, debug & deploy faster",
        description: "Provides technical insight, code reviews, and architecture recommendations aligned with your org's tech stack and deployment flow."
      },
      {
        id: 3,
        name: "Market Desk",
        subtitle: "Track trends & competitors",
        description: "Analyzes industry signals, competitor activity, and customer feedback to generate concise market intelligence summaries."
      },
      {
        id: 4,
        name: "Growth",
        subtitle: "Optimize performance",
        description: "Crafts campaign ideas, models growth experiments, and surfaces data-driven insights to accelerate acquisition and retention."
      },
      {
        id: 5,
        name: "People Ops",
        subtitle: "Streamline team workflows",
        description: "Centralizes onboarding, policy Q&A, and team recognition initiatives to support culture and people operations."
      },
      {
        id: 6,
        name: "Finance",
        subtitle: "Budgeting & forecasting",
        description: "Builds quick financial breakdowns, runs what-if scenarios, and ensures transparent burn and revenue visibility."
      }
    ];

    const router = useRouter();
  
    return (
      <div style={{ padding: "60px 40px", maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", fontSize: "48px", marginBottom: "60px", fontWeight: 400 }}>
          rooms
        </h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
          {rooms.map((room) => (
            <button
              key={room.name}
              style={{
                border: "1px solid #333",
                padding: "32px",
                borderRadius: "0",
                minHeight: "200px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                cursor: 'pointer'
              }}
              onClick={() => router.push(`/rooms/${room.id}`)}
            >
              <h2 style={{ fontSize: "24px", fontWeight: 600, margin: 0 }}>
                {room.name}
              </h2>
              <p style={{ fontSize: "14px", margin: 0, opacity: 0.8 }}>
                {room.subtitle}
              </p>
              <p style={{ fontSize: "14px", lineHeight: "1.6", margin: 0, marginTop: "8px" }}>
                {room.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }