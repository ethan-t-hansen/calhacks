import { Router } from "express";
import { Socket } from "socket.io";
import { startDocumentPersistence, handleJoin, handleLeave, handleDisconnect, handleAwareness, handleUpdate } from "./controller";

export function createRoomRouter(io: any) {
    const router = Router();

    startDocumentPersistence();

    router.get("/info", (req, res) => {
        res.json({ message: "route for rooms" });
    });

    router.get("/ws", (req, res) => {
        res.json({ message: "connect to websocket using Socket.IO at the same host" });
    });

    io.on("connection", (socket: Socket) => {
        console.log("client connected: ", socket.id);

        socket.on("join", (data: string) => handleJoin(socket, data));
        socket.on("leave", (data: string) => handleLeave(socket, data));
        socket.on("disconnect", (data: string) => handleDisconnect(socket, data));
        socket.on("awareness", (data: string) => handleAwareness(socket, data));
        socket.on("update", (data: string) => handleUpdate(socket, data));
    });

    return router;
}
