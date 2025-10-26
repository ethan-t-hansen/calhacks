import { ChatMessage } from "../completion/types";

interface YjsDocumentState {
    type: "yjs_state";
    document_id: string;
    state_vector: Uint8Array;
    update: Uint8Array;
    timestamp: string; // ISO 8601
}

export interface DocumentState {
    yjs_state: YjsDocumentState;
    message_log: { role: string; message: string }[];
    user_to_message: { [key: string]: ChatMessage[] };
    active_users: number;
    is_dirty: boolean;
}
