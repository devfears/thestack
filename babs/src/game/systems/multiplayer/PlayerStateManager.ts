import * as THREE from 'three';
import { NetworkPlayer } from '../../network/NetworkManager';

/**
 * Manages player state and prevents ghost characters
 * This handles the core logic for preventing duplicate players and ensuring clean state
 */
export class PlayerStateManager {
  private activePlayers: Map<string, {
    player: NetworkPlayer;
    lastSeen: number;
    isLocal: boolean;
  }> = new Map();
  
  private localPlayerId: string | null = null;
  private stalePlayerThreshold: number = 10000; // 10 seconds
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Callbacks for player lifecycle events
  private onPlayerAddedCallback: ((player: NetworkPlayer) => void) | null = null;
  private onPlayerRemovedCallback: ((playerId: string) => void) | null = null;
  private onPlayerUpdatedCallback: ((player: NetworkPlayer) => void) | null = null;
  private onPlayersListChangedCallback: ((players: NetworkPlayer[]) => void) | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  public setCallbacks(
    onPlayerAdded: (player: NetworkPlayer) => void,
    onPlayerRemoved: (playerId: string) => void,
    onPlayerUpdated: (player: NetworkPlayer) => void,
    onPlayersListChanged: (players: NetworkPlayer[]) => void
  ): void {
    this.onPlayerAddedCallback = onPlayerAdded;
    this.onPlayerRemovedCallback = onPlayerRemoved;
    this.onPlayerUpdatedCallback = onPlayerUpdated;
    this.onPlayersListChangedCallback = onPlayersListChanged;
  }

  public setLocalPlayerId(playerId: string): void {
    console.log(`🆔 Setting local player ID: ${playerId}`);
    this.localPlayerId = playerId;
  }

  public handlePlayersList(players: NetworkPlayer[], source: string = 'unknown'): void {
    console.log(`👥 Processing ${players.length} players from ${source}`);
    console.log(`🆔 Local player ID: ${this.localPlayerId}`);
    console.log(`📋 Player IDs from server:`, players.map(p => `${p.displayName} (${p.id})`));
    
    const now = Date.now();
    const serverPlayerIds = new Set<string>();
    let hasChanges = false;

    // Process each player from the server
    for (const player of players) {
      serverPlayerIds.add(player.id);
      
      // Skip local player
      if (player.id === this.localPlayerId) {
        console.log(`⏭️ Skipping local player: ${player.displayName} (${player.id})`);
        continue;
      }

      const existing = this.activePlayers.get(player.id);
      
      if (existing) {
        // Update existing player
        const positionChanged = !existing.player.position.equals(player.position);
        const rotationChanged = !existing.player.rotation.equals(player.rotation);
        
        if (positionChanged || rotationChanged || (now - existing.lastSeen) > 1000) {
          existing.player = { ...player };
          existing.lastSeen = now;
          
          if (this.onPlayerUpdatedCallback) {
            this.onPlayerUpdatedCallback(player);
          }
          hasChanges = true;
        }
      } else {
        // New player
        console.log(`➕ Adding new player: ${player.displayName} (${player.id})`);
        console.log(`📍 Player position:`, player.position);
        
        this.activePlayers.set(player.id, {
          player: { ...player },
          lastSeen: now,
          isLocal: false
        });
        
        if (this.onPlayerAddedCallback) {
          console.log(`📞 Calling onPlayerAddedCallback for ${player.displayName}`);
          this.onPlayerAddedCallback(player);
        } else {
          console.warn(`⚠️ No onPlayerAddedCallback set!`);
        }
        hasChanges = true;
      }
    }

    // Remove players not in server list
    for (const [playerId, playerData] of this.activePlayers.entries()) {
      if (!serverPlayerIds.has(playerId) && !playerData.isLocal) {
        console.log(`➖ Removing player not in server list: ${playerId}`);
        
        this.activePlayers.delete(playerId);
        
        if (this.onPlayerRemovedCallback) {
          this.onPlayerRemovedCallback(playerId);
        }
        hasChanges = true;
      }
    }

    // Notify of changes
    if (hasChanges && this.onPlayersListChangedCallback) {
      const allPlayers = Array.from(this.activePlayers.values()).map(p => p.player);
      this.onPlayersListChangedCallback(allPlayers);
    }
  }

  public handlePlayerUpdate(player: NetworkPlayer): void {
    // Skip local player updates
    if (player.id === this.localPlayerId) {
      return;
    }

    const existing = this.activePlayers.get(player.id);
    const now = Date.now();

    if (existing) {
      // Update existing player
      existing.player = { ...player };
      existing.lastSeen = now;
      
      if (this.onPlayerUpdatedCallback) {
        this.onPlayerUpdatedCallback(player);
      }
    } else {
      // New player from update (shouldn't happen often, but handle gracefully)
      console.log(`➕ Adding player from update: ${player.displayName} (${player.id})`);
      
      this.activePlayers.set(player.id, {
        player: { ...player },
        lastSeen: now,
        isLocal: false
      });
      
      if (this.onPlayerAddedCallback) {
        this.onPlayerAddedCallback(player);
      }
    }
  }

  public removePlayer(playerId: string): void {
    const existing = this.activePlayers.get(playerId);
    
    if (existing) {
      console.log(`➖ Manually removing player: ${playerId}`);
      
      this.activePlayers.delete(playerId);
      
      if (this.onPlayerRemovedCallback) {
        this.onPlayerRemovedCallback(playerId);
      }
    }
  }

  public getActivePlayers(): NetworkPlayer[] {
    return Array.from(this.activePlayers.values()).map(p => p.player);
  }

  public getActivePlayerCount(): number {
    return this.activePlayers.size;
  }

  public hasPlayer(playerId: string): boolean {
    return this.activePlayers.has(playerId);
  }

  public getPlayer(playerId: string): NetworkPlayer | null {
    const playerData = this.activePlayers.get(playerId);
    return playerData ? playerData.player : null;
  }

  public forceCleanup(): void {
    console.log(`🧹 Force cleanup of all players`);
    
    const playerIds = Array.from(this.activePlayers.keys());
    
    for (const playerId of playerIds) {
      if (this.onPlayerRemovedCallback) {
        this.onPlayerRemovedCallback(playerId);
      }
    }
    
    this.activePlayers.clear();
    
    if (this.onPlayersListChangedCallback) {
      this.onPlayersListChangedCallback([]);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePlayers();
    }, 5000); // Check every 5 seconds
  }

  private cleanupStalePlayers(): void {
    const now = Date.now();
    const stalePlayerIds: string[] = [];

    for (const [playerId, playerData] of this.activePlayers.entries()) {
      if (!playerData.isLocal && (now - playerData.lastSeen) > this.stalePlayerThreshold) {
        stalePlayerIds.push(playerId);
      }
    }

    if (stalePlayerIds.length > 0) {
      console.log(`🧹 Cleaning up ${stalePlayerIds.length} stale players`);
      
      for (const playerId of stalePlayerIds) {
        this.activePlayers.delete(playerId);
        
        if (this.onPlayerRemovedCallback) {
          this.onPlayerRemovedCallback(playerId);
        }
      }
      
      if (this.onPlayersListChangedCallback) {
        const allPlayers = Array.from(this.activePlayers.values()).map(p => p.player);
        this.onPlayersListChangedCallback(allPlayers);
      }
    }
  }

  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.forceCleanup();
  }
}