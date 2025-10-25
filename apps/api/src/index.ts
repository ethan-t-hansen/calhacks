// apps/api/src/index.ts
import Fastify from "fastify";
import { createCompletion } from "./prompt";
import { createStorage } from "./database";
import { initializeRoomManager } from "./rooms";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = Fastify({ logger: true });

// Initialize storage
let storage;
try {
    storage = createStorage();
    console.log("Database connection initialized successfully");
} catch (error) {
    console.error("Failed to initialize database connection:", error);
    process.exit(1);
}

// Initialize room manager with storage
initializeRoomManager(storage);

app.get("/health", async () => ({ status: "ok" }));

app.post("/chat", async (request, reply) => {
    // const { messages } = request.body as { messages: ChatCompletionMessageParam[] };

    try {
        const response = await createCompletion([
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello!" }
        ]);
        return {
            message: response.message,
            formatted: response.formatted
        };
    } catch (error) {
        reply.status(500).send({ error: "Failed to get completion" });
    }
});

// Persistence API endpoints
app.get("/documents/:documentId/suggestions", async (request, reply) => {
    try {
        const { documentId } = request.params as { documentId: string };
        const { status } = request.query as { status?: string };
        const suggestions = await storage.getSuggestions(documentId, status);
        return { suggestions };
    } catch (error) {
        reply.status(500).send({ error: "Failed to get suggestions" });
    }
});

app.get("/documents/:documentId/chat", async (request, reply) => {
    try {
        const { documentId } = request.params as { documentId: string };
        const { threadId } = request.query as { threadId?: string };
        const messages = await storage.getChatMessages(documentId, threadId);
        return { messages };
    } catch (error) {
        reply.status(500).send({ error: "Failed to get chat messages" });
    }
});

app.get("/documents/:documentId/threads", async (request, reply) => {
    try {
        const { documentId } = request.params as { documentId: string };
        const threads = await storage.getSideChatThreads(documentId);
        return { threads };
    } catch (error) {
        reply.status(500).send({ error: "Failed to get side chat threads" });
    }
});

app.get("/documents/:documentId/activity", async (request, reply) => {
    try {
        const { documentId } = request.params as { documentId: string };
        const { limit } = request.query as { limit?: string };
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        const activity = await storage.getActivityLog(documentId, limitNum);
        return { activity };
    } catch (error) {
        reply.status(500).send({ error: "Failed to get activity log" });
    }
});

app.listen({ port: 3001 }, (err) => {
    if (err) throw err;
    console.log("API ready at http://localhost:3001");
});
