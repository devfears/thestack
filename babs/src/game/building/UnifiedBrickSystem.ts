import * as THREE from 'three';
import { SceneObjects, GameState } from '../core/types';
import { SimpleMultiplayerSystem } from '../systems/multiplayer/SimpleMultiplayerSystem';
import { AnimationSystemManager } from '../character/AnimationSystem';

export interface BrickPosition {
  x: number;
  z: number;
  layer: number;
}

export class UnifiedBrickSystem {
  private scene: THREE.Scene;
  private sceneObjects: SceneObjects;
  private gameState: GameState;
  private multiplayerSystem: SimpleMultiplayerSystem;
  private animationSystem: AnimationSystemManager;
  
  // Simple configuration
  public readonly CELL_SIZE = 0.4;
  private readonly BRICK_HEIGHT = 0.24; // 0.4 * 0.6
  public readonly GRID_SIZE = 60; // 60x60 grid
  private readonly MAX_LAYERS = 20;
  
  // Platform info
  private platformTop: number = 0;
  private platformCenter: THREE.Vector3 = new THREE.Vector3();
  private gridOrigin: THREE.Vector3 = new THREE.Vector3();
  
  // Brick state
  private occupiedPositions: Set<string> = new Set();
  private placedBricks: THREE.Object3D[] = [];
  private carriedBrick: THREE.Object3D | null = null;
  private ghostBrick: THREE.Object3D | null = null;
  private currentLayer = 0;
  private completedLayers: boolean[] = new Array(this.MAX_LAYERS).fill(false);
  
  // Colors
  private brickColors = [
    0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0x96CEB4,
    0xFECA57, 0xFF9FF3, 0x74B9FF, 0xA29BFE
  ];

  // Performance optimization: shared geometry and materials
  private sharedBrickGeometry: THREE.BoxGeometry | null = null;
  private materialCache: Map<number, THREE.Material> = new Map();
  private performanceMode: boolean = false;
  private lastPerformanceCheck: number = 0;
  private frameCount: number = 0;

  constructor(scene: THREE.Scene, sceneObjects: SceneObjects, gameState: GameState, multiplayerSystem: SimpleMultiplayerSystem, animationSystem: AnimationSystemManager) {
    this.scene = scene;
    this.sceneObjects = sceneObjects;
    this.gameState = gameState;
    this.multiplayerSystem = multiplayerSystem;
    this.animationSystem = animationSystem;
    
    this.initializeSystem();
  }

  private initializeSystem(): void {
    // Calculate platform info
    this.calculatePlatformInfo();
    
    // Note: Carried brick and ghost brick will be created after master brick is loaded
  }

  // Method to initialize bricks after master brick is loaded
  public initializeAfterMasterBrick(): void {
    if (!this.sceneObjects.masterBrick) {
      console.error('❌ Master brick still not available!');
      return;
    }
    
    // Create carried brick
    this.createCarriedBrick();
    
    // Create ghost brick
    this.createGhostBrick();
  }

  // Method to recalculate platform info after platform is loaded
  public recalculatePlatformInfo(): void {
    this.calculatePlatformInfo();
  }

  private calculatePlatformInfo(): void {
    if (!this.sceneObjects.buildingPlatform) {
      return;
    }

    const platformBox = new THREE.Box3().setFromObject(this.sceneObjects.buildingPlatform);
    this.platformTop = platformBox.max.y;
    this.platformCenter = platformBox.getCenter(new THREE.Vector3());
    
    // Calculate grid origin (bottom-left corner of grid, at platform top)
    const gridWorldSize = this.GRID_SIZE * this.CELL_SIZE;
    this.gridOrigin.set(
      this.platformCenter.x - gridWorldSize / 2 + this.CELL_SIZE / 2,
      this.platformTop, // Start exactly at platform top
      this.platformCenter.z - gridWorldSize / 2 + this.CELL_SIZE / 2
    );
  }

  private createCarriedBrick(): void {
    const geometry = new THREE.BoxGeometry(this.CELL_SIZE, this.BRICK_HEIGHT, this.CELL_SIZE);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.carriedBrick = new THREE.Mesh(geometry, material);
    this.carriedBrick.visible = false; // Initially hidden
    this.scene.add(this.carriedBrick);
  }

  // Create an optimized brick mesh for performance
  private createOptimizedBrickMesh(position: THREE.Vector3, color: number, isStair: boolean = false): THREE.Mesh {
    // Use shared geometry for better performance
    if (!this.sharedBrickGeometry) {
      this.sharedBrickGeometry = new THREE.BoxGeometry(this.CELL_SIZE, this.BRICK_HEIGHT, this.CELL_SIZE);
    }

    // Use material caching for performance
    let material = this.materialCache.get(color);
    if (!material) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      material = isMobile
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshStandardMaterial({ color });
      this.materialCache.set(color, material);
    }

    const brick = new THREE.Mesh(this.sharedBrickGeometry, material);
    brick.position.copy(position);

    // Disable shadows for brighter scene
    brick.castShadow = false;
    brick.receiveShadow = false;

    brick.userData.isBrick = true;
    brick.userData.isStair = isStair;
    return brick;
  }

  private createGhostBrick(): void {
    const geometry = new THREE.BoxGeometry(this.CELL_SIZE, this.BRICK_HEIGHT, this.CELL_SIZE);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        opacity: 0.5,
        transparent: true,
    });
    this.ghostBrick = new THREE.Mesh(geometry, material);
    this.ghostBrick.visible = false;
    this.scene.add(this.ghostBrick);
    this.sceneObjects.ghostBrick = this.ghostBrick as THREE.Mesh;
  }

  // Convert world position to grid coordinates
  public worldToGrid(worldPos: THREE.Vector3): { x: number; z: number; layer: number } | null {
    if (!this.sceneObjects.buildingPlatform) return null;

    const relativePos = worldPos.clone().sub(this.gridOrigin);

    const gridX = Math.floor(relativePos.x / this.CELL_SIZE);
    const gridZ = Math.floor(relativePos.z / this.CELL_SIZE);

    if (gridX >= 0 && gridX < this.GRID_SIZE && gridZ >= 0 && gridZ < this.GRID_SIZE) {
      return { x: gridX, z: gridZ, layer: 0 }; // Return layer 0 as a placeholder
    } else {
      return null;
    }
  }

  // Convert grid position to world position
  public gridToWorld(gridPos: BrickPosition): THREE.Vector3 {
    const worldX = this.gridOrigin.x + gridPos.x * this.CELL_SIZE;
    const worldZ = this.gridOrigin.z + gridPos.z * this.CELL_SIZE;
    
    // Position brick so its BOTTOM sits on the surface
    const worldY = this.platformTop + (gridPos.layer * this.BRICK_HEIGHT) + (this.BRICK_HEIGHT / 2);

    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  // Public accessor methods for external systems
  public getCellSize(): number {
    return this.CELL_SIZE;
  }

  public getBrickHeight(): number {
    return this.BRICK_HEIGHT;
  }

  public getGridOrigin(): THREE.Vector3 {
    return this.gridOrigin.clone();
  }

  // Method to place a remote brick (from multiplayer)
  public placeRemoteBrick(gridPos: BrickPosition, color: number): THREE.Mesh | null {
    console.log('🧱 UnifiedBrickSystem.placeRemoteBrick called with:', { gridPos, color: `#${color.toString(16).padStart(6, '0')}` });
    
    // Skip validation for remote bricks - trust the server
    const worldPos = this.gridToWorld(gridPos);
    console.log('🌍 World position calculated:', worldPos);
    
    // Create a unique brick mesh for remote bricks (don't use cached materials)
    if (!this.sharedBrickGeometry) {
      this.sharedBrickGeometry = new THREE.BoxGeometry(this.CELL_SIZE, this.BRICK_HEIGHT, this.CELL_SIZE);
    }

    // Create a NEW material specifically for this remote brick (no caching to avoid conflicts)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const material = isMobile
      ? new THREE.MeshBasicMaterial({ 
          color: color,
          transparent: false,
          opacity: 1.0,
          visible: true
        })
      : new THREE.MeshStandardMaterial({ 
          color: color,
          transparent: false,
          opacity: 1.0,
          visible: true
        });

    const brick = new THREE.Mesh(this.sharedBrickGeometry, material);
    brick.position.copy(worldPos);

    // Disable shadows for brighter scene
    brick.castShadow = false;
    brick.receiveShadow = false;
    
    // Mark as network brick with comprehensive metadata
    brick.userData.isBrick = true;
    brick.userData.isNetworkBrick = true;
    brick.userData.gridPosition = gridPos;
    brick.userData.color = color;
    brick.userData.timestamp = Date.now();
    brick.visible = true;
    
    // Ensure the brick has a unique name for debugging
    brick.name = `network-brick-${gridPos.x}-${gridPos.z}-${gridPos.layer}-${Date.now()}`;
    
    // Force proper rendering settings
    brick.frustumCulled = false; // Prevent culling issues
    brick.matrixAutoUpdate = true;
    
    console.log('🔨 Created remote brick mesh:', {
      name: brick.name,
      position: brick.position,
      visible: brick.visible,
      userData: brick.userData,
      materialColor: `#${color.toString(16).padStart(6, '0')}`,
      materialVisible: material.visible,
      materialOpacity: material.opacity
    });
    
    // Add to scene and tracking arrays
    this.scene.add(brick);
    this.placedBricks.push(brick);
    this.sceneObjects.placedBricks.push(brick);
    this.sceneObjects.solidObjects.push(brick);
    this.sceneObjects.groundObjects.push(brick);
    
    // Mark position as occupied
    const key = `${gridPos.x},${gridPos.z},${gridPos.layer}`;
    this.occupiedPositions.add(key);
    
    // Force matrix updates
    brick.updateMatrix();
    brick.updateMatrixWorld(true);
    
    // Check layer completion for remote bricks too
    this.checkLayerCompletion();
    
    console.log('✅ Remote brick successfully added to scene and tracking arrays');
    console.log('📊 Current brick counts:', {
      placedBricks: this.placedBricks.length,
      sceneObjectsBricks: this.sceneObjects.placedBricks.length,
      occupiedPositions: this.occupiedPositions.size,
      sceneChildren: this.scene.children.length
    });
    
    return brick;
  }

  // Method to check if a position is occupied (public access)
  public isPositionOccupied(gridPos: BrickPosition): boolean {
    const key = `${gridPos.x},${gridPos.z},${gridPos.layer}`;
    return this.occupiedPositions.has(key);
  }

  // Check if position is valid for placement
  public canPlaceBrick(gridPos: BrickPosition): boolean {
    // Check bounds
    if (gridPos.x < 0 || gridPos.x >= this.GRID_SIZE || 
        gridPos.z < 0 || gridPos.z >= this.GRID_SIZE || 
        gridPos.layer < 0 || gridPos.layer >= this.MAX_LAYERS) {
      return false;
    }

    // Check if trying to place on a layer other than the current one
    if (gridPos.layer !== this.currentLayer) {
      return false;
    }

    // Check if occupied
    const key = `${gridPos.x},${gridPos.z},${gridPos.layer}`;
    if (this.occupiedPositions.has(key)) {
      return false;
    }

    // If placing on any layer higher than the base, check for a supporting brick below
    if (gridPos.layer > 0) {
      const belowKey = `${gridPos.x},${gridPos.z},${gridPos.layer - 1}`;
      if (!this.occupiedPositions.has(belowKey)) {
        return false; // No support
      }
    }

    // Placement is valid if it's on the current layer and (on layer 0 or a supported higher layer)
    return true;
  }

  private checkLayerCompletion(): void {
    if (this.completedLayers[this.currentLayer]) return;

    const layerSize = this.GRID_SIZE * this.GRID_SIZE;
    let bricksInLayer = 0;

    for (let x = 0; x < this.GRID_SIZE; x++) {
      for (let z = 0; z < this.GRID_SIZE; z++) {
        const key = `${x},${z},${this.currentLayer}`;
        if (this.occupiedPositions.has(key)) {
          bricksInLayer++;
        }
      }
    }

    if (bricksInLayer >= layerSize) {
      this.completedLayers[this.currentLayer] = true;
      if (this.currentLayer < this.MAX_LAYERS - 1) {
        this.currentLayer++;
        this.createStaircase(this.currentLayer -1);
        // Here you could trigger UI updates or other game events
      } else {
        // Final completion event
      }
    }
  }

  private createStaircase(forLayer: number): void {
    // Create stairs that extend outside the platform boundary on the side closest to spawn
    // The character spawns near the corner, so we'll create stairs extending from that side
    // Position stairs outside the grid boundary but connected to the platform edge
    
    const stairColor = 0x888888; // Grey for stairs
    
    // Create stairs that climb up the side of the platform
    for (let layer = 0; layer <= forLayer; layer++) {
      // Position stairs outside the grid boundary, extending from the side
      // Start from grid position (-1, 0) which is outside the platform but connected
      const stairX = -1; // Outside the grid boundary (left side)
      const stairZ = layer; // Move along Z-axis as we go up layers
      
      // Calculate world position manually since this is outside the normal grid
      const worldX = this.gridOrigin.x + stairX * this.CELL_SIZE;
      const worldZ = this.gridOrigin.z + stairZ * this.CELL_SIZE;
      const worldY = this.platformTop + layer * this.BRICK_HEIGHT;
      
      const worldPos = new THREE.Vector3(worldX, worldY, worldZ);
      
      // Create and place the stair brick
      const brick = this.createOptimizedBrickMesh(worldPos, stairColor, true);
      this.scene.add(brick);
      this.placedBricks.push(brick);
      this.sceneObjects.solidObjects.push(brick);
      this.sceneObjects.groundObjects.push(brick);
      
      // Also create a connecting brick at the platform edge for each layer
      if (layer > 0) {
        const connectingX = 0; // At the edge of the platform
        const connectingZ = layer;
        const connectingWorldX = this.gridOrigin.x + connectingX * this.CELL_SIZE;
        const connectingWorldZ = this.gridOrigin.z + connectingZ * this.CELL_SIZE;
        const connectingWorldY = this.platformTop + layer * this.BRICK_HEIGHT;
        
        const connectingPos = new THREE.Vector3(connectingWorldX, connectingWorldY, connectingWorldZ);
        const connectingBrick = this.createOptimizedBrickMesh(connectingPos, stairColor, true);
        this.scene.add(connectingBrick);
        this.placedBricks.push(connectingBrick);
        this.sceneObjects.solidObjects.push(connectingBrick);
        this.sceneObjects.groundObjects.push(connectingBrick);
        
        const connectingKey = `${connectingX},${connectingZ},${layer}`;
        this.occupiedPositions.add(connectingKey);
      }
    }
  }

  // Pick up a brick
  public pickupBrick(): boolean {
    if (this.gameState.isCarryingBrick) return false;

    this.gameState.isCarryingBrick = true;

    if (this.carriedBrick) {
        const color = this.brickColors[Math.floor(Math.random() * this.brickColors.length)];
        const material = (this.carriedBrick as THREE.Mesh).material as THREE.MeshStandardMaterial;
        material.color.setHex(color);
        material.visible = true;
        this.carriedBrick.visible = true;
        this.sceneObjects.carriedBrick = this.carriedBrick as any;
    }

    // Play pickup animation
    this.animationSystem.playPickupAnimation();

    return true;
  }

  // Place a brick
  public placeBrick(): boolean {
    console.log('🧱 UnifiedBrickSystem.placeBrick called!');
    
    if (!this.gameState.isCarryingBrick || !this.ghostBrick) {
      console.log('❌ Cannot place brick: isCarryingBrick =', this.gameState.isCarryingBrick, 'ghostBrick =', !!this.ghostBrick);
      return false;
    }

    // Use ghost brick's position for placement
    const worldPos = this.ghostBrick.position;
    const gridPos = this.worldToGrid(worldPos);

    // Also check if ghost brick is visible (which implies it's in a valid general area)
    // and if the position is valid for placement.
    if (!gridPos || !this.canPlaceBrick(gridPos) || !this.ghostBrick.visible) {
      console.log('❌ Cannot place brick: gridPos =', gridPos, 'canPlace =', gridPos ? this.canPlaceBrick(gridPos) : false, 'ghostVisible =', this.ghostBrick.visible);
      return false;
    }

    console.log('✅ Placing brick at grid position:', gridPos);

    // Create the brick with performance optimization
    const exactWorldPos = this.gridToWorld(gridPos);
    
    let brickColor = this.brickColors[0]; // Default color
    if (this.carriedBrick) {
        brickColor = ((this.carriedBrick as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex();
    }

    // Use optimized brick creation for better performance
    const brick = this.createOptimizedBrickMesh(exactWorldPos, brickColor);
    
    // Add to scene and tracking
    brick.userData.gridPosition = gridPos;
    brick.visible = true;
    
    // Performance monitoring and optimization
    this.checkAndOptimizePerformance();
    
    this.scene.add(brick);
    this.placedBricks.push(brick);
    this.sceneObjects.placedBricks.push(brick);
    this.sceneObjects.solidObjects.push(brick);
    this.sceneObjects.groundObjects.push(brick);
    
    // Mark position as occupied
    const key = `${gridPos.x},${gridPos.z},${gridPos.layer}`;
    this.occupiedPositions.add(key);
    
    // Hide carried brick
    this.gameState.isCarryingBrick = false;
    if (this.carriedBrick) {
      this.carriedBrick.visible = false;
      this.sceneObjects.carriedBrick = null;
    }
    
    // Send multiplayer event
    const brickData = {
      position: exactWorldPos,
      worldPosition: exactWorldPos,
      color: brickColor,
      gridPosition: gridPos
    };
    
    // Send to multiplayer if connected
    if (this.multiplayerSystem.isMultiplayerEnabled()) {
      console.log('📤 Sending brick placement to multiplayer system');
      this.multiplayerSystem.sendBrickPlaced(brickData);
    } else {
      console.log('⚠️ Multiplayer not connected, skipping network send');
    }
    
    this.checkLayerCompletion();

    // Play place animation
    this.animationSystem.playPlaceAnimation();

    return true;
  }

  // Update carried brick position
  public updateCarriedBrick(): void {
    if (!this.gameState.isCarryingBrick || !this.carriedBrick || !this.sceneObjects.character) {
      return;
    }

    const character = this.sceneObjects.character;
    this.carriedBrick.position.set(
      character.position.x,
      character.position.y + 3.0, // Higher above head
      character.position.z
    );
    
    // Gentle animation
    this.carriedBrick.position.y += Math.sin(Date.now() * 0.002) * 0.1;
    this.carriedBrick.rotation.y += 0.02;
  }

  // Update ghost brick
  public updateGhostBrick(_camera: THREE.Camera): void {
    if (!this.ghostBrick || !this.gameState.isCarryingBrick || !this.sceneObjects.character) {
      if (this.ghostBrick) this.ghostBrick.visible = false;
      return;
    }

    const character = this.sceneObjects.character;
    const characterPos = character.position.clone();

    // 1. Get character's forward direction
    const forward = new THREE.Vector3();
    character.getWorldDirection(forward);
    forward.y = 0; // We only care about XZ plane
    forward.normalize();

    // 2. Calculate target position in front of the character
    const placementDistance = this.CELL_SIZE * 1.5; // Place it one and a half cells away
    const targetPos = characterPos.add(forward.multiplyScalar(placementDistance));
    
    // Check if the target position is within the grid bounds
    const gridWorldSize = this.GRID_SIZE * this.CELL_SIZE;
    const gridMinX = this.gridOrigin.x - this.CELL_SIZE / 2;
    const gridMaxX = this.gridOrigin.x + gridWorldSize - this.CELL_SIZE / 2;
    const gridMinZ = this.gridOrigin.z - this.CELL_SIZE / 2;
    const gridMaxZ = this.gridOrigin.z + gridWorldSize - this.CELL_SIZE / 2;

    if (
      targetPos.x < gridMinX ||
      targetPos.x > gridMaxX ||
      targetPos.z < gridMinZ ||
      targetPos.z > gridMaxZ
    ) {
      this.ghostBrick.visible = false;
      return;
    }
    
    // Find the highest occupied layer at this X, Z position to place the ghost brick on top
    const tempGridPos = this.worldToGrid(targetPos);
    if (!tempGridPos) {
      this.ghostBrick.visible = false;
      return;
    }

    let targetLayer = 0;
    for (let l = this.MAX_LAYERS - 1; l >= 0; l--) {
      const key = `${tempGridPos.x},${tempGridPos.z},${l}`;
      if (this.occupiedPositions.has(key)) {
        targetLayer = l + 1;
        break;
      }
    }

    const gridPos = { x: tempGridPos.x, z: tempGridPos.z, layer: targetLayer };

    if (gridPos) {
      const worldPos = this.gridToWorld(gridPos);
      this.ghostBrick.position.copy(worldPos);

      // Snap rotation to 90-degree increments based on character's rotation
      const snappedRotation = Math.round(character.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
      this.ghostBrick.rotation.y = snappedRotation;

      this.ghostBrick.visible = true;
      
      // Check if we can place at this position
      const canPlace = this.canPlaceBrick(gridPos);
      const color = canPlace ? 0x00ff00 : 0xff0000; // Green if can place, red if cannot
      
      // Update ghost brick material directly (it's a simple Mesh, not a Group)
      const material = (this.ghostBrick as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (material) {
        material.color.setHex(color);
      }
      
    } else {
      this.ghostBrick.visible = false;
    }
  }

  // Clear all bricks
  public clearAllBricks(): void {
    this.placedBricks.forEach(brick => this.scene.remove(brick));
    this.placedBricks = [];
    this.occupiedPositions.clear();
    
    // Clean up scene objects
    this.sceneObjects.placedBricks = [];
    this.sceneObjects.solidObjects = this.sceneObjects.solidObjects.filter(obj => !obj.userData.isBrick);
    this.sceneObjects.groundObjects = this.sceneObjects.groundObjects.filter(obj => !obj.userData.isBrick);
    
    // Reset carried state
    this.gameState.isCarryingBrick = false;
    if (this.carriedBrick) {
      this.carriedBrick.visible = false;
      this.sceneObjects.carriedBrick = null;
    }
  }

  public clearRemoteBricks(): void {
    console.log('🧹 Clearing remote bricks before sync...');
    
    // Filter out only remote bricks from placed bricks
    const remoteBricks = this.placedBricks.filter(brick => brick.userData.isNetworkBrick);
    const localBricks = this.placedBricks.filter(brick => !brick.userData.isNetworkBrick);
    
    console.log(`🧹 Found ${remoteBricks.length} remote bricks and ${localBricks.length} local bricks`);
    
    // Remove remote bricks from scene
    remoteBricks.forEach(brick => {
      this.scene.remove(brick);
      
      // Remove from occupied positions
      const gridPos = brick.userData.gridPosition;
      if (gridPos) {
        const key = `${gridPos.x},${gridPos.z},${gridPos.layer}`;
        this.occupiedPositions.delete(key);
      }
    });
    
    // Update placed bricks array to only contain local bricks
    this.placedBricks = localBricks;
    
    // Clean up scene objects - only remove remote bricks
    this.sceneObjects.placedBricks = this.sceneObjects.placedBricks.filter(brick => !brick.userData.isNetworkBrick);
    this.sceneObjects.solidObjects = this.sceneObjects.solidObjects.filter(obj => 
      !obj.userData.isBrick || !obj.userData.isNetworkBrick
    );
    this.sceneObjects.groundObjects = this.sceneObjects.groundObjects.filter(obj => 
      !obj.userData.isBrick || !obj.userData.isNetworkBrick
    );
    
    console.log(`✅ Cleared ${remoteBricks.length} remote bricks, kept ${localBricks.length} local bricks`);
  }

  // Get layer progress for the UI
  public getLayerProgress(layer: number): { filled: number, total: number, percentage: number } {
    if (layer < 0 || layer >= this.MAX_LAYERS) {
      return { filled: 0, total: 0, percentage: 0 };
    }

    let filled = 0;
    const total = this.GRID_SIZE * this.GRID_SIZE;

    for (let x = 0; x < this.GRID_SIZE; x++) {
      for (let z = 0; z < this.GRID_SIZE; z++) {
        const key = `${x},${z},${layer}`;
        if (this.occupiedPositions.has(key)) {
          filled++;
        }
      }
    }

    return {
      filled,
      total,
      percentage: total > 0 ? (filled / total) * 100 : 0
    };
  }

  // Get current active layer
  public getCurrentActiveLayer(): number {
    for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
      const progress = this.getLayerProgress(layer);
      if (progress.percentage < 100) {
        return layer;
      }
    }
    return this.MAX_LAYERS - 1;
  }

  // Debug method
  public debugBrickVisibility(): void {
    // Debug method - logging removed for performance
  }  // Debug platform and grid setup
  public debugPlatformSetup(): void {
    // Debug method - logging removed for performance
  }

  // Performance monitoring and optimization
   private checkAndOptimizePerformance(): void {
     this.frameCount++;
     const now = performance.now();
     
     // Initialize lastPerformanceCheck if not set
     if (this.lastPerformanceCheck === 0) {
       this.lastPerformanceCheck = now;
       return;
     }
     
     // Check performance every 60 frames
     if (this.frameCount % 60 === 0) {
       const deltaTime = now - this.lastPerformanceCheck;
       const fps = 60000 / deltaTime; // Calculate FPS
       
       // Enable performance mode if FPS drops below 30
       if (fps < 30 && !this.performanceMode) {
         this.performanceMode = true;
         this.enablePerformanceMode();
       } else if (fps > 45 && this.performanceMode) {
         this.performanceMode = false;
       }
       
       this.lastPerformanceCheck = now;
     }
   }

  private enablePerformanceMode(): void {
     // Reduce shadow quality for existing bricks
     this.placedBricks.forEach(brick => {
       if (brick instanceof THREE.Mesh) {
         brick.castShadow = false;
         brick.receiveShadow = false;
         
         // Switch to basic material if possible
         if (brick.material instanceof THREE.MeshStandardMaterial) {
           const basicMaterial = new THREE.MeshBasicMaterial({ 
             color: brick.material.color 
           });
           brick.material = basicMaterial;
         }
       }
     });
   }

  // Getters
  public getGridSize(): { x: number, z: number } {
    return { x: this.GRID_SIZE, z: this.GRID_SIZE };
  }
  public getMaxLayers(): number { return this.MAX_LAYERS; }
  public getPlatformTop(): number { return this.platformTop; }
  public isCarryingBrick(): boolean { return this.gameState.isCarryingBrick; }
  public getPlacedBricksCount(): number { return this.placedBricks.length; }

  public debugFillCurrentLayer(): void {
    for (let x = 0; x < this.GRID_SIZE; x++) {
      for (let z = 0; z < this.GRID_SIZE; z++) {
        const gridPos = { x, z, layer: this.currentLayer };
        const key = `${x},${z},${this.currentLayer}`;
        if (!this.occupiedPositions.has(key)) {
          if (this.canPlaceBrick(gridPos)) {
            const worldPos = this.gridToWorld(gridPos);
            const color = this.brickColors[Math.floor(Math.random() * this.brickColors.length)];
            const brick = this.createOptimizedBrickMesh(worldPos, color);
            this.scene.add(brick);
            this.placedBricks.push(brick);
            this.sceneObjects.placedBricks.push(brick);
            this.sceneObjects.solidObjects.push(brick);
            this.sceneObjects.groundObjects.push(brick);
            this.occupiedPositions.add(key);

            const brickData = {
              position: worldPos,
              worldPosition: worldPos,
              color: color,
              gridPosition: gridPos
            };
            this.multiplayerSystem.sendBrickPlaced(brickData);
          }
        }
      }
    }
    this.checkLayerCompletion();
  }

  public debugNextLayer(): void {
    if (this.currentLayer < this.MAX_LAYERS - 1) {
      this.currentLayer++;
    }
  }

  public debugLayerProgress(): void {
    // Debug method - logging removed for performance
  }

  public debugClearBricks(): void {
    this.placedBricks.forEach(brick => this.scene.remove(brick));
    this.placedBricks = [];
    this.sceneObjects.placedBricks = [];
    // Also remove from solid and ground objects
    this.sceneObjects.solidObjects = this.sceneObjects.solidObjects.filter(obj => !obj.userData.isBrick);
    this.sceneObjects.groundObjects = this.sceneObjects.groundObjects.filter(obj => !obj.userData.isBrick);
    this.occupiedPositions.clear();
    this.currentLayer = 0;
    this.completedLayers.fill(false);
    // Clear stairs if they exist
    // This requires stairs to be identifiable, e.g., by adding userData
  }
}
