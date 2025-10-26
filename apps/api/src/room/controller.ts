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

    (socket as any).documentId = doc_id;
    (socket as any).userId = user_id;

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

    if (!room_state.documents[doc_id].connected_users) {
        room_state.documents[doc_id].connected_users = new Map();
    }

    room_state.documents[doc_id].connected_users.set(socket.id, { user_id });
    room_state.documents[doc_id].active_users += 1;


    room_state.documents[doc_id].active_users += 1;

    socket.join(doc_id);

    const currentUsers = Array.from(room_state.documents[doc_id].connected_users.values());
    socket.emit("room_state", { connected_users: currentUsers });

    socket.to(doc_id).emit("user_join", data);
}

export async function handleLeave(socket: Socket, data: any) {
    const { doc_id, user_id } = data;

    if (room_state.documents[doc_id]) {
        if (room_state.documents[doc_id].connected_users) {
            room_state.documents[doc_id].connected_users.delete(socket.id);
        }
        
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

    const updateArray = Array.isArray(update) ? new Uint8Array(update) : update;
    room_state.documents[doc_id].yjs_state.update = updateArray;
    room_state.documents[doc_id].is_dirty = true;
    socket.to(doc_id).emit("yjs", { update });
}

export function handleSyncRequest(socket: Socket, data: any) {
    const { documentId, stateVector } = data;

    if (!room_state.documents[documentId]) {
        socket.emit("yjs-sync-response", { documentId, update: [] });
        return;
    }

    const document = room_state.documents[documentId];
    if (document.yjs_state.update && document.yjs_state.update.length > 0) {
        socket.emit("yjs-sync-response", {
            documentId,
            update: document.yjs_state.update
        });
    } else {
        socket.emit("yjs-sync-response", { documentId, update: [] });
    }
}


export async function handleDisconnect(socket: Socket) {
    const documentId = (socket as any).documentId;
    const userId = (socket as any).userId;
  
    if (!documentId) return; // nothing to clean up
    const doc = room_state.documents[documentId];
    if (!doc || !doc.connected_users) return;
  
    const user = doc.connected_users.get(socket.id);
    doc.connected_users.delete(socket.id);
    doc.active_users = Math.max(0, (doc.active_users ?? 0) - 1);
  
    socket.to(documentId).emit("user_left", { user_id: userId });
  
    if (doc.active_users === 0) {
      await neonDAO.persistDocument(doc);
      delete room_state.documents[documentId];
    }
  
    console.log(`User ${userId} disconnected from ${documentId}`);
  }