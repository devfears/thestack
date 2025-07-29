# Farcaster Multiplayer Game - Monorepo

This is a monorepo containing both the frontend and backend for the Farcaster multiplayer game.

## Project Structure

```
├── babs/                    # Frontend React application
├── multiplayer-server/      # Backend Node.js server
└── package.json            # Root package.json for monorepo
```

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

1. Install all dependencies for both frontend and backend:
```bash
npm run install:all
```

Or install individually:
```bash
npm install              # Root dependencies
npm run install:client   # Frontend dependencies
npm run install:server   # Backend dependencies
```

### Development

Run both frontend and backend simultaneously:
```bash
npm run dev
```

This will start:
- Frontend on http://localhost:5174 (or next available port)
- Backend on http://localhost:3001

### Individual Commands

Run only the frontend:
```bash
npm run dev:client
```

Run only the backend:
```bash
npm run dev:server
```

### Production

Build the frontend:
```bash
npm run build
```

Start production servers:
```bash
npm start
```

## Features

- **Monorepo Setup**: Both frontend and backend in a single repository
- **Concurrent Development**: Run both services with a single command
- **Workspace Management**: Uses npm workspaces for dependency management
- **Multiplayer Game**: Real-time multiplayer functionality with Socket.IO
- **Farcaster Integration**: Built for Farcaster frames and miniapps

## Technology Stack

### Frontend (babs/)
- React + TypeScript
- Vite
- Three.js for 3D graphics
- Socket.IO client for real-time communication
- Farcaster SDK integration

### Backend (multiplayer-server/)
- Node.js + Express
- Socket.IO for real-time communication
- CORS enabled for cross-origin requests

## Development Notes

- The frontend automatically connects to the backend on port 3001
- Hot reloading is enabled for both frontend and backend
- CORS is configured to allow connections from common development ports
- The multiplayer server handles player connections, movements, and game state