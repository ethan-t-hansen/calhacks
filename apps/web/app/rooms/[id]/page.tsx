"use client";
import { useState, useEffect, useRef } from "react";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import { useParams, useRouter } from "next/navigation";
import CollaborativeEditor from "../../components/CollaborativeEditor";
import { Input } from "@/components/ui/input";
import { useUserIdentity } from "@/app/hooks/useUserIdentity";
import AuthWrapper from "@/app/wrap/AuthWrapper";
import { cn } from "@/lib/utils";
import { Squircle } from "@squircle-js/react";
import { ArrowUp } from "lucide-react";

interface ConnectedUser {
  userId: string;
  name: string;
  color: string;
}

interface Message {
  role: string;
  content: string;
  username: string;
}

export default function RoomDetail() {
  const { userId, userName, userColor } = useUserIdentity();
  const [isThinking, setIsThinking] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();

  const params = useParams();
  const docId = typeof params.id === "string" ? params.id : "";

  const { socket, socketConnected, socketMessages, sendMessage } =
    useRoomSocket({
      documentId: docId,
      userId,
      userName,
      userColor,
      autoConnect: true,
    });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeSubroom, setActiveSubroom] = useState("A");
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    socketMessages.forEach((msg) => {
      const msgId = `${msg.type}-${msg.timestamp}`;

      if (processedMessageIds.has(msgId)) {
        return;
      }

      if (msg.type === "user-joined" && msg.data) {
        setConnectedUsers((prev) => {
          const exists = prev.some((u) => u.userId === msg.data.userId);
          if (!exists) {
            return [
              ...prev,
              {
                userId: msg.data.userId,
                name: msg.data.userInfo?.name || msg.data.name,
                color: msg.data.userInfo?.color || msg.data.color,
              },
            ];
          }
          return prev;
        });
      } else if (msg.type === "user-left" && msg.data) {
        setConnectedUsers((prev) =>
          prev.filter((u) => u.userId !== msg.data.userId)
        );
      } else if (msg.type === "ai-message" && msg.data?.content) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: msg.data.content,
            username: "chat.ai",
          },
        ]);
      } else if (msg.type === "message" && msg.data?.content) {
        if (msg.data.userId !== userId) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: msg.data.content,
              username: msg.data.userName || "Unknown",
            },
          ]);
        }
      }

      setProcessedMessageIds((prev) => new Set(prev).add(msgId));
    });
  }, [socketMessages, userId, processedMessageIds]);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage = {
      role: "user",
      content: input,
      username: userName,
    };

    setMessages([...messages, newMessage]);

    setIsThinking(true);

    setTimeout(() => {
      const aiResponse = {
        role: "ai",
        content: "This is some AI generated stuff",
        username: "Isaac Liu",
      };
      setMessages((currMessages) => [...currMessages, aiResponse]);
      setIsThinking(false);
    }, 3000);

    if (socketConnected) {
      sendMessage({
        type: "chat_message",
        documentId: docId,
        content: input,
        userId,
        userName,
        timestamp: new Date().toISOString(),
      });
      console.log("message sent!");
    }

    setInput("");
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    if (isNearBottom) scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const roomData = {
    id: params.id,
    name: "Design Studio",
    subtitle: "Brief",
    brief: `...`,
  };

  return (
    <AuthWrapper>
      <div className="flex h-screen overflow-hidden">
        <div className="flex flex-col flex-1 border-r">
          {/* Header */}
          <div className="flex items-center gap-3 border-b px-5 py-4 shrink-0">
            <button
              onClick={() => router.push("/rooms")}
              className="px-5 py-2 border border-gray-800 rounded-full bg-transparent text-[var(--foreground)] text-sm cursor-pointer hover:bg-gray-900/20 transition"
            >
              ← exit room
            </button>

            <div className="ml-auto text-xs opacity-60">
              {socketConnected ? "🟢 Connected" : "🔴 Disconnected"}
            </div>
          </div>

          {/* Chat pane: make this fill remaining height */}
          <div className="relative h-full flex flex-col flex-1 overflow-hidden">
            {/* Scrollable message list */}
            <div
              className="flex-1 overflow-y-auto flex flex-col gap-4 px-8 pb-24"
              ref={containerRef}
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40 text-center">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-gray-400"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-sm">
                    No messages yet. Start the conversation.
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col w-full border",
                      msg.username !== userName ? "items-start" : "items-end"
                    )}
                  >
                    {msg.username && userName !== msg.username && (
                      <div className="text-xs mb-1 opacity-60">
                        {msg.username}
                      </div>
                    )}
                    <Squircle
                      cornerRadius={16}
                      cornerSmoothing={1}
                      className={`px-4 py-2 inline-block max-w-[60%] ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white ml-auto"
                          : "bg-stone-300 text-black"
                      }`}
                    >
                      {msg.content}
                    </Squircle>
                  </div>
                ))
              )}

              <div ref={scrollRef} />
            </div>

            {/* Input */}
            <div className="absolute bottom-8 left-8 w-[calc(100%-4rem)] flex flex-row gap-2 items-center shrink-0">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type your message here"
                className="flex-1 h-12 bg-white/90 backdrop-blur border border-gray-300 rounded-2xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSend}>
                <Squircle
                  cornerRadius={16}
                  cornerSmoothing={1}
                  className="w-12 h-12 rounded-md bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition text-white"
                >
                  <ArrowUp size={16} />
                </Squircle>
              </button>
            </div>
          </div>
        </div>

        {/* ===== Right: Editor Panel ===== */}
        <div className="w-[420px] p-8 bg-[var(--background)] overflow-y-auto">
          {/* Connected Users */}
          <div className="flex gap-2 mb-6">
            {connectedUsers.length > 0 ? (
              connectedUsers.map((user) => (
                <div
                  key={user.userId}
                  title={user.name}
                  style={{ background: user.color }}
                  className="w-8 h-8 rounded-full cursor-pointer"
                />
              ))
            ) : (
              <div className="text-sm opacity-40">No users connected</div>
            )}
          </div>

          <div className="text-xs opacity-60 mb-1">
            {roomData.name} / {roomData.subtitle}
          </div>

          <h1 className="text-3xl font-semibold mb-6">
            {roomData.name} {roomData.subtitle}
          </h1>

          <div className="flex-1 min-h-0">
            <CollaborativeEditor
              documentId={docId}
              userId={userId}
              userName={userName}
              userColor={userColor}
              socket={socket}
              socketConnected={socketConnected}
            />
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
