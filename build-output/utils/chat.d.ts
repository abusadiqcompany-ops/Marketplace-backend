export interface ChatMessagePayload {
    id?: string;
    chatId: string;
    senderId: string;
    senderName: string;
    content: string;
    image?: string;
    timestamp?: string;
}
export interface ChatMessageRecord extends ChatMessagePayload {
    id: string;
    timestamp: string;
}
export declare function deriveChatId(userA: string, userB: string, listingId?: string): string;
export declare function createChatMessage(payload: ChatMessagePayload): ChatMessageRecord;
//# sourceMappingURL=chat.d.ts.map