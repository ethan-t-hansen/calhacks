import { Router } from "express";
import * as chatController from "../controllers/chat.controller";

export function createChatRouter(): Router {
    const router = Router();

    router.post("/", chatController.chat);

    return router;
}

export default createChatRouter;
