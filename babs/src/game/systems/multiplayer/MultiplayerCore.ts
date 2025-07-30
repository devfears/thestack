import * as THREE from 'three';
import { NetworkManager } from '../../network/NetworkManager';
import { UserProfile } from '../../core/types';
import { GameManager } from '../../core/GameManager';
import { ConnectionStateManager } from './ConnectionStateManager';
import { PlayerStateManager } from './PlayerStateManager';

/**
 * Core multiplayer system - handles connection and basic state management
 * Now uses enhanced state managers to prevent ghost characters and connection issues
 */
export class MultiplayerCore {
  protected networkManager: NetworkManager;
  protected gameManager: GameManager;
  protected scene: THREE.Scene;
  protected isEnabled: boolean = false;
  protected isConnecting: boolean = false;
  protected onPlayerCountChange: ((count: number) => void) | null = null;

  // Enhanced state management
  private connectionStateManager: ConnectionStateManager;
  private playerStateManager: PlayerStateManager;

  constructor(gameManager: GameManager, scene: THREE.Scene) {
    this.gameManager = gameManager;
    this.scene = scene;
    
    // Initialize NetworkManager with error handling
    try {
      this.networkManager = new NetworkManager();
      console.log('✅ NetworkManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize NetworkManager:', error);
      throw error;
    }
    
    // Initialize enhanced state managers
    this.connectionStateManager = ConnectionStateManager.getInstance();
    this.playerStateManager = new PlayerStateManager();
    
    this.setupStateManagers();
  }

  public async connect(user: UserProfile): Promise<boolean> {
    // Use connection state manager to prevent duplicate connections
    const canConnect = await this.connectionStateManager.requestConnection(user);
    
    if (!canConnect) {
      return this.isEnabled;
    }

    this.isConnecting = true;

    try {
      const connected = await this.networkManager.connect(user);
      
      if (connected) {
        const connectionId = this.networkManager.getLocalPlayerId();
        if (connectionId) {
          this.connectionStateManager.onConnectionSuccess(connectionId);
          this.playerStateManager.setLocalPlayerId(connectionId);
        }
        
        this.isEnabled = connected;
      } else {
        this.connectionStateManager.onConnectionFailure();
        this.isEnabled = false;
      }
      
      return connected;
    } catch (error) {
      console.error('❌ Error during multiplayer connection:', error);
      this.connectionStateManager.onConnectionFailure();
      this.isEnabled = false;
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  public disconnect(): void {
    // Use connection state manager for clean disconnection
    this.connectionStateManager.requestDisconnection();
    
    this.networkManager.disconnect();
    this.isEnabled = false;
    this.isConnecting = false;
    
    // Clean up all players
    this.playerStateManager.forceCleanup();
  }

  public setOnPlayerCountChange(callback: (count: number) => void): void {
    this.onPlayerCountChange = callback;
  }

  public isMultiplayerEnabled(): boolean {
    // Add defensive checks to prevent runtime errors
    if (!this.networkManager) {
      console.warn('⚠️ NetworkManager is not initialized');
      return false;
    }
    
    // Check if socket exists and is connected
    let socketConnected = false;
    try {
      const socket = this.networkManager.getSocket();
      socketConnected = socket?.connected || false;
    } catch (error) {
      console.warn('Could not check socket connection status:', error);
    }
    
    // Use network manager's connection status as primary check
    const networkManagerConnected = this.networkManager.isConnectedToServer();
    
    // Enable multiplayer if either the socket is connected OR network manager reports connected
    const shouldBeEnabled = socketConnected || networkManagerConnected;
    
    // Update internal state if connection is detected
    if (shouldBeEnabled && !this.isEnabled) {
      console.log('🔧 Connection detected, enabling multiplayer');
      this.isEnabled = true;
    }
    
    const result = shouldBeEnabled && this.isEnabled;
    
    return result;
  }

  public getNetworkManager(): NetworkManager {
    return this.networkManager;
  }

  public getGameManager(): GameManager {
    return this.gameManager;
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  private setupStateManagers(): void {
    // Set up connection state manager callbacks
    this.connectionStateManager.setCallbacks(
      (state: string) => {
        if (state === 'disconnected') {
          this.isEnabled = false;
          this.isConnecting = false;
        } else if (state === 'connecting' || state === 'reconnecting') {
          this.isConnecting = true;
        } else if (state === 'connected') {
          this.isEnabled = true;
          this.isConnecting = false;
        }
      },
      async (user: UserProfile) => {
        // Reconnection callback
        return await this.networkManager.connect(user);
      },
      () => {
        // Disconnection callback
        this.networkManager.disconnect();
        this.playerStateManager.forceCleanup();
      }
    );

    // Set up player state manager callbacks (will be connected to RemotePlayerManager)
    this.playerStateManager.setCallbacks(
      (_player) => {
        // Player added - will be handled by RemotePlayerManager
      },
      (_playerId) => {
        // Player removed - will be handled by RemotePlayerManager
      },
      (_player) => {
        // Player updated - will be handled by RemotePlayerManager
      },
      (players) => {
        // Players list changed - include local player in count
        const totalPlayerCount = players.length + 1; // +1 for local player
        console.log(`👥 Player count changed: ${players.length} remote + 1 local = ${totalPlayerCount} total`);
        if (this.onPlayerCountChange) {
          this.onPlayerCountChange(totalPlayerCount);
        }
      }
    );
  }

  public clearAllNetworkBricks(): void {
    
    // Remove all network bricks from scene
    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.traverse((child) => {
      if (child.userData.isNetworkBrick || 
          child.name.includes('network-brick') || 
          child.name.includes('fallback-network-brick')) {
        objectsToRemove.push(child);
      }
    });
    
    objectsToRemove.forEach(obj => {
      this.scene.remove(obj);
    });
    
    // Clear from physics arrays
    const sceneObjects = this.gameManager.getSceneObjects() as any;
    sceneObjects.solidObjects = sceneObjects.solidObjects.filter((obj: any) => !obj.userData.isNetworkBrick);
    sceneObjects.groundObjects = sceneObjects.groundObjects.filter((obj: any) => !obj.userData.isNetworkBrick);
    
  }

  public getPlayerStateManager(): PlayerStateManager {
    return this.playerStateManager;
  }

  public getConnectionStateManager(): ConnectionStateManager {
    return this.connectionStateManager;
  }

  public dispose(): void {
    
    // Clear all network bricks first
    this.clearAllNetworkBricks();

    // Dispose state managers
    this.playerStateManager.dispose();
    this.connectionStateManager.dispose();

    // Disconnect from network
    this.networkManager.disconnect();

  }
}