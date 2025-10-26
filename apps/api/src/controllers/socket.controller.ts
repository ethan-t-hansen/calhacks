import { Socket } from "socket.io";
import * as roomsModel from "../models/rooms.model";
import * as yjsModel from "../models/yjs.model";
import * as llm_client from "../prompt";
import { nanoid } from "nanoid";
import { ChatMessage } from "../types";

export async function handleJoinRoom(socket: Socket, data: { documentId: string; userId: string; name: string; color: string }) {
    const { documentId, userId, name, color } = data;

    if (!userId || !name || !color) {
        socket.emit("error", {
            message: "Missing required parameters: userId, name, color"
        });
        return;
    }

    const userInfo = { name, color };

    socket.join(documentId);
    roomsModel.joinRoom(documentId, userId, socket as any, userInfo);

    socket.to(documentId).emit("user-joined", {
        userId,
        userInfo,
        timestamp: new Date().toISOString()
    });

    console.log(`User ${userId} joined room ${documentId}`);
}

export function handleLeaveRoom(socket: Socket, data: { documentId: string; userId: string }) {
    const { documentId, userId } = data;

    roomsModel.leaveRoom(documentId, userId);
    socket.leave(documentId);

    socket.to(documentId).emit("user-left", {
        userId,
        timestamp: new Date().toISOString()
    });

    console.log(`User ${userId} left room ${documentId}`);
}

export async function handleYjsUpdate(socket: Socket, data: { documentId: string; userId: string; update: Uint8Array }) {
    const { documentId, userId, update } = data;

    try {
        await yjsModel.applyUpdate(documentId, update, userId);
        socket.to(documentId).emit("yjs-update", data);
    } catch (error) {
        console.error("Error applying Yjs update:", error);
        socket.emit("error", { message: "Failed to apply Yjs update" });
    }
}

export function handleYjsSyncRequest(socket: Socket, data: { documentId: string; userId: string; stateVector: Uint8Array }) {
    const { documentId, userId, stateVector } = data;

    try {
        const updates = yjsModel.getUpdatesSince(documentId, stateVector);

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
}

export async function handleSuggest(socket: Socket, data: any) {
    try {
        await roomsModel.persistSuggestion(data);
        socket.to(data.document_id).emit("suggest", data);
    } catch (error) {
        console.error("Error handling suggestion:", error);
        socket.emit("error", { message: "Failed to process suggestion" });
    }
}

export async function handleChat(socket: Socket, data: ChatMessage) {
    try {
        data.message = data.message.trim();
        const stream = await llm_client.client.chat.completions.create({
            model: "x2",
            messages: [{ role: "user", content: data.message }],
            stream: true
        });

        socket.to(data.document_id).emit("chat", data);

        let response = "";
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                socket.to(data.document_id).emit("ai-message", content);
                response += content;
            }
        }

        const aiMessage = {
            id: nanoid(),
            document_id: data.document_id,
            user_id: "ai",
            timestamp: new Date().toISOString(),
            message: response,
            reply_to: data.id,
            thread_id: data.thread_id || null
        };
        await Promise.all([roomsModel.persistChatMessage(data), roomsModel.persistChatMessage(aiMessage)]);
    } catch (error) {
        console.error("Error handling chat message:", error);
        socket.emit("error", { message: "Failed to process chat message" });
    }
}

export function handleSuggestionResolution(
    socket: Socket,
    io: any,
    data: { documentId: string; suggestionId: string; userId: string; action: "accepted" | "rejected" }
) {
    const { documentId, suggestionId, userId, action } = data;

    io.to(documentId).emit("suggestion-resolution", {
        suggestionId,
        userId,
        action,
        timestamp: new Date().toISOString()
    });
}

export function handleDisconnect(socket: Socket) {
    console.log("Client disconnected:", socket.id);
}
