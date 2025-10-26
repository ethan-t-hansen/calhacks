import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { createRoomRouter } from "./room/router";
import { createCompletionRouter } from "./completion/router";

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
app.use("/room", createRoomRouter(io));
app.use("/completions", createCompletionRouter(io));

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`API ready at http://localhost:${PORT}`);
});
