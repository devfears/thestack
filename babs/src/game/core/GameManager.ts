
import * as THREE from 'three';
import { GameState, SceneObjects, UserProfile } from './types';
import { SceneSystemManager } from '../scene/SceneSystem';
import { PhysicsSystemManager } from '../character/PhysicsSystem';
import { AnimationSystemManager } from '../character/AnimationSystem';
import { InputSystemManager } from '../input/InputSystem';
import { WaterSystemManager } from '../scene/WaterSystem';
import { ModelLoaderManager } from '../scene/ModelLoader';
import { UnifiedBrickSystem } from '../building/UnifiedBrickSystem';
import { SimpleInteractionSystem } from '../scene/SimpleInteractionSystem';
import { SimpleMultiplayerSystem } from '../systems/multiplayer/SimpleMultiplayerSystem';
import { UIManager } from '../ui/UIManager';
import { LayerProgressUI } from '../ui/LayerProgressUI';

// New manager imports
import { GameLifecycleManager } from './GameLifecycleManager';
import { MultiplayerManager } from './MultiplayerManager';
import { BuildingManager } from './BuildingManager';
import { DebugManager } from './DebugManager';
import { StateManager } from './StateManager';

export class GameManager {
  // Core systems
  private sceneSystem: SceneSystemManager;
  private physicsSystem: PhysicsSystemManager;
  private animationSystem: AnimationSystemManager;
  private inputSystem: InputSystemManager;
  private waterSystem: WaterSystemManager;
  private modelLoader: ModelLoaderManager;
  private brickSystem: UnifiedBrickSystem;
  private multiplayerSystem: SimpleMultiplayerSystem;
  private uiManager: UIManager;
  private layerProgressUI: LayerProgressUI | null = null;
  private gameStarted: boolean = false;

  // New managers
  private lifecycleManager!: GameLifecycleManager;
  private multiplayerManager!: MultiplayerManager;
  private buildingManager!: BuildingManager;
  private debugManager!: DebugManager;
  private stateManager!: StateManager;

  // Game state
  private gameState: GameState;
  private sceneObjects: SceneObjects;
  private clock: THREE.Clock;
  private scene!: THREE.Scene;

  // User profile
  private user: UserProfile | null;

  // Tracking variables for multiplayer
  private lastSentPosition: THREE.Vector3;
  private lastSentRotation: THREE.Euler;
  private lastSentCarryingBrick: boolean;

  // Performance tracking
  private isMobile: boolean;
  private targetFrameTime: number;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;
  private isInitialized: boolean = false;

  // Callbacks
  private onRemotePlayerCountChange: ((count: number) => void) | null = null;

  constructor(
    mountElement: HTMLDivElement,
    user: UserProfile | null,
    onRemotePlayerCountChange: (count: number) => void
  ) {
    this.user = user;
    this.onRemotePlayerCountChange = onRemotePlayerCountChange;
    
    // Initialize tracking variables
    this.lastSentPosition = new THREE.Vector3();
    this.lastSentRotation = new THREE.Euler();
    this.lastSentCarryingBrick = false;
    
    // Detect mobile device and set performance targets
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.targetFrameTime = this.isMobile ? 33.33 : 16.67; // 30 FPS mobile, 60 FPS desktop

    // Initialize game state and scene objects first
    this.gameState = {
      isJumping: false,
      jumpVelocity: 0,
      targetRotation: 0,
      currentRotation: 0,
      rotationDirection: 0,
      isCarryingBrick: false,
      isBuildMode: true,
      cameraFollowEnabled: true, // Enable third-person camera by default
      keysPressed: {},
      lastAnimationState: 'idle',
      animationStateChanged: false,
      joystickData: null,
    };
    this.sceneObjects = {
      character: null,
      mixer: null,
      carriedBrick: null,
      masterBrick: null,
      brickPile: null,
      ghostBrick: null,
      rightHandBone: null,
      water: null,
      solidObjects: [],
      groundObjects: [],
      buildingPlatform: null,
      placedBricks: [],
      camera: null,
    };

    // Initialize systems in the correct order
    this.sceneSystem = new SceneSystemManager(mountElement);
    this.physicsSystem = new PhysicsSystemManager();

    this.animationSystem = new AnimationSystemManager();
    this.waterSystem = new WaterSystemManager(this.sceneSystem.scene);

    // Store camera reference for building system
    this.sceneObjects.camera = this.sceneSystem.camera;
    this.scene = this.sceneSystem.scene;
    this.clock = new THREE.Clock();
    // Initialize simplified multiplayer system
    this.multiplayerSystem = new SimpleMultiplayerSystem(this, this.sceneSystem.scene);

    this.brickSystem = new UnifiedBrickSystem(this.sceneSystem.scene, this.sceneObjects, this.gameState, this.multiplayerSystem, this.animationSystem);
    this.modelLoader = new ModelLoaderManager(
      this.sceneSystem.scene,
      this.sceneObjects,
      this.animationSystem,
      user
    );
    this.inputSystem = new InputSystemManager(
      this.gameState,
      this.physicsSystem,
      this.animationSystem,
      this
    );

    // Initialize interaction system for touch/click interactions
    new SimpleInteractionSystem(
      this.sceneSystem.camera,
      this.sceneSystem.renderer,
      this.sceneObjects,
      this.gameState,
      this
    );

    // Initialize UI manager
    this.uiManager = new UIManager(mountElement);
    this.multiplayerSystem.setOnPlayerCountChange((count) => {
      
      this.onRemotePlayerCountChange?.(count);
      // Also update the LayerProgressUI if it exists
      if (this.layerProgressUI) {
        this.layerProgressUI.updatePlayerCount(count);
      }
    });

    // Note: Simplified multiplayer system handles cleanup automatically

    // Expose global clear function for testing
    this.exposeGlobalClearFunction();

    // Expose brick system debug functions
    (window as any).debugFillCurrentLayer = () => this.brickSystem.debugFillCurrentLayer();
    (window as any).debugNextLayer = () => this.brickSystem.debugNextLayer();
    (window as any).debugClearBricks = () => this.brickSystem.debugClearBricks();

    // Store water reference
    this.sceneObjects.water = this.waterSystem.getMesh();
    if (this.sceneObjects.water) {
      this.sceneObjects.groundObjects.push(this.sceneObjects.water);
    }

    // Initialize the game
    this.init();
    
    // Initialize LayerProgressUI after brick system is ready (but keep it hidden)
    this.layerProgressUI = new LayerProgressUI(this.brickSystem);
    this.layerProgressUI.hide(); // Keep hidden until game starts
    
    // Set initial player count (1 for local player)
    this.layerProgressUI.updatePlayerCount(1);
  }

  public setJoystickData(data: any): void {
    this.gameState.joystickData = data;
  }

  public setNametagVisible(visible: boolean): void {
    // Local player nametag
    this.modelLoader.setNametagVisible(visible);
    // Note: Remote player nametags are handled by SimpleMultiplayerSystem
  }

  public setLocalNametagVisible(visible: boolean): void {
    // Only control local player nametag
    this.modelLoader.setNametagVisible(visible);
  }

  private async init(): Promise<void> {
    try {
      // Initialize new managers
      this.lifecycleManager = new GameLifecycleManager();

       this.multiplayerManager = new MultiplayerManager(
         this.scene,
         this,
         this.onRemotePlayerCountChange!
       );

       this.buildingManager = new BuildingManager(
         this.brickSystem,
         this.multiplayerManager,
         this.gameState,
         this.sceneObjects,
         this.scene
       );

       this.stateManager = new StateManager(
         this.gameState,
         this.sceneObjects,
         this.buildingManager,
         this.multiplayerManager,
         this.brickSystem
       );

       this.debugManager = new DebugManager(
         this.brickSystem,
         this.multiplayerManager,
         this.gameState,
         this.sceneObjects
       );

      // Set user profile in state manager
      if (this.user) {
        this.stateManager.setUserProfile(this.user);
      }

      // Load master brick first to ensure it's available for the building system
      await this.modelLoader.loadMasterBrick();

      // Initialize building system after master brick is loaded
      if (this.sceneObjects.masterBrick) {
        
        this.brickSystem.initializeAfterMasterBrick();
        
      } else {
        
      }

      // Load the rest of the models
      await this.modelLoader.loadCharacter();
      await this.modelLoader.loadBrickPile();
      await this.modelLoader.loadPlatform(this.brickSystem.GRID_SIZE, this.brickSystem.CELL_SIZE);
      
      // Recalculate platform info after platform is loaded
      this.brickSystem.recalculatePlatformInfo();
      
      await this.modelLoader.loadIsland();

      // Wait a moment to ensure character is fully loaded and accessible
      await new Promise(resolve => setTimeout(resolve, 100));

      // Connect to multiplayer if user is provided (after character is loaded)
      if (this.user) {
        try {
          console.log('🔌 Attempting multiplayer connection...');
          const connected = await this.multiplayerSystem.connect(this.user);
          if (connected) {
            console.log('✅ Multiplayer connected successfully');
          } else {
            console.log('⚠️ Multiplayer connection failed, continuing in single-player mode');
          }
        } catch (error) {
          console.error('❌ Multiplayer connection error:', error);
          // Continue with single-player mode if multiplayer fails
        }
      } else {
        console.log('ℹ️ No user provided, running in single-player mode');
      }

      // Expose debug functions globally
        this.debugManager.exposeGlobalDebugFunctions(
          () => this.buildingManager.clearAllBricks(),
          () => this.buildingManager.pickupBrick()
        );

      // Start game loop
      this.lifecycleManager.startGameLoop(() => this.update());

      this.isInitialized = true;

    } catch (error) {
      console.error('❌ Failed to initialize game:', error);
    }
  }

  private startGameLoop(): void {
    // Legacy method - now handled by LifecycleManager
    this.lifecycleManager.startGameLoop(() => this.update());
  }

  private update(): void {
    const deltaTime = this.clock.getDelta();

    // Performance monitoring (minimal)
    this.frameCount++;

    // Update physics
    if (this.sceneObjects.character) {
      this.physicsSystem.updateJumpPhysics(
        this.sceneObjects.character,
        this.gameState,
        this.sceneObjects.groundObjects
      );

      // Update rotation
      this.physicsSystem.updateRotation(this.sceneObjects.character, this.gameState);
    }

    // Process input and movement
    this.inputSystem.processMovement(
      this.sceneObjects.character,
      this.sceneObjects.solidObjects,
      this.sceneObjects.groundObjects,
      deltaTime
    );

    // Update ground position AFTER processing movement (only for Y-axis adjustments)
    if (this.sceneObjects.character && !this.gameState.isJumping) {
      this.physicsSystem.updateGroundPosition(
        this.sceneObjects.character,
        this.sceneObjects.groundObjects,
        this.gameState
      );
    }

    // Update animations
    this.animationSystem.updateAnimations(this.gameState, this.inputSystem);

    // Update new managers
    this.buildingManager.update();
    this.multiplayerManager.update(deltaTime);
    
    // Update simplified multiplayer system
    this.multiplayerSystem.update(deltaTime);
    
    // Send player updates if multiplayer is connected
    if (this.sceneObjects.character && this.multiplayerSystem.isMultiplayerEnabled()) {
      this.multiplayerSystem.sendPlayerUpdate({
        position: this.sceneObjects.character.position,
        rotation: this.sceneObjects.character.rotation,
        isCarryingBrick: this.gameState.isCarryingBrick
      });
    }

    // Update water animation
    this.waterSystem.update();

    // Update camera
    this.sceneSystem.updateCamera(
      this.sceneObjects.character,
      this.gameState.cameraFollowEnabled
    );

    // Render nametags
    this.modelLoader.renderLabels();

    // Render the scene
    this.sceneSystem.render();
  }

  // Public methods for external control
  public toggleCameraFollow(): void {
    this.stateManager.toggleCameraFollow();
  }

  public pickupBrick(): void {
    this.buildingManager.pickupBrick();
  }

  public placeBrick(): boolean {
    return this.buildingManager.placeBrick();
  }

  public toggleBuildMode(): void {
    this.stateManager.toggleBuildMode();
  }

  // Layer management method (NEW)
  public advanceToNextLayer(): boolean {
    // Layers advance automatically in unified system
    return true;
  }

  public canAdvanceLayer(): boolean {
    // Always can advance in unified system
    return true;
  }

  // Reset all bricks for testing
  public resetAllBricks(): void {
    this.brickSystem.clearAllBricks();
  }

  // Clear all bricks (local and network) for a clean slate
  public clearAllBricks(): void {
    this.buildingManager.clearAllBricks();
  }

  // Utility methods
  public getUser(): UserProfile | null {
    return this.stateManager.getUserProfile();
  }

  public setUser(user: UserProfile): void {
    this.stateManager.setUserProfile(user);
  }

  public getGameState(): Readonly<GameState> {
    return { ...this.gameState };
  }

  public getSceneObjects(): Readonly<SceneObjects> {
    return { ...this.sceneObjects };
  }

  public getBrickSystem(): UnifiedBrickSystem {
    return this.brickSystem;
  }

  public getMultiplayerSystem(): SimpleMultiplayerSystem {
    return this.multiplayerSystem;
  }

  public getUIManager(): UIManager {
    return this.uiManager;
  }

  public getStateManager(): StateManager {
    return this.stateManager;
  }

  public getBuildingManager(): BuildingManager {
    return this.buildingManager;
  }

  public getMultiplayerManager(): MultiplayerManager {
    return this.multiplayerManager;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.sceneSystem.camera;
  }

  // Layer progress methods for UI
  public getCurrentLayer(): number {
    return this.stateManager.getCurrentLayer();
  }

  public showLayerProgressUI(): void {
    this.gameStarted = true;
    this.layerProgressUI?.show();
    
    // Enable name tags now that game has started
    this.multiplayerSystem.setNametagVisible(true);
    console.log('🎮 Game started - UI and nametags now visible');
  }

  public hideLayerProgressUI(): void {
    this.layerProgressUI?.hide();
  }

  public getLayerProgress(): { current: number, total: number, percentage: number } {
    const currentLayer = this.brickSystem.getCurrentActiveLayer();
    const progress = this.brickSystem.getLayerProgress(currentLayer);
    return {
      current: progress.filled,
      total: progress.total,
      percentage: progress.percentage
    };
  }

  // Testing utilities
  public testGridAlignment(): void {
    
  }

  public testSimpleAlignment(): void {
    
  }

  // Expose clear function to global scope for easy testing
  public exposeGlobalClearFunction(): void {
    (window as any).clearAllBricks = () => {
      this.clearAllBricks();
    };

    (window as any).hardReset = () => {
      
      // Clear all bricks (local and network)
      this.clearAllBricks();

      // Force reset the grid system - unified system handles this
      
      // Reset layer manager to layer 0 - unified system handles this
      
      // Reset game state
      this.gameState.isCarryingBrick = false;

      // Hide carried brick if visible
      if (this.sceneObjects.carriedBrick) {
        this.sceneObjects.carriedBrick.visible = false;
        this.sceneObjects.carriedBrick = null;
      }

      // Additional cleanup for simplified system
      
    };

    (window as any).fillAllLayers = (maxLayers = 4) => {
      
      return 0;
    };

    (window as any).fillLayer = (layerNumber = 0) => {
      
      return 0;
    };

    (window as any).giveBrick = () => {
      const success = this.brickSystem.pickupBrick();
      
      return success;
    };

    (window as any).debugBrickState = () => {

      // Check if character is near brick pile
      if (this.sceneObjects.character && this.sceneObjects.brickPile) {
        const distance = this.sceneObjects.character.position.distanceTo(this.sceneObjects.brickPile.position);
        
      }
      
      // Debug platform setup
      this.brickSystem.debugPlatformSetup();
      
      // Debug brick visibility
      this.brickSystem.debugBrickVisibility();
    };

    (window as any).debugGrid = () => {
      
    };

    (window as any).showGrid = () => {
      
    };

    (window as any).toggleGrid = () => {
      
    };

    (window as any).testBrickPlacement = () => {
      
      if (this.gameState.isCarryingBrick) {
        
      } else {
        
        this.brickSystem.pickupBrick();
      }
    };

    (window as any).testCentering = () => {
      
      // Clear first
      this.clearAllBricks();

      return;
    };

    (window as any).fixFloatingBricks = () => {
      
      if (!this.sceneObjects.buildingPlatform) {
        console.error('❌ No building platform found');
        return;
      }

      const platformBox = new THREE.Box3().setFromObject(this.sceneObjects.buildingPlatform);
      const platformTop = platformBox.max.y;
      let fixedCount = 0;

      this.sceneObjects.placedBricks.forEach((brick, index) => {
        if (!brick.userData.isBrick) return;

        const brickBox = new THREE.Box3().setFromObject(brick);
        const actualBrickBottom = brickBox.min.y;
        const actualBrickHeight = brickBox.max.y - brickBox.min.y;
        const gap = actualBrickBottom - platformTop;

        // Get the layer from userData
        const gridPos = brick.userData.gridPosition;
        const layer = gridPos ? gridPos.layer : 0;

        if (Math.abs(gap) > 0.01) {
          // Calculate correct Y position for this layer
          const correctY = platformTop + (layer * actualBrickHeight) + (actualBrickHeight / 2);
          const oldY = brick.position.y;
          brick.position.y = correctY;
          fixedCount++;

        } else {
          
        }
      });

    };

    (window as any).debugGridSystem = () => {
      
      return;
    };

    (window as any).verifyPlatform = () => {
      
      if (!this.sceneObjects.buildingPlatform) {
        console.error('❌ No building platform found');
        return;
      }

      const platform = this.sceneObjects.buildingPlatform;
      const platformBox = new THREE.Box3().setFromObject(platform);
      const platformCenter = platformBox.getCenter(new THREE.Vector3());
      const platformSize = platformBox.getSize(new THREE.Vector3());

      // Test grid system alignment
      
    };

    (window as any).testSingleBrick = () => {
      
      // Clear first
      this.clearAllBricks();

      return;
    };

    (window as any).debugPosition = () => {
      
      if (this.sceneObjects.character) {
        
      }
      if (this.sceneObjects.buildingPlatform) {
        const bounds = new THREE.Box3().setFromObject(this.sceneObjects.buildingPlatform);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        
        // Check platform object properties
      }
      
    };

    (window as any).debugMasterBrick = () => {
      
      const masterBrick = this.sceneObjects.masterBrick;
      if (masterBrick) {
        
        masterBrick.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            
          }
        });
      } else {
        
      }
    };

    (window as any).debugBrickPositioning = () => {
      
      if (this.sceneObjects.buildingPlatform) {
        const bounds = new THREE.Box3().setFromObject(this.sceneObjects.buildingPlatform);
        const center = bounds.getCenter(new THREE.Vector3());
        
        return;
      }
    };

    (window as any).testUnified = () => {
      this.testUnifiedSystem();
    };

    (window as any).debugVisibility = () => {
      this.brickSystem.debugBrickVisibility();
    };

    (window as any).debugMasterBrick = () => {
      
      const masterBrick = this.sceneObjects.masterBrick;
      if (masterBrick) {
        
        masterBrick.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            
          }
        });
      } else {
        
      }
    };

    (window as any).verifyPlatform = () => {
      this.brickSystem.debugPlatformSetup();
    };

    (window as any).debugLayerProgress = () => {
      this.brickSystem.debugLayerProgress();
    };

    (window as any).debugLayerUI = () => {
      
      if (this.layerProgressUI) {
        const currentLayer = this.brickSystem.getCurrentActiveLayer();
        const progress = this.brickSystem.getLayerProgress(currentLayer);
        
        this.brickSystem.debugLayerProgress();
      }
    };

    (window as any).testMultiplayerBrick = () => {
      
      // Try to place a test brick if carrying one
      if (this.gameState.isCarryingBrick) {
        
        const success = this.brickSystem.placeBrick();
        
      } else {
        
        const pickupSuccess = this.brickSystem.pickupBrick();
        
        if (pickupSuccess) {
          
        }
      }
    };

    (window as any).debugMultiplayerState = () => {
      
      // Check scene for network bricks
      let networkBrickCount = 0;
      let localBrickCount = 0;
      this.scene.traverse((child) => {
        if (child.userData.isNetworkBrick) {
          networkBrickCount++;
        } else if (child.userData.isBrick) {
          localBrickCount++;
        }
      });
      
    };

    (window as any).forceResyncBricks = () => {
      console.log('🔄 Force resync not needed in simplified system');
    };

    (window as any).connectMultiplayer = async () => {
      if (!this.user) {
        
        return false;
      }
      
      try {
        const connected = await this.multiplayerSystem.connect(this.user);
        
        // Test brick placement after connection
        if (connected) {
          
        }
        
        return connected;
      } catch (error) {
        console.error('❌ Manual connection failed:', error);
        return false;
      }
    };

    (window as any).checkServerConnection = async () => {
      
      const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL || 'http://localhost:3002';
      
      try {
        const response = await fetch(`${serverUrl}/health`);
        const data = await response.json();
        
        return data;
      } catch (error) {
        console.error('❌ Server health check failed:', error);
        
        return null;
      }
    };

    (window as any).debugRemotePlayers = () => {
      console.log('🔍 Remote Players Debug:', {
        count: this.multiplayerSystem.getRemotePlayerCount(),
        connected: this.multiplayerSystem.isMultiplayerEnabled()
      });
    };

  }

  public toggleGreenPlane(): void {
    
  }

  // Simple test method for the new system
  public testUnifiedSystem(): void {
    
    this.brickSystem.debugBrickVisibility();
  }

  public isGameInitialized(): boolean {
    return this.isInitialized;
  }

  // Multiplayer methods
  public async connectToMultiplayer(user: UserProfile): Promise<boolean> {
    return await this.multiplayerSystem.connect(user);
  }

  public disconnectFromMultiplayer(): void {
    this.multiplayerSystem.disconnect();
  }

  public isMultiplayerConnected(): boolean {
    return this.multiplayerSystem.isMultiplayerEnabled();
  }

  public getRemotePlayerCount(): number {
    return this.multiplayerSystem.getRemotePlayerCount();
  }

  public debugMultiplayer(): void {
    this.debugManager.debugMultiplayer();
  }

  public printHelp(): void {
    this.debugManager.printHelp();
  }

  // Chat methods
  public sendChatMessage(text: string, user: any): void {
    this.multiplayerSystem.sendChatMessage(text, user);
  }

  // Nametag methods
  public setRemoteNametagVisible(visible: boolean): void {
    this.multiplayerSystem.setNametagVisible(visible);
  }

  // Force immediate multiplayer position sync
  public forceMultiplayerSync(): void {
    if (this.sceneObjects.character) {
      this.multiplayerManager.forceSync(this.sceneObjects.character, this.gameState);
    }
  }

  public dispose(): void {
    // Stop game loop
    this.lifecycleManager?.dispose();
    
    // Dispose managers
    this.buildingManager?.dispose();
    this.multiplayerManager?.dispose();
    
    // Dispose of UI components
    if (this.layerProgressUI) {
      this.layerProgressUI.dispose();
      this.layerProgressUI = null;
    }

    // Dispose systems
    this.sceneSystem.dispose();
    this.animationSystem.dispose();
    this.inputSystem.dispose();
    this.waterSystem.dispose();
    this.multiplayerSystem.dispose();
  }
}
