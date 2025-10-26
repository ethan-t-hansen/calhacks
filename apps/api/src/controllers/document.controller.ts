import { Request, Response } from "express";
import * as db from "../models/database.model";

export async function getSuggestions(req: Request, res: Response) {
    try {
        const documentId = req.params.documentId as string;
        const { status } = req.query as { status?: string };
        const suggestions = await db.getSuggestions(documentId, status);
        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ error: "Failed to get suggestions" });
    }
}

export async function getChatMessages(req: Request, res: Response) {
    try {
        const documentId = req.params.documentId as string;
        const { threadId } = req.query as { threadId?: string };
        const messages = await db.getChatMessages(documentId, threadId);
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: "Failed to get chat messages" });
    }
}

export async function getThreads(req: Request, res: Response) {
    try {
        const documentId = req.params.documentId as string;
        const threads = await db.getSideChatThreads(documentId);
        res.json({ threads });
    } catch (error) {
        res.status(500).json({ error: "Failed to get side chat threads" });
    }
}

export async function getActivity(req: Request, res: Response) {
    try {
        const documentId = req.params.documentId as string;
        const { limit } = req.query as { limit?: string };
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        const activity = await db.getActivityLog(documentId, limitNum);
        res.json({ activity });
    } catch (error) {
        res.status(500).json({ error: "Failed to get activity log" });
    }
}
