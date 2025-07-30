const fs = require('fs');
const path = require('path');

/**
 * Enhanced brick persistence system for multiplayer server
 * Handles proper persistence, deduplication, and state management
 */
class BrickPersistenceManager {
  constructor() {
    this.towerFilePath = path.join(__dirname, 'towerState.json');
    this.gameState = {
      tower: [], // Array of placed bricks
      currentLayer: 0,
      lastUpdated: Date.now(),
      version: 1
    };
    
    // In-memory brick tracking for fast access
    this.brickPositions = new Map(); // "x,z,layer" -> brickData
    
    this.loadTowerState();
    
    // Auto-save every 30 seconds
    setInterval(() => this.saveTowerState(), 30000);
  }

  /**
   * Load tower state from disk
   */
  loadTowerState() {
    try {
      if (fs.existsSync(this.towerFilePath)) {
        const data = fs.readFileSync(this.towerFilePath, 'utf8');
        const savedState = JSON.parse(data);
        
        this.gameState = {
          ...this.gameState,
          ...savedState,
          lastLoaded: Date.now()
        };
        
        // Rebuild position map for fast lookups
        this.rebuildPositionMap();
        
        console.log(`📁 Loaded tower state: ${this.gameState.tower.length} bricks, layer ${this.gameState.currentLayer}`);
      } else {
        console.log('📁 No saved tower state found, starting fresh');
        this.saveTowerState();
      }
    } catch (error) {
      console.error('❌ Failed to load tower state:', error);
      // Continue with empty state
    }
  }

  /**
   * Save tower state to disk
   */
  saveTowerState() {
    try {
      this.gameState.lastUpdated = Date.now();
      fs.writeFileSync(this.towerFilePath, JSON.stringify(this.gameState, null, 2));
      console.log(`💾 Saved tower state: ${this.gameState.tower.length} bricks`);
    } catch (error) {
      console.error('❌ Failed to save tower state:', error);
    }
  }

  /**
   * Rebuild the position map from tower array
   */
  rebuildPositionMap() {
    this.brickPositions.clear();
    this.gameState.tower.forEach(brick => {
      if (brick.gridPosition) {
        const key = `${brick.gridPosition.x},${brick.gridPosition.z},${brick.gridPosition.layer}`;
        this.brickPositions.set(key, brick);
      }
    });
  }

  /**
   * Add a brick (with deduplication)
   */
  addBrick(brickData, playerId, playerName) {
    if (!brickData.gridPosition) {
      console.error('❌ Brick missing gridPosition:', brickData);
      return false;
    }

    const key = `${brickData.gridPosition.x},${brickData.gridPosition.z},${brickData.gridPosition.layer}`;
    
    // Check for duplicates
    if (this.brickPositions.has(key)) {
      console.log(`🚫 Duplicate brick rejected at ${key}`);
      return false;
    }

    // Create enhanced brick data
    const enhancedBrick = {
      ...brickData,
      playerId,
      playerName,
      timestamp: Date.now(),
      id: `${playerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Add to both storage systems
    this.gameState.tower.push(enhancedBrick);
    this.brickPositions.set(key, enhancedBrick);

    // Update current layer
    if (brickData.gridPosition.layer > this.gameState.currentLayer) {
      this.gameState.currentLayer = brickData.gridPosition.layer;
    }

    console.log(`🧱 Brick added at ${key} by ${playerName} (Total: ${this.gameState.tower.length})`);
    
    // Save state immediately on brick placement
    this.saveTowerState();
    
    return true;
  }

  /**
   * Clear all bricks
   */
  clearAllBricks(playerId, playerName) {
    const previousCount = this.gameState.tower.length;
    
    this.gameState.tower = [];
    this.gameState.currentLayer = 0;
    this.brickPositions.clear();
    
    console.log(`🧹 All ${previousCount} bricks cleared by ${playerName}`);
    
    this.saveTowerState();
    return true;
  }

  /**
   * Get current game state (for new players joining)
   */
  getCurrentState() {
    return {
      ...this.gameState,
      brickCount: this.gameState.tower.length,
      positionCount: this.brickPositions.size
    };
  }

  /**
   * Get brick at specific position
   */
  getBrickAt(x, z, layer) {
    const key = `${x},${z},${layer}`;
    return this.brickPositions.get(key);
  }

  /**
   * Force cleanup - remove invalid bricks
   */
  cleanup() {
    const originalCount = this.gameState.tower.length;
    
    // Remove bricks without valid grid positions
    this.gameState.tower = this.gameState.tower.filter(brick => 
      brick.gridPosition && 
      typeof brick.gridPosition.x === 'number' && 
      typeof brick.gridPosition.z === 'number' && 
      typeof brick.gridPosition.layer === 'number'
    );

    if (this.gameState.tower.length !== originalCount) {
      console.log(`🧹 Cleaned up ${originalCount - this.gameState.tower.length} invalid bricks`);
      this.rebuildPositionMap();
      this.saveTowerState();
    }
  }
}

module.exports = BrickPersistenceManager;
