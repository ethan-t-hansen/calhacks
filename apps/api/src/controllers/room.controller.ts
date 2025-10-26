import { Request, Response } from "express";
import * as roomsModel from "../models/rooms.model";

export function getRoom(req: Request, res: Response) {
    try {
        const documentId = req.params.documentId as string;
        const room = roomsModel.getRoom(documentId);
        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        const users = roomsModel.getRoomUsers(documentId);
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
}

export function getRooms(req: Request, res: Response) {
    try {
        const stats = roomsModel.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Failed to get room statistics" });
    }
}
