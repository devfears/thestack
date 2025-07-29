import { NetworkPlayer, BrickData, ChatMessage } from '../../network/NetworkManager';
import { MultiplayerCore } from './MultiplayerCore';
import { RemotePlayerManager } from './RemotePlayerManager';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Handles all multiplayer events and network callbacks
 */
export class MultiplayerEventHandler {
  private core: MultiplayerCore;
  private remotePlayerManager: RemotePlayerManager;

  // Duplicate brick prevention
  private processedBricks: Set<string> = new Set();
  private lastBrickCleanup: number = 0;

  constructor(core: MultiplayerCore, remotePlayerManager: RemotePlayerManager) {
    this.core = core;
    this.remotePlayerManager = remotePlayerManager;
    
    this.setupNetworkCallbacks();
  }

  private setupNetworkCallbacks(): void {
    const networkManager = this.core.getNetworkManager();

    // Player events
    networkManager.onCurrentPlayers(this.handleCurrentPlayers.bind(this));
    networkManager.onPlayerUpdate(this.handlePlayerUpdate.bind(this));

    // Game events
    networkManager.onBrickPlaced(this.handleRemoteBrickPlaced.bind(this));
    networkManager.onChatMessage(this.handleChatMessage.bind(this));
    networkManager.onGameState(this.handleGameState.bind(this));
    networkManager.onClearAllBricks(this.handleClearAllBricks.bind(this));
  }

  private handleCurrentPlayers(players: NetworkPlayer[]): void {
    console.log(`🎭 MultiplayerEventHandler.handleCurrentPlayers called with ${players.length} players`);
    console.log(`📋 Players:`, players.map(p => `${p.displayName} (${p.id})`));
    
    // Use the player state manager instead of direct remote player manager
    const playerStateManager = this.core.getPlayerStateManager();
    console.log(`📞 Calling playerStateManager.handlePlayersList`);
    playerStateManager.handlePlayersList(players, 'event-handler');
  }



  private handlePlayerUpdate(player: NetworkPlayer): void {
    // Use the player state manager for updates
    const playerStateManager = this.core.getPlayerStateManager();
    playerStateManager.handlePlayerUpdate(player);
  }

  private handleRemoteBrickPlaced(brickData: BrickData): void {
    console.log('🧱 MultiplayerEventHandler.handleRemoteBrickPlaced called!');
    console.log('🧱 Remote brick placed by:', brickData.playerName);
    console.log('🔍 Brick data received:', {
      playerId: brickData.playerId,
      playerName: brickData.playerName,
      gridPosition: brickData.gridPosition,
      color: `#${(brickData.color || 0x4169E1).toString(16).padStart(6, '0')}`
    });

    // Skip if this brick was placed by the local player (to avoid duplicates)
    const localPlayerId = this.core.getNetworkManager().getLocalPlayerId();
    console.log('🔍 Local player ID:', localPlayerId, 'Remote player ID:', brickData.playerId);
    if (brickData.playerId === localPlayerId) {
      console.log('🚫 Skipping local player brick to avoid duplicate');
      return;
    }
    console.log('✅ This is a remote player brick, proceeding...');

    const brickSystem = this.core.getGameManager().getBrickSystem();
    if (!brickSystem) {
      console.error('❌ Brick system not found');
      return;
    }

    // Create a position-based identifier for the cache
    const positionKey = `${brickData.gridPosition.x},${brickData.gridPosition.z},${brickData.gridPosition.layer}`;
    
    // Check if we already processed this brick
    if (this.processedBricks.has(positionKey)) {
      console.log('🚫 Skipping duplicate brick:', positionKey);
      return;
    }

    // Check if position is already occupied by a local brick
    if (brickSystem.isPositionOccupied(brickData.gridPosition)) {
      console.log('🚫 Position already occupied by local brick, but still placing remote brick:', positionKey);
      // Continue anyway - server has authority
    }

    this.processedBricks.add(positionKey);

    // Use the brick system's method to place remote brick
    console.log('🔧 Calling brickSystem.placeRemoteBrick with:', {
      gridPosition: brickData.gridPosition,
      color: brickData.color
    });
    
    const brick = brickSystem.placeRemoteBrick(brickData.gridPosition, brickData.color);
    
    if (brick) {
      console.log('✅ Remote brick created successfully:', {
        position: brick.position,
        gridPosition: brickData.gridPosition,
        color: `#${(brickData.color || 0x4169E1).toString(16).padStart(6, '0')}`,
        visible: brick.visible,
        inScene: this.core.getScene().children.includes(brick),
        userData: brick.userData
      });
      
      // Force visibility check
      if (!brick.visible) {
        console.warn('⚠️ Remote brick created but not visible, forcing visibility');
        brick.visible = true;
      }
      
      // Ensure brick is in scene
      if (!this.core.getScene().children.includes(brick)) {
        console.warn('⚠️ Remote brick not in scene, adding it');
        this.core.getScene().add(brick);
      }
      
      // Debug: Check if brick is visible in scene
      const gameManager = this.core.getGameManager();
      const sceneObjects = gameManager.getSceneObjects();
      console.log('🔍 Scene objects placedBricks count:', sceneObjects.placedBricks?.length || 0);
      console.log('🔍 Scene objects solidObjects count:', sceneObjects.solidObjects?.length || 0);
      
      // Additional debug: Check material and geometry
      if (brick instanceof THREE.Mesh) {
        console.log('🔍 Brick mesh details:', {
          geometry: !!brick.geometry,
          material: !!brick.material,
          materialColor: brick.material instanceof THREE.MeshStandardMaterial ? 
            `#${brick.material.color.getHex().toString(16).padStart(6, '0')}` : 'unknown',
          scale: brick.scale,
          castShadow: brick.castShadow,
          receiveShadow: brick.receiveShadow
        });
      }
      
    } else {
      console.error('❌ Failed to create remote brick');
    }

    // Clean up old processed bricks periodically
    const now = Date.now();
    if (now - this.lastBrickCleanup > 300000) {
      this.processedBricks.clear();
      this.lastBrickCleanup = now;
      console.log('🧹 Cleaned up processed bricks cache');
    }
  }

  private handleChatMessage(message: ChatMessage): void {
    console.log('💬 Chat message from', message.username + ':', message.text);

    // Dispatch custom event for chat UI to handle
    const chatEvent = new CustomEvent('multiplayer-chat', {
      detail: message
    });
    window.dispatchEvent(chatEvent);
  }

  private handleGameState(gameState: any): void {
    console.log('🎮 Received game state update:', gameState);

    // Handle game state synchronization
    if (gameState.tower && gameState.tower.length > 0) {
      console.log('🏗️ Loading tower state:', gameState.tower.length, 'bricks');
      
      // Load all existing bricks from the tower state
      gameState.tower.forEach((brickData: any) => {
        // Convert server brick data to our BrickData format
        const networkBrickData: BrickData = {
          position: new THREE.Vector3(brickData.position.x, brickData.position.y, brickData.position.z),
          worldPosition: new THREE.Vector3(brickData.worldPosition.x, brickData.worldPosition.y, brickData.worldPosition.z),
          color: brickData.color,
          gridPosition: {
            x: brickData.gridPosition.x,
            z: brickData.gridPosition.z,
            layer: brickData.gridPosition.layer
          },
          playerId: brickData.playerId,
          playerName: brickData.playerName
        };
        
        // Skip if this brick was placed by the local player (to avoid duplicates)
        const localPlayerId = this.core.getNetworkManager().getLocalPlayerId();
        if (brickData.playerId === localPlayerId) {
          console.log('🚫 Skipping local player brick during tower sync to avoid duplicate');
          return;
        }
        
        const positionKey = `${brickData.gridPosition.x},${brickData.gridPosition.z},${brickData.gridPosition.layer}`;
        const gameManager = this.core.getGameManager();
        const brickSystem = gameManager.getBrickSystem();
        
        if (!brickSystem) {
          console.error('❌ Brick system not found during tower sync');
          return;
        }
        
        // Check if we already processed this brick
        if (this.processedBricks.has(positionKey)) {
          console.log('🚫 Skipping duplicate brick during tower sync:', positionKey);
          return;
        }
        
        // Check if position is occupied, but proceed anyway (server has authority)
        if (brickSystem.isPositionOccupied(brickData.gridPosition)) {
          console.log('🚫 Position occupied by local brick, but still placing remote brick during sync:', positionKey);
        }
        
        this.processedBricks.add(positionKey);
        
        // Use the brick system's method to place remote brick
        const brick = brickSystem.placeRemoteBrick(networkBrickData.gridPosition, networkBrickData.color);
        
        if (brick) {
          console.log('✅ Remote brick created during tower sync:', {
            position: brick.position,
            gridPosition: networkBrickData.gridPosition,
            color: networkBrickData.color,
            visible: brick.visible,
            inScene: this.core.getScene().children.includes(brick)
          });
        } else {
          console.error('❌ Failed to create remote brick during tower sync');
        }
      });
      
      console.log('✅ Tower state loaded successfully');
    }
  }

  private handleClearAllBricks(): void {
    console.log('🧹 Handling clear all bricks from network...');
    
    // Clear all network bricks
    this.clearAllNetworkBricks();
    
    // Also clear local bricks (but don't send network event to avoid loops)
    const gameManager = this.core.getGameManager();
    const brickSystem = gameManager.getBrickSystem();
    if (brickSystem && typeof brickSystem.clearAllBricks === 'function') {
      brickSystem.clearAllBricks();
    }
    
    console.log('✅ All bricks cleared from network event');
  }

  public clearAllNetworkBricks(): void {
    console.log('🧹 Clearing all network bricks...');
    
    const gameManager = this.core.getGameManager();
    const scene = this.core.getScene();
    
    // Remove all network bricks from scene
    const objectsToRemove: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.userData.isNetworkBrick || 
          child.name.includes('network-brick') || 
          child.name.includes('fallback-network-brick')) {
        objectsToRemove.push(child);
      }
    });
    
    objectsToRemove.forEach(obj => {
      scene.remove(obj);
    });
    
    // Clear from physics arrays
    const sceneObjects = gameManager.getSceneObjects() as any;
    sceneObjects.solidObjects = sceneObjects.solidObjects.filter((obj: any) => !obj.userData.isNetworkBrick);
    sceneObjects.groundObjects = sceneObjects.groundObjects.filter((obj: any) => !obj.userData.isNetworkBrick);
    
    // Clear processed bricks cache
    this.processedBricks.clear();
    
    console.log('✅ All network bricks cleared');
  }

  private createRemoteBrick(brickData: BrickData): void {
    console.log('🧱 Creating remote brick at:', brickData.gridPosition);
    
    const gameManager = this.core.getGameManager();
    const brickSystem = gameManager.getBrickSystem();
    
    if (!brickSystem) {
      console.error('❌ Brick system not found');
      return;
    }
    
    // Use the brick system's method to place remote brick
    const brick = brickSystem.placeRemoteBrick(brickData.gridPosition, brickData.color);
    
    if (brick) {
      console.log('✅ Remote brick created successfully:', {
        position: brick.position,
        visible: brick.visible,
        color: `#${(brickData.color || 0x4169E1).toString(16).padStart(6, '0')}`,
        name: brick.name,
        inScene: this.core.getScene().children.includes(brick)
      });
    } else {
      console.error('❌ Failed to create remote brick');
    }
  }

  public dispose(): void {
    console.log('🧹 Disposing multiplayer event handler...');
    
    // Clear all network bricks
    this.clearAllNetworkBricks();
    
    console.log('✅ Multiplayer event handler disposed');
  }
}