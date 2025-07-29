import * as THREE from 'three';
import { SceneObjects, GameState } from '../core/types';
import { MultiplayerSystem } from '../systems/MultiplayerSystemNew';
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
  private multiplayerSystem: MultiplayerSystem;
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

  constructor(scene: THREE.Scene, sceneObjects: SceneObjects, gameState: GameState, multiplayerSystem: MultiplayerSystem, animationSystem: AnimationSystemManager) {
    this.scene = scene;
    this.sceneObjects = sceneObjects;
    this.gameState = gameState;
    this.multiplayerSystem = multiplayerSystem;
    this.animationSystem = animationSystem;
    
    this.initializeSystem();
  }

  private initializeSystem(): void {
    console.log('🔧 Initializing Unified Brick System...');
    
    // Calculate platform info
    this.calculatePlatformInfo();
    
    // Note: Carried brick and ghost brick will be created after master brick is loaded
    console.log('⏳ Waiting for master brick to be loaded before creating carried/ghost bricks');
    
    console.log('✅ Unified Brick System initialized');
    console.log('📍 Platform top:', this.platformTop);
    console.log('📍 Grid origin:', this.gridOrigin);
    console.log('📏 Cell size:', this.CELL_SIZE);
    console.log('📏 Brick height:', this.BRICK_HEIGHT);
  }

  // Method to initialize bricks after master brick is loaded
  public initializeAfterMasterBrick(): void {
    console.log('🧱 Initializing carried and ghost bricks after master brick loaded...');
    
    if (!this.sceneObjects.masterBrick) {
      console.error('❌ Master brick still not available!');
      return;
    }
    
    // Create carried brick
    this.createCarriedBrick();
    
    // Create ghost brick
    this.createGhostBrick();
    
    console.log('✅ Carried and ghost bricks initialized');
  }

  // Method to recalculate platform info after platform is loaded
  public recalculatePlatformInfo(): void {
    console.log('🏗️ Recalculating platform info after platform loaded...');
    this.calculatePlatformInfo();
    console.log('✅ Platform info recalculated');
    console.log('📍 Updated platform top:', this.platformTop);
    console.log('📍 Updated grid origin:', this.gridOrigin);
  }

  private calculatePlatformInfo(): void {
    if (!this.sceneObjects.buildingPlatform) {
      console.warn('⚠️ No building platform found');
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
    console.log('🔧 Creating carried brick...');
    const geometry = new THREE.BoxGeometry(this.CELL_SIZE, this.BRICK_HEIGHT, this.CELL_SIZE);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.carriedBrick = new THREE.Mesh(geometry, material);
    this.carriedBrick.visible = false; // Initially hidden
    this.scene.add(this.carriedBrick);
    console.log('✅ Carried brick created and added to scene');
  }

  private createBrickMesh(position: THREE.Vector3, color: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(this.CELL_SIZE, this.BRICK_HEIGHT, this.CELL_SIZE);
    const material = new THREE.MeshStandardMaterial({ color });
    const brick = new THREE.Mesh(geometry, material);
    brick.position.copy(position);
    return brick;
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
    console.log('🔧 Creating ghost brick...');
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
    console.log('✅ Ghost brick created and added to scene');
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
    console.log('🌐 UnifiedBrickSystem.placeRemoteBrick called with:', {
      gridPos,
      color: `#${color.toString(16).padStart(6, '0')}`
    });
    
    // Skip validation for remote bricks - trust the server
    const worldPos = this.gridToWorld(gridPos);
    console.log('🌍 Calculated world position:', worldPos);
    
    // Use optimized brick creation for remote bricks
    const brick = this.createOptimizedBrickMesh(worldPos, color);
    console.log('🧱 Created brick mesh:', {
      position: brick.position,
      visible: brick.visible,
      geometry: !!brick.geometry,
      material: !!brick.material
    });
    
    // Mark as network brick
    brick.userData.isBrick = true;
    brick.userData.isNetworkBrick = true;
    brick.userData.gridPosition = gridPos;
    brick.visible = true;
    
    // Ensure the brick has a unique name for debugging
    brick.name = `network-brick-${gridPos.x}-${gridPos.z}-${gridPos.layer}`;
    
    // Add to scene and tracking
    this.scene.add(brick);
    this.placedBricks.push(brick);
    this.sceneObjects.placedBricks.push(brick);
    this.sceneObjects.solidObjects.push(brick);
    this.sceneObjects.groundObjects.push(brick);
    
    console.log('📊 Updated tracking arrays:', {
      placedBricksCount: this.placedBricks.length,
      sceneObjectsPlacedBricksCount: this.sceneObjects.placedBricks.length,
      solidObjectsCount: this.sceneObjects.solidObjects.length,
      groundObjectsCount: this.sceneObjects.groundObjects.length,
      brickInScene: this.scene.children.includes(brick)
    });
    
    // Mark position as occupied
    const key = `${gridPos.x},${gridPos.z},${gridPos.layer}`;
    this.occupiedPositions.add(key);
    console.log('🔒 Position marked as occupied:', key);
    
    // Debug: Log remote brick placement and current layer progress
    const currentLayer = this.getCurrentActiveLayer();
    const progress = this.getLayerProgress(currentLayer);
    console.log(`🔍 Remote brick placed at ${JSON.stringify(gridPos)}, Layer ${currentLayer + 1} progress: ${progress.filled}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
    
    // Check layer completion for remote bricks too
    this.checkLayerCompletion();
    
    // Final verification
    console.log('✅ Remote brick placement complete:', {
      brickName: brick.name,
      position: brick.position,
      visible: brick.visible,
      inScene: this.scene.children.includes(brick),
      userData: brick.userData
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
        console.log(`Layer ${this.currentLayer - 1} complete! Moving to layer ${this.currentLayer}.`);
        this.createStaircase(this.currentLayer -1);
        // Here you could trigger UI updates or other game events
      } else {
        console.log('All layers complete! Structure finished!');
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
        
        // Mark the connecting position as occupied
        const connectingKey = `${connectingX},${connectingZ},${layer}`;
        this.occupiedPositions.add(connectingKey);
      }
    }
    
    console.log(`Staircase created extending from platform side up to layer ${forLayer}`);
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
        console.log('✅ Carried brick is now visible with color:', `#${color.toString(16).padStart(6, '0')}`);
    }

    // Play pickup animation
    this.animationSystem.playPickupAnimation();
    console.log('🎬 Playing pickup animation');

    return true;
  }

  // Place a brick
  public placeBrick(): boolean {
    if (!this.gameState.isCarryingBrick || !this.ghostBrick) {
      return false;
    }

    // Use ghost brick's position for placement
    const worldPos = this.ghostBrick.position;
    const gridPos = this.worldToGrid(worldPos);

    // Also check if ghost brick is visible (which implies it's in a valid general area)
    // and if the position is valid for placement.
    if (!gridPos || !this.canPlaceBrick(gridPos) || !this.ghostBrick.visible) {
      return false;
    }

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
    
    if (this.multiplayerSystem && this.multiplayerSystem.isMultiplayerEnabled()) {
      try {
        this.multiplayerSystem.sendBrickPlaced(brickData);
        console.log('📤 Brick placement sent to multiplayer system');
      } catch (error) {
        console.error('❌ Failed to send brick placement to multiplayer system:', error);
      }
    } else {
      console.warn('⚠️ Multiplayer system not available or not enabled, skipping brick sync');
    }
    
    this.checkLayerCompletion();

    // Play place animation
    this.animationSystem.playPlaceAnimation();
    console.log('🎬 Playing place animation');

    console.log(`Brick placed at ${JSON.stringify(gridPos)}`);
    
    // Final visibility check
    const isBrickInScene = this.scene.children.includes(brick);
    console.log(`🔍 Final check: Brick in scene: ${isBrickInScene}, Visible: ${brick.visible}`);
    brick.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        console.log(`  - Child mesh visible: ${(child as THREE.Mesh).visible}, Material opacity: ${((child as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity}`);
      }
    });

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
    console.log('🔍 Brick Visibility Debug:');
    console.log('  Master brick exists:', !!this.sceneObjects.masterBrick);
    console.log('  Carried brick exists:', !!this.carriedBrick);
    console.log('  Carried brick visible:', this.carriedBrick?.visible);
    console.log('  Ghost brick exists:', !!this.ghostBrick);
    console.log('  Ghost brick visible:', this.ghostBrick?.visible);
    console.log('  Placed bricks count:', this.placedBricks.length);
    
    if (this.carriedBrick) {
      console.log('  Carried brick position:', this.carriedBrick.position);
      console.log('  Carried brick scale:', this.carriedBrick.scale);
      this.carriedBrick.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          console.log(`    Child - visible: ${mesh.visible}, material:`, mesh.material);
        }
      });
    }
    
    this.placedBricks.forEach((brick, index) => {
      console.log(`  Placed brick ${index} - visible: ${brick.visible}, position:`, brick.position);
    });
  }

  // Debug platform and grid setup
  public debugPlatformSetup(): void {
    console.log('🏗️ Platform & Grid Debug:');
    console.log('  Building platform exists:', !!this.sceneObjects.buildingPlatform);
    console.log('  Platform top Y:', this.platformTop);
    console.log('  Platform center:', this.platformCenter);
    console.log('  Grid origin:', this.gridOrigin);
    console.log('  Grid size:', this.GRID_SIZE);
    console.log('  Cell size:', this.CELL_SIZE);
    console.log('  Brick height:', this.BRICK_HEIGHT);
    
    if (this.sceneObjects.buildingPlatform) {
      const platformBox = new THREE.Box3().setFromObject(this.sceneObjects.buildingPlatform);
      console.log('  Platform bounds:', {
        min: platformBox.min,
        max: platformBox.max,
        size: platformBox.getSize(new THREE.Vector3())
      });
      
      // Calculate expected grid coverage
      const gridWorldSize = this.GRID_SIZE * this.CELL_SIZE;
      console.log('  Grid world size:', gridWorldSize);
      console.log('  Platform size:', platformBox.getSize(new THREE.Vector3()));
      console.log('  Grid coverage ratio:', {
        x: gridWorldSize / platformBox.getSize(new THREE.Vector3()).x,
        z: gridWorldSize / platformBox.getSize(new THREE.Vector3()).z
      });
    }
    
    if (this.sceneObjects.character) {
      console.log('  Character position:', this.sceneObjects.character.position);
      const characterPlatformPos = this.sceneObjects.character.position.clone();
      characterPlatformPos.y = this.platformTop;
      const gridPos = this.worldToGrid(characterPlatformPos);
      console.log('  Character grid position (at platform level):', gridPos);
      
      // Test distance calculation
      const distanceFromCenter = Math.sqrt(
        Math.pow(this.sceneObjects.character.position.x - this.platformCenter.x, 2) + 
        Math.pow(this.sceneObjects.character.position.z - this.platformCenter.z, 2)
      );
      const maxDistance = (this.GRID_SIZE * this.CELL_SIZE) / 2 + 2;
      console.log('  Distance from platform center:', distanceFromCenter.toFixed(2));
      console.log('  Max allowed distance:', maxDistance.toFixed(2));
      console.log('  Within range:', distanceFromCenter <= maxDistance);
    }
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
         console.log('🚀 Performance mode enabled due to low FPS:', fps.toFixed(1));
       } else if (fps > 45 && this.performanceMode) {
         this.performanceMode = false;
         console.log('✅ Performance mode disabled, FPS improved:', fps.toFixed(1));
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
    console.log(`[DEBUG] Filling layer ${this.currentLayer}...`);
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
    console.log(`[DEBUG] Layer ${this.currentLayer -1} filled.`);
  }

  public debugNextLayer(): void {
    if (this.currentLayer < this.MAX_LAYERS - 1) {
      this.currentLayer++;
      console.log(`[DEBUG] Manually advanced to layer ${this.currentLayer}.`);
    } else {
      console.log(`[DEBUG] Already at the max layer.`);
    }
  }

  public debugLayerProgress(): void {
    const currentLayer = this.getCurrentActiveLayer();
    const progress = this.getLayerProgress(currentLayer);
    console.log(`📊 Layer ${currentLayer + 1} progress: ${progress.filled}/${progress.total} bricks (${progress.percentage.toFixed(1)}%)`);
    console.log(`📊 Total occupied positions: ${this.occupiedPositions.size}`);
    
    // Count positions by layer
    const layerCounts: { [key: number]: number } = {};
    const layerPositions: { [key: number]: string[] } = {};
    
    for (const key of this.occupiedPositions) {
      const parts = key.split(',');
      const layer = parseInt(parts[2]);
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;
      if (!layerPositions[layer]) layerPositions[layer] = [];
      layerPositions[layer].push(key);
    }
    
    console.log('📊 Brick counts by layer:', layerCounts);
    console.log('📊 Current active layer:', currentLayer + 1);
    console.log('📊 All occupied positions:', Array.from(this.occupiedPositions));
    
    // Show sample of positions for layer 0
    if (layerPositions[0]) {
      console.log('📊 Layer 1 positions (first 10):', layerPositions[0].slice(0, 10));
    }
    
    // Check if LayerProgressUI is working
    console.log('📊 LayerProgressUI should be updating every 500ms');
  }

  public debugClearBricks(): void {
    console.log('[DEBUG] Clearing all bricks...');
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
    console.log('[DEBUG] All bricks cleared.');
  }
}