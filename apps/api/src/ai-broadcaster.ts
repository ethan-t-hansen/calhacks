import { Server } from "socket.io";
import { createCompletion, createStreamingCompletion } from "./prompt";
import { nanoid } from "nanoid";
import { AIWebSocketMessage } from "./types";

export interface AIRequest {
    documentId: string;
    userId: string;
    requestType: "chat" | "suggestion";
    visibility?: "private" | "shared";
    context?: {
        selectedText?: string;
        cursorPosition?: number;
        range?: { anchor: number; head: number };
    };
    prompt: string;
}

export class AIBroadcaster {
    private activeStreams: Map<string, boolean> = new Map();
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    async generateSuggestion(request: AIRequest): Promise<void> {
        const requestId = nanoid();
        const { documentId, userId, context, prompt } = request;

        // Mark stream as active
        this.activeStreams.set(requestId, true);

        try {
            // Broadcast start message to all users
            const startMessage: AIWebSocketMessage = {
                type: "ai:suggestion:start",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                timestamp: new Date().toISOString(),
                context
            };
            this.io.to(documentId).emit("ai-message", startMessage);

            // Generate completion with real streaming
            const stream = createStreamingCompletion([
                { role: "system", content: "You are a helpful assistant that provides suggestions for improving text." },
                { role: "user", content: prompt }
            ]);

            let content = "";

            for await (const chunk of stream) {
                if (!this.activeStreams.get(requestId)) break; // Stream cancelled

                content += chunk;
                const chunkMessage: AIWebSocketMessage = {
                    type: "ai:suggestion:chunk",
                    request_id: requestId,
                    document_id: documentId,
                    user_id: userId,
                    chunk,
                    timestamp: new Date().toISOString()
                };

                this.io.to(documentId).emit("ai-message", chunkMessage);
            }

            // Broadcast completion message
            const completeMessage: AIWebSocketMessage = {
                type: "ai:suggestion:complete",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                content,
                timestamp: new Date().toISOString(),
                metadata: {
                    suggestion: content,
                    target_range: context?.range,
                    target_text: context?.selectedText
                }
            };
            this.io.to(documentId).emit("ai-message", completeMessage);
        } catch (error) {
            console.error("Error generating suggestion:", error);

            // Broadcast error to all users
            const errorMessage: AIWebSocketMessage = {
                type: "ai:suggestion:complete",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                content: "",
                timestamp: new Date().toISOString(),
                metadata: { error: "Failed to generate suggestion" }
            };
            this.io.to(documentId).emit("ai-message", errorMessage);
        } finally {
            // Clean up
            this.activeStreams.delete(requestId);
        }
    }

    async generateChat(request: AIRequest): Promise<void> {
        const requestId = nanoid();
        const { documentId, userId, visibility = "shared", context, prompt } = request;

        // Mark stream as active
        this.activeStreams.set(requestId, true);

        try {
            // Broadcast start message
            const startMessage: AIWebSocketMessage = {
                type: "ai:chat:start",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                timestamp: new Date().toISOString(),
                context
            };

            if (visibility === "shared") {
                this.io.to(documentId).emit("ai-message", startMessage);
            } else {
                // For private chats, we need to find the specific socket for the user
                // This is a simplified approach - in production you'd want better user-to-socket mapping
                this.io.to(documentId).emit("ai-message", startMessage);
            }

            // Generate completion with real streaming
            const stream = createStreamingCompletion([
                { role: "system", content: "You are a helpful assistant that answers questions about documents." },
                { role: "user", content: prompt }
            ]);

            let content = "";

            for await (const chunk of stream) {
                if (!this.activeStreams.get(requestId)) break;

                content += chunk;
                const chunkMessage: AIWebSocketMessage = {
                    type: "ai:chat:chunk",
                    request_id: requestId,
                    document_id: documentId,
                    user_id: userId,
                    chunk,
                    timestamp: new Date().toISOString()
                };

                if (visibility === "shared") {
                    this.io.to(documentId).emit("ai-message", chunkMessage);
                } else {
                    // For private chats, broadcast to room but include visibility metadata
                    this.io.to(documentId).emit("ai-message", chunkMessage);
                }
            }

            // Broadcast completion message
            const completeMessage: AIWebSocketMessage = {
                type: "ai:chat:complete",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                content,
                timestamp: new Date().toISOString(),
                metadata: { visibility }
            };

            if (visibility === "shared") {
                this.io.to(documentId).emit("ai-message", completeMessage);
            } else {
                this.io.to(documentId).emit("ai-message", completeMessage);
            }
        } catch (error) {
            console.error("Error generating chat:", error);

            const errorMessage: AIWebSocketMessage = {
                type: "ai:chat:complete",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                content: "",
                timestamp: new Date().toISOString(),
                metadata: { error: "Failed to generate chat response" }
            };

            if (visibility === "shared") {
                this.io.to(documentId).emit("ai-message", errorMessage);
            } else {
                this.io.to(documentId).emit("ai-message", errorMessage);
            }
        } finally {
            // Clean up
            this.activeStreams.delete(requestId);
        }
    }

    async generateSideChatResponse(request: AIRequest & { threadId: string }): Promise<void> {
        const requestId = nanoid();
        const { documentId, userId, threadId, context, prompt } = request;

        // Mark stream as active
        this.activeStreams.set(requestId, true);

        try {
            // Broadcast start message to all users in the room
            const startMessage: AIWebSocketMessage = {
                type: "ai:chat:start",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                timestamp: new Date().toISOString(),
                context: context
            };
            this.io.to(documentId).emit("ai-message", startMessage);

            // Generate completion with real streaming
            const stream = createStreamingCompletion([
                { role: "system", content: "You are a helpful assistant that answers questions about documents in side chat threads." },
                { role: "user", content: prompt }
            ]);

            let content = "";

            for await (const chunk of stream) {
                if (!this.activeStreams.get(requestId)) break;

                content += chunk;
                const chunkMessage: AIWebSocketMessage = {
                    type: "ai:chat:chunk",
                    request_id: requestId,
                    document_id: documentId,
                    user_id: userId,
                    chunk,
                    timestamp: new Date().toISOString()
                };

                this.io.to(documentId).emit("ai-message", chunkMessage);
            }

            // Broadcast completion message
            const completeMessage: AIWebSocketMessage = {
                type: "ai:chat:complete",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                content,
                timestamp: new Date().toISOString(),
                metadata: { thread_id: threadId, visibility: "shared" }
            };
            this.io.to(documentId).emit("ai-message", completeMessage);
        } catch (error) {
            console.error("Error generating side chat response:", error);

            const errorMessage: AIWebSocketMessage = {
                type: "ai:chat:complete",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                content: "",
                timestamp: new Date().toISOString(),
                metadata: { error: "Failed to generate side chat response", thread_id: threadId }
            };
            this.io.to(documentId).emit("ai-message", errorMessage);
        } finally {
            // Clean up
            this.activeStreams.delete(requestId);
        }
    }

    cancelStream(requestId: string): void {
        this.activeStreams.set(requestId, false);
    }
}
