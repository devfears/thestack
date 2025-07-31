// Main component
export { default as ThreeScene } from './ThreeScene';

// Game Manager
export { GameManager } from './GameManager';

// Systems
export { SceneSystemManager } from '../scene/SceneSystem';
export { PhysicsSystemManager } from '../character/PhysicsSystem';
export { AnimationSystemManager } from '../character/AnimationSystem';
export { InputSystemManager } from '../input/InputSystem';
export { WaterSystemManager } from '../scene/WaterSystem';
export { ModelLoaderManager } from '../scene/ModelLoader';
export { UnifiedBrickSystem } from '../building';

// Hooks
export { useGame } from './useGame';

// Utils
export * from './constants';
export * from './types';
