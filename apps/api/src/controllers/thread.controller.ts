import { Request, Response } from "express";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import * as db from "../models/database.model";
import * as aiController from "./ai.controller";

export async function createThread(req: Request, res: Response, io: Server) {
    try {
        const documentId = req.params.documentId as string;
        const { userId, title, anchorPosition, anchorText } = req.body as {
            userId: string;
            title: string;
            anchorPosition: number;
            anchorText: string;
        };

        if (!userId || !title || anchorPosition === undefined || !anchorText) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const threadId = nanoid();
        const thread = {
            type: "side_chat_thread" as const,
            id: threadId,
            document_id: documentId,
            created_by: userId,
            timestamp: new Date().toISOString(),
            title,
            anchor_position: anchorPosition,
            anchor_text: anchorText,
            resolved: false
        };

        await db.saveSideChatThread(thread);

        io.to(documentId).emit("side-chat-thread-created", thread);

        res.json({ success: true, threadId, thread });
    } catch (error) {
        res.status(500).json({ error: "Failed to create side chat thread" });
    }
}

export async function addMessageToThread(req: Request, res: Response, io: Server) {
    try {
        const threadId = req.params.threadId as string;
        const { documentId, userId, message, aiPrompt } = req.body as {
            documentId: string;
            userId: string;
            message: string;
            aiPrompt?: string;
        };

        if (!documentId || !userId || !message) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const messageId = nanoid();
        const chatMessage = {
            type: "side_chat_message" as const,
            id: messageId,
            thread_id: threadId,
            document_id: documentId,
            user_id: userId,
            timestamp: new Date().toISOString(),
            message
        };

        await db.saveSideChatMessage(chatMessage);

        io.to(documentId).emit("side-chat-message", chatMessage);

        if (aiPrompt) {
            aiController.generateSideChatResponse(io, {
                documentId,
                userId,
                threadId,
                requestType: "chat",
                prompt: aiPrompt,
                context: {
                    selectedText: message,
                    cursorPosition: message.length
                }
            });
        }

        res.json({ success: true, messageId, message: chatMessage });
    } catch (error) {
        res.status(500).json({ error: "Failed to add message to thread" });
    }
}

export async function generateThreadAIResponse(req: Request, res: Response, io: Server) {
    try {
        const threadId = req.params.threadId as string;
        const { documentId, userId, prompt, context } = req.body as {
            documentId: string;
            userId: string;
            prompt: string;
            context?: {
                selectedText?: string;
                cursorPosition?: number;
                range?: { anchor: number; head: number };
            };
        };

        if (!documentId || !userId || !prompt) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        aiController.generateSideChatResponse(io, {
            documentId,
            userId,
            threadId,
            requestType: "chat",
            prompt,
            context
        });

        res.json({ success: true, message: "AI response generation started" });
    } catch (error) {
        res.status(500).json({ error: "Failed to start AI response generation" });
    }
}
