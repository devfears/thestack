
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
import { MultiplayerSystem } from '../systems/MultiplayerSystemNew';
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
  private multiplayerSystem: MultiplayerSystem;
  private uiManager: UIManager;
  private layerProgressUI: LayerProgressUI | null = null;

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
    // Initialize multiplayer system
    this.multiplayerSystem = new MultiplayerSystem(this, this.sceneSystem.scene);

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
      console.log(`🎮 GameManager: Player count changed to ${count}`);
      this.onRemotePlayerCountChange?.(count);
      // Also update the LayerProgressUI if it exists
      if (this.layerProgressUI) {
        this.layerProgressUI.updatePlayerCount(count);
      }
    });

    // Clear any existing network bricks from previous sessions
    this.multiplayerSystem.clearAllNetworkBricks();

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
    
    // Initialize LayerProgressUI after brick system is ready
    this.layerProgressUI = new LayerProgressUI(this.brickSystem);
    this.layerProgressUI.show(); // Ensure it's visible
    
    // Set initial player count (1 for local player)
    this.layerProgressUI.updatePlayerCount(1);
  }

  public setJoystickData(data: any): void {
    this.gameState.joystickData = data;
  }

  public setNametagVisible(visible: boolean): void {
    // Local player nametag
    this.modelLoader.setNametagVisible(visible);
    // Remote player nametags
    this.multiplayerSystem.setNametagVisible(visible);
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
        console.log('🧱 Initializing building system with master brick');
        this.brickSystem.initializeAfterMasterBrick();
        console.log('✅ Unified brick system ready with master brick');

        console.log('✅ Building system initialized successfully');
      } else {
        console.warn('⚠️ Master brick not available for building system initialization');
      }

      // Load the rest of the models
      await this.modelLoader.loadCharacter();
      await this.modelLoader.loadBrickPile();
      await this.modelLoader.loadPlatform(this.brickSystem.GRID_SIZE, this.brickSystem.CELL_SIZE);
      
      // Recalculate platform info after platform is loaded
      this.brickSystem.recalculatePlatformInfo();
      
      await this.modelLoader.loadIsland();

      // Connect to multiplayer if user is provided
      // The MultiplayerSystem has safeguards to prevent duplicate player creation
      if (this.user) {
        try {
          console.log('🔌 Attempting to connect to multiplayer with user:', this.user);
          const connected = await this.multiplayerSystem.connect(this.user);
          console.log('🎮 Multiplayer connection result:', connected);
          console.log('🔗 Multiplayer enabled after connection:', this.multiplayerSystem.isMultiplayerEnabled());
        } catch (error) {
          console.warn('⚠️ Failed to connect to multiplayer:', error);
          // Continue with single-player mode if multiplayer fails
        }
      } else {
        console.log('❌ No user provided, skipping multiplayer connection');
      }

      // Expose debug functions globally
        this.debugManager.exposeGlobalDebugFunctions(
          () => this.buildingManager.clearAllBricks(),
          () => this.buildingManager.pickupBrick()
        );

      // Start game loop
      this.lifecycleManager.startGameLoop(() => this.update());

      this.isInitialized = true;

      console.log('✅ Game initialized successfully with new architecture');
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
    
    // Send player updates if multiplayer is connected
    if (this.sceneObjects.character) {
      this.multiplayerManager.sendPlayerUpdateIfChanged(this.sceneObjects.character, this.gameState);
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

  public getMultiplayerSystem(): MultiplayerSystem {
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
    this.layerProgressUI?.show();
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
    console.log('🔧 Grid alignment test - unified system handles this automatically');
  }

  public testSimpleAlignment(): void {
    console.log('🔧 Simple alignment test - unified system handles this automatically');
  }

  // Expose clear function to global scope for easy testing
  public exposeGlobalClearFunction(): void {
    (window as any).clearAllBricks = () => {
      this.clearAllBricks();
    };

    (window as any).hardReset = () => {
      console.log('🔥 HARD RESET: Clearing everything and resetting grid...');

      // Clear all bricks (local and network)
      this.clearAllBricks();

      // Force reset the grid system - unified system handles this
      console.log('🔄 Grid system reset handled by unified system');

      // Reset layer manager to layer 0 - unified system handles this
      console.log('🔄 Layer manager reset handled by unified system');

      // Reset game state
      this.gameState.isCarryingBrick = false;

      // Hide carried brick if visible
      if (this.sceneObjects.carriedBrick) {
        this.sceneObjects.carriedBrick.visible = false;
        this.sceneObjects.carriedBrick = null;
      }

      // Additional cleanup for simplified system
      console.log('🧹 Additional cleanup completed');

      console.log('✅ Hard reset complete - everything cleared and reset to initial state');
    };

    (window as any).fillAllLayers = (maxLayers = 4) => {
      console.log(`🏗️ FILL ALL LAYERS: Spawning bricks on all positions for ${maxLayers} layers...`);
      console.log('⚠️ fillAllLayers temporarily disabled - UnifiedBrickSystem uses different architecture');
      return 0;
    };

    (window as any).fillLayer = (layerNumber = 0) => {
      console.log(`🔨 FILL LAYER ${layerNumber}: Spawning bricks on all positions...`);
      console.log('⚠️ fillLayer temporarily disabled - UnifiedBrickSystem uses different architecture');
      return 0;
    };

    (window as any).giveBrick = () => {
      const success = this.brickSystem.pickupBrick();
      console.log('🧱 giveBrick() result:', success);
      return success;
    };

    (window as any).debugBrickState = () => {
      console.log('🔍 Current brick state:', {
        isCarryingBrick: this.gameState.isCarryingBrick,
        hasMasterBrick: !!this.sceneObjects.masterBrick,
        hasGhostBrick: !!this.sceneObjects.ghostBrick,
        ghostBrickVisible: this.sceneObjects.ghostBrick?.visible,
        brickCount: this.brickSystem.getPlacedBricksCount(),
        gridSize: this.brickSystem.getGridSize(),
        cellSize: this.brickSystem.getCellSize(),
        maxLayers: this.brickSystem.getMaxLayers(),
        gridOrigin: this.brickSystem.getGridOrigin(),
        solidObjectsCount: this.sceneObjects.solidObjects.length,
        groundObjectsCount: this.sceneObjects.groundObjects.length
      });

      // Check if character is near brick pile
      if (this.sceneObjects.character && this.sceneObjects.brickPile) {
        const distance = this.sceneObjects.character.position.distanceTo(this.sceneObjects.brickPile.position);
        console.log('📏 Distance to brick pile:', distance.toFixed(2));
        console.log('📍 Character position:', this.sceneObjects.character.position);
        console.log('📍 Brick pile position:', this.sceneObjects.brickPile.position);
      }
      
      // Debug platform setup
      this.brickSystem.debugPlatformSetup();
      
      // Debug brick visibility
      this.brickSystem.debugBrickVisibility();
    };

    (window as any).debugGrid = () => {
      console.log('🔲 Grid debug - unified system');
    };

    (window as any).showGrid = () => {
      console.log('🔲 Grid visualization - unified system');
    };

    (window as any).toggleGrid = () => {
      console.log('🔲 Grid toggle - unified system');
    };

    (window as any).testBrickPlacement = () => {
      console.log('🧪 Testing brick placement...');
      if (this.gameState.isCarryingBrick) {
        console.log('✅ Already carrying a brick - try placing it');
      } else {
        console.log('🎯 Picking up a brick for testing...');
        this.brickSystem.pickupBrick();
      }
    };

    (window as any).testCentering = () => {
      console.log('🎯 Testing grid centering with corner bricks...');

      // Clear first
      this.clearAllBricks();

      console.log('⚠️ Spawn test bricks temporarily disabled - UnifiedBrickSystem uses different architecture');
      return;
    };

    (window as any).fixFloatingBricks = () => {
      console.log('🔧 Fixing all floating bricks...');

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

        console.log(`🔍 Brick ${index} analysis:`);
        console.log(`  - Current position: Y=${brick.position.y}`);
        console.log(`  - Brick bottom: Y=${actualBrickBottom}`);
        console.log(`  - Platform top: Y=${platformTop}`);
        console.log(`  - Gap: ${gap}`);
        console.log(`  - Layer: ${layer}`);
        console.log(`  - Brick height: ${actualBrickHeight}`);

        if (Math.abs(gap) > 0.01) {
          // Calculate correct Y position for this layer
          const correctY = platformTop + (layer * actualBrickHeight) + (actualBrickHeight / 2);
          const oldY = brick.position.y;
          brick.position.y = correctY;
          fixedCount++;

          console.log(`🔧 Fixed brick ${index}: layer ${layer}, moved from Y=${oldY} to Y=${correctY}`);
        } else {
          console.log(`✅ Brick ${index} is correctly positioned`);
        }
      });

      console.log(`✅ Fixed ${fixedCount} floating bricks`);
    };

    (window as any).debugGridSystem = () => {
      console.log('🔍 Grid System Debug Info:');

      console.log('⚠️ Grid system debug temporarily disabled - UnifiedBrickSystem uses different architecture');
      return;
    };

    (window as any).verifyPlatform = () => {
      console.log('🔍 Platform Verification:');

      if (!this.sceneObjects.buildingPlatform) {
        console.error('❌ No building platform found');
        return;
      }

      const platform = this.sceneObjects.buildingPlatform;
      const platformBox = new THREE.Box3().setFromObject(platform);
      const platformCenter = platformBox.getCenter(new THREE.Vector3());
      const platformSize = platformBox.getSize(new THREE.Vector3());

      console.log('🏗️ Platform Details:');
      console.log('  - Name:', platform.name);
      console.log('  - Position:', platform.position);
      console.log('  - Bounds Min:', platformBox.min);
      console.log('  - Bounds Max:', platformBox.max);
      console.log('  - Center:', platformCenter);
      console.log('  - Size:', platformSize);
      console.log('  - Top Y:', platformBox.max.y);

      // Test grid system alignment
      console.log('⚠️ Grid system alignment test temporarily disabled - UnifiedBrickSystem uses different architecture');
    };

    (window as any).testSingleBrick = () => {
      console.log('🧱 Testing single brick placement with detailed logging...');

      // Clear first
      this.clearAllBricks();

      console.log('⚠️ Spawn test bricks temporarily disabled - UnifiedBrickSystem uses different architecture');
      return;
    };

    (window as any).debugPosition = () => {
      console.log('🔍 Position debug:');
      if (this.sceneObjects.character) {
        console.log('  Character position:', this.sceneObjects.character.position);
      }
      if (this.sceneObjects.buildingPlatform) {
        const bounds = new THREE.Box3().setFromObject(this.sceneObjects.buildingPlatform);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        console.log('  Platform bounds:', bounds);
        console.log('  Platform center:', center);
        console.log('  Platform size:', size);
        console.log('  Platform top Y:', bounds.max.y);

        // Check platform object properties
        console.log('  Platform object:', {
          position: this.sceneObjects.buildingPlatform.position,
          scale: this.sceneObjects.buildingPlatform.scale,
          rotation: this.sceneObjects.buildingPlatform.rotation,
          visible: this.sceneObjects.buildingPlatform.visible
        });
      }
      console.log('⚠️ Grid system debug temporarily disabled - UnifiedBrickSystem uses different architecture');
    };

    (window as any).debugMasterBrick = () => {
      console.log('🧱 Master brick debug:');
      const masterBrick = this.sceneObjects.masterBrick;
      if (masterBrick) {
        console.log('  Master brick exists:', !!masterBrick);
        console.log('  Master brick visible:', masterBrick.visible);
        console.log('  Master brick position:', masterBrick.position);
        console.log('  Master brick scale:', masterBrick.scale);
        console.log('  Master brick children:', masterBrick.children.length);
        masterBrick.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            console.log('    Mesh child:', child.name, 'visible:', child.visible, 'geometry:', !!child.geometry, 'material:', !!child.material);
          }
        });
      } else {
        console.log('  Master brick not found!');
      }
    };

    (window as any).debugBrickPositioning = () => {
      console.log('📐 Brick positioning debug:');
      if (this.sceneObjects.buildingPlatform) {
        const bounds = new THREE.Box3().setFromObject(this.sceneObjects.buildingPlatform);
        const center = bounds.getCenter(new THREE.Vector3());
        console.log('  Platform bounds:', bounds);
        console.log('  Platform center:', center);
        console.log('  Platform top Y:', bounds.max.y);

        console.log('⚠️ Platform debug temporarily disabled - UnifiedBrickSystem uses different architecture');
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
      console.log('🧱 Master brick debug:');
      const masterBrick = this.sceneObjects.masterBrick;
      if (masterBrick) {
        console.log('  Master brick exists:', !!masterBrick);
        console.log('  Master brick visible:', masterBrick.visible);
        console.log('  Master brick position:', masterBrick.position);
        console.log('  Master brick scale:', masterBrick.scale);
        console.log('  Master brick children:', masterBrick.children.length);
        masterBrick.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            console.log('    Mesh child:', child.name, 'visible:', child.visible, 'geometry:', !!child.geometry, 'material:', !!child.material);
          }
        });
      } else {
        console.log('  Master brick does not exist!');
      }
    };

    (window as any).verifyPlatform = () => {
      this.brickSystem.debugPlatformSetup();
    };

    (window as any).debugLayerProgress = () => {
      this.brickSystem.debugLayerProgress();
    };

    (window as any).debugLayerUI = () => {
      console.log('🔍 LayerProgressUI Debug:');
      console.log('  UI exists:', !!this.layerProgressUI);
      if (this.layerProgressUI) {
        const currentLayer = this.brickSystem.getCurrentActiveLayer();
        const progress = this.brickSystem.getLayerProgress(currentLayer);
        console.log('  Current layer:', currentLayer + 1);
        console.log('  Layer progress:', `${progress.filled}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
        console.log('  Calling debugLayerProgress...');
        this.brickSystem.debugLayerProgress();
      }
    };

    (window as any).testMultiplayerBrick = () => {
      console.log('🧪 Testing multiplayer brick sync...');
      console.log('🔌 Multiplayer enabled:', this.multiplayerSystem.isMultiplayerEnabled());
      console.log('🔗 Network connected:', this.multiplayerSystem.networkManager?.isConnectedToServer());
      console.log('👥 Remote player count:', this.multiplayerSystem.getRemotePlayerCount());
      
      // Try to place a test brick if carrying one
      if (this.gameState.isCarryingBrick) {
        console.log('🧱 Attempting to place carried brick...');
        const success = this.brickSystem.placeBrick();
        console.log('📊 Placement result:', success);
      } else {
        console.log('🎯 Picking up a brick first...');
        const pickupSuccess = this.brickSystem.pickupBrick();
        console.log('📊 Pickup result:', pickupSuccess);
        if (pickupSuccess) {
          console.log('⏰ Try running testMultiplayerBrick() again to place the brick');
        }
      }
    };

    (window as any).debugMultiplayerState = () => {
      console.log('🔍 Multiplayer State Debug:');
      console.log('  Multiplayer enabled:', this.multiplayerSystem.isMultiplayerEnabled());
      console.log('  Network manager exists:', !!this.multiplayerSystem.networkManager);
      console.log('  Network connected:', this.multiplayerSystem.networkManager?.isConnectedToServer());
      console.log('  Local player ID:', this.multiplayerSystem.networkManager?.getLocalPlayerId());
      console.log('  Remote players:', this.multiplayerSystem.getRemotePlayerCount());
      console.log('  User profile:', this.user);
      
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
      console.log('  Network bricks in scene:', networkBrickCount);
      console.log('  Local bricks in scene:', localBrickCount);
      console.log('  Total placed bricks:', this.brickSystem.getPlacedBricksCount());
    };

    (window as any).forceResyncBricks = () => {
      console.log('🔄 Forcing brick resync...');
      this.multiplayerSystem.forceResyncBricks();
    };

    (window as any).connectMultiplayer = async () => {
      if (!this.user) {
        console.log('❌ No user profile available for multiplayer connection');
        return false;
      }
      
      console.log('🔌 Manually connecting to multiplayer...');
      console.log('👤 User profile:', this.user);
      console.log('🌐 Server URL:', import.meta.env.VITE_MULTIPLAYER_SERVER_URL || 'http://localhost:3002');
      
      try {
        const connected = await this.multiplayerSystem.connect(this.user);
        console.log('🎮 Manual connection result:', connected);
        console.log('🔗 Multiplayer enabled:', this.multiplayerSystem.isMultiplayerEnabled());
        console.log('🔗 Network connected:', this.multiplayerSystem.networkManager?.isConnectedToServer());
        console.log('🆔 Local player ID:', this.multiplayerSystem.networkManager?.getLocalPlayerId());
        
        // Test brick placement after connection
        if (connected) {
          console.log('✅ Connection successful! You can now test brick placement with testMultiplayerBrick()');
        }
        
        return connected;
      } catch (error) {
        console.error('❌ Manual connection failed:', error);
        return false;
      }
    };

    (window as any).checkServerConnection = async () => {
      console.log('🔍 Checking server connection...');
      const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL || 'http://localhost:3002';
      console.log('🌐 Server URL:', serverUrl);
      
      try {
        const response = await fetch(`${serverUrl}/health`);
        const data = await response.json();
        console.log('✅ Server health check:', data);
        return data;
      } catch (error) {
        console.error('❌ Server health check failed:', error);
        console.log('💡 Make sure the multiplayer server is running on port 3002');
        return null;
      }
    };

    (window as any).debugRemotePlayers = () => {
      console.log('🔍 Remote Players Debug:');
      const remotePlayerManager = this.multiplayerSystem.remotePlayerManager;
      if (remotePlayerManager) {
        console.log('  Remote players count:', remotePlayerManager.getRemotePlayerCount());
        console.log('  Remote players map:', remotePlayerManager.getRemotePlayers());
        console.log('  Player targets:', remotePlayerManager.getPlayerTargets());
        
        // Check scene for remote player objects
        let sceneRemotePlayerCount = 0;
        this.scene.traverse((child) => {
          if (child.name && child.name.startsWith('player-')) {
            sceneRemotePlayerCount++;
            console.log('    Scene player object:', child.name, 'visible:', child.visible, 'position:', child.position);
          }
        });
        console.log('  Remote players in scene:', sceneRemotePlayerCount);
      } else {
        console.log('❌ Remote player manager not available');
      }
    };

    console.log('🌍 Global functions exposed:');
    console.log('  - clearAllBricks() - Clear all bricks');
    console.log('  - giveBrick() - Give yourself a brick to carry');
    console.log('  - testUnified() - Test unified brick system');
    console.log('  - debugVisibility() - Debug brick visibility');
    console.log('  - debugMasterBrick() - Show master brick information');
    console.log('  - debugPlatform() - Debug platform and grid setup');
    console.log('  - debugBrickState() - Show detailed brick state info');
    console.log('  - debugBrickPositioning() - Show brick positioning calculations');
    console.log('  - debugBrickState() - Show current brick state');
    console.log('  - debugGrid() - Show grid occupancy info');
    console.log('  - showGrid() - Show magenta grid lines permanently');
    console.log('  - toggleGrid() - Toggle grid visualization on/off');
    console.log('  - testBrickPlacement() - Test brick pickup/placement');
    console.log('  - testCentering() - Place test bricks at corners and center to verify positioning');
    console.log('  - testSingleBrick() - Place one brick with detailed positioning analysis');
    console.log('  - fixFloatingBricks() - Fix all existing floating bricks to sit on platform');
    console.log('  - debugGridSystem() - Show detailed grid system and platform information');
    console.log('  - verifyPlatform() - Verify custom platform alignment and positioning');
    console.log('  - debugLayerProgress() - Show current layer progress and brick counts');
    console.log('  - debugLayerUI() - Debug layer UI synchronization issues');
    console.log('  - testMultiplayerBrick() - Test multiplayer brick placement sync');
    console.log('  - debugMultiplayerState() - Show detailed multiplayer connection state');
    console.log('  - forceResyncBricks() - Force resync all bricks from server');
    console.log('  - connectMultiplayer() - Manually connect to multiplayer server');
    console.log('  - checkServerConnection() - Check if multiplayer server is running');
    console.log('  - debugRemotePlayers() - Debug remote player state and duplicates');
    console.log('');
    console.log('🎮 Controls:');
    console.log('  - Click/tap: Pick up brick (when near pile) or place brick (when carrying)');
    console.log('  - WASD: Move character');
    console.log('  - Mouse: Look around');
    console.log('');
    console.log('🏗️ New Fill Functions:');
    console.log('  - fillAllLayers() - Fill 4 layers with different colors');
    console.log('  - fillAllLayers(2) - Fill only 2 layers');
    console.log('  - fillLayer(0) - Fill just the first layer');
    console.log('  - fillLayer(1) - Fill just the second layer');
    console.log('');
    console.log('📏 Proximity Rules:');
    console.log('  - Must be within 3 units of brick pile to pick up bricks');
    console.log('  - Ghost brick shows where brick will be placed');
    console.log('  - Green ghost = valid placement, Red ghost = invalid');
    console.log('');
    console.log('🐛 If you have issues, try: hardReset()');
  }

  public toggleGreenPlane(): void {
    console.log('🟢 Green plane toggle - unified system');
  }

  // Simple test method for the new system
  public testUnifiedSystem(): void {
    console.log('🧪 Testing Unified Brick System...');
    console.log('📏 Grid size:', this.brickSystem.getGridSize());
    console.log('📏 Cell size:', this.brickSystem.getCellSize());
    console.log('📏 Brick height:', this.brickSystem.getBrickHeight());
    console.log('📍 Grid origin:', this.brickSystem.getGridOrigin());
    console.log('🧱 Placed bricks:', this.brickSystem.getPlacedBricksCount());
    console.log('🎒 Carrying brick:', this.brickSystem.isCarryingBrick());
    this.brickSystem.debugBrickVisibility();
  }



  public isGameInitialized(): boolean {
    return this.isInitialized;
  }

  // Multiplayer methods
  public async connectToMultiplayer(user: UserProfile): Promise<boolean> {
    return await this.multiplayerManager.connect(user);
  }

  public disconnectFromMultiplayer(): void {
    this.multiplayerManager.disconnect();
  }

  public isMultiplayerConnected(): boolean {
    return this.multiplayerManager.isConnected();
  }

  public getRemotePlayerCount(): number {
    return this.multiplayerManager.getRemotePlayerCount();
  }

  public debugMultiplayer(): void {
    this.debugManager.debugMultiplayer();
  }



  public printHelp(): void {
    this.debugManager.printHelp();
  }

  // Force immediate multiplayer position sync
  public forceMultiplayerSync(): void {
    if (this.sceneObjects.character) {
      this.multiplayerManager.forceSync(this.sceneObjects.character, this.gameState);
    }
  }

  public toggleRemotePlayerDebug(): void {
    this.multiplayerManager.toggleRemotePlayerDebug();
  }

  public forceRemotePlayerFallback(): void {
    this.multiplayerManager.forceRemotePlayerFallback();
  }

  public startUpdateFrequencyMonitor(): void {
    this.multiplayerManager.startUpdateFrequencyMonitor();
  }

  public stopUpdateFrequencyMonitor(): void {
    this.multiplayerManager.stopUpdateFrequencyMonitor();
  }

  // Force sync all multiplayer data
  public forceSyncMultiplayer(): void {
    this.forceMultiplayerSync();
  }

  public forceCleanupRemotePlayers(): void {
    this.multiplayerManager.forceCleanupRemotePlayers();
  }

  public debugRemotePlayersInfo(): void {
    this.multiplayerManager.debugRemotePlayersInfo();
  }

  public requestForceSync(): void {
    this.multiplayerManager.requestForceSync();
  }

  public sendChatMessage(text: string, user: UserProfile): void {
    this.multiplayerManager.sendChatMessage(text, user);
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
