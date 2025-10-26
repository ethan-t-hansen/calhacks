import { Request, Response } from "express";
import { createCompletion } from "../prompt";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function chat(req: Request, res: Response) {
    const { messages } = req.body as { messages: ChatCompletionMessageParam[] };

    try {
        const response = await createCompletion(messages);
        res.json({
            message: response.message,
            formatted: response.formatted
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to get completion" });
    }
}
