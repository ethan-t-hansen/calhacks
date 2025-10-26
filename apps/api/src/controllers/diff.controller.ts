import { Request, Response } from "express";
import { Server } from "socket.io";
import * as db from "../models/database.model";

export async function acceptDiff(req: Request, res: Response, io: Server) {
    try {
        const { documentId, userId, suggestionId } = req.body as {
            documentId: string;
            userId: string;
            suggestionId: string;
        };

        if (!documentId || !userId || !suggestionId) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        await db.updateSuggestionStatus(suggestionId, "accepted", userId, new Date().toISOString());

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
}

export async function rejectDiff(req: Request, res: Response, io: Server) {
    try {
        const { documentId, userId, suggestionId } = req.body as {
            documentId: string;
            userId: string;
            suggestionId: string;
        };

        if (!documentId || !userId || !suggestionId) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        await db.updateSuggestionStatus(suggestionId, "rejected", userId, new Date().toISOString());

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
}
