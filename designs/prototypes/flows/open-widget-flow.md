# Open Widget Flow

## User Flow: Opening the Floating Widget

### Steps

1. **User sees floating button**
   - Compact widget with icon visible
   - Located in bottom-right corner (default)
   - Icon: Chat bubble or AI icon

2. **User clicks floating button**
   - Widget expands to full chat interface
   - Smooth animation (200-300ms)
   - Focus moves to message input

3. **Chat interface loads**
   - Header with close button
   - Message history displays
   - Message input is ready for typing

4. **User can:**
   - Type and send messages
   - Upload files
   - View conversation history
   - Collapse widget

## Animations

- **Expand**: Scale from 60px to full size
- **Duration**: 250ms ease-out
- **Transition**: Smooth with no jarring movements

## Error Handling

- If chat history fails to load: Show placeholder message
- If widget cannot connect: Show error message with retry option
- Timeout after 5 seconds with fallback state
