import { Router } from "express";
import { Socket } from "socket.io";
import { startDocumentPersistence, handleJoin, handleLeave, handleAwareness, handleUpdate, handleSyncRequest, handleDisconnect } from "./controller";
import { handleChatStream } from "../completion/controller";
import { neonDAO } from "../database/neon";
import { createDocumentState } from "../document/document";
import { ChatMessage } from "../completion/types";

export function createRoomRouter(io: any) {
    const router = Router();

    startDocumentPersistence();

    router.get("/info", (req, res) => {
        res.json({ message: "route for rooms" });
    });

    router.get("/list", async (req, res) => {
        try {
            const rooms = await neonDAO.many(
                (sql: any) => sql`SELECT document_id, name, timestamp FROM yjs_document_states ORDER BY timestamp DESC`
            );
            res.json({ rooms });
        } catch (error) {
            console.error("Error fetching rooms:", error);
            res.status(500).json({ error: "Failed to fetch rooms" });
        }
    });

    router.post("/create", async (req, res) => {
        try {
            const { name } = req.body;

            if (!name || typeof name !== "string" || name.trim().length === 0) {
                res.status(400).json({ error: "Room name is required" });
                return;
            }

            const document_id = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            // Create empty Yjs state
            const emptyState = new Uint8Array(0);

            await neonDAO.query(
                (sql: any) => sql`
                    INSERT INTO yjs_document_states (document_id, name, state_vector, update_data)
                    VALUES (${document_id}, ${name.trim()}, ${emptyState}, ${emptyState})
                `
            );

            res.json({ document_id, name: name.trim() });
        } catch (error) {
            console.error("Error creating room:", error);
            res.status(500).json({ error: "Failed to create room" });
        }
    });

    router.get("/rooms/:id", async (req, res) => {
        try {
            const { id } = req.params;

            if (!id) {
                res.status(400).json({ error: "Room ID is required" });
                return;
            }

            // Get room info
            const room = await neonDAO.one(
                (sql: any) => sql`SELECT document_id, name, timestamp FROM yjs_document_states WHERE document_id=${id}`
            );

            if (!room) {
                res.status(404).json({ error: "Room not found" });
                return;
            }

            // Get message count
            const messageStats = await neonDAO.one(
                (sql: any) => sql`SELECT COUNT(*) as message_count FROM chat_messages WHERE document_id=${id}`
            );

            // Get unique users who have sent messages
            const userStats = await neonDAO.one(
                (sql: any) => sql`SELECT COUNT(DISTINCT user_id) as user_count FROM chat_messages WHERE document_id=${id} AND user_id != 'ai'`
            );

            res.json({
                room: {
                    ...room,
                    message_count: parseInt(messageStats?.message_count || '0'),
                    user_count: parseInt(userStats?.user_count || '0')
                }
            });
        } catch (error) {
            console.error("Error fetching room info:", error);
            res.status(500).json({ error: "Failed to fetch room info" });
        }
    });

    router.patch("/rooms/:id/name", async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;

            if (!id) {
                res.status(400).json({ error: "Room ID is required" });
                return;
            }

            if (!name || typeof name !== "string" || name.trim().length === 0) {
                res.status(400).json({ error: "Room name is required" });
                return;
            }

            // Check if room exists
            const room = await neonDAO.one(
                (sql: any) => sql`SELECT document_id FROM yjs_document_states WHERE document_id=${id}`
            );

            if (!room) {
                res.status(404).json({ error: "Room not found" });
                return;
            }

            // Update room name
            await neonDAO.query(
                (sql: any) => sql`
                    UPDATE yjs_document_states
                    SET name = ${name.trim()}
                    WHERE document_id = ${id}
                `
            );

            res.json({ success: true, name: name.trim() });
        } catch (error) {
            console.error("Error updating room name:", error);
            res.status(500).json({ error: "Failed to update room name" });
        }
    });

    io.on("connection", (socket: Socket) => {
        console.log("room client connected: ", socket.id);

        socket.on("join", (data) => handleJoin(socket, data));
        socket.on("leave", (data) => handleLeave(socket, data));
        socket.on("awareness", (data) => handleAwareness(socket, data));
        socket.on("update", (data) => handleUpdate(socket, data));
        socket.on("yjs-sync-request", (data) => handleSyncRequest(socket, data));
        socket.on("disconnect", () => handleDisconnect(socket));
    });

    router.get("/rehydrate/:doc_id/:user_id", async (req, res) => {
        const { doc_id, user_id } = req.params;

        if (!doc_id || !user_id) {
            res.status(400).json({ error: "Missing doc_id or user_id" });
            return;
        }

        let document = req.app.get("room_state")?.documents?.[doc_id];
        if (!document) {
            const [persisted, messages] = await Promise.all([
                neonDAO.one((sql: any) => sql`SELECT * FROM yjs_document_states WHERE document_id=${doc_id}`),
                neonDAO.many((sql: any) => sql`SELECT * FROM chat_messages WHERE document_id=${doc_id} ORDER BY timestamp DESC LIMIT 10`)
            ]);

            const user_to_message: { [userId: string]: number[] } = {};
            const message_log: ChatMessage[] = [];

            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];

                message_log.push(msg);
                const messageIndex = message_log.length - 1;

                if (msg.user_id != "ai") {
                    if (!user_to_message[msg.user_id]) {
                        user_to_message[msg.user_id] = [messageIndex];
                    } else {
                        user_to_message[msg.user_id]!.push(messageIndex);
                    }
                } else {
                    const replyToUser = msg.reply_to ?? "";
                    if (!user_to_message[replyToUser]) {
                        user_to_message[replyToUser] = [messageIndex];
                    } else {
                        user_to_message[replyToUser]!.push(messageIndex);
                    }
                }
            }

            if (persisted) {
                document = createDocumentState({
                    document_id: doc_id,
                    state_vector: persisted.state_vector,
                    update: persisted.update_data,
                    message_log,
                    user_to_message
                });
            } else {
                document = createDocumentState({ document_id: doc_id, message_log, user_to_message });
            }
        }

        res.json({
            yjs_state: document.yjs_state,
            message_log: document.message_log,
            user_to_message: document.user_to_message,
            active_users: document.active_users,
            is_dirty: document.is_dirty
        });
    });

    return router;
}
