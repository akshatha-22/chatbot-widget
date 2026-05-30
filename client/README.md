# Chatbot Widget Client

React-based frontend for the Floating Chatbot Widget.

## Structure

```
src/
├── components/
│   ├── ChatbotWidget/       # Main widget components
│   ├── ui/                  # Reusable UI components
│   └── icons/               # SVG icon components
├── styles/                  # Design tokens and global styles
├── hooks/                   # Custom React hooks
└── main.tsx                 # Entry point

public/
└── designs/                 # Link to design files
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts the development server at `http://localhost:5173`

### Build

```bash
npm run build
```

Creates optimized production build in `dist/` directory.

### Type Checking

```bash
npm run type-check
```

## Components

### ChatbotWidget
- `FloatingWidget` - Main floating button and widget container
- `CompactWidget` - Minimized widget state
- `ExpandedWidget` - Full chat interface
- `ChatInterface` - Message display and input
- `Dashboard` - Admin interface
- `FilePanel` - File management

### UI Components
- `Button` - Action button
- `Input` - Text input field
- `MessageBubble` - Chat message display
- `FileUpload` - File upload component

### Icons
- `SendIcon` - Send message icon
- `UploadIcon` - Upload file icon
- `EditIcon` - Edit/edit icon
- `CopyIcon` - Copy to clipboard icon
- `CloseIcon` - Close/dismiss icon

## Styles

Design tokens and styles are defined in `src/styles/`:
- `design-tokens.ts` - Design system tokens
- `colors.ts` - Color palette
- `typography.ts` - Font sizes and weights
- `spacing.ts` - Spacing scale
- `animations.ts` - Animation definitions

## Hooks

Custom hooks for common functionality:
- `useWidget` - Widget state and lifecycle
- `useChat` - Chat message management
- `useFileUpload` - File upload handling

## Environment Variables

Variables use the **repo root** `.env.local` (Vite is configured with `envDir: '..'`, so it does not load a separate file under `client/`). Copy from the root `.env.example` if needed.

Example:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## Building for Production

```bash
npm run build
```

The `dist/` directory contains the production-ready bundle.
