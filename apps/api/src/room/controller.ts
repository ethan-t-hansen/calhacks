import { Socket } from "socket.io";
import { Room } from "./types";
import { createDocumentState } from "../document/document";
import { neonDAO } from "../database/neon";

export const room_state: Room = { documents: {} };

export function startDocumentPersistence() {
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
}

export async function handleJoin(socket: Socket, data: any) {
    const { doc_id, user_id } = data;
    console.log(`${user_id} joined document ${doc_id}`);

    if (!doc_id || !user_id) {
        socket.emit("error", { message: "Missing required fields" });
        socket.disconnect(true);
        return false;
    }

    if (!room_state.documents[doc_id]) {
        const persisted = await neonDAO.one((sql) => sql`SELECT * FROM yjs_document_states WHERE document_id=${doc_id}`);
        if (persisted) {
            console.log(persisted);
            room_state.documents[doc_id] = createDocumentState({
                document_id: doc_id,
                state_vector: persisted.state_vector,
                update: persisted.update_data
            });
        } else {
            room_state.documents[doc_id] = createDocumentState({ document_id: doc_id });
        }
    }

    room_state.documents[doc_id].active_users += 1;

    socket.join(doc_id);
    socket.to(doc_id).emit("user_join", data);
}

export async function handleLeave(socket: Socket, data: any) {
    const { doc_id, user_id } = data;

    if (room_state.documents[doc_id]) {
        room_state.documents[doc_id].active_users = Math.max(0, room_state.documents[doc_id].active_users - 1);
        if (room_state.documents[doc_id].active_users == 0) {
            await neonDAO.persistDocument(room_state.documents[doc_id]);
            delete room_state.documents[doc_id];
        }
    }

    socket.leave(doc_id);
    socket.to(doc_id).emit("user_left", { user_id });
}

export function handleAwareness(socket: Socket, data: { doc_id: string; user_id: string; state: "typing" | "idle" }) {
    const { doc_id } = data;
    socket.to(doc_id).emit("aware", data);
}

export function handleUpdate(socket: Socket, data: any) {
    const { doc_id, update } = data;

    if (!room_state.documents[doc_id]) {
        room_state.documents[doc_id] = createDocumentState({ document_id: doc_id });
    }

    room_state.documents[doc_id].yjs_state.update = update;
    room_state.documents[doc_id].is_dirty = true;
    socket.to(doc_id).emit("yjs", data);
}
