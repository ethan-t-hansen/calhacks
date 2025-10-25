"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@repo/ui/button";
import styles from "./page.module.css";
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
    const [aiVisibility, setAiVisibility] = useState<"private" | "shared">("shared");

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
            setSocketMessages((prev) => [...prev, { type: "connection", message: "Connected to Socket.IO" }]);

            // Join room after connection
            socket.emit("join-room", {
                documentId,
                userId,
                name: userName,
                color: userColor
            });
        });

        socket.on("disconnect", () => {
            setSocketConnected(false);
            setSocketMessages((prev) => [...prev, { type: "connection", message: "Disconnected from Socket.IO" }]);
        });

        socket.on("user-joined", (data: any) => {
            setSocketMessages((prev) => [...prev, { type: "user-joined", data, timestamp: new Date().toISOString() }]);
        });

        socket.on("user-left", (data: any) => {
            setSocketMessages((prev) => [...prev, { type: "user-left", data, timestamp: new Date().toISOString() }]);
        });

        socket.on("message", (data: any) => {
            setSocketMessages((prev) => [...prev, { type: "message", data, timestamp: new Date().toISOString() }]);
        });

        socket.on("ai-message", (data: any) => {
            setSocketMessages((prev) => [...prev, { type: "ai-message", data, timestamp: new Date().toISOString() }]);
        });

        socket.on("yjs-update", (data: any) => {
            setSocketMessages((prev) => [...prev, { type: "yjs-update", data, timestamp: new Date().toISOString() }]);
        });

        socket.on("suggestion-resolution", (data: any) => {
            setSocketMessages((prev) => [...prev, { type: "suggestion-resolution", data, timestamp: new Date().toISOString() }]);
        });

        socket.on("error", (error: any) => {
            setSocketMessages((prev) => [...prev, { type: "error", message: error.message, timestamp: new Date().toISOString() }]);
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
            const response = await fetch(`http://localhost:3001/rooms/${documentId}`, {
                method: "GET"
            });

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
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    documentId,
                    userId,
                    prompt: aiPrompt,
                    visibility: aiType === "chat" ? aiVisibility : undefined,
                    context: {
                        selectedText: "Sample selected text",
                        cursorPosition: 100,
                        range: { anchor: 90, head: 110 }
                    }
                })
            });

            const data = await response.json();
            setResult(data);
        } catch (error) {
            setResult({ error: "Failed to start AI generation" });
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
            timestamp: new Date().toISOString()
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
            update
        });
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1>Collaborative Document Editor - Socket.IO Test</h1>

                <div style={{ marginBottom: "2rem" }}>
                    <h2>Room Management</h2>

                    <div style={{ marginBottom: "1rem" }}>
                        <label>
                            Document ID:
                            <input
                                type='text'
                                value={documentId}
                                onChange={(e) => setDocumentId(e.target.value)}
                                style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                        <label>
                            User ID:
                            <input
                                type='text'
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                placeholder='user-123'
                                style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                        <label>
                            Name:
                            <input
                                type='text'
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder='John Doe'
                                style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
                            />
                        </label>
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                        <label>
                            Color:
                            <input
                                type='color'
                                value={userColor}
                                onChange={(e) => setUserColor(e.target.value)}
                                style={{ marginLeft: "0.5rem" }}
                            />
                        </label>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                        <button onClick={joinRoom} disabled={loading} style={{ padding: "0.5rem 1rem", marginRight: "0.5rem" }}>
                            {loading ? "Loading..." : "Get Room Info"}
                        </button>
                        <button onClick={getRoomStats} style={{ padding: "0.5rem 1rem" }}>
                            Get Room Stats
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: "2rem" }}>
                    <h2>Socket.IO Connection</h2>
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                        <button onClick={connectSocket} disabled={socketConnected} style={{ padding: "0.5rem 1rem" }}>
                            {socketConnected ? "Connected" : "Connect Socket.IO"}
                        </button>
                        <button onClick={disconnectSocket} disabled={!socketConnected} style={{ padding: "0.5rem 1rem" }}>
                            Disconnect
                        </button>
                        <button onClick={sendSocketMessage} disabled={!socketConnected} style={{ padding: "0.5rem 1rem" }}>
                            Send Test Message
                        </button>
                        <button onClick={sendYjsUpdate} disabled={!socketConnected} style={{ padding: "0.5rem 1rem" }}>
                            Send Yjs Update
                        </button>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: socketConnected ? "#22c55e" : "#ef4444" }}>
                        Status: {socketConnected ? "Connected" : "Disconnected"}
                    </div>
                </div>

                <div style={{ marginBottom: "2rem" }}>
                    <h2>AI Generation</h2>

                    <div style={{ marginBottom: "1rem" }}>
                        <label>
                            AI Type:
                            <select
                                value={aiType}
                                onChange={(e) => setAiType(e.target.value as "suggestion" | "chat")}
                                style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
                            >
                                <option value='suggestion'>Suggestion</option>
                                <option value='chat'>Chat</option>
                            </select>
                        </label>
                    </div>

                    {aiType === "chat" && (
                        <div style={{ marginBottom: "1rem" }}>
                            <label>
                                Visibility:
                                <select
                                    value={aiVisibility}
                                    onChange={(e) => setAiVisibility(e.target.value as "private" | "shared")}
                                    style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
                                >
                                    <option value='shared'>Shared (All Users)</option>
                                    <option value='private'>Private (Only You)</option>
                                </select>
                            </label>
                        </div>
                    )}

                    <div style={{ marginBottom: "1rem" }}>
                        <label>
                            Prompt:
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder='Enter your prompt here...'
                                style={{
                                    marginLeft: "0.5rem",
                                    padding: "0.5rem",
                                    width: "100%",
                                    minHeight: "80px",
                                    marginTop: "0.5rem"
                                }}
                            />
                        </label>
                    </div>

                    <button onClick={sendAIGeneration} disabled={!aiPrompt} style={{ padding: "0.5rem 1rem" }}>
                        Generate {aiType === "suggestion" ? "Suggestion" : "Chat"}
                    </button>
                </div>

                {socketMessages.length > 0 && (
                    <div style={{ marginBottom: "2rem" }}>
                        <h3>Socket Messages ({socketMessages.length})</h3>
                        <div
                            style={{
                                background: "#f5f5f5",
                                padding: "1rem",
                                borderRadius: "4px",
                                maxHeight: "300px",
                                overflow: "auto"
                            }}
                        >
                            {socketMessages.map((msg, index) => (
                                <div key={index} style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                                    <strong>[{msg.timestamp}]</strong> {msg.type}:
                                    {msg.data ? (
                                        <pre style={{ margin: "0.25rem 0", fontSize: "0.8rem" }}>{JSON.stringify(msg.data, null, 2)}</pre>
                                    ) : (
                                        <span> {msg.message}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {result && (
                    <div style={{ marginTop: "2rem" }}>
                        <h3>Result:</h3>
                        <pre
                            style={{
                                background: "#f5f5f5",
                                padding: "1rem",
                                borderRadius: "4px",
                                overflow: "auto",
                                maxHeight: "400px"
                            }}
                        >
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}

                <div style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#666" }}>
                    <p>API Endpoints (Express + Socket.IO):</p>
                    <ul>
                        <li>Socket.IO connection for real-time collaboration</li>
                        <li>GET /rooms/:documentId - Get room information</li>
                        <li>GET /rooms - Get all room statistics</li>
                        <li>POST /ai/suggest - Generate AI suggestions (streams via Socket.IO)</li>
                        <li>POST /ai/chat - Generate AI chat responses (streams via Socket.IO)</li>
                        <li>POST /diff/accept - Accept a suggestion</li>
                        <li>POST /diff/reject - Reject a suggestion</li>
                        <li>GET /health - Health check</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
