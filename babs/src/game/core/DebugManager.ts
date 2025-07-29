import * as THREE from 'three';
import { GameState, SceneObjects } from './types';
import { UnifiedBrickSystem } from '../building/UnifiedBrickSystem';
import { MultiplayerManager } from './MultiplayerManager';

/**
 * Manages all debug and testing functionality
 * Follows Single Responsibility Principle by focusing only on debugging concerns
 */
export class DebugManager {
  private brickSystem: UnifiedBrickSystem;
  private multiplayerManager: MultiplayerManager;
  private gameState: GameState;
  private sceneObjects: SceneObjects;

  constructor(
    brickSystem: UnifiedBrickSystem,
    multiplayerManager: MultiplayerManager,
    gameState: GameState,
    sceneObjects: SceneObjects
  ) {
    this.brickSystem = brickSystem;
    this.multiplayerManager = multiplayerManager;
    this.gameState = gameState;
    this.sceneObjects = sceneObjects;
  }

  /**
   * Expose all debug functions to global scope for easy testing
   */
  public exposeGlobalDebugFunctions(
    clearAllBricksCallback: () => void,
    pickupBrickCallback: () => boolean
  ): void {
    // Basic brick operations
    (window as any).clearAllBricks = clearAllBricksCallback;
    (window as any).giveBrick = pickupBrickCallback;
    
    // Brick system debug functions
    (window as any).debugFillCurrentLayer = () => this.brickSystem.debugFillCurrentLayer();
    (window as any).debugNextLayer = () => this.brickSystem.debugNextLayer();
    (window as any).debugClearBricks = () => this.brickSystem.debugClearBricks();
    
    // Advanced debug functions
    (window as any).hardReset = () => this.hardReset(clearAllBricksCallback);
    (window as any).debugBrickState = () => this.debugBrickState();
    (window as any).testBrickPlacement = () => this.testBrickPlacement(pickupBrickCallback);
    (window as any).fixFloatingBricks = () => this.fixFloatingBricks();
    
    // Grid debug functions
    (window as any).debugGrid = () => this.debugGrid();
    (window as any).showGrid = () => this.showGrid();
    (window as any).toggleGrid = () => this.toggleGrid();
    (window as any).debugGridSystem = () => this.debugGridSystem();
    
    // Test functions
    (window as any).testCentering = () => this.testCentering(clearAllBricksCallback);
    
    // Legacy functions (disabled but kept for compatibility)
    (window as any).fillAllLayers = (maxLayers = 4) => this.fillAllLayers(maxLayers);
    (window as any).fillLayer = (layerNumber = 0) => this.fillLayer(layerNumber);
  }

  /**
   * Perform a hard reset of the game state
   */
  private hardReset(clearAllBricksCallback: () => void): void {
    console.log('🔥 HARD RESET: Clearing everything and resetting grid...');

    // Clear all bricks (local and network)
    clearAllBricksCallback();

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
  }

  /**
   * Debug current brick state
   */
  private debugBrickState(): void {
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
  }

  /**
   * Test brick placement functionality
   */
  private testBrickPlacement(pickupBrickCallback: () => boolean): void {
    console.log('🧪 Testing brick placement...');
    if (this.gameState.isCarryingBrick) {
      console.log('✅ Already carrying a brick - try placing it');
    } else {
      console.log('🎯 Picking up a brick for testing...');
      pickupBrickCallback();
    }
  }

  /**
   * Fix floating bricks by adjusting their Y positions
   */
  private fixFloatingBricks(): void {
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
  }

  /**
   * Debug grid system
   */
  private debugGrid(): void {
    console.log('🔲 Grid debug - unified system');
  }

  /**
   * Show grid visualization
   */
  private showGrid(): void {
    console.log('🔲 Grid visualization - unified system');
  }

  /**
   * Toggle grid visibility
   */
  private toggleGrid(): void {
    console.log('🔲 Grid toggle - unified system');
  }

  /**
   * Debug grid system information
   */
  private debugGridSystem(): void {
    console.log('🔍 Grid System Debug Info:');
    console.log('⚠️ Grid system debug temporarily disabled - UnifiedBrickSystem uses different architecture');
  }

  /**
   * Test grid centering
   */
  private testCentering(clearAllBricksCallback: () => void): void {
    console.log('🎯 Testing grid centering with corner bricks...');
    
    // Clear first
    clearAllBricksCallback();
    
    console.log('⚠️ Spawn test bricks temporarily disabled - UnifiedBrickSystem uses different architecture');
  }

  /**
   * Legacy function - fill all layers (disabled)
   */
  private fillAllLayers(maxLayers: number): number {
    console.log(`🏗️ FILL ALL LAYERS: Spawning bricks on all positions for ${maxLayers} layers...`);
    console.log('⚠️ fillAllLayers temporarily disabled - UnifiedBrickSystem uses different architecture');
    return 0;
  }

  /**
   * Legacy function - fill specific layer (disabled)
   */
  private fillLayer(layerNumber: number): number {
    console.log(`🔨 FILL LAYER ${layerNumber}: Spawning bricks on all positions...`);
    console.log('⚠️ fillLayer temporarily disabled - UnifiedBrickSystem uses different architecture');
    return 0;
  }

  /**
   * Test the unified brick system
   */
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

  /**
   * Debug multiplayer system
   */
  public debugMultiplayer(): void {
    this.multiplayerManager.debug();
  }

  /**
   * Print help information
   */
  public printHelp(): void {
    console.log('🎮 === GAME CONTROLS & DEBUG COMMANDS ===');
    console.log('');
    console.log('🎯 Basic Controls:');
    console.log('  - WASD: Move character');
    console.log('  - Space: Jump');
    console.log('  - E: Pick up brick (near pile) / Place brick (when carrying)');
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
}