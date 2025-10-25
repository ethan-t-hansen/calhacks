"use client";
import { useState } from "react";

export default function ChatStream() {
  const [chat, setChat] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async () => {
    setChat("");
    setIsStreaming(true);

    try {
      const response = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello! Tell me a story." }],
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsStreaming(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setChat((prev) => prev + parsed.content);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-black">
      <button
        onClick={startStream}
        disabled={isStreaming}
        style={{ marginBottom: 10 }}
      >
        {isStreaming ? "Streaming..." : "Start Chat Stream"}
      </button>
      <div
        style={{
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          border: "1px solid #ccc",
          padding: 10,
          borderRadius: 6,
          minHeight: "200px",
        }}
      >
        {chat}
      </div>
    </div>
  );
}
