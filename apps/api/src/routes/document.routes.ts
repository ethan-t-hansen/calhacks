import { Router } from "express";
import * as documentController from "../controllers/document.controller";

export function createDocumentRouter(): Router {
    const router = Router();

    router.get("/:documentId/suggestions", documentController.getSuggestions);

    router.get("/:documentId/chat", documentController.getChatMessages);

    router.get("/:documentId/threads", documentController.getThreads);

    router.get("/:documentId/activity", documentController.getActivity);

    return router;
}
