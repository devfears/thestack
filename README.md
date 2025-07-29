# The Stack - Farcaster 3D Tower Building Game

A collaborative 3D tower building game built for the Farcaster ecosystem. Players can build together in real-time using colorful blocks in a shared 3D environment.

## 🎮 Features

- **3D Building System**: Layer-based construction with grid snapping
- **Multiplayer Support**: Real-time collaboration with WebSocket synchronization
- **Character System**: Animated 3D characters with physics and movement
- **Mobile-Friendly**: Touch controls and responsive design
- **Performance Optimized**: InstancedMesh rendering for thousands of blocks
- **Visual Feedback**: Ghost brick preview, boundary detection, and progress tracking
- **Random Colors**: 12-color palette for vibrant building creations

## 🏗️ Project Structure

```
├── babs/                    # Frontend React + Three.js application
│   ├── src/game/           # Core game systems
│   ├── public/assets/      # 3D models and textures
│   └── src/components/     # React components
├── multiplayer-server/      # Node.js WebSocket server
├── test-*.js               # Testing and debugging scripts
└── *.md                    # Documentation files
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

1. **Frontend Development** (Main Game):
```bash
cd babs
npm install
npm run dev
```
Game will be available at http://localhost:5176

2. **Multiplayer Server** (Optional):
```bash
cd multiplayer-server
npm install
node index.js
```
Server runs on http://localhost:3001

3. **Full Stack Development**:
```bash
npm run install:all  # Install all dependencies
npm run dev          # Run both frontend and backend
```

## 🎮 How to Play

1. **Movement**: Use WASD keys or touch controls to move your character
2. **Pickup Bricks**: Press E near the brick pile to pick up a colored brick
3. **Place Bricks**: Press B to place bricks and build your tower
4. **Building**: Bricks snap to a grid system for organized construction
5. **Multiplayer**: Other players appear as characters in your world

## 🛠️ Game Systems

### Core Systems
- **UnifiedBrickSystem**: Handles brick placement, pickup, and physics
- **AnimationSystem**: Character animations and movement
- **PhysicsSystem**: Collision detection and character physics
- **MultiplayerCore**: Real-time synchronization between players
- **SceneSystem**: 3D world rendering and lighting

### Building Features
- **Grid Snapping**: Blocks automatically align to a construction grid
- **Ghost Brick Preview**: See where your brick will be placed
- **Random Colors**: Each brick gets a random color from 12 vibrant options
- **Performance Optimization**: InstancedMesh rendering for thousands of blocks
- **Layer System**: Build layer by layer with completion tracking

## 🔧 Technology Stack

### Frontend (babs/)
- **React 18** + **TypeScript** - Modern UI framework
- **Three.js** - 3D graphics and rendering
- **Vite** - Fast development and building
- **WebSocket** - Real-time multiplayer communication
- **Farcaster SDK** - Frame integration

### Backend (multiplayer-server/)
- **Node.js** + **Express** - Server runtime
- **Colyseus** - Multiplayer game server framework
- **WebSocket** - Real-time communication
- Socket.IO for real-time communication
- CORS enabled for cross-origin requests

## Development Notes

- The frontend automatically connects to the backend on port 3001
- Hot reloading is enabled for both frontend and backend
- CORS is configured to allow connections from common development ports
- The multiplayer server handles player connections, movements, and game state