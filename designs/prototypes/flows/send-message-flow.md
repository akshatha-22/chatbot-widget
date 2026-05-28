# Send Message Flow

## User Flow: Sending a Message

### Steps

1. **User enters message**
   - Types in message input field
   - Character count optional (max 5000)
   - Send button becomes active if text is entered

2. **User sends message**
   - Click send button or press Ctrl+Enter
   - Message appears immediately in chat
   - Message marked as "sending" state

3. **Message processing**
   - Loading indicator in chat
   - User can continue typing (messages queue)
   - Typing indicator shows AI is responding

4. **Response received**
   - AI response appears in chat
   - Message marked as "sent"
   - New message input field ready

## States

- **Idle**: Input field empty, send button disabled
- **Typing**: User typing, send button enabled
- **Sending**: Message submitted, loading state
- **Sent**: Message delivered
- **Error**: Failed to send, retry option

## Error Handling

- Network error: Show retry button
- Server error: Show user-friendly message
- Rate limit: Inform user to wait
- Timeout: After 30s, show retry option

## Keyboard Shortcuts

- **Ctrl+Enter** (or Cmd+Enter on Mac): Send message
- **Shift+Tab**: Move to file upload
- **Tab**: Navigate controls
