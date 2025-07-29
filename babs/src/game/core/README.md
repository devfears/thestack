# Farcaster 3D Game Architecture

This directory contains the refactored, modular architecture for the Farcaster 3D mini-app game.

## 🏗️ Architecture Overview

The original 1011-line monolithic `ThreeScene.tsx` has been broken down into focused, maintainable systems:

```
components/three/
├── ThreeScene.tsx          # Main React component (~150 lines)
├── GameManager.ts          # Central game orchestrator
├── index.ts               # Clean module exports
├── hooks/
│   └── useGame.ts         # Custom React hook for game state
├── systems/               # Core game systems
│   ├── SceneSystem.ts     # Scene, camera, renderer setup
│   ├── PhysicsSystem.ts   # Physics, collision, movement
│   ├── AnimationSystem.ts # Character animations
│   ├── InputSystem.ts     # Keyboard input handling
│   ├── WaterSystem.ts     # Water effects and animation
│   ├── ModelLoader.ts     # GLTF model loading
│   └── BuildingSystem.ts  # Building mechanics
└── utils/
    ├── constants.ts       # Game configuration
    └── types.ts          # TypeScript interfaces
```

## 🎮 Systems Breakdown

### GameManager
- **Purpose**: Central orchestrator that manages all game systems
- **Responsibilities**: System initialization, game loop, state coordination
- **Key Methods**: `initialize()`, `update()`, `render()`, `dispose()`

### SceneSystem
- **Purpose**: Three.js scene setup and rendering
- **Responsibilities**: Scene, camera, renderer, lighting, resize handling
- **Features**: Optimized rendering, proper color space handling, shadow mapping

### PhysicsSystem
- **Purpose**: Game physics and collision detection
- **Responsibilities**: Jump physics, ground detection, collision checking, movement
- **Features**: Smooth character movement, terrain following, jump mechanics

### AnimationSystem
- **Purpose**: Character animation management
- **Responsibilities**: Animation state transitions, mixer updates, action blending
- **Features**: Smooth transitions, jump animation handling, pickup animations

### InputSystem
- **Purpose**: User input processing
- **Responsibilities**: Keyboard event handling, movement processing
- **Features**: Responsive controls, key mapping, action triggers

### WaterSystem
- **Purpose**: Water effects and animation
- **Responsibilities**: Wave animation, performance optimization
- **Features**: Realistic water waves, optimized updates (30fps)

### ModelLoader
- **Purpose**: 3D model loading and setup
- **Responsibilities**: GLTF loading, material setup, shadow configuration
- **Features**: Async loading, error handling, proper material assignment

### BuildingSystem
- **Purpose**: Building mechanics and brick management
- **Responsibilities**: Brick pickup/placement, platform bounds, inventory
- **Features**: Ghost brick preview, platform validation, carry animations

## 🔧 Key Features Preserved

- ✅ Character movement and controls (arrow keys, shift to run)
- ✅ Jump physics with proper landing detection
- ✅ Brick pickup and carrying system
- ✅ Building platform with boundary validation
- ✅ Water animation and environmental effects
- ✅ Farcaster authentication integration
- ✅ Camera follow system
- ✅ All original animations and interactions

## 🚀 Benefits of New Architecture

### Maintainability
- **Single Responsibility**: Each system has one clear purpose
- **Focused Files**: Easy to locate and modify specific functionality
- **Clear Dependencies**: Well-defined interfaces between systems

### Debuggability
- **Isolated Systems**: Debug physics separately from rendering
- **Clear State Management**: Game state is centralized and typed
- **System-Specific Logging**: Each system can log independently

### Performance
- **Optimized Updates**: Systems only update when needed
- **Efficient Resource Management**: Proper disposal and cleanup
- **Reduced Memory Footprint**: Better object pooling and reuse

### Extensibility
- **Plugin Architecture**: Easy to add new systems
- **Modular Design**: Systems can be swapped or enhanced
- **Type Safety**: Full TypeScript support with proper interfaces

## 🎯 Usage

### Basic Usage
```tsx
import { ThreeScene } from './components/three';

function App() {
  return <ThreeScene />;
}
```

### Advanced Usage with Game Manager
```tsx
import { useGame } from './game/core/useGame';

function GameComponent() {
  const { mountRef, gameManager, isLoading, actions } = useGame();
  
  // Access game actions
  const handlePickup = () => actions.pickupBrick();
  const handleBuild = () => actions.toggleBuildMode();
  
  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
  );
}
```

## 🔧 Configuration

Game settings can be easily modified in `utils/constants.ts`:

```typescript
export const CHARACTER_CONFIG = {
  SPEED: 0.1,           // Walking speed
  RUN_SPEED: 0.2,       // Running speed
  JUMP_FORCE: 0.18,     // Jump strength
  GRAVITY: -0.012,      // Gravity force
};
```

## 🧪 Testing Individual Systems

Each system can be tested independently:

```typescript
// Test physics system
const physics = new PhysicsSystemManager();
const canMove = physics.moveCharacter(character, 'forward', 0.1, obstacles);

// Test animation system
const animations = new AnimationSystemManager();
animations.fadeToAction(walkAction);
```

## 🔄 Migration Notes

The refactored code maintains 100% compatibility with the original functionality while providing:
- Better error handling and debugging
- Improved performance through system optimization
- Cleaner code organization
- Enhanced maintainability

All original game mechanics, controls, and features remain exactly the same from the user's perspective.
