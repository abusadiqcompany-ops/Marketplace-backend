import { v4 as uuidv4 } from 'uuid';

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

export function deriveChatId(userA: string, userB: string, listingId?: string): string {
  const [first, second] = [userA, userB].sort();
  return listingId ? `${first}-${second}-${listingId}` : `${first}-${second}`;
}

export function createChatMessage(payload: ChatMessagePayload): ChatMessageRecord {
  return {
    id: payload.id || `msg-${uuidv4()}`,
    chatId: payload.chatId,
    senderId: payload.senderId,
    senderName: payload.senderName,
    content: payload.content,
    image: payload.image,
    timestamp: payload.timestamp || new Date().toISOString(),
  };
}
