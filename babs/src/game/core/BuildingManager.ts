import * as THREE from 'three';
import { GameState, SceneObjects } from './types';
import { UnifiedBrickSystem } from '../building/UnifiedBrickSystem';
import { MultiplayerManager } from './MultiplayerManager';

/**
 * Manages all building-related functionality
 * Follows Single Responsibility Principle by focusing only on building concerns
 */
export class BuildingManager {
  private brickSystem: UnifiedBrickSystem;
  private multiplayerManager: MultiplayerManager;
  private gameState: GameState;
  private sceneObjects: SceneObjects;
  private scene: THREE.Scene;

  constructor(
    brickSystem: UnifiedBrickSystem,
    multiplayerManager: MultiplayerManager,
    gameState: GameState,
    sceneObjects: SceneObjects,
    scene: THREE.Scene
  ) {
    this.brickSystem = brickSystem;
    this.multiplayerManager = multiplayerManager;
    this.gameState = gameState;
    this.sceneObjects = sceneObjects;
    this.scene = scene;
  }

  /**
   * Toggle build mode on/off
   */
  public toggleBuildMode(): void {
    this.gameState.isBuildMode = !this.gameState.isBuildMode;
    console.log(`🏗️ Build mode: ${this.gameState.isBuildMode ? 'ON' : 'OFF'}`);
    
    // Update UI or visual indicators here if needed
    // This could trigger UI updates through events
  }

  /**
   * Attempt to pick up a brick from the pile
   */
  public pickupBrick(): boolean {
    if (!this.sceneObjects.character || !this.sceneObjects.brickPile) {
      console.log('❌ Character or brick pile not found');
      return false;
    }

    if (this.gameState.isCarryingBrick) {
      console.log('❌ Already carrying a brick');
      return false;
    }

    // Check distance to brick pile
    const distance = this.sceneObjects.character.position.distanceTo(this.sceneObjects.brickPile.position);
    const maxDistance = 3;

    if (distance > maxDistance) {
      console.log(`❌ Too far from brick pile (${distance.toFixed(1)} > ${maxDistance})`);
      return false;
    }

    // Use unified brick system to pick up brick
    const success = this.brickSystem.pickupBrick();
    if (success) {
      this.gameState.isCarryingBrick = true;
      console.log('✅ Picked up brick!');
      
      // Sync with multiplayer if connected
      if (this.multiplayerManager.isConnected() && this.sceneObjects.character) {
        this.multiplayerManager.forceSync(this.sceneObjects.character, this.gameState);
      }
    }

    return success;
  }

  /**
   * Attempt to place the carried brick
   */
  public placeBrick(): boolean {
    if (!this.gameState.isCarryingBrick) {
      console.log('❌ Not carrying a brick');
      return false;
    }

    if (!this.sceneObjects.character) {
      console.log('❌ Character not found');
      return false;
    }

    // Use unified brick system to place brick
    const success = this.brickSystem.placeBrick();
    if (success) {
      this.gameState.isCarryingBrick = false;
      console.log('✅ Placed brick!');
      
      // Sync with multiplayer if connected
      if (this.multiplayerManager.isConnected() && this.sceneObjects.character) {
        this.multiplayerManager.forceSync(this.sceneObjects.character, this.gameState);
      }
    }

    return success;
  }

  /**
   * Handle brick interaction (pickup or place)
   */
  public handleBrickInteraction(): boolean {
    if (this.gameState.isCarryingBrick) {
      return this.placeBrick();
    } else {
      return this.pickupBrick();
    }
  }

  /**
   * Clear all placed bricks
   */
  public clearAllBricks(): void {
    console.log('🧹 Clearing all bricks...');
    
    // Clear from unified brick system
    this.brickSystem.clearAllBricks();
    
    // Clear from scene objects array
    this.sceneObjects.placedBricks.forEach(brick => {
      if (brick.parent) {
        brick.parent.remove(brick);
      }
    });
    this.sceneObjects.placedBricks.length = 0;
    
    // Reset carrying state
    this.gameState.isCarryingBrick = false;
    
    // Hide carried brick if visible
    if (this.sceneObjects.carriedBrick) {
      this.sceneObjects.carriedBrick.visible = false;
      this.sceneObjects.carriedBrick = null;
    }
    
    // Sync with multiplayer
    if (this.multiplayerManager.isConnected()) {
      this.multiplayerManager.sendClearAllBricks();
    }
    
    console.log('✅ All bricks cleared');
  }

  /**
   * Get current layer information
   */
  public getCurrentLayer(): number {
    return this.brickSystem.getCurrentActiveLayer();
  }

  /**
   * Get maximum layers
   */
  public getMaxLayers(): number {
    return this.brickSystem.getMaxLayers();
  }

  /**
   * Get total number of placed bricks
   */
  public getPlacedBricksCount(): number {
    return this.brickSystem.getPlacedBricksCount();
  }

  /**
   * Get grid size
   */
  public getGridSize(): { x: number; z: number } {
    return this.brickSystem.getGridSize();
  }

  /**
   * Get cell size
   */
  public getCellSize(): number {
    return this.brickSystem.CELL_SIZE;
  }

  /**
   * Get brick height
   */
  public getBrickHeight(): number {
    return 0.24; // BRICK_HEIGHT from UnifiedBrickSystem
  }

  /**
   * Get grid origin
   */
  public getGridOrigin(): THREE.Vector3 {
    // This would need to be exposed from UnifiedBrickSystem if needed
    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Check if currently carrying a brick
   */
  public isCarryingBrick(): boolean {
    return this.gameState.isCarryingBrick;
  }

  /**
   * Check if in build mode
   */
  public isBuildMode(): boolean {
    return this.gameState.isBuildMode;
  }

  /**
   * Update building system (called from game loop)
   */
  public update(): void {
    // Update carried brick position
    this.brickSystem.updateCarriedBrick();
    
    // Update ghost brick visibility and position
    this.updateGhostBrick();
  }

  /**
   * Update ghost brick position and visibility
   */
  private updateGhostBrick(): void {
    if (!this.gameState.isCarryingBrick || !this.sceneObjects.ghostBrick) {
      if (this.sceneObjects.ghostBrick) {
        this.sceneObjects.ghostBrick.visible = false;
      }
      return;
    }

    // Update ghost brick using the unified brick system's method
    if (this.sceneObjects.camera) {
      this.brickSystem.updateGhostBrick(this.sceneObjects.camera);
    }
  }

  /**
   * Handle brick placement from multiplayer
   */
  public handleMultiplayerBrickPlacement(data: any): void {
    console.log('🌐 Received multiplayer brick placement:', data);
    
    // This would need to be implemented in UnifiedBrickSystem if needed
    // For now, just log the received data
    console.log('Multiplayer brick placement received but not yet implemented');
  }

  /**
   * Handle brick clearing from multiplayer
   */
  public handleMultiplayerBrickClear(): void {
    console.log('🌐 Received multiplayer brick clear');
    this.clearAllBricks();
  }

  /**
   * Dispose of building manager resources
   */
  public dispose(): void {
    // Clean up any building-specific resources
    if (this.sceneObjects.ghostBrick) {
      this.sceneObjects.ghostBrick.visible = false;
    }
    
    if (this.sceneObjects.carriedBrick) {
      this.sceneObjects.carriedBrick.visible = false;
    }
    
    // Reset state
    this.gameState.isCarryingBrick = false;
    this.gameState.isBuildMode = false;
  }
}