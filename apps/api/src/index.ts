import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import * as database from "./models/database.model";
import * as yjsModel from "./models/yjs.model";
import { setupSocketRoutes } from "./routes/socket.routes";
import { createAIRouter } from "./routes/ai.routes";
import { createDocumentRouter } from "./routes/document.routes";
import { createRoomRouter } from "./routes/room.routes";
import { createThreadRouter } from "./routes/thread.routes";
import { createDiffRouter } from "./routes/diff.routes";
import { createChatRouter } from "./routes/chat.routes";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is required");
    }
    database.initializeDatabase(connectionString);
    console.log("Database connection initialized successfully");
} catch (error) {
    console.error("Failed to initialize database connection:", error);
    process.exit(1);
}

yjsModel.startPeriodicSnapshots();

setupSocketRoutes(io);

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/chat", createChatRouter());
app.use("/documents", createDocumentRouter());
app.use("/rooms", createRoomRouter());
app.use("/ai", createAIRouter(io));
app.use("/diff", createDiffRouter(io));
app.use("/threads", createThreadRouter(io));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`API ready at http://localhost:${PORT}`);
});
