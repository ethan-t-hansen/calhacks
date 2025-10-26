import { Server } from "socket.io";
import { nanoid } from "nanoid";
import * as llm_client from "../prompt";
import { AIWebSocketMessage } from "../types";

interface AIRequest {
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

const activeStreams = new Map<string, boolean>();

export async function generateSuggestion(io: Server, request: AIRequest): Promise<void> {
    const requestId = nanoid();
    const { documentId, userId, context, prompt } = request;

    activeStreams.set(requestId, true);

    try {
        const startMessage: AIWebSocketMessage = {
            type: "ai:suggestion:start",
            request_id: requestId,
            document_id: documentId,
            user_id: userId,
            timestamp: new Date().toISOString(),
            context
        };
        io.to(documentId).emit("ai-message", startMessage);

        const stream = llm_client.createStreamingCompletion([
            { role: "system", content: "You are a helpful assistant that provides suggestions for improving text." },
            { role: "user", content: prompt }
        ]);

        let content = "";

        for await (const chunk of stream) {
            if (!activeStreams.get(requestId)) break;

            content += chunk;
            const chunkMessage: AIWebSocketMessage = {
                type: "ai:suggestion:chunk",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                chunk,
                timestamp: new Date().toISOString()
            };

            io.to(documentId).emit("ai-message", chunkMessage);
        }

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
        io.to(documentId).emit("ai-message", completeMessage);
    } catch (error) {
        console.error("Error generating suggestion:", error);

        const errorMessage: AIWebSocketMessage = {
            type: "ai:suggestion:complete",
            request_id: requestId,
            document_id: documentId,
            user_id: userId,
            content: "",
            timestamp: new Date().toISOString(),
            metadata: { error: "Failed to generate suggestion" }
        };
        io.to(documentId).emit("ai-message", errorMessage);
    } finally {
        activeStreams.delete(requestId);
    }
}

export async function generateChat(io: Server, request: AIRequest): Promise<void> {
    const requestId = nanoid();
    const { documentId, userId, visibility = "shared", context, prompt } = request;

    activeStreams.set(requestId, true);

    try {
        const startMessage: AIWebSocketMessage = {
            type: "ai:chat:start",
            request_id: requestId,
            document_id: documentId,
            user_id: userId,
            timestamp: new Date().toISOString(),
            context
        };

        if (visibility === "shared") {
            io.to(documentId).emit("ai-message", startMessage);
        } else {
            io.to(documentId).emit("ai-message", startMessage);
        }

        const stream = llm_client.createStreamingCompletion([
            { role: "system", content: "You are a helpful assistant that answers questions about documents." },
            { role: "user", content: prompt }
        ]);

        let content = "";

        for await (const chunk of stream) {
            if (!activeStreams.get(requestId)) break;

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
                io.to(documentId).emit("ai-message", chunkMessage);
            } else {
                io.to(documentId).emit("ai-message", chunkMessage);
            }
        }

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
            io.to(documentId).emit("ai-message", completeMessage);
        } else {
            io.to(documentId).emit("ai-message", completeMessage);
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
            io.to(documentId).emit("ai-message", errorMessage);
        } else {
            io.to(documentId).emit("ai-message", errorMessage);
        }
    } finally {
        activeStreams.delete(requestId);
    }
}

export async function generateSideChatResponse(io: Server, request: AIRequest & { threadId: string }): Promise<void> {
    const requestId = nanoid();
    const { documentId, userId, threadId, context, prompt } = request;

    activeStreams.set(requestId, true);

    try {
        const startMessage: AIWebSocketMessage = {
            type: "ai:chat:start",
            request_id: requestId,
            document_id: documentId,
            user_id: userId,
            timestamp: new Date().toISOString(),
            context: context
        };
        io.to(documentId).emit("ai-message", startMessage);

        const stream = llm_client.createStreamingCompletion([
            { role: "system", content: "You are a helpful assistant that answers questions about documents in side chat threads." },
            { role: "user", content: prompt }
        ]);

        let content = "";

        for await (const chunk of stream) {
            if (!activeStreams.get(requestId)) break;

            content += chunk;
            const chunkMessage: AIWebSocketMessage = {
                type: "ai:chat:chunk",
                request_id: requestId,
                document_id: documentId,
                user_id: userId,
                chunk,
                timestamp: new Date().toISOString()
            };

            io.to(documentId).emit("ai-message", chunkMessage);
        }

        const completeMessage: AIWebSocketMessage = {
            type: "ai:chat:complete",
            request_id: requestId,
            document_id: documentId,
            user_id: userId,
            content,
            timestamp: new Date().toISOString(),
            metadata: { thread_id: threadId, visibility: "shared" }
        };
        io.to(documentId).emit("ai-message", completeMessage);
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
        io.to(documentId).emit("ai-message", errorMessage);
    } finally {
        activeStreams.delete(requestId);
    }
}

export function cancelStream(requestId: string): void {
    activeStreams.set(requestId, false);
}

export function streamSuggestion(prompt: string, context?: any): AsyncGenerator<string> {
    const stream = llm_client.createStreamingCompletion([
        { role: "system", content: "You are a helpful assistant that provides suggestions for improving text." },
        { role: "user", content: prompt }
    ]);

    return stream;
}

export function streamChat(prompt: string, context?: any): AsyncGenerator<string> {
    const stream = llm_client.createStreamingCompletion([
        { role: "system", content: "You are a helpful assistant that answers questions about documents." },
        { role: "user", content: prompt }
    ]);

    return stream;
}
