import { nanoid } from "nanoid";
import { Room, RoomUser, WebSocketMessage, AIWebSocketMessage, StorageInterface, ActivityLogEntry } from "./types";

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private userToRooms: Map<string, Set<string>> = new Map(); // userId -> Set<documentId>
    private storage?: StorageInterface;

    constructor(storage?: StorageInterface) {
        this.storage = storage;
    }

    /**
     * Join a user to a document room
     */
    joinRoom(documentId: string, userId: string, socket: any, userInfo: { name: string; color: string }): void {
        this.leaveAllRooms(userId);

        let room = this.rooms.get(documentId);
        if (!room) {
            room = {
                document_id: documentId,
                users: new Map(),
                created_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
            };
            this.rooms.set(documentId, room);
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

        // Track user's rooms
        if (!this.userToRooms.has(userId)) {
            this.userToRooms.set(userId, new Set());
        }
        this.userToRooms.get(userId)!.add(documentId);

        // Broadcast user presence to other users in the room
        this.broadcastToRoom(
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

        // Log activity
        this.logActivity(documentId, userId, "edit", { userInfo, action: "join" });
    }

    /**
     * Remove a user from a specific room
     */
    leaveRoom(documentId: string, userId: string): void {
        const room = this.rooms.get(documentId);
        if (!room) return;

        const user = room.users.get(userId);
        if (!user) return;

        room.users.delete(userId);
        room.last_activity = new Date().toISOString();

        const userRooms = this.userToRooms.get(userId);
        if (userRooms) {
            userRooms.delete(documentId);
            if (userRooms.size === 0) {
                this.userToRooms.delete(userId);
            }
        }

        if (user.websocket.readyState === WebSocket.OPEN) {
            user.websocket.close();
        }

        this.broadcastToRoom(documentId, {
            type: "user_presence",
            document_id: documentId,
            user_id: userId,
            action: "leave",
            timestamp: new Date().toISOString(),
            user_info: user.user_info
        });

        if (room.users.size === 0) {
            this.rooms.delete(documentId);
            console.log(`Room ${documentId} deleted (no users remaining)`);
        } else {
            console.log(`User ${userId} left room ${documentId}. Room now has ${room.users.size} users.`);
        }

        // Log activity
        this.logActivity(documentId, userId, "edit", { userInfo: user.user_info, action: "leave" });
    }

    /**
     * Remove user from all rooms
     */
    leaveAllRooms(userId: string): void {
        const userRooms = this.userToRooms.get(userId);
        if (!userRooms) return;

        // Create a copy of the set to avoid modification during iteration
        const roomIds = Array.from(userRooms);
        roomIds.forEach((documentId) => {
            this.leaveRoom(documentId, userId);
        });
    }

    /**
     * Get all users in a room
     */
    getRoomUsers(documentId: string): RoomUser[] {
        const room = this.rooms.get(documentId);
        if (!room) return [];

        return Array.from(room.users.values());
    }

    /**
     * Get room information
     */
    getRoom(documentId: string): Room | undefined {
        return this.rooms.get(documentId);
    }

    /**
     * Get all rooms a user is in
     */
    getUserRooms(userId: string): string[] {
        const userRooms = this.userToRooms.get(userId);
        return userRooms ? Array.from(userRooms) : [];
    }

    /**
     * Broadcast a message to all users in a room
     */
    broadcastToRoom(documentId: string, message: WebSocketMessage | AIWebSocketMessage, excludeUserId?: string): void {
        const room = this.rooms.get(documentId);
        if (!room) return;

        const messageStr = JSON.stringify(message);
        let sentCount = 0;

        for (const [userId, roomUser] of room.users) {
            if (excludeUserId && userId === excludeUserId) continue;

            if (roomUser.websocket.connected) {
                try {
                    roomUser.websocket.emit("message", message);
                    sentCount++;

                    // Update last seen
                    roomUser.last_seen = new Date().toISOString();
                } catch (error) {
                    console.error(`Failed to send message to user ${userId}:`, error);
                    // Remove user if websocket is broken
                    this.leaveRoom(documentId, userId);
                }
            } else {
                // Remove user if websocket is closed
                this.leaveRoom(documentId, userId);
            }
        }

        room.last_activity = new Date().toISOString();
        console.log(`Broadcasted message to ${sentCount} users in room ${documentId}`);
    }

    /**
     * Send a message to a specific user in a room
     */
    sendToUser(documentId: string, userId: string, message: WebSocketMessage | AIWebSocketMessage): boolean {
        const room = this.rooms.get(documentId);
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
            this.leaveRoom(documentId, userId);
            return false;
        }
    }

    /**
     * Get room statistics
     */
    getStats(): {
        totalRooms: number;
        totalUsers: number;
        rooms: Array<{
            documentId: string;
            userCount: number;
            createdAt: string;
            lastActivity: string;
        }>;
    } {
        const rooms = Array.from(this.rooms.values()).map((room) => ({
            documentId: room.document_id,
            userCount: room.users.size,
            createdAt: room.created_at,
            lastActivity: room.last_activity
        }));

        return {
            totalRooms: this.rooms.size,
            totalUsers: Array.from(this.userToRooms.keys()).length,
            rooms
        };
    }

    /**
     * Clean up inactive rooms (rooms with no users for more than 1 hour)
     */
    cleanupInactiveRooms(): void {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const roomsToDelete: string[] = [];

        for (const [documentId, room] of this.rooms) {
            if (room.users.size === 0 && room.last_activity < oneHourAgo) {
                roomsToDelete.push(documentId);
            }
        }

        roomsToDelete.forEach((documentId) => {
            this.rooms.delete(documentId);
            console.log(`Cleaned up inactive room: ${documentId}`);
        });
    }

    /**
     * Handle websocket disconnection
     */
    handleDisconnection(websocket: WebSocket): void {
        // Find and remove user from all rooms
        for (const [documentId, room] of this.rooms) {
            for (const [userId, roomUser] of room.users) {
                if (roomUser.websocket === websocket) {
                    this.leaveRoom(documentId, userId);
                    break;
                }
            }
        }
    }

    /**
     * Log activity to storage
     */
    private async logActivity(
        documentId: string,
        userId: string,
        activityType: "edit" | "suggest" | "chat" | "side_chat",
        metadata: Record<string, any>
    ): Promise<void> {
        if (!this.storage) return;

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
            await this.storage.saveActivityLog(entry);
        } catch (error) {
            console.error("Failed to log activity:", error);
        }
    }

    /**
     * Persist a Yjs update
     */
    async persistYjsUpdate(documentId: string, userId: string, update: Uint8Array): Promise<void> {
        if (!this.storage) return;

        try {
            await this.storage.saveYjsUpdate({
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

    /**
     * Persist a suggestion
     */
    async persistSuggestion(suggestion: any): Promise<void> {
        if (!this.storage) return;

        try {
            await this.storage.saveSuggestion(suggestion);
        } catch (error) {
            console.error("Failed to persist suggestion:", error);
        }
    }

    /**
     * Persist a chat message
     */
    async persistChatMessage(message: any): Promise<void> {
        if (!this.storage) return;

        try {
            await this.storage.saveChatMessage(message);
        } catch (error) {
            console.error("Failed to persist chat message:", error);
        }
    }
}

// Singleton instance - will be initialized with storage in index.ts
export let roomManager: RoomManager;

export function initializeRoomManager(storage?: StorageInterface): void {
    roomManager = new RoomManager(storage);
}
