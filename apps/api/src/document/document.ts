import { ChatMessage } from "../completion/types";
import { DocumentState } from "./types";

export function createDocumentState(params: {
    document_id: string;
    state_vector?: Uint8Array;
    update?: Uint8Array;
    message_log?: ChatMessage[];
    user_to_message?: { [key: string]: number[] };
}): DocumentState {
    return {
        yjs_state: {
            type: "yjs_state",
            document_id: params.document_id,
            state_vector: params.state_vector ?? new Uint8Array(),
            update: params.update ?? new Uint8Array(),
            timestamp: Date.now().toString()
        },
        message_log: params.message_log || [],
        user_to_message: params.user_to_message || {},
        active_users: 0,
        connected_users: new Map(),
        is_dirty: false
    };
}
