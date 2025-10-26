import { Router, Request, Response } from "express";
import { Server } from "socket.io";
import * as aiController from "../controllers/ai.controller";
import * as llm_client from "../prompt";

export function createAIRouter(io: Server): Router {
    const router = Router();

    router.post("/suggest", async (req: Request, res: Response) => {
        try {
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

            aiController.generateSuggestion(io, {
                documentId,
                userId,
                requestType: "suggestion",
                context,
                prompt
            });

            res.json({ success: true, message: "Suggestion generation started" });
        } catch (error) {
            res.status(500).json({ error: "Failed to start suggestion generation" });
        }
    });

    router.post("/suggest/stream", async (req: Request, res: Response) => {
        try {
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

            res.setHeader("Content-Type", "text/plain");
            res.setHeader("Transfer-Encoding", "chunked");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");

            const stream = llm_client.createStreamingCompletion([
                { role: "system", content: "You are a helpful assistant that provides suggestions for improving text." },
                { role: "user", content: prompt }
            ]);

            let fullContent = "";
            for await (const chunk of stream) {
                fullContent += chunk;
                res.write(chunk);
            }

            res.end();
        } catch (error) {
            console.error("Error in streaming suggestion:", error);
            res.status(500).json({ error: "Failed to generate suggestion" });
        }
    });

    router.post("/chat", async (req: Request, res: Response) => {
        try {
            const {
                documentId,
                userId,
                prompt,
                visibility = "shared",
                context
            } = req.body as {
                documentId: string;
                userId: string;
                prompt: string;
                visibility?: "private" | "shared";
                context?: {
                    selectedText?: string;
                    cursorPosition?: number;
                    range?: { anchor: number; head: number };
                };
            };

            if (!documentId || !userId || !prompt) {
                return res.status(400).json({ error: "Missing required parameters" });
            }

            aiController.generateChat(io, {
                documentId,
                userId,
                requestType: "chat",
                visibility,
                context,
                prompt
            });

            res.json({ success: true, message: "Chat generation started" });
        } catch (error) {
            res.status(500).json({ error: "Failed to start chat generation" });
        }
    });

    router.post("/chat/stream", async (req: Request, res: Response) => {
        try {
            const {
                documentId,
                userId,
                prompt,
                visibility = "shared",
                context
            } = req.body as {
                documentId: string;
                userId: string;
                prompt: string;
                visibility?: "private" | "shared";
                context?: {
                    selectedText?: string;
                    cursorPosition?: number;
                    range?: { anchor: number; head: number };
                };
            };

            if (!documentId || !userId || !prompt) {
                return res.status(400).json({ error: "Missing required parameters" });
            }

            res.setHeader("Content-Type", "text/plain");
            res.setHeader("Transfer-Encoding", "chunked");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");

            const stream = llm_client.createStreamingCompletion([
                { role: "system", content: "You are a helpful assistant that answers questions about documents." },
                { role: "user", content: prompt }
            ]);

            let fullContent = "";
            for await (const chunk of stream) {
                fullContent += chunk;
                res.write(chunk);
            }

            res.end();
        } catch (error) {
            console.error("Error in streaming chat:", error);
            res.status(500).json({ error: "Failed to generate chat response" });
        }
    });

    return router;
}
