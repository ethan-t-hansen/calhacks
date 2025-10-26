import { Router } from "express";
import { Socket } from "socket.io";
import { Room } from "./types";
import { createDocumentState } from "../document/document";
import { neonDAO } from "../database/neon";

const room_state: Room = { documents: {} };

export function createRoomRouter(io: any) {
    const router = Router();

    setInterval(async () => {
        for (const doc_id in room_state.documents) {
            const document = room_state.documents[doc_id];
            if (document && document.is_dirty) {
                try {
                    await neonDAO.persistDocument(document);
                    const persisted = await neonDAO.one((sql) => sql`SELECT * FROM yjs_document_states WHERE document_id=${doc_id}`);
                    console.log("Persisted document", doc_id, persisted);
                    document.is_dirty = false;
                } catch (error) {
                    console.error(`Failed to persist document ${doc_id}:`, error);
                }
            }
        }
    }, 20000);

    router.get("/info", (req, res) => {
        res.json({ message: "route for rooms" });
    });

    router.get("/ws", (req, res) => {
        res.json({ message: "connect to websocket using Socket.IO at the same host" });
    });

    io.on("connection", (socket: Socket) => {
        console.log("client connected: ", socket.id);

        socket.on("join", (data: string) => {
            const dataParsed: { doc_id: string; user_id: string } = JSON.parse(data);
            const { doc_id, user_id } = dataParsed;
            if (!doc_id || !user_id) {
                socket.emit("error", { message: "Missing required fields" });
                socket.disconnect(true);
                return false;
            }

            if (!room_state.documents[doc_id]) {
                room_state.documents[doc_id] = createDocumentState({ document_id: doc_id });
            }

            room_state.documents[doc_id].active_users += 1;

            socket.join(doc_id);
            socket.to(doc_id).emit("user_join", data);
        });

        socket.on("leave", async (data: string) => {
            const dataParsed: { doc_id: string; user_id: string } = JSON.parse(data);
            const { doc_id, user_id } = dataParsed;
            if (room_state.documents[doc_id]) {
                room_state.documents[doc_id].active_users = Math.max(0, room_state.documents[doc_id].active_users - 1);
                if (room_state.documents[doc_id].active_users == 0) {
                    await neonDAO.persistDocument(room_state.documents[doc_id]);
                    delete room_state.documents[doc_id];
                }
            }
            socket.leave(doc_id);
            socket.to(doc_id).emit("user_left", { user_id });
        });

        socket.on("disconnect", async (data: string) => {
            const dataParsed: { doc_id: string; user_id: string } = JSON.parse(data);
            const { doc_id, user_id } = dataParsed;
            if (room_state.documents[doc_id]) {
                room_state.documents[doc_id].active_users = Math.max(0, room_state.documents[doc_id].active_users - 1);
                if (room_state.documents[doc_id].active_users == 0) {
                    await neonDAO.persistDocument(room_state.documents[doc_id]);
                    delete room_state.documents[doc_id];
                }
            }
            socket.leave(doc_id);
            socket.to(doc_id).emit("user_left", { user_id });
        });

        socket.on("awareness", (data: string) => {
            const dataParsed: { doc_id: string; user_id: string; state: "typing" | "idle" } = JSON.parse(data);
            const { doc_id } = dataParsed;
            socket.to(doc_id).emit("aware", dataParsed);
        });

        socket.on("update", (data: string) => {
            const dataParsed: { doc_id: string; update: Uint8Array } = JSON.parse(data);
            const { doc_id, update } = dataParsed;
            if (!room_state.documents[doc_id]) {
                room_state.documents[doc_id] = createDocumentState({ document_id: doc_id });
            }
            room_state.documents[doc_id].yjs_state.update = update;
            room_state.documents[doc_id].is_dirty = true;
            socket.to(doc_id).emit("yjs", dataParsed);
        });
    });

    return router;
}
