import { Server, Socket } from "socket.io";
import * as socketController from "../controllers/socket.controller";

export function setupSocketRoutes(io: Server) {
    io.on("connection", (socket: Socket) => {
        console.log("Client connected:", socket.id);

        socket.on("join-room", (data) => socketController.handleJoinRoom(socket, data));

        socket.on("leave-room", (data) => socketController.handleLeaveRoom(socket, data));

        socket.on("yjs-update", (data) => socketController.handleYjsUpdate(socket, data));

        socket.on("yjs-sync-request", (data) => socketController.handleYjsSyncRequest(socket, data));

        socket.on("suggest", (data) => socketController.handleSuggest(socket, data));

        socket.on("chat", (data) => socketController.handleChat(socket, data));

        socket.on("suggestion-resolution", (data) => socketController.handleSuggestionResolution(socket, io, data));

        socket.on("disconnect", () => socketController.handleDisconnect(socket));
    });
}
