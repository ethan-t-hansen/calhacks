import { Router } from "express";
import { Socket } from "socket.io";
import { startDocumentPersistence, handleJoin, handleLeave, handleAwareness, handleUpdate } from "./controller";
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

    io.on("connection", (socket: Socket) => {
        console.log("room client connected: ", socket.id);

        socket.on("join", (data) => handleJoin(socket, data));
        socket.on("leave", (data) => handleLeave(socket, data));
        socket.on("awareness", (data) => handleAwareness(socket, data));
        socket.on("update", (data) => handleUpdate(socket, data));
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
