# Designs Structure

This directory contains all design-related files for the Floating Chatbot Launcher project.

## Directory Structure

```
designs/
├── figma/                    # Figma design files
│   ├── README.md
│   └── DESIGN_TOKENS.json
├── assets/
│   ├── icons/               # SVG icons
│   ├── illustrations/       # Illustration assets
│   └── screenshots/         # UI screenshots
├── prototypes/
│   ├── flows/              # User interaction flows
│   └── wireframes/         # Layout wireframes
└── documentation/
    ├── design-system.md
    ├── component-specs.md
    └── accessibility-guide.md
```

## Quick Links

- [Design System](./documentation/design-system.md) - Core design principles and tokens
- [Component Specifications](./documentation/component-specs.md) - Detailed component docs
- [Accessibility Guide](./documentation/accessibility-guide.md) - WCAG compliance info
- [Design Tokens](./figma/DESIGN_TOKENS.json) - JSON format design tokens

## File Organization

### Icons (`assets/icons/`)
SVG icon components used throughout the UI:
- send.svg
- upload.svg
- edit.svg
- copy.svg
- close.svg

### Illustrations (`assets/illustrations/`)
Large illustration assets:
- empty-state.svg
- loading.svg

### Screenshots (`assets/screenshots/`)
UI mockups and screenshots:
- compact-widget.png
- expanded-widget.png
- dashboard.png

### Flows (`prototypes/flows/`)
User interaction documentation:
- open-widget-flow.md
- send-message-flow.md
- upload-file-flow.md

### Wireframes (`prototypes/wireframes/`)
Layout templates:
- mobile-layout.png
- tablet-layout.png
- desktop-layout.png

## Design System Overview

The design system is built on a 4px base unit with:
- **Colors**: Primary blues, neutral grays, and semantic colors
- **Typography**: Consistent font sizes and weights
- **Spacing**: 4px-based spacing scale
- **Components**: Reusable UI building blocks

See [design-system.md](./documentation/design-system.md) for complete documentation.
