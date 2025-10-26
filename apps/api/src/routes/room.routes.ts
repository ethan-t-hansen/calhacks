import { Router } from "express";
import * as roomController from "../controllers/room.controller";

export function createRoomRouter(): Router {
    const router = Router();

    router.get("/:documentId", roomController.getRoom);

    router.get("/", roomController.getRooms);

    return router;
}
