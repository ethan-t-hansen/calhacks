import { Router } from "express";
import { Socket } from "socket.io";
import { handleChatStream, handleSuggestStream } from "./controller";

export function createCompletionRouter(io: any) {
    const router = Router();

    router.get("/info", (req, res) => {
        res.json({ message: "route for rooms" });
    });

    router.get("/ws", (req, res) => {
        res.json({ message: "connect to websocket using Socket.IO at the same host" });
    });

    router.post("/suggest", handleSuggestStream);

    io.on("connection", (socket: Socket) => {
        console.log("chat client connected: ", socket.id);

        socket.on("chat", (data: any) => handleChatStream(io, data));
        // socket.on("suggest", (data: string) => handleSuggestStream(io, JSON.parse(data)));
        // socket.on("leave", (data: string) => handleLeave(socket, data));
        // socket.on("disconnect", (data: string) => handleDisconnect(socket));
        // socket.on("awareness", (data: string) => handleAwareness(socket, data));
        // socket.on("update", (data: string) => handleUpdate(socket, data));
    });

    return router;
}
