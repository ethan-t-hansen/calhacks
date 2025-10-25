import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { createCompletion } from "./prompt";
import { createStorage } from "./database";
import { initializeRoomManager, roomManager } from "./rooms";
import { AIBroadcaster } from "./ai-broadcaster";
import { YjsDocumentManager } from "./yjs-manager";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import dotenv from "dotenv";
import { nanoid } from "nanoid";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

let storage;
try {
    storage = createStorage();
    console.log("Database connection initialized successfully");
} catch (error) {
    console.error("Failed to initialize database connection:", error);
    process.exit(1);
}

initializeRoomManager(storage);
const yjsManager = new YjsDocumentManager(storage);
const aiBroadcaster = new AIBroadcaster(io);

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-room", (data: { documentId: string; userId: string; name: string; color: string }) => {
        const { documentId, userId, name, color } = data;

        if (!userId || !name || !color) {
            socket.emit("error", { message: "Missing required parameters: userId, name, color" });
            return;
        }

        const userInfo = { name, color };

        // Join the room
        socket.join(documentId);
        roomManager.joinRoom(documentId, userId, socket as any, userInfo);

        // Notify others in the room
        socket.to(documentId).emit("user-joined", {
            userId,
            userInfo,
            timestamp: new Date().toISOString()
        });

        console.log(`User ${userId} joined room ${documentId}`);
    });

    socket.on("leave-room", (data: { documentId: string; userId: string }) => {
        const { documentId, userId } = data;

        roomManager.leaveRoom(documentId, userId);
        socket.leave(documentId);

        // Notify others in the room
        socket.to(documentId).emit("user-left", {
            userId,
            timestamp: new Date().toISOString()
        });

        console.log(`User ${userId} left room ${documentId}`);
    });

    socket.on("yjs-update", async (data: { documentId: string; userId: string; update: Uint8Array }) => {
        const { documentId, userId, update } = data;

        try {
            // Apply update to Yjs document
            await yjsManager.applyUpdate(documentId, update, userId);

            // Broadcast to other users in the room
            socket.to(documentId).emit("yjs-update", data);
        } catch (error) {
            console.error("Error applying Yjs update:", error);
            socket.emit("error", { message: "Failed to apply Yjs update" });
        }
    });

    socket.on("yjs-sync-request", (data: { documentId: string; userId: string; stateVector: Uint8Array }) => {
        const { documentId, userId, stateVector } = data;

        try {
            // Get updates since the provided state vector
            const updates = yjsManager.getUpdatesSince(documentId, stateVector);

            socket.emit("yjs-sync-response", {
                documentId,
                update: updates
            });
        } catch (error) {
            console.error("Error handling Yjs sync request:", error);
            socket.emit("yjs-sync-response", {
                documentId,
                update: new Uint8Array(0)
            });
        }
    });

    socket.on("suggest", async (data: any) => {
        try {
            // Persist suggestion
            await roomManager.persistSuggestion(data);

            // Broadcast to other users in the room
            socket.to(data.document_id).emit("suggest", data);
        } catch (error) {
            console.error("Error handling suggestion:", error);
            socket.emit("error", { message: "Failed to process suggestion" });
        }
    });

    socket.on("chat", async (data: any) => {
        try {
            // Persist chat message
            await roomManager.persistChatMessage(data);

            // Broadcast to other users in the room
            socket.to(data.document_id).emit("chat", data);
        } catch (error) {
            console.error("Error handling chat message:", error);
            socket.emit("error", { message: "Failed to process chat message" });
        }
    });

    socket.on(
        "suggestion-resolution",
        (data: { documentId: string; suggestionId: string; userId: string; action: "accepted" | "rejected" }) => {
            const { documentId, suggestionId, userId, action } = data;

            // Broadcast suggestion resolution to all users in the room
            io.to(documentId).emit("suggestion-resolution", {
                suggestionId,
                userId,
                action,
                timestamp: new Date().toISOString()
            });
        }
    );

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        // Handle cleanup if needed
    });
});

// HTTP Routes
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
    const { messages } = req.body as { messages: ChatCompletionMessageParam[] };

    try {
        const response = await createCompletion(messages);
        res.json({
            message: response.message,
            formatted: response.formatted
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to get completion" });
    }
});

app.get("/documents/:documentId/suggestions", async (req, res) => {
    try {
        const { documentId } = req.params;
        const { status } = req.query as { status?: string };
        const suggestions = await storage.getSuggestions(documentId, status);
        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ error: "Failed to get suggestions" });
    }
});

app.get("/documents/:documentId/chat", async (req, res) => {
    try {
        const { documentId } = req.params;
        const { threadId } = req.query as { threadId?: string };
        const messages = await storage.getChatMessages(documentId, threadId);
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: "Failed to get chat messages" });
    }
});

app.get("/documents/:documentId/threads", async (req, res) => {
    try {
        const { documentId } = req.params;
        const threads = await storage.getSideChatThreads(documentId);
        res.json({ threads });
    } catch (error) {
        res.status(500).json({ error: "Failed to get side chat threads" });
    }
});

app.get("/documents/:documentId/activity", async (req, res) => {
    try {
        const { documentId } = req.params;
        const { limit } = req.query as { limit?: string };
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        const activity = await storage.getActivityLog(documentId, limitNum);
        res.json({ activity });
    } catch (error) {
        res.status(500).json({ error: "Failed to get activity log" });
    }
});

// Room management endpoints
app.get("/rooms/:documentId", (req, res) => {
    try {
        const { documentId } = req.params;
        const room = roomManager.getRoom(documentId);
        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        const users = roomManager.getRoomUsers(documentId);
        res.json({
            documentId: room.document_id,
            createdAt: room.created_at,
            lastActivity: room.last_activity,
            userCount: users.length,
            users: users.map((user) => ({
                userId: user.user_id,
                userInfo: user.user_info,
                joinedAt: user.joined_at,
                lastSeen: user.last_seen
            }))
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to get room information" });
    }
});

app.get("/rooms", (req, res) => {
    try {
        const stats = roomManager.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Failed to get room statistics" });
    }
});

// AI endpoints for streaming content
app.post("/ai/suggest", async (req, res) => {
    try {
        const { documentId, userId, prompt, context } = req.body as {
            documentId: string;
            userId: string;
            prompt: string;
            context?: {
                selectedText?: string;
                cursorPosition?: number;
                range?: { anchor: number; head: number };
            };
        };

        if (!documentId || !userId || !prompt) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Start suggestion generation (non-blocking)
        aiBroadcaster.generateSuggestion({
            documentId,
            userId,
            requestType: "suggestion",
            context,
            prompt
        });

        res.json({ success: true, message: "Suggestion generation started" });
    } catch (error) {
        res.status(500).json({ error: "Failed to start suggestion generation" });
    }
});

app.post("/ai/chat", async (req, res) => {
    try {
        const {
            documentId,
            userId,
            prompt,
            visibility = "shared",
            context
        } = req.body as {
            documentId: string;
            userId: string;
            prompt: string;
            visibility?: "private" | "shared";
            context?: {
                selectedText?: string;
                cursorPosition?: number;
                range?: { anchor: number; head: number };
            };
        };

        if (!documentId || !userId || !prompt) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Start chat generation (non-blocking)
        aiBroadcaster.generateChat({
            documentId,
            userId,
            requestType: "chat",
            visibility,
            context,
            prompt
        });

        res.json({ success: true, message: "Chat generation started" });
    } catch (error) {
        res.status(500).json({ error: "Failed to start chat generation" });
    }
});

// Diff management endpoints
app.post("/diff/accept", async (req, res) => {
    try {
        const { documentId, userId, suggestionId } = req.body as {
            documentId: string;
            userId: string;
            suggestionId: string;
        };

        if (!documentId || !userId || !suggestionId) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Update suggestion status in database
        await storage.updateSuggestionStatus(suggestionId, "accepted", userId, new Date().toISOString());

        // Broadcast acceptance to room
        io.to(documentId).emit("suggestion-resolution", {
            suggestionId,
            userId,
            action: "accepted",
            timestamp: new Date().toISOString()
        });

        res.json({ success: true, message: "Suggestion accepted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to accept suggestion" });
    }
});

app.post("/diff/reject", async (req, res) => {
    try {
        const { documentId, userId, suggestionId } = req.body as {
            documentId: string;
            userId: string;
            suggestionId: string;
        };

        if (!documentId || !userId || !suggestionId) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Update suggestion status in database
        await storage.updateSuggestionStatus(suggestionId, "rejected", userId, new Date().toISOString());

        // Broadcast rejection to room
        io.to(documentId).emit("suggestion-resolution", {
            suggestionId,
            userId,
            action: "rejected",
            timestamp: new Date().toISOString()
        });

        res.json({ success: true, message: "Suggestion rejected" });
    } catch (error) {
        res.status(500).json({ error: "Failed to reject suggestion" });
    }
});

// Side chat thread endpoints
app.post("/documents/:documentId/threads", async (req, res) => {
    try {
        const { documentId } = req.params;
        const { userId, title, anchorPosition, anchorText } = req.body as {
            userId: string;
            title: string;
            anchorPosition: number;
            anchorText: string;
        };

        if (!userId || !title || anchorPosition === undefined || !anchorText) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const threadId = nanoid();
        const thread = {
            type: "side_chat_thread" as const,
            id: threadId,
            document_id: documentId,
            created_by: userId,
            timestamp: new Date().toISOString(),
            title,
            anchor_position: anchorPosition,
            anchor_text: anchorText,
            resolved: false
        };

        await storage.saveSideChatThread(thread);

        // Broadcast thread creation to room
        io.to(documentId).emit("side-chat-thread-created", thread);

        res.json({ success: true, threadId, thread });
    } catch (error) {
        res.status(500).json({ error: "Failed to create side chat thread" });
    }
});

app.post("/threads/:threadId/messages", async (req, res) => {
    try {
        const { threadId } = req.params;
        const { documentId, userId, message, aiPrompt } = req.body as {
            documentId: string;
            userId: string;
            message: string;
            aiPrompt?: string;
        };

        if (!documentId || !userId || !message) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const messageId = nanoid();
        const chatMessage = {
            type: "side_chat_message" as const,
            id: messageId,
            thread_id: threadId,
            document_id: documentId,
            user_id: userId,
            timestamp: new Date().toISOString(),
            message
        };

        await storage.saveSideChatMessage(chatMessage);

        // Broadcast message to room
        io.to(documentId).emit("side-chat-message", chatMessage);

        // If AI prompt is provided, generate AI response
        if (aiPrompt) {
            aiBroadcaster.generateSideChatResponse({
                documentId,
                userId,
                threadId,
                requestType: "chat",
                prompt: aiPrompt,
                context: {
                    selectedText: message,
                    cursorPosition: message.length
                }
            });
        }

        res.json({ success: true, messageId, message: chatMessage });
    } catch (error) {
        res.status(500).json({ error: "Failed to add message to thread" });
    }
});

app.post("/threads/:threadId/ai", async (req, res) => {
    try {
        const { threadId } = req.params;
        const { documentId, userId, prompt, context } = req.body as {
            documentId: string;
            userId: string;
            prompt: string;
            context?: {
                selectedText?: string;
                cursorPosition?: number;
                range?: { anchor: number; head: number };
            };
        };

        if (!documentId || !userId || !prompt) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Generate AI response for the thread
        aiBroadcaster.generateSideChatResponse({
            documentId,
            userId,
            threadId,
            requestType: "chat",
            prompt,
            context
        });

        res.json({ success: true, message: "AI response generation started" });
    } catch (error) {
        res.status(500).json({ error: "Failed to start AI response generation" });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`API ready at http://localhost:${PORT}`);
});
