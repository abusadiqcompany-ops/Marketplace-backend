import { v4 as uuidv4 } from 'uuid';
export function deriveChatId(userA, userB, listingId) {
    const [first, second] = [userA, userB].sort();
    return listingId ? `${first}-${second}-${listingId}` : `${first}-${second}`;
}
export function createChatMessage(payload) {
    return {
        id: payload.id || `msg-${uuidv4()}`,
        chatId: payload.chatId,
        senderId: payload.senderId,
        senderName: payload.senderName,
        content: payload.content,
        timestamp: payload.timestamp || new Date().toISOString(),
    };
}
//# sourceMappingURL=chat.js.map