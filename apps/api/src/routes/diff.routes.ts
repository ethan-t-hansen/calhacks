import { Router } from "express";
import { Server } from "socket.io";
import * as diffController from "../controllers/diff.controller";

export function createDiffRouter(io: Server): Router {
    const router = Router();

    router.post("/accept", (req, res) => diffController.acceptDiff(req, res, io));

    router.post("/reject", (req, res) => diffController.rejectDiff(req, res, io));

    return router;
}
