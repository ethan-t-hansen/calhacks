import { ChatMessage } from "../completion/types";

export interface YjsDocumentState {
    type: "yjs_state";
    document_id: string;
    state_vector: Uint8Array;
    update: Uint8Array;
    timestamp: string; // ISO 8601
}

export interface DocumentState {
    yjs_state: YjsDocumentState;
    message_log: ChatMessage[];
    user_to_message: { [key: string]: number[] };
    active_users: number;
    is_dirty: boolean;
    connected_users?: Map<string, {user_id: string}>;
}
