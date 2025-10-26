"use client";
import { useState, useEffect } from "react";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import { useParams, useRouter } from "next/navigation";
import CollaborativeEditor from "../../components/CollaborativeEditor";

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
  const [userId] = useState(
    () => `user-${Math.random().toString(36).substr(2, 9)}`
  );
  const [userName] = useState("Anonymous User");
  const [userColor] = useState("#667eea");

  const router = useRouter();

  const params = useParams();
  const docId = typeof params.id === "string" ? params.id : "";

  const { socket, socketConnected, socketMessages, sendMessage } = useRoomSocket({
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

    if (socketConnected) {
      sendMessage({
        type: "chat_message",
        documentId: docId,
        content: input,
        userId,
        userName,
        timestamp: new Date().toISOString(),
      });
    }

    setInput("");
  };

  const roomData = {
    id: params.id,
    name: "Design Studio",
    subtitle: "Brief",
    brief: `...`,
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--background)",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #333",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #333",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <button
            style={{
              padding: "8px 20px",
              border: "1px solid #333",
              borderRadius: "999px",
              background: "transparent",
              color: "var(--foreground)",
              cursor: "pointer",
              fontSize: "14px",
            }}
            onClick={() => router.push("/rooms")}
          >
            ← exit room
          </button>

          <div style={{ marginLeft: "auto", fontSize: "12px", opacity: 0.6 }}>
            {socketConnected ? "🟢 Connected" : "🔴 Disconnected"}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                flexDirection: "column",
                gap: "12px",
                opacity: 0.4,
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ fontSize: "14px" }}>
                No messages yet. Start the conversation.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: "24px" }}>
                {msg.username && (
                  <div
                    style={{
                      fontSize: "12px",
                      marginBottom: "8px",
                      opacity: 0.6,
                    }}
                  >
                    {msg.username}
                  </div>
                )}
                <div
                  style={{
                    padding: "20px 24px",
                    borderRadius: "16px",
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "#1a1a1a",
                    color: "#fff",
                    lineHeight: "1.6",
                    fontSize: "15px",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "20px", borderTop: "1px solid #333" }}>
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              border: "1px solid #333",
              borderRadius: "12px",
              padding: "4px 4px 4px 20px",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your message here"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--foreground)",
                fontSize: "14px",
              }}
            />
            <button
              onClick={handleSend}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: "#667eea",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          width: "420px",
          padding: "32px",
          background: "var(--background)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {connectedUsers.map((user, i) => (
            <div
              key={user.userId}
              title={user.name}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: user.color,
                cursor: "pointer",
              }}
            />
          ))}
          {connectedUsers.length === 0 && (
            <div style={{ fontSize: "14px", opacity: 0.4 }}>
              No users connected
            </div>
          )}
        </div>

        <div style={{ fontSize: "12px", marginBottom: "4px", opacity: 0.6 }}>
          {roomData.name} / {roomData.subtitle}
        </div>

        <h1 style={{ fontSize: "32px", fontWeight: 600, marginBottom: "24px" }}>
          {roomData.name} {roomData.subtitle}
        </h1>

        <div style={{ flex: 1, minHeight: 0 }}>
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
  );
}
