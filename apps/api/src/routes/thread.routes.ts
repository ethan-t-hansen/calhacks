import { Router } from "express";
import { Server } from "socket.io";
import * as threadController from "../controllers/thread.controller";

export function createThreadRouter(io: Server): Router {
    const router = Router();

    router.post("/documents/:documentId/threads", (req, res) => threadController.createThread(req, res, io));

    router.post("/:threadId/messages", (req, res) => threadController.addMessageToThread(req, res, io));

    router.post("/:threadId/ai", (req, res) => threadController.generateThreadAIResponse(req, res, io));

    return router;
}
