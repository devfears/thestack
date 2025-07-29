import * as THREE from 'three';
import { UserProfile, GameState } from './types';
import { MultiplayerSystem } from '../systems/MultiplayerSystemNew';

/**
 * Manages all multiplayer functionality and communication
 * Follows Single Responsibility Principle by focusing only on multiplayer concerns
 */
export class MultiplayerManager {
  private multiplayerSystem: MultiplayerSystem;
  private onRemotePlayerCountChange: ((count: number) => void) | null = null;
  
  // Track last sent position for movement detection
  private lastSentPosition: THREE.Vector3;
  private lastSentRotation: THREE.Euler;
  private lastSentCarryingBrick: boolean;

  constructor(
    scene: THREE.Scene,
    gameManagerRef: any, // Reference to GameManager for system integration
    onRemotePlayerCountChange: (count: number) => void
  ) {
    this.multiplayerSystem = new MultiplayerSystem(gameManagerRef, scene);
    this.onRemotePlayerCountChange = onRemotePlayerCountChange;
    
    // Initialize tracking variables
    this.lastSentPosition = new THREE.Vector3();
    this.lastSentRotation = new THREE.Euler();
    this.lastSentCarryingBrick = false;
    
    // Set up player count change callback
    this.multiplayerSystem.setOnPlayerCountChange((count) => {
      this.onRemotePlayerCountChange?.(count);
    });
    
    // Clear any existing network bricks from previous sessions
    this.multiplayerSystem.clearAllNetworkBricks();
  }

  /**
   * Connect to multiplayer with user profile
   */
  public async connect(user: UserProfile): Promise<boolean> {
    try {
      const success = await this.multiplayerSystem.connect(user);
      if (success) {
        console.log('🎮 Connected to multiplayer successfully');
      }
      return success;
    } catch (error) {
      console.warn('⚠️ Failed to connect to multiplayer:', error);
      return false;
    }
  }

  /**
   * Disconnect from multiplayer
   */
  public disconnect(): void {
    this.multiplayerSystem.disconnect();
  }

  /**
   * Check if multiplayer is enabled and connected
   */
  public isConnected(): boolean {
    return this.multiplayerSystem.isMultiplayerEnabled();
  }

  /**
   * Get the number of remote players
   */
  public getRemotePlayerCount(): number {
    return this.multiplayerSystem.getRemotePlayerCount();
  }

  /**
   * Update multiplayer system (called from game loop)
   */
  public update(deltaTime: number): void {
    this.multiplayerSystem.update(deltaTime);
  }

  /**
   * Send player position update if significant changes detected
   */
  public sendPlayerUpdateIfChanged(
    character: THREE.Object3D,
    gameState: GameState
  ): void {
    if (!this.isConnected() || !character) return;

    const currentPosition = character.position;
    const currentRotation = character.rotation;
    const currentCarryingBrick = gameState.isCarryingBrick;

    // Check if position, rotation, or carrying state has changed significantly
    const positionChanged = this.lastSentPosition.distanceTo(currentPosition) > 0.005;
    const rotationChanged = Math.abs(this.lastSentRotation.y - currentRotation.y) > 0.02;
    const carryingStateChanged = this.lastSentCarryingBrick !== currentCarryingBrick;
    const animationStateChanged = gameState.animationStateChanged;

    // Send update if anything significant changed
    if (positionChanged || rotationChanged || carryingStateChanged || animationStateChanged) {
      this.multiplayerSystem.sendPlayerUpdate(
        currentPosition,
        currentRotation,
        currentCarryingBrick,
        gameState.lastAnimationState,
        animationStateChanged || carryingStateChanged // Force update for important state changes
      );

      // Update last sent values
      this.lastSentPosition.copy(currentPosition);
      this.lastSentRotation.copy(currentRotation);
      this.lastSentCarryingBrick = currentCarryingBrick;
    }
  }

  /**
   * Force immediate multiplayer position sync
   */
  public forceSync(character: THREE.Object3D, gameState: GameState): void {
    if (character && this.isConnected()) {
      this.multiplayerSystem.sendPlayerUpdate(
        character.position,
        character.rotation,
        gameState.isCarryingBrick,
        gameState.lastAnimationState,
        true // Force update
      );
    }
  }

  /**
   * Send chat message
   */
  public sendChatMessage(text: string, user: UserProfile): void {
    this.multiplayerSystem.sendChatMessage(text, user);
  }

  /**
   * Clear all network bricks
   */
  public clearAllNetworkBricks(): void {
    this.multiplayerSystem.clearAllNetworkBricks();
  }

  /**
   * Send clear all bricks event to other clients
   */
  public sendClearAllBricks(): void {
    this.multiplayerSystem.sendClearAllBricks();
  }

  /**
   * Set nametag visibility for remote players
   */
  public setNametagVisible(visible: boolean): void {
    this.multiplayerSystem.setNametagVisible(visible);
  }

  // Debug methods
  public debug(): void {
    console.log('=== MULTIPLAYER DEBUG ===');
    console.log('Multiplayer enabled:', this.isConnected());
    console.log('Remote player count:', this.getRemotePlayerCount());
    this.multiplayerSystem.debugRemotePlayers();
  }

  public toggleRemotePlayerDebug(): void {
    this.multiplayerSystem.toggleRemotePlayerDebug();
  }

  public forceRemotePlayerFallback(): void {
    this.multiplayerSystem.forceRemotePlayerFallback();
  }

  public startUpdateFrequencyMonitor(): void {
    this.multiplayerSystem.startUpdateFrequencyMonitor();
  }

  public stopUpdateFrequencyMonitor(): void {
    this.multiplayerSystem.stopUpdateFrequencyMonitor();
  }

  public forceCleanupRemotePlayers(): void {
    this.multiplayerSystem.forceCleanupAllRemotePlayers();
  }

  public debugRemotePlayersInfo(): void {
    this.multiplayerSystem.debugRemotePlayers();
  }

  public requestForceSync(): void {
    this.multiplayerSystem.requestForceSync();
  }

  /**
   * Dispose of multiplayer resources
   */
  public dispose(): void {
    this.multiplayerSystem.dispose();
  }
}