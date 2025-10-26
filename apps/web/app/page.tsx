"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export default function Home() {
  const [documentId, setDocumentId] = useState("test-doc-1");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userColor, setUserColor] = useState("#3b82f6");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiType, setAiType] = useState<"suggestion" | "chat">("suggestion");
  const [aiVisibility, setAiVisibility] = useState<"private" | "shared">(
    "shared"
  );

  const socketRef = useRef<Socket | null>(null);

  // Socket.IO connection
  const connectSocket = () => {
    if (!userId || !userName || !userColor) {
      alert("Please fill in User ID, Name, and Color first");
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      setSocketMessages((prev) => [
        ...prev,
        { type: "connection", message: "Connected to Socket.IO" },
      ]);

      // Join room after connection
      socket.emit("join-room", {
        documentId,
        userId,
        name: userName,
        color: userColor,
      });
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setSocketMessages((prev) => [
        ...prev,
        { type: "connection", message: "Disconnected from Socket.IO" },
      ]);
    });

    socket.on("user-joined", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "user-joined", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("user-left", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "user-left", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("message", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "message", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("ai-message", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "ai-message", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("yjs-update", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        { type: "yjs-update", data, timestamp: new Date().toISOString() },
      ]);
    });

    socket.on("suggestion-resolution", (data: any) => {
      setSocketMessages((prev) => [
        ...prev,
        {
          type: "suggestion-resolution",
          data,
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    socket.on("error", (error: any) => {
      setSocketMessages((prev) => [
        ...prev,
        {
          type: "error",
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      ]);
    });
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const joinRoom = async () => {
    if (!userId || !userName) {
      alert("Please fill in User ID and Name");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/rooms/${documentId}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: "Failed to connect to API" });
    } finally {
      setLoading(false);
    }
  };

  const getRoomStats = async () => {
    try {
      const response = await fetch("http://localhost:3001/rooms");
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: "Failed to get room stats" });
    }
  };

  const sendAIGeneration = async () => {
    if (!aiPrompt || !documentId || !userId) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const endpoint = aiType === "suggestion" ? "/ai/suggest" : "/ai/chat";
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          userId,
          prompt: aiPrompt,
          visibility: aiType === "chat" ? aiVisibility : undefined,
          context: {
            selectedText: "Sample selected text",
            cursorPosition: 100,
            range: { anchor: 90, head: 110 },
          },
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: "Failed to start AI generation" });
    }
  };

  const sendStreamingAIGeneration = async () => {
    if (!aiPrompt || !documentId || !userId) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const endpoint =
        aiType === "suggestion" ? "/ai/suggest/stream" : "/ai/chat/stream";
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          userId,
          prompt: aiPrompt,
          visibility: aiType === "chat" ? aiVisibility : undefined,
          context: {
            selectedText: "Sample selected text",
            cursorPosition: 100,
            range: { anchor: 90, head: 110 },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      let fullContent = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullContent += chunk;

        // Update result with streaming content
        setResult({
          type: "streaming",
          content: fullContent,
          endpoint: endpoint,
          timestamp: new Date().toISOString(),
        });
      }

      // Final result
      setResult({
        type: "streaming_complete",
        content: fullContent,
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setResult({
        error: "Failed to stream AI generation",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const sendSocketMessage = () => {
    if (!socketRef.current || !socketRef.current.connected) {
      alert("Socket not connected");
      return;
    }

    const message = {
      type: "test_message",
      content: "Hello from client!",
      timestamp: new Date().toISOString(),
    };

    socketRef.current.emit("message", message);
  };

  const sendYjsUpdate = () => {
    if (!socketRef.current || !socketRef.current.connected) {
      alert("Socket not connected");
      return;
    }

    const update = new Uint8Array([1, 2, 3, 4, 5]); // Sample Yjs update
    socketRef.current.emit("yjs-update", {
      documentId,
      userId,
      update,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 flex justify-center">
      <main className="w-full max-w-5xl bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-800 mb-8">
          Collaborative Document Editor - Socket.IO Test
        </h1>

        {/* ===== Room Management ===== */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Room Management</h2>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium">
              Document ID:
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="ml-2 p-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium">
              User ID:
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user-123"
                className="ml-2 p-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium">
              Name:
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="John Doe"
                className="ml-2 p-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium">
              Color:
              <input
                type="color"
                value={userColor}
                onChange={(e) => setUserColor(e.target.value)}
                className="ml-2 cursor-pointer"
              />
            </label>
          </div>

          <div className="flex gap-4 mb-4">
            <button
              onClick={joinRoom}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Get Room Info"}
            </button>
            <button
              onClick={getRoomStats}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Get Room Stats
            </button>
          </div>
        </div>

        {/* ===== Socket.IO Connection ===== */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Socket.IO Connection</h2>

          <div className="flex gap-4 mb-4">
            <button
              onClick={connectSocket}
              disabled={socketConnected}
              className={`px-4 py-2 rounded text-white font-medium ${
                socketConnected
                  ? "bg-green-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {socketConnected ? "Connected" : "Connect Socket.IO"}
            </button>
            <button
              onClick={disconnectSocket}
              disabled={!socketConnected}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              Disconnect
            </button>
            <button
              onClick={sendSocketMessage}
              disabled={!socketConnected}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              Send Test Message
            </button>
            <button
              onClick={sendYjsUpdate}
              disabled={!socketConnected}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              Send Yjs Update
            </button>
          </div>

          <div
            className={`text-sm font-medium ${
              socketConnected ? "text-green-600" : "text-red-500"
            }`}
          >
            Status: {socketConnected ? "Connected" : "Disconnected"}
          </div>
        </div>

        {/* ===== AI Generation ===== */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">AI Generation</h2>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium">
              AI Type:
              <select
                value={aiType}
                onChange={(e) =>
                  setAiType(e.target.value as "suggestion" | "chat")
                }
                className="ml-2 p-1 border border-gray-300 rounded"
              >
                <option value="suggestion">Suggestion</option>
                <option value="chat">Chat</option>
              </select>
            </label>
          </div>

          {aiType === "chat" && (
            <div className="mb-4">
              <label className="block text-gray-700 font-medium">
                Visibility:
                <select
                  value={aiVisibility}
                  onChange={(e) =>
                    setAiVisibility(e.target.value as "private" | "shared")
                  }
                  className="ml-2 p-1 border border-gray-300 rounded"
                >
                  <option value="shared">Shared (All Users)</option>
                  <option value="private">Private (Only You)</option>
                </select>
              </label>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-700 font-medium">
              Prompt:
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="mt-2 ml-2 p-2 w-full min-h-[80px] border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="flex gap-4">
            <button
              onClick={sendAIGeneration}
              disabled={!aiPrompt}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Generate {aiType === "suggestion" ? "Suggestion" : "Chat"}{" "}
              (Socket.IO)
            </button>
            <button
              onClick={sendStreamingAIGeneration}
              disabled={!aiPrompt}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Stream {aiType === "suggestion" ? "Suggestion" : "Chat"} (HTTP)
            </button>
          </div>
        </div>

        {/* ===== Socket Messages ===== */}
        {socketMessages.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-2">
              Socket Messages ({socketMessages.length})
            </h3>
            <div className="bg-gray-100 p-4 rounded max-h-[300px] overflow-auto text-sm">
              {socketMessages.map((msg, index) => (
                <div key={index} className="mb-2">
                  <strong>[{msg.timestamp}]</strong> {msg.type}:
                  {msg.data ? (
                    <pre className="bg-gray-50 p-2 rounded mt-1 text-xs overflow-auto">
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  ) : (
                    <span> {msg.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== Result Display ===== */}
        {result && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-2">Result:</h3>

            {result.type === "streaming" ||
            result.type === "streaming_complete" ? (
              <div>
                <div className="text-sm text-gray-600 mb-4">
                  {result.type === "streaming"
                    ? "🔄 Streaming..."
                    : "✅ Streaming Complete"}
                  <br />
                  Endpoint: {result.endpoint}
                  <br />
                  Timestamp: {result.timestamp}
                </div>
                <div
                  className={`bg-gray-100 p-4 rounded font-mono whitespace-pre-wrap max-h-[400px] overflow-auto border-2 ${
                    result.type === "streaming"
                      ? "border-blue-500"
                      : "border-green-500"
                  }`}
                >
                  {result.content}
                </div>
              </div>
            ) : (
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[400px] text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* ===== API Endpoints Footer ===== */}
        <div className="mt-8 text-sm text-gray-600">
          <p>API Endpoints (Express + Socket.IO):</p>
          <ul className="list-disc list-inside">
            <li>Socket.IO connection for real-time collaboration</li>
            <li>GET /rooms/:documentId - Get room information</li>
            <li>GET /rooms - Get all room statistics</li>
            <li>POST /ai/suggest - Generate AI suggestions (via Socket.IO)</li>
            <li>
              POST /ai/suggest/stream - Generate AI suggestions (HTTP streaming)
            </li>
            <li>POST /ai/chat - Generate AI chat responses (via Socket.IO)</li>
            <li>
              POST /ai/chat/stream - Generate AI chat responses (HTTP streaming)
            </li>
            <li>POST /diff/accept - Accept a suggestion</li>
            <li>POST /diff/reject - Reject a suggestion</li>
            <li>GET /health - Health check</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
