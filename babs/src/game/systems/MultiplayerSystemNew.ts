import * as THREE from 'three';
import { NetworkPlayer, BrickData, ChatMessage } from '../network/NetworkManager';
import { UserProfile } from '../core/types';
import { GameManager } from '../core/GameManager';

// Import our modular components
import { MultiplayerCore } from './multiplayer/MultiplayerCore';
import { RemotePlayerManager } from './multiplayer/RemotePlayerManager';
import { MultiplayerEventHandler } from './multiplayer/MultiplayerEventHandler';
import { MultiplayerDebugTools } from './multiplayer/MultiplayerDebugTools';

/**
 * Main multiplayer system - orchestrates all multiplayer functionality
 * This is a much cleaner, modular version of the original 1261-line monolith
 */
export class MultiplayerSystem {
  private core: MultiplayerCore;
  private remotePlayerManager: RemotePlayerManager;
  private eventHandler: MultiplayerEventHandler;
  private debugTools: MultiplayerDebugTools;

  constructor(gameManager: GameManager, scene: THREE.Scene) {
    // Initialize core components
    this.core = new MultiplayerCore(gameManager, scene);
    this.remotePlayerManager = new RemotePlayerManager(this.core);
    this.eventHandler = new MultiplayerEventHandler(this.core, this.remotePlayerManager);
    this.debugTools = new MultiplayerDebugTools(this.core, this.remotePlayerManager);
  }

  // === PUBLIC API ===

  public async connect(user: UserProfile): Promise<boolean> {
    const connected = await this.core.connect(user);
    
    if (connected) {
      // Set up network event handlers for disconnection management
      // Note: socket access handled internally by NetworkManager
    }
    
    return connected;
  }

  public disconnect(): void {
    this.core.disconnect();
  }

  public setOnPlayerCountChange(callback: (count: number) => void): void {
    this.core.setOnPlayerCountChange(callback);
  }

  public isMultiplayerEnabled(): boolean {
    return this.core.isMultiplayerEnabled();
  }

  public getConnectionState(): string {
    return this.core.getConnectionStateManager().getConnectionState();
  }

  public getRemotePlayerCount(): number {
    return this.remotePlayerManager.getRemotePlayerCount();
  }

  public setNametagVisible(visible: boolean): void {
    this.remotePlayerManager.setNametagVisible(visible);
  }

  // === PLAYER UPDATES ===

  public sendPlayerUpdate(
    position: THREE.Vector3,
    rotation: THREE.Euler,
    isCarryingBrick: boolean,
    animationState?: string,
    forceUpdate?: boolean
  ): void {
    if (!this.core.isMultiplayerEnabled()) return;

    this.core.getNetworkManager().sendPlayerUpdate({
      position,
      rotation,
      isCarryingBrick,
      animationState,
      forceUpdate
    });
  }

  // === CHAT SYSTEM ===

  public sendChatMessage(text: string, user: UserProfile): void {
    if (!this.core.isMultiplayerEnabled()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      username: user.username,
      text: text,
      timestamp: new Date(),
      pfpUrl: user.pfpUrl
    };

    this.core.getNetworkManager().sendChatMessage(message);
  }

  // === BRICK SYSTEM ===

  public sendBrickPlaced(brickData: {
    position: THREE.Vector3;
    worldPosition: THREE.Vector3;
    color: number;
    gridPosition: { x: number, z: number, layer: number };
  }): void {
    if (!this.core.isMultiplayerEnabled()) return;
    if (!this.core.getNetworkManager().isConnectedToServer()) return;

    this.core.getNetworkManager().sendBrickPlaced(brickData);
  }

  public sendBrickPickedUp(): void {
    if (!this.core.isMultiplayerEnabled()) return;

    this.core.getNetworkManager().sendBrickPickedUp();
  }

  public sendClearAllBricks(): void {
    if (!this.core.isMultiplayerEnabled()) return;

    this.core.getNetworkManager().sendClearAllBricks();
  }

  // === ANIMATION SYSTEM ===

  public playRemotePlayerAnimation(playerId: string, animationName: string): void {
    this.remotePlayerManager.playRemotePlayerAnimation(playerId, animationName);
  }

  // === UPDATE LOOP ===

  public update(deltaTime: number): void {
    if (!this.core.isMultiplayerEnabled()) return;

    // Update remote player animations and movement interpolation
    this.remotePlayerManager.updateAnimations(deltaTime);

    // Update nametag scaling for consistent size
    const camera = this.core.getGameManager().getCamera();
    this.remotePlayerManager.updateNametagScaling(camera);

    // Smooth interpolation for remote player positions
    const remotePlayers = this.remotePlayerManager.getRemotePlayers();
    const playerTargets = this.remotePlayerManager.getPlayerTargets();
    const now = Date.now();

    remotePlayers.forEach((playerGroup, playerId) => {
      const target = playerTargets.get(playerId);
      if (target) {
        // Check if the update is recent (within 1 second)
        const timeSinceUpdate = now - target.lastUpdate;
        if (timeSinceUpdate > 1000) {
          // Skip interpolation for stale data
          return;
        }

        // Smooth interpolation towards target position
        const currentPos = playerGroup.position;
        const targetPos = target.position;
        const distance = currentPos.distanceTo(targetPos);

        if (distance > 0.005) { // Reduced threshold for more responsive updates
          // More aggressive interpolation for real-time movement
          // Use higher lerp factor for recent updates
          let lerpFactor;
          if (timeSinceUpdate < 100) {
            // Very recent update - be very aggressive
            lerpFactor = Math.min(deltaTime * 25, 0.8);
          } else if (timeSinceUpdate < 300) {
            // Recent update - be aggressive
            lerpFactor = Math.min(deltaTime * 20, 0.6);
          } else {
            // Older update - be more conservative
            lerpFactor = Math.min(deltaTime * 15, 0.4);
          }

          // Interpolate position
          playerGroup.position.lerp(targetPos, lerpFactor);

          // Interpolate rotation with same factor
          playerGroup.rotation.x = THREE.MathUtils.lerp(playerGroup.rotation.x, target.rotation.x, lerpFactor);
          playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, target.rotation.y, lerpFactor);
          playerGroup.rotation.z = THREE.MathUtils.lerp(playerGroup.rotation.z, target.rotation.z, lerpFactor);
        }
      }
    });
  }

  // === DEBUG TOOLS ===

  public toggleRemotePlayerDebug(): void {
    this.debugTools.toggleRemotePlayerDebug();
  }

  public forceRemotePlayerFallback(): void {
    this.debugTools.forceRemotePlayerFallback();
  }

  public startUpdateFrequencyMonitor(): void {
    this.debugTools.startUpdateFrequencyMonitor();
  }

  public stopUpdateFrequencyMonitor(): void {
    this.debugTools.stopUpdateFrequencyMonitor();
  }

  public debugRemotePlayers(): void {
    this.debugTools.debugRemotePlayers();
  }

  public requestForceSync(): void {
    this.debugTools.requestForceSync();
  }

  public forceResyncBricks(): void {
    
    if (!this.core.isMultiplayerEnabled()) {
      
      return;
    }

    // Request fresh game state from server
    this.core.getNetworkManager().requestForceSync();
    
  }

  public forceCleanupAllRemotePlayers(): void {
    this.remotePlayerManager.forceCleanupAllRemotePlayers();
  }

  public clearAllNetworkBricks(): void {
    
    this.core.clearAllNetworkBricks();
    this.eventHandler.clearAllNetworkBricks();
  }

  // === LEGACY COMPATIBILITY ===
  // These properties are exposed for backward compatibility with existing code

  public get networkManager() {
    return this.core.getNetworkManager();
  }

  public get remotePlayers() {
    return this.remotePlayerManager.getRemotePlayers();
  }

  public get playerTargets() {
    return this.remotePlayerManager.getPlayerTargets();
  }

  // === DISPOSAL ===

  public dispose(): void {
    
    // Dispose all components in reverse order
    this.debugTools.dispose();
    this.eventHandler.dispose();
    this.remotePlayerManager.dispose();
    this.core.dispose();

  }
}
