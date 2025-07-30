import * as THREE from 'three';
import { NetworkPlayer } from '../../network/NetworkManager';
import { MultiplayerCore } from './MultiplayerCore';
import { RemotePlayerManager } from './RemotePlayerManager';

/**
 * Debug and testing tools for multiplayer system
 */
export class MultiplayerDebugTools {
  private core: MultiplayerCore;
  private remotePlayerManager: RemotePlayerManager;

  // Debug tracking
  private updateCounts: Map<string, { count: number, lastReset: number }> = new Map();
  private debugUpdateFrequency: boolean = false;
  private updateFrequencyInterval: NodeJS.Timeout | null = null;

  constructor(core: MultiplayerCore, remotePlayerManager: RemotePlayerManager) {
    this.core = core;
    this.remotePlayerManager = remotePlayerManager;
  }

  // Debug method to toggle debug mode for remote players
  public toggleRemotePlayerDebug(): void {
    const remotePlayers = this.remotePlayerManager.getRemotePlayers();
    
    remotePlayers.forEach((playerGroup, playerId) => {
      // Remove existing debug box if present
      const existingDebugBox = playerGroup.getObjectByName('debug-box');
      if (existingDebugBox) {
        playerGroup.remove(existingDebugBox);
        return;
      }

      // Add a bright debug box around each remote player
      const debugBox = new THREE.Mesh(
        new THREE.BoxGeometry(2, 3, 2),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
          wireframe: true,
          transparent: true,
          opacity: 0.8
        })
      );
      debugBox.name = 'debug-box';
      debugBox.position.set(0, 1.5, 0); // Center the debug box
      playerGroup.add(debugBox);

    });
  }

  // Force all remote players to use fallback geometry for testing
  public forceRemotePlayerFallback(): void {
    
    const remotePlayers = this.remotePlayerManager.getRemotePlayers();
    const playerTargets = this.remotePlayerManager.getPlayerTargets();

    // Get current player data
    const currentPlayers: { id: string, displayName: string, position: THREE.Vector3, rotation: THREE.Euler }[] = [];
    remotePlayers.forEach((playerGroup, playerId) => {
      const target = playerTargets.get(playerId);
      if (target) {
        currentPlayers.push({
          id: playerId,
          displayName: playerGroup.name.replace('player-', ''),
          position: target.position.clone(),
          rotation: target.rotation.clone()
        });
      }
    });

    // Remove all current remote players
    this.remotePlayerManager.forceCleanupAllRemotePlayers();

    // Recreate them with fallback geometry
    currentPlayers.forEach(playerData => {
      const mockPlayer: NetworkPlayer = {
        id: playerData.id,
        displayName: playerData.displayName,
        username: playerData.displayName,
        position: playerData.position,
        rotation: playerData.rotation,
        isCarryingBrick: false,
        lastUpdate: Date.now()
      };
      this.remotePlayerManager.createRemotePlayer(mockPlayer);
    });

  }

  // Debug method to start monitoring update frequency
  public startUpdateFrequencyMonitor(): void {
    this.debugUpdateFrequency = true;
    
    // Also start a detailed monitor
    
    const updateCounts = new Map<string, number>();

    this.updateFrequencyInterval = setInterval(() => {
      const remotePlayers = this.remotePlayerManager.getRemotePlayers();
      
      updateCounts.forEach((count, playerId) => {
        
      });
      
      updateCounts.clear();
      
    }, 1000);
  }

  // Debug method to stop monitoring update frequency
  public stopUpdateFrequencyMonitor(): void {
    this.debugUpdateFrequency = false;
    this.updateCounts.clear();
    
    if (this.updateFrequencyInterval) {
      clearInterval(this.updateFrequencyInterval);
      this.updateFrequencyInterval = null;
      
    }
  }

  // Debug method to list current remote players
  public debugRemotePlayers(): void {
    
    const remotePlayers = this.remotePlayerManager.getRemotePlayers();
    const playerTargets = this.remotePlayerManager.getPlayerTargets();
    
    remotePlayers.forEach((playerGroup, playerId) => {
      
    });

    // Also log network manager state
    const networkManager = this.core.getNetworkManager();
    
  }

  // Method to request force sync from server
  public requestForceSync(): void {
    
    this.core.getNetworkManager().requestForceSync();
  }

  // Method to send test player update
  public sendTestPlayerUpdate(): void {
    const networkManager = this.core.getNetworkManager();
    
    if (!this.core.isMultiplayerEnabled()) {
      
      return;
    }

    networkManager.sendPlayerUpdate({
      position: new THREE.Vector3(Math.random() * 10 - 5, 2, Math.random() * 10 - 5),
      rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
      isCarryingBrick: false,
      forceUpdate: true
    });
  }

  // Method to simulate network lag
  public simulateNetworkLag(delayMs: number = 100): void {
    
    const networkManager = this.core.getNetworkManager();
    const originalSendPlayerUpdate = networkManager.sendPlayerUpdate.bind(networkManager);
    
    networkManager.sendPlayerUpdate = function(data: any) {
      setTimeout(() => {
        originalSendPlayerUpdate(data);
      }, delayMs);
    };
    
    // Restore after 30 seconds
    setTimeout(() => {
      networkManager.sendPlayerUpdate = originalSendPlayerUpdate;
      
    }, 30000);
  }

  // Method to stress test with rapid updates
  public stressTestUpdates(count: number = 100, intervalMs: number = 10): void {
    
    let sentCount = 0;
    const stressInterval = setInterval(() => {
      this.sendTestPlayerUpdate();
      sentCount++;
      
      if (sentCount >= count) {
        clearInterval(stressInterval);
        
      }
    }, intervalMs);
  }

  public dispose(): void {
    this.stopUpdateFrequencyMonitor();
    this.updateCounts.clear();
  }
}
