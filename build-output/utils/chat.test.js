import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatMessage, deriveChatId } from './chat.js';
test('deriveChatId stays consistent for the same participants regardless of order', () => {
    assert.equal(deriveChatId('seller-2', 'buyer-1', 'listing-9'), 'buyer-1-seller-2-listing-9');
    assert.equal(deriveChatId('buyer-1', 'seller-2', 'listing-9'), 'buyer-1-seller-2-listing-9');
});
test('deriveChatId omits the listing suffix when no listing is provided', () => {
    assert.equal(deriveChatId('buyer-1', 'seller-2'), 'buyer-1-seller-2');
});
test('createChatMessage preserves image attachments', () => {
    const message = createChatMessage({
        chatId: 'buyer-1-seller-2-listing-9',
        senderId: 'buyer-1',
        senderName: 'Buyer One',
        content: '',
        image: 'data:image/png;base64,aaa',
    });
    assert.equal(message.image, 'data:image/png;base64,aaa');
    assert.equal(message.content, '');
});
//# sourceMappingURL=chat.test.js.map