export interface ChatMessage {
    document_id: string;
    user_id: string;
    timestamp: string;
    message: string;
    reply_to?: string;
}
