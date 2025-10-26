import { Router } from "express";
import { Socket } from "socket.io";
import { startDocumentPersistence, handleJoin, handleLeave, handleAwareness, handleUpdate } from "./controller";

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

        socket.on("join", (data: any) => handleJoin(socket, data));
        socket.on("leave", (data: any) => handleLeave(socket, data));
        socket.on("awareness", (data: any) => handleAwareness(socket, data));
        socket.on("update", (data: any) => handleUpdate(socket, data));
    });

    return router;
}
