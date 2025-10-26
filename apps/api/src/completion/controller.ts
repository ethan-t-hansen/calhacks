import { Request, Response } from "express";
import * as Y from "yjs";
import { createStreamingCompletion } from "../utils/prompt";
import { room_state } from "../room/controller";
import { neonDAO } from "../database/neon";
import { Socket } from "socket.io";
import { createDocumentState } from "../document/document";
import { ChatMessage } from "./types";
import { request } from "http";
import { DocumentState, YjsDocumentState } from "../document/types";

interface SuggestRequest {
    doc_id: string;
    user_id: string;
    prompt: string;
    context: string;
}

export async function updateSuggestionStatus(req: Request, res: Response) {
    const { suggestionId } = req.params;
    const { status } = req.body;

    if (!["pending", "accepted", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        await neonDAO.query(
            (sql) => sql`
            UPDATE suggestions 
            SET status=${status}
            WHERE id=${suggestionId}
        `
        );

        return res.json({ success: true });
    } catch (error) {
        console.error("Error updating suggestion status:", error);
        return res.status(500).json({ error: "Failed to update suggestion" });
    }
}

export async function handleChatStream(
    socket: Socket,
    data: {
        doc_id: string;
        user_id: string;
        request_completion: boolean;
        message: string;
        position?: { range: { head: number; anchor: number } };
    }
) {
    const { doc_id, user_id, request_completion, message, position } = data;

    console.log(data);

    if (!doc_id || !user_id || !message || (position && (!position.range || !position.range.anchor || !position.range.anchor))) {
        socket.emit("error", "invalid syntax encountered");
        return false;
    }

    let document = room_state.documents[doc_id];
    socket.to(doc_id).emit("chat", data);

    if (!document) {
        const persistedDoc = await neonDAO.one((sql) => sql`SELECT * FROM yjs_document_states WHERE document_id=${doc_id}`);
        const messages = (await neonDAO.many(
            (sql) => sql`SELECT * FROM chat_messages WHERE document_id=${doc_id} ORDER BY timestamp DESC`
        )) as ChatMessage[];

        console.log("parsing messages");
        const user_to_message: { [userId: string]: number[] } = {};
        const message_log: ChatMessage[] = [];

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i] as ChatMessage;
            message_log.push(msg);
            const messageIndex = message_log.length - 1;

            if (msg.user_id != "ai") {
                if (!user_to_message[msg.user_id]) {
                    user_to_message[msg.user_id] = [messageIndex];
                } else {
                    user_to_message[msg.user_id]!.push(messageIndex);
                }
            } else {
                const replyToUser = msg.reply_to ?? "";
                if (!user_to_message[replyToUser]) {
                    user_to_message[replyToUser] = [messageIndex];
                } else {
                    user_to_message[replyToUser]!.push(messageIndex);
                }
            }
        }

        console.log("succeeded at parsing messages");
        document = createDocumentState({
            document_id: doc_id,
            ...(persistedDoc && { state_vector: persistedDoc.state_vector }),
            message_log,
            user_to_message
        });
    }

    console.log("handleChatStream - doc_id:", doc_id, "user_id:", user_id, "message:", message, "data:", data);

    try {
        await neonDAO.query(
            (sql) => sql`
                INSERT INTO chat_messages (
                    document_id, user_id, timestamp, message
                ) VALUES (
                    ${doc_id},
                    ${user_id},
                    NOW(),
                    ${message}
                )
            `
        );
    } catch (error) {
        console.log("we hit an error here!");
        console.error(error);
    }

    if (request_completion) {
        const ydoc = new Y.Doc();
        if (document.yjs_state.update && document.yjs_state.update.length > 0) {
            Y.applyUpdate(ydoc, new Uint8Array(document.yjs_state.update));
        }
        const ytext = ydoc.getText("content");
        const documentContent = ytext.toString();

        const userMessages = document.user_to_message[user_id]
            ?.map((idx: number) => {
                const msg = messages?.[idx];
                if (!msg) return "";
                if ("user_id" in msg && "message" in msg) {
                    return `from:${msg.user_id} content:${msg.message ?? ""}`;
                }
                return "";
            })
            .join("\n");
        const systemPrompt = buildChatSystemPrompt(documentContent + userMessages, "Not Applicable: Whole Document", message);
        const messages = [{ role: "system" as const, content: systemPrompt }];

        const stamp = Date.now().toString();

        (async () => {
            let fullSuggestion = "";
            for await (const chunk of createStreamingCompletion(messages)) {
                fullSuggestion += chunk;
                socket.server.to(doc_id).emit("chunk", { key: `${user_id}:${stamp}`, data: chunk });
            }

            console.log(fullSuggestion);

            await neonDAO.query(
                (sql) => sql`
            INSERT INTO chat_messages (
                document_id, user_id, timestamp, message, reply_to
                ) VALUES (
                    ${doc_id},
                    'ai',
                    NOW(),
                    ${fullSuggestion},
                    ${user_id}
                    )
                    `
            );
        })();
    }
}

export async function handleSuggestStream(req: Request, res: Response) {
    const { doc_id, user_id, prompt, context } = req.body as SuggestRequest;

    if (!doc_id || !user_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
        const document = room_state.documents[doc_id];
        let documentContent = "";
        if (document) {
            const ydoc = new Y.Doc();

            if (document.yjs_state.update && document.yjs_state.update.length > 0) {
                Y.applyUpdate(ydoc, new Uint8Array(document.yjs_state.update));
            }

            const ytext = ydoc.getText("content");
            documentContent = ytext.toString();
        } else {
            const persistedDoc = (await neonDAO.one(
                (sql) => sql`SELECT * FROM yjs_document_states WHERE document_id=${doc_id} LIMIT 5`
            )) as YjsDocumentState;

            if (persistedDoc) {
                const ydoc = new Y.Doc();
                if (persistedDoc.update && persistedDoc.update.length > 0) {
                    Y.applyUpdate(ydoc, new Uint8Array(persistedDoc.update));
                }
                const ytext = ydoc.getText("content");
                documentContent = ytext.toString();
            }
        }

        const systemPrompt = buildSystemPrompt(documentContent, context, prompt);
        const messages = [{ role: "user" as const, content: systemPrompt }];

        let fullSuggestion = "";

        for await (const chunk of createStreamingCompletion(messages)) {
            fullSuggestion += chunk;
            res.write(chunk);
        }

        res.end();
    } catch (error) {
        console.error("Error generating suggestion:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to generate suggestion" });
        } else {
            res.end();
        }
    }
}

function buildSystemPrompt(documentContent: string, targetText: string, userPrompt?: string): string {
    let prompt =
        "You are an expert AI writing coach. Your task is to enhance and clarify the user's document and selection with clear, concise, and impactful language.\n\n";

    if (documentContent) {
        prompt += `Here is the current document:\n${documentContent}\n\n`;
    }

    if (targetText) {
        prompt += `Focus your edit on this selection:\n${targetText}\n\n`;
    }

    if (userPrompt) {
        prompt += `Special instructions or requests from the user:\n${userPrompt}\n\n`;
    }

    prompt +=
        "Respond only with the improved replacement text or edits for the selection above. Do not include commentary or explanations.";

    return prompt;
}

function buildChatSystemPrompt(documentContent: string, targetText: string, userPrompt?: string): string {
    let prompt = "You are Steve Jobs helping your fellow employees. You are not to use emojis, markdown, or em dashes under any circumstance.\n\n";

    if (documentContent) {
        prompt += `Full document content:\n${documentContent}\n\n`;
    }

    if (targetText) {
        prompt += `Selected text to focus on:\n${targetText}\n\n`;
    }

    if (userPrompt) {
        prompt += `User request: ${userPrompt}\n\n`;
    }

    return prompt;
}

export async function getSuggestions(req: Request, res: Response) {
    const { documentId } = req.params;

    try {
        const suggestions = await neonDAO.many(
            (sql) => sql`
            SELECT * FROM suggestions 
            WHERE document_id=${documentId}
            ORDER BY timestamp DESC
        `
        );

        return res.json({ suggestions });
    } catch (error) {
        console.error("Error fetching suggestions:", error);
        return res.status(500).json({ error: "Failed to fetch suggestions" });
    }
}
