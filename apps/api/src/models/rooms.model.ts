import { nanoid } from "nanoid";
import { Room, RoomUser, WebSocketMessage, AIWebSocketMessage, ActivityLogEntry } from "../types";
import * as db from "./database.model";

const rooms = new Map<string, Room>();
const userToRooms = new Map<string, Set<string>>();

export function joinRoom(documentId: string, userId: string, socket: any, userInfo: { name: string; color: string }): void {
    leaveAllRooms(userId);

    let room = rooms.get(documentId);
    if (!room) {
        room = {
            document_id: documentId,
            users: new Map(),
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
        };
        rooms.set(documentId, room);
    }

    const roomUser: RoomUser = {
        user_id: userId,
        websocket: socket,
        user_info: userInfo,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
    };

    room.users.set(userId, roomUser);
    room.last_activity = new Date().toISOString();

    if (!userToRooms.has(userId)) {
        userToRooms.set(userId, new Set());
    }
    userToRooms.get(userId)!.add(documentId);

    broadcastToRoom(
        documentId,
        {
            type: "user_presence",
            document_id: documentId,
            user_id: userId,
            action: "join",
            timestamp: new Date().toISOString(),
            user_info: userInfo
        },
        userId
    );

    console.log(`User ${userId} joined room ${documentId}. Room now has ${room.users.size} users.`);

    logActivity(documentId, userId, "edit", { userInfo, action: "join" });
}

export function leaveRoom(documentId: string, userId: string): void {
    const room = rooms.get(documentId);
    if (!room) return;

    const user = room.users.get(userId);
    if (!user) return;

    room.users.delete(userId);
    room.last_activity = new Date().toISOString();

    const userRooms = userToRooms.get(userId);
    if (userRooms) {
        userRooms.delete(documentId);
        if (userRooms.size === 0) {
            userToRooms.delete(userId);
        }
    }

    broadcastToRoom(documentId, {
        type: "user_presence",
        document_id: documentId,
        user_id: userId,
        action: "leave",
        timestamp: new Date().toISOString(),
        user_info: user.user_info
    });

    if (room.users.size === 0) {
        rooms.delete(documentId);
        console.log(`Room ${documentId} deleted (no users remaining)`);
    } else {
        console.log(`User ${userId} left room ${documentId}. Room now has ${room.users.size} users.`);
    }

    logActivity(documentId, userId, "edit", { userInfo: user.user_info, action: "leave" });
}

export function leaveAllRooms(userId: string): void {
    const userRooms = userToRooms.get(userId);
    if (!userRooms) return;

    const roomIds = Array.from(userRooms);
    roomIds.forEach((documentId) => {
        leaveRoom(documentId, userId);
    });
}

export function getRoomUsers(documentId: string): RoomUser[] {
    const room = rooms.get(documentId);
    if (!room) return [];

    return Array.from(room.users.values());
}

export function getRoom(documentId: string): Room | undefined {
    return rooms.get(documentId);
}

export function getUserRooms(userId: string): string[] {
    const userRooms = userToRooms.get(userId);
    return userRooms ? Array.from(userRooms) : [];
}

export function broadcastToRoom(documentId: string, message: WebSocketMessage | AIWebSocketMessage, excludeUserId?: string): void {
    const room = rooms.get(documentId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const [userId, roomUser] of room.users) {
        if (excludeUserId && userId === excludeUserId) continue;

        if (roomUser.websocket.connected) {
            try {
                roomUser.websocket.emit("message", message);
                sentCount++;

                roomUser.last_seen = new Date().toISOString();
            } catch (error) {
                console.error(`Failed to send message to user ${userId}:`, error);
                leaveRoom(documentId, userId);
            }
        } else {
            leaveRoom(documentId, userId);
        }
    }

    room.last_activity = new Date().toISOString();
    console.log(`Broadcasted message to ${sentCount} users in room ${documentId}`);
}

export function sendToUser(documentId: string, userId: string, message: WebSocketMessage | AIWebSocketMessage): boolean {
    const room = rooms.get(documentId);
    if (!room) return false;

    const roomUser = room.users.get(userId);
    if (!roomUser || !roomUser.websocket.connected) {
        return false;
    }

    try {
        roomUser.websocket.emit("message", message);
        roomUser.last_seen = new Date().toISOString();
        room.last_activity = new Date().toISOString();
        return true;
    } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
        leaveRoom(documentId, userId);
        return false;
    }
}

export function getStats(): {
    totalRooms: number;
    totalUsers: number;
    rooms: Array<{
        documentId: string;
        userCount: number;
        createdAt: string;
        lastActivity: string;
    }>;
} {
    const roomsArray = Array.from(rooms.values()).map((room) => ({
        documentId: room.document_id,
        userCount: room.users.size,
        createdAt: room.created_at,
        lastActivity: room.last_activity
    }));

    return {
        totalRooms: rooms.size,
        totalUsers: Array.from(userToRooms.keys()).length,
        rooms: roomsArray
    };
}

export function cleanupInactiveRooms(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const roomsToDelete: string[] = [];

    for (const [documentId, room] of rooms) {
        if (room.users.size === 0 && room.last_activity < oneHourAgo) {
            roomsToDelete.push(documentId);
        }
    }

    roomsToDelete.forEach((documentId) => {
        rooms.delete(documentId);
        console.log(`Cleaned up inactive room: ${documentId}`);
    });
}

export function handleDisconnection(websocket: WebSocket): void {
    for (const [documentId, room] of rooms) {
        for (const [userId, roomUser] of room.users) {
            if (roomUser.websocket === websocket) {
                leaveRoom(documentId, userId);
                break;
            }
        }
    }
}

async function logActivity(
    documentId: string,
    userId: string,
    activityType: "edit" | "suggest" | "chat" | "side_chat",
    metadata: Record<string, any>
): Promise<void> {
    try {
        const entry: ActivityLogEntry = {
            type: "activity_log",
            id: nanoid(),
            document_id: documentId,
            user_id: userId,
            timestamp: new Date().toISOString(),
            activity_type: activityType,
            metadata
        };
        await db.saveActivityLog(entry);
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}

export async function persistYjsUpdate(documentId: string, userId: string, update: Uint8Array): Promise<void> {
    try {
        await db.saveYjsUpdate({
            type: "yjs_update",
            document_id: documentId,
            user_id: userId,
            update,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Failed to persist Yjs update:", error);
    }
}

export async function persistSuggestion(suggestion: any): Promise<void> {
    try {
        await db.saveSuggestion(suggestion);
    } catch (error) {
        console.error("Failed to persist suggestion:", error);
    }
}

export async function persistChatMessage(message: any): Promise<void> {
    try {
        await db.saveChatMessage(message);
    } catch (error) {
        console.error("Failed to persist chat message:", error);
    }
}
