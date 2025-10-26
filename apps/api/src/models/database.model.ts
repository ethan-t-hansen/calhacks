import { neon } from "@neondatabase/serverless";
import {
    StorageInterface,
    YjsDocumentState,
    YjsUpdate,
    Suggestion,
    ChatMessage,
    SideChatMessage,
    SideChatThread,
    ActivityLogEntry
} from "../types";

let dbInstance: ReturnType<typeof neon>;

export function initializeDatabase(connectionString: string) {
    if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is required");
    }
    dbInstance = neon(connectionString);
    return dbInstance;
}

export function getDatabase() {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call initializeDatabase first.");
    }
    return dbInstance;
}

export async function saveYjsUpdate(update: YjsUpdate): Promise<void> {
    const db = getDatabase();
    await db`
        INSERT INTO yjs_updates (document_id, user_id, update_data, timestamp)
        VALUES (${update.document_id}, ${update.user_id}, ${update.update}, ${update.timestamp})
    `;
}

export async function saveSuggestion(suggestion: Suggestion): Promise<void> {
    const db = getDatabase();
    await db`
        INSERT INTO suggestions (
            id, document_id, user_id, timestamp, suggestion, 
            target_range_anchor, target_range_head, target_text, 
            status, resolved_by, resolved_at
        )
        VALUES (
            ${suggestion.id}, ${suggestion.document_id}, ${suggestion.user_id}, 
            ${suggestion.timestamp}, ${suggestion.suggestion},
            ${suggestion.target_range.anchor}, ${suggestion.target_range.head}, 
            ${suggestion.target_text}, ${suggestion.status}, 
            ${suggestion.resolved_by}, ${suggestion.resolved_at}
        )
    `;
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
    const db = getDatabase();
    await db`
        INSERT INTO chat_messages (id, document_id, user_id, timestamp, message, reply_to, thread_id)
        VALUES (${message.id}, ${message.document_id}, ${message.user_id}, ${message.timestamp}, ${message.message}, ${message.reply_to}, ${message.thread_id})
    `;
}

export async function saveSideChatMessage(message: SideChatMessage): Promise<void> {
    const db = getDatabase();
    await db`
        INSERT INTO side_chat_messages (id, thread_id, document_id, user_id, timestamp, message)
        VALUES (${message.id}, ${message.thread_id}, ${message.document_id}, ${message.user_id}, ${message.timestamp}, ${message.message})
    `;
}

export async function saveYjsDocumentState(state: YjsDocumentState): Promise<void> {
    const db = getDatabase();
    await db`
        INSERT INTO yjs_document_states (document_id, state_vector, update_data, timestamp)
        VALUES (${state.document_id}, ${state.state_vector}, ${state.update}, ${state.timestamp})
        ON CONFLICT (document_id) 
        DO UPDATE SET 
            state_vector = EXCLUDED.state_vector,
            update_data = EXCLUDED.update_data,
            timestamp = EXCLUDED.timestamp
    `;
}

export async function saveSideChatThread(thread: SideChatThread): Promise<void> {
    const db = getDatabase();
    await db`
        INSERT INTO side_chat_threads (id, document_id, created_by, timestamp, title, anchor_position, anchor_text, resolved)
        VALUES (${thread.id}, ${thread.document_id}, ${thread.created_by}, ${thread.timestamp}, ${thread.title}, ${thread.anchor_position}, ${thread.anchor_text}, ${thread.resolved})
    `;
}

export async function saveActivityLog(entry: ActivityLogEntry): Promise<void> {
    const db = getDatabase();
    await db`
        INSERT INTO activity_logs (id, document_id, user_id, timestamp, activity_type, metadata)
        VALUES (${entry.id}, ${entry.document_id}, ${entry.user_id}, ${entry.timestamp}, ${entry.activity_type}, ${JSON.stringify(entry.metadata)})
    `;
}

export async function getYjsUpdates(documentId: string, since?: Uint8Array): Promise<YjsUpdate[]> {
    const db = getDatabase();
    const results = since
        ? await db`
            SELECT document_id, user_id, update_data, timestamp
            FROM yjs_updates 
            WHERE document_id = ${documentId} 
            AND timestamp > (SELECT timestamp FROM yjs_updates WHERE state_vector = ${since} LIMIT 1)
            ORDER BY timestamp ASC
        `
        : await db`
            SELECT document_id, user_id, update_data, timestamp
            FROM yjs_updates 
            WHERE document_id = ${documentId}
            ORDER BY timestamp ASC
        `;

    return (results as any[]).map((row: any) => ({
        type: "yjs_update" as const,
        document_id: row.document_id,
        user_id: row.user_id,
        update: row.update_data,
        timestamp: row.timestamp
    }));
}

export async function getSuggestions(documentId: string, status?: string): Promise<Suggestion[]> {
    const db = getDatabase();
    const results = status
        ? await db`
            SELECT id, document_id, user_id, timestamp, suggestion, 
                   target_range_anchor, target_range_head, target_text, 
                   status, resolved_by, resolved_at
            FROM suggestions 
            WHERE document_id = ${documentId} AND status = ${status}
            ORDER BY timestamp DESC
        `
        : await db`
            SELECT id, document_id, user_id, timestamp, suggestion, 
                   target_range_anchor, target_range_head, target_text, 
                   status, resolved_by, resolved_at
            FROM suggestions 
            WHERE document_id = ${documentId}
            ORDER BY timestamp DESC
        `;

    return (results as any[]).map((row: any) => ({
        type: "suggest" as const,
        id: row.id,
        document_id: row.document_id,
        user_id: row.user_id,
        timestamp: row.timestamp,
        suggestion: row.suggestion,
        target_range: {
            anchor: row.target_range_anchor,
            head: row.target_range_head
        },
        target_text: row.target_text,
        status: row.status,
        resolved_by: row.resolved_by,
        resolved_at: row.resolved_at
    }));
}

export async function getChatMessages(documentId: string, threadId?: string): Promise<ChatMessage[]> {
    const db = getDatabase();
    const results = threadId
        ? await db`
            SELECT id, document_id, user_id, timestamp, message, reply_to, thread_id
            FROM chat_messages 
            WHERE document_id = ${documentId} AND thread_id = ${threadId}
            ORDER BY timestamp ASC
        `
        : await db`
            SELECT id, document_id, user_id, timestamp, message, reply_to, thread_id
            FROM chat_messages 
            WHERE document_id = ${documentId}
            ORDER BY timestamp ASC
        `;

    return (results as any[]).map((row: any) => ({
        type: "chat" as const,
        id: row.id,
        document_id: row.document_id,
        user_id: row.user_id,
        timestamp: row.timestamp,
        message: row.message,
        reply_to: row.reply_to,
        thread_id: row.thread_id
    }));
}

export async function getSideChatThreads(documentId: string): Promise<SideChatThread[]> {
    const db = getDatabase();
    const results = await db`
        SELECT id, document_id, created_by, timestamp, title, anchor_position, anchor_text, resolved
        FROM side_chat_threads 
        WHERE document_id = ${documentId}
        ORDER BY timestamp DESC
    `;

    return (results as any[]).map((row: any) => ({
        type: "side_chat_thread" as const,
        id: row.id,
        document_id: row.document_id,
        created_by: row.created_by,
        timestamp: row.timestamp,
        title: row.title,
        anchor_position: row.anchor_position,
        anchor_text: row.anchor_text,
        resolved: row.resolved
    }));
}

export async function getActivityLog(documentId: string, limit?: number): Promise<ActivityLogEntry[]> {
    const db = getDatabase();
    const results = limit
        ? await db`
            SELECT id, document_id, user_id, timestamp, activity_type, metadata
            FROM activity_logs 
            WHERE document_id = ${documentId}
            ORDER BY timestamp DESC
            LIMIT ${limit}
        `
        : await db`
            SELECT id, document_id, user_id, timestamp, activity_type, metadata
            FROM activity_logs 
            WHERE document_id = ${documentId}
            ORDER BY timestamp DESC
        `;

    return (results as any[]).map((row: any) => ({
        type: "activity_log" as const,
        id: row.id,
        document_id: row.document_id,
        user_id: row.user_id,
        timestamp: row.timestamp,
        activity_type: row.activity_type,
        metadata: row.metadata
    }));
}

export async function updateSuggestionStatus(
    suggestionId: string,
    status: "accepted" | "rejected",
    resolvedBy: string,
    resolvedAt: string
): Promise<void> {
    const db = getDatabase();
    await db`
        UPDATE suggestions 
        SET status = ${status}, resolved_by = ${resolvedBy}, resolved_at = ${resolvedAt}
        WHERE id = ${suggestionId}
    `;
}
