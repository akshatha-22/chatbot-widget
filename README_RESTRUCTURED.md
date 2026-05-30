# Root README

Welcome to the **Floating Chatbot Launcher** project! This is a comprehensive web-based chatbot widget with designs, client implementation, and backend services.

## Project Structure

```
chatbot-widget/
├── designs/                    # Design system and prototypes
├── client/                     # React frontend application
├── backend/                    # Python FastAPI backend
├── docker/                     # Docker configurations
├── docs/                       # Documentation
└── scripts/                    # Build and deployment scripts
```

## Quick Start

### Frontend (Client)

```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:5173`

### Design System

```bash
cd designs
# View design documentation in designs/documentation/
```

## Key Directories

### `/designs`
- **figma/** - Figma design files and tokens
- **assets/** - Icons, illustrations, and screenshots
- **prototypes/** - User flows and wireframes
- **documentation/** - Design system guidelines and accessibility

### `/client`
- **src/components/** - React components
- **src/styles/** - Design tokens and styling
- **src/hooks/** - Custom React hooks

### `/backend`
- Python FastAPI application
- REST API endpoints
- Database models and migrations

## Documentation

See the [designs documentation](./designs/documentation/design-system.md) for the complete design system.

See the [client README](./client/README.md) for frontend setup instructions.

## Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker & Docker Compose (optional)

### Environment Setup

1. Clone the repository
2. Install dependencies:
   - Frontend: `cd client && npm install`
   - Backend: `cd backend && pip install -r requirements.txt`

3. Start development servers:
   - Frontend: `npm run dev` (from client directory)
   - Backend: `python main.py` (from backend directory)

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

See [LICENSE](./LICENSE) file for details.

## Support

For issues and questions, please refer to the [troubleshooting guide](./docs/11_troubleshooting.md).
