"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import { useParams, useRouter } from "next/navigation";
import CollaborativeEditor from "../../components/CollaborativeEditor";
import { Input } from "@/components/ui/input";
import { useUserIdentity } from "@/app/hooks/useUserIdentity";
import AuthWrapper from "@/app/wrap/AuthWrapper";
import { cn } from "@/lib/utils";
import { Squircle } from "@squircle-js/react";
import {
  ArrowUp,
  User,
  Rocket,
  Star,
  Zap,
  Coffee,
  Heart,
  Crown,
  Sparkles,
  Flame,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { useRoomById, useUpdateRoomName } from "@/queries/room";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Utility functions for consistent user colors and icons
const COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

const ICONS: LucideIcon[] = [
  User,
  Rocket,
  Star,
  Zap,
  Coffee,
  Heart,
  Crown,
  Sparkles,
  Flame,
  Bot,
];

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const getUserColor = (userId: string): string => {
  return COLORS[hashString(userId) % COLORS.length];
};

const getUserIcon = (userId: string): LucideIcon => {
  return ICONS[hashString(userId + "icon") % ICONS.length];
};

export default function RoomDetail() {
  const { userId } = useUserIdentity();
  const [isThinking, setIsThinking] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();

  const params = useParams();
  const docId = typeof params.id === "string" ? params.id : "";

  const { data, isLoading } = useRoomById(docId);
  const updateRoomNameMutation = useUpdateRoomName(docId);

  const { socket, socketConnected, socketMessages, sendChatMessage } =
    useRoomSocket({
      documentId: docId,
      userId,
      autoConnect: true,
    });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [roomNameInput, setRoomNameInput] = useState<string>("");
  const [initialYjsState, setInitialYjsState] = useState<{
    update: number[];
  } | null>(null);

  // Sync room name input with fetched data
  useEffect(() => {
    if (data?.room.name) {
      setRoomNameInput(data.room.name);
    }
  }, [data?.room.name]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    console.log(socketMessages);
  }, [socketMessages]);

  useEffect(() => {
    const rehydrateChat = async () => {
      if (!docId || !userId) return;

      try {
        const response = await fetch(
          `http://localhost:3001/room/rehydrate/${docId}/${userId}`
        );

        if (!response.ok) {
          console.error("Failed to rehydrate chat");
          return;
        }

        const data = await response.json();

        if (data.yjs_state) {
          setInitialYjsState(data.yjs_state);
        }

        if (data.message_log && Array.isArray(data.message_log)) {
          const rehydratedMessages = data.message_log.map((msg: any) => ({
            role: msg.user_id === "ai" ? "assistant" : "user",
            content: msg.message,
            username: msg.user_id,
          }));

          setMessages(rehydratedMessages.reverse());
        }
      } catch (error) {
        console.error("Error rehydrating chat:", error);
      }
    };

    rehydrateChat();
  }, [docId, userId]);

  useEffect(() => {
    socketMessages.forEach((msg) => {
      const msgId = `${msg.type}-${msg.timestamp}`;

      if (processedMessageIds.has(msgId)) {
        return;
      }

      if (msg.type === "room_state" && msg.data?.connected_users) {
        setConnectedUsers(
          msg.data.connected_users.map((user: any) => ({
            userId: user.user_id,
            name: user.user_id,
            color: getUserColor(user.user_id),
          }))
        );
      } else if (msg.type === "user_join" && msg.data) {
        setConnectedUsers((prev) => {
          const exists = prev.some((u) => u.userId === msg.data.user_id);
          if (!exists) {
            return [
              ...prev,
              {
                userId: msg.data.user_id,
                name: msg.data.user_id,
                color: getUserColor(msg.data.user_id),
              },
            ];
          }
          return prev;
        });
      } else if (msg.type === "user_left" && msg.data) {
        setConnectedUsers((prev) =>
          prev.filter((u) => u.userId !== msg.data.user_id)
        );
      } else if (msg.type === "chat" && msg.data) {
        console.log(msg);
        if (msg.data.username !== userId) {
          setMessages((prev) => [
            ...prev,
            {
              role: msg.data.role,
              content: msg.data.content,
              username: msg.data.username,
            },
          ]);
        }
      } else if (msg.type === "chunk" && msg.data) {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "ai" && lastMsg.username === "ai") {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + msg.data.data },
            ];
          } else {
            return [
              ...prev,
              {
                role: "ai",
                content: msg.data.data,
                username: "ai",
              },
            ];
          }
        });
      } else if (msg.type === "user_left" && msg.data) {
        setConnectedUsers((prev) =>
          prev.filter((u) => u.userId !== msg.data.user_id)
        );
      }

      setProcessedMessageIds((prev) => new Set(prev).add(msgId));
    });
  }, [socketMessages, userId, processedMessageIds]);

  const handleSend = (
    requestCompletion = false,
    position?: { range: { head: number; anchor: number } }
  ) => {
    if (!input.trim()) return;

    const newMessage = {
      role: "user",
      content: input,
      username: userId,
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsThinking(true);

    const payload = {
      doc_id: docId,
      user_id: userId,
      request_completion: requestCompletion,
      message: input,
      ...(position && { position }),
    };

    sendChatMessage(payload); // Uses hook’s method internally

    setInput("");
    console.log("handleSend(): chat message emitted", payload);
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
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <div className="flex flex-col flex-1 border-r border-gray-200 bg-white">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4 shrink-0 bg-white">
            <button
              onClick={() => router.push("/rooms")}
              className="px-5 py-2 border border-gray-800 rounded-full bg-transparent text-[var(--foreground)] text-sm cursor-pointer hover:bg-gray-900/20 transition"
            >
              ← exit room
            </button>

            {!socketConnected && (
              <div className="ml-auto text-xs opacity-60">🔴 Disconnected</div>
            )}
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
                      "flex flex-col w-full",
                      msg.username === userId ? "items-end" : "items-start"
                    )}
                  >
                    {msg.username && userId !== msg.username && (
                      <div className="text-xs mb-1 opacity-60">
                        {msg.username}
                      </div>
                    )}
                    <Squircle
                      cornerRadius={16}
                      cornerSmoothing={1}
                      className={`px-4 py-2 inline-block max-w-[85%] lg:max-w-[75%] ${
                        userId === msg.username
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
            <div className="absolute bottom-0 w-full shrink-0 bg-linear-to-t from-white via-white to-white/0 z-0">
              <div className="flex flex-row gap-2 items-center mx-8 mb-8">
                <Input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend(true)}
                  placeholder="Type your message here"
                  className="flex-1 h-12 bg-white/90 backdrop-blur border border-gray-300 rounded-2xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => handleSend()}>
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
        </div>

        {/* ===== Right: Editor Panel ===== */}
        <div className="flex-1 max-w-[600px] mx-auto overflow-y-auto bg-white">
          <div className="px-12 py-12">
            {/* Connected Users - Floating Top Right */}
            <div className="flex gap-2 mb-8">
              {connectedUsers.length > 0 && (
                <TooltipProvider>
                  {connectedUsers.map((user) => {
                    const IconComponent = getUserIcon(user.userId);
                    const color = getUserColor(user.userId);

                    return (
                      <Tooltip key={user.userId}>
                        <TooltipTrigger asChild>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-sm"
                            style={{ backgroundColor: color }}
                          >
                            <IconComponent size={16} className="text-white" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{user.userId}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              )}
            </div>

            {/* Document Title */}
            {isLoading ? (
              <div className="h-12 w-64 animate-pulse bg-gray-100 rounded-lg mb-2" />
            ) : (
              <input
                type="text"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                onBlur={() => {
                  const trimmedName = roomNameInput.trim();
                  if (trimmedName && trimmedName !== data?.room.name) {
                    updateRoomNameMutation.mutate(trimmedName);
                  } else if (!trimmedName && data?.room.name) {
                    setRoomNameInput(data.room.name);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    setRoomNameInput(data?.room.name || "");
                    e.currentTarget.blur();
                  }
                }}
                className="text-5xl font-bold mb-4 bg-transparent border-none outline-none focus:outline-none w-full placeholder:text-gray-300"
                placeholder="Untitled"
              />
            )}

            {/* Document Body */}
            <div className="min-h-[600px]">
              {initialYjsState !== null && (
                <CollaborativeEditor
                  documentId={docId}
                  userId={userId}
                  socket={socket}
                  socketConnected={socketConnected}
                  initialYjsState={initialYjsState}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
