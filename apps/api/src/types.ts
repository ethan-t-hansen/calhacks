// TypeScript types matching the data schema

// ============================================================================
// PERSISTENCE TYPES (Red)
// ============================================================================

export interface YjsDocumentState {
    type: "yjs_state";
    document_id: string;
    state_vector: Uint8Array;
    update: Uint8Array;
    timestamp: string; // ISO 8601
}

export interface YjsUpdate {
    type: "yjs_update";
    document_id: string;
    user_id: string;
    update: Uint8Array;
    timestamp: string; // ISO 8601
}

export interface Suggestion {
    type: "suggest";
    id: string;
    document_id: string;
    user_id: string;
    timestamp: string; // ISO 8601
    suggestion: string;
    target_range: {
        anchor: number;
        head: number;
    };
    target_text: string;
    status: "pending" | "accepted" | "rejected";
    resolved_by: string | null;
    resolved_at: string | null; // ISO 8601
}

export interface ChatMessage {
    type: "chat";
    id: string;
    document_id: string;
    user_id: string;
    timestamp: string; // ISO 8601
    message: string;
    reply_to: string | null;
    thread_id: string | null;
}

export interface SideChatThread {
    type: "side_chat_thread";
    id: string;
    document_id: string;
    created_by: string;
    timestamp: string; // ISO 8601
    title: string;
    anchor_position: number;
    anchor_text: string;
    resolved: boolean;
}

export interface SideChatMessage {
    type: "side_chat_message";
    id: string;
    thread_id: string;
    document_id: string;
    user_id: string;
    timestamp: string; // ISO 8601
    message: string;
}

export interface ActivityLogEntry {
    type: "activity_log";
    id: string;
    document_id: string;
    user_id: string;
    timestamp: string; // ISO 8601
    activity_type: "edit" | "suggest" | "chat" | "side_chat";
    metadata: Record<string, any>;
}

// ============================================================================
// PROTOCOL TYPES (Green)
// ============================================================================

export interface YjsSyncRequest {
    type: "yjs_sync_request";
    document_id: string;
    user_id: string;
    state_vector: Uint8Array;
}

export interface YjsSyncResponse {
    type: "yjs_sync_response";
    document_id: string;
    update: Uint8Array;
}

export interface Acknowledgment {
    type: "ack";
    message_id: string;
    user_id: string;
    timestamp: string; // ISO 8601
}

// ============================================================================
// EPHEMERAL STATE TYPES (Yellow)
// ============================================================================

export interface UserPresence {
    type: "user_presence";
    document_id: string;
    user_id: string;
    action: "join" | "leave";
    timestamp: string; // ISO 8601
    user_info: {
        name: string;
        color: string;
    };
}

export interface AwarenessUpdate {
    type: "awareness_update";
    document_id: string;
    user_id: string;
    states: Record<
        string,
        {
            cursor?: {
                anchor: number;
                head: number;
            };
            name: string;
            color: string;
        }
    >;
    timestamp: string; // ISO 8601
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

export type WebSocketMessage =
    | YjsDocumentState
    | YjsUpdate
    | YjsSyncRequest
    | YjsSyncResponse
    | Suggestion
    | ChatMessage
    | SideChatThread
    | SideChatMessage
    | UserPresence
    | AwarenessUpdate
    | ActivityLogEntry
    | Acknowledgment;

// ============================================================================
// AI STREAMING TYPES
// ============================================================================

export interface AIStreamStart {
    type: "ai:suggestion:start" | "ai:chat:start";
    request_id: string;
    document_id: string;
    user_id: string;
    timestamp: string;
    context?: {
        selected_text?: string;
        cursor_position?: number;
        range?: { anchor: number; head: number };
    };
}

export interface AIStreamChunk {
    type: "ai:suggestion:chunk" | "ai:chat:chunk";
    request_id: string;
    document_id: string;
    user_id: string;
    chunk: string;
    timestamp: string;
}

export interface AIStreamComplete {
    type: "ai:suggestion:complete" | "ai:chat:complete";
    request_id: string;
    document_id: string;
    user_id: string;
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface SuggestionResolution {
    type: "suggestion:accepted" | "suggestion:rejected";
    suggestion_id: string;
    document_id: string;
    user_id: string;
    timestamp: string;
}

export type AIWebSocketMessage = AIStreamStart | AIStreamChunk | AIStreamComplete | SuggestionResolution;

// ============================================================================
// ROOM MANAGEMENT TYPES
// ============================================================================

export interface RoomUser {
    user_id: string;
    websocket: any; // Socket.IO socket
    user_info: {
        name: string;
        color: string;
    };
    joined_at: string;
    last_seen: string;
}

export interface Room {
    document_id: string;
    users: Map<string, RoomUser>;
    created_at: string;
    last_activity: string;
}

// ============================================================================
// AI REQUEST TYPES
// ============================================================================

export interface AIRequest {
    document_id: string;
    user_id: string;
    request_type: "chat" | "suggestion";
    visibility?: "private" | "shared"; // for chats only
    context?: {
        selected_text?: string;
        cursor_position?: number;
        range?: { anchor: number; head: number };
    };
    prompt: string;
}

export interface AIResponse {
    request_id: string;
    success: boolean;
    content?: string;
    error?: string;
    metadata?: Record<string, any>;
}

// ============================================================================
// STORAGE INTERFACE TYPES
// ============================================================================

export interface StorageInterface {
    // Immediate persistence
    saveYjsUpdate(update: YjsUpdate): Promise<void>;
    saveSuggestion(suggestion: Suggestion): Promise<void>;
    saveChatMessage(message: ChatMessage): Promise<void>;
    saveSideChatMessage(message: SideChatMessage): Promise<void>;

    // Periodic persistence
    saveYjsDocumentState(state: YjsDocumentState): Promise<void>;
    saveSideChatThread(thread: SideChatThread): Promise<void>;
    saveActivityLog(entry: ActivityLogEntry): Promise<void>;

    // Updates
    updateSuggestionStatus(suggestionId: string, status: "accepted" | "rejected", resolvedBy: string, resolvedAt: string): Promise<void>;

    // Queries
    getYjsUpdates(documentId: string, since?: Uint8Array): Promise<YjsUpdate[]>;
    getSuggestions(documentId: string, status?: string): Promise<Suggestion[]>;
    getChatMessages(documentId: string, threadId?: string): Promise<ChatMessage[]>;
    getSideChatThreads(documentId: string): Promise<SideChatThread[]>;
    getActivityLog(documentId: string, limit?: number): Promise<ActivityLogEntry[]>;
}
