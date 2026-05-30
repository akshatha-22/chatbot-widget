# Component Specifications

## Core Components

### FloatingWidget
The main floating widget component that appears on the page.

**States:**
- Compact: Minimized state
- Expanded: Full chat interface
- Loading: Data fetching state

**Interactions:**
- Click to expand/collapse
- Drag to reposition (optional)
- Close button to hide

### ChatInterface
Main chat message interface component.

**Features:**
- Message display
- Message input
- File upload
- Typing indicators

### Dashboard
Administrative dashboard for widget management.

**Sections:**
- Analytics
- Settings
- Conversation history
- Widget configuration

### FilePanel
File management interface.

**Actions:**
- Upload files
- View file list
- Delete files
- Preview files

## UI Components

See the `ui/` directory for individual component specifications.

## Component Hierarchy

```
FloatingWidget
├── CompactWidget
├── ExpandedWidget
└── ChatInterface
    ├── MessageBubble
    ├── FilePanel
    ├── Input
    └── Button
```
