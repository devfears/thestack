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

      console.log(`Added debug box to player ${playerId}`);
    });
  }

  // Force all remote players to use fallback geometry for testing
  public forceRemotePlayerFallback(): void {
    console.log('🔧 Forcing all remote players to use fallback geometry...');

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

    console.log(`✅ Recreated ${currentPlayers.length} remote players with fallback geometry`);
  }

  // Debug method to start monitoring update frequency
  public startUpdateFrequencyMonitor(): void {
    this.debugUpdateFrequency = true;
    console.log('📊 Started monitoring player update frequency');

    // Also start a detailed monitor
    console.log('🔍 Starting detailed update frequency monitor...');
    const updateCounts = new Map<string, number>();

    this.updateFrequencyInterval = setInterval(() => {
      const remotePlayers = this.remotePlayerManager.getRemotePlayers();
      
      console.log('=== UPDATE FREQUENCY REPORT ===');
      console.log(`Remote players: ${remotePlayers.size}`);
      
      updateCounts.forEach((count, playerId) => {
        console.log(`Player ${playerId}: ${count} updates/sec`);
      });
      
      updateCounts.clear();
      console.log('=== END REPORT ===');
    }, 1000);
  }

  // Debug method to stop monitoring update frequency
  public stopUpdateFrequencyMonitor(): void {
    this.debugUpdateFrequency = false;
    this.updateCounts.clear();
    console.log('📊 Stopped monitoring player update frequency');

    if (this.updateFrequencyInterval) {
      clearInterval(this.updateFrequencyInterval);
      this.updateFrequencyInterval = null;
      console.log('🔍 Stopped detailed update frequency monitor');
    }
  }

  // Debug method to list current remote players
  public debugRemotePlayers(): void {
    console.log('=== REMOTE PLAYERS DEBUG ===');
    
    const remotePlayers = this.remotePlayerManager.getRemotePlayers();
    const playerTargets = this.remotePlayerManager.getPlayerTargets();
    
    console.log(`Total remote players: ${remotePlayers.size}`);

    remotePlayers.forEach((playerGroup, playerId) => {
      console.log(`Player ${playerId}:`);
      console.log(`  - Group in scene: ${this.core.getScene().children.includes(playerGroup)}`);
      console.log(`  - Group children: ${playerGroup.children.length}`);
      console.log(`  - Position: [${playerGroup.position.toArray()}]`);
      console.log(`  - Has target: ${playerTargets.has(playerId)}`);
    });

    console.log('=== END REMOTE PLAYERS DEBUG ===');

    // Also log network manager state
    const networkManager = this.core.getNetworkManager();
    console.log('=== NETWORK MANAGER DEBUG ===');
    console.log(`Connected: ${networkManager.isConnectedToServer()}`);
    console.log(`Local player ID: ${networkManager.getLocalPlayerId()}`);
    console.log(`Remote players in NetworkManager: ${networkManager.getRemotePlayers().size}`);
    console.log('=== END NETWORK MANAGER DEBUG ===');
  }

  // Method to request force sync from server
  public requestForceSync(): void {
    console.log('🔄 Requesting force sync from server...');
    this.core.getNetworkManager().requestForceSync();
  }

  // Method to send test player update
  public sendTestPlayerUpdate(): void {
    const networkManager = this.core.getNetworkManager();
    
    if (!this.core.isMultiplayerEnabled()) {
      console.warn('⚠️ Multiplayer not enabled');
      return;
    }

    console.log('📤 Sending test player update...');
    networkManager.sendPlayerUpdate({
      position: new THREE.Vector3(Math.random() * 10 - 5, 2, Math.random() * 10 - 5),
      rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
      isCarryingBrick: false,
      forceUpdate: true
    });
  }

  // Method to simulate network lag
  public simulateNetworkLag(delayMs: number = 100): void {
    console.log(`🐌 Simulating ${delayMs}ms network lag...`);
    
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
      console.log('✅ Network lag simulation ended');
    }, 30000);
  }

  // Method to stress test with rapid updates
  public stressTestUpdates(count: number = 100, intervalMs: number = 10): void {
    console.log(`🔥 Starting stress test: ${count} updates every ${intervalMs}ms`);
    
    let sentCount = 0;
    const stressInterval = setInterval(() => {
      this.sendTestPlayerUpdate();
      sentCount++;
      
      if (sentCount >= count) {
        clearInterval(stressInterval);
        console.log(`✅ Stress test complete: sent ${sentCount} updates`);
      }
    }, intervalMs);
  }

  public dispose(): void {
    console.log('🧹 Disposing multiplayer debug tools...');
    
    this.stopUpdateFrequencyMonitor();
    this.updateCounts.clear();
    
    console.log('✅ Multiplayer debug tools disposed');
  }
}