// components/TypingIndicator.tsx
"use client";
import React from "react";

export function TypingIndicator({
  avatarColor = "#CBD5E1",
  messageColor = "#E5E7EB",
}: {
  avatarColor?: string;
  messageColor?: string;
}) {
  return (
    <div className="flex items-end gap-2">
      {/* Profile Circle */}
      <div
        className="w-8 h-8 rounded-full shrink-0"
        style={{ backgroundColor: avatarColor }}
      />
      {/* "Typing" bubble */}
      <div
        className="px-4 py-2 rounded-2xl bg-stone-300 flex items-center gap-1"
        style={{ backgroundColor: messageColor }}
      >
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.2s]" />
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.1s]" />
        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
      </div>
    </div>
  );
}