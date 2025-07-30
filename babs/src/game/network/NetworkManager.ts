import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { UserProfile } from '../core/types';

export interface NetworkPlayer {
  id: string;
  displayName: string;
  username: string;
  pfpUrl?: string;
  fid?: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  isCarryingBrick: boolean;
  animationState?: string;
  lastUpdate: number;
}

export interface BrickData {
  position: THREE.Vector3;
  worldPosition: THREE.Vector3;
  color: number;
  gridPosition: { x: number, z: number, layer: number };
  playerId: string;
  playerName: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: Date;
  pfpUrl?: string;
}

export class NetworkManager {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private localPlayer: UserProfile | null = null;
  private remotePlayers: Map<string, NetworkPlayer> = new Map();
  private localIdSet: Promise<void>;
  private resolveLocalIdSet!: () => void;
  private serverUrl: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second
  private lastConnectionAttempt: number = 0;
  private connectionCooldown: number = 2000; // 2 seconds between connection attempts
  
  // Callbacks
  private onPlayerJoinedCallback?: (player: NetworkPlayer) => void;
  private onPlayerLeftCallback?: (playerId: string) => void;
  private onPlayerUpdateCallback?: (player: NetworkPlayer) => void;
  private onBrickPlacedCallback?: (brickData: BrickData) => void;
  private onChatMessageCallback?: (message: ChatMessage) => void;
  private onClearAllBricksCallback?: () => void;
  private onGameStateCallback?: (gameState: any) => void;
  private onCurrentPlayersCallback?: (players: NetworkPlayer[]) => void;

  public onCurrentPlayers(callback: (players: NetworkPlayer[]) => void): void {
    this.onCurrentPlayersCallback = callback;
  }

  public getLocalPlayerId(): string | null {
    return this.socket?.id || null;
  }
  
  // Update throttling
  private lastPositionUpdate: number = 0;
  private positionUpdateInterval: number = 8; // ~120 FPS for position updates (ultra responsive for real-time movement)
  
  // Heartbeat system
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  
  constructor() {
    this.serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL || 'http://localhost:3002';
    console.log(`🔌 Multiplayer server URL set to: ${this.serverUrl}`);
    this.localIdSet = new Promise(resolve => {
      this.resolveLocalIdSet = resolve;
    });
  }
  
  public async connect(user: UserProfile): Promise<boolean> {
    if (this.socket?.connected) {
      console.warn('🔌 Already connected to multiplayer server.');
      return true;
    }
    
    if (this.isConnecting) {
      console.warn('🔌 Connection already in progress. Aborting new connection attempt.');
      return false;
    }
    
    // Check connection cooldown
    const now = Date.now();
    if (now - this.lastConnectionAttempt < this.connectionCooldown) {
      console.warn(`⏰ Connection cooldown active. Please wait ${Math.ceil((this.connectionCooldown - (now - this.lastConnectionAttempt)) / 1000)}s before trying again.`);
      return false;
    }
    
    this.lastConnectionAttempt = now;
    this.isConnecting = true;
    
    try {
      this.localPlayer = user;
      console.log(`🔍 Attempting connection to ${this.serverUrl} for user:`, user.username);
      
      this.socket = io(this.serverUrl, {
        timeout: 8000, // Increased timeout
        reconnection: false, // Disable automatic reconnection to control it manually
      });
      
      this.setupEventListeners();
      
      return new Promise((resolve) => {
        this.socket!.on('connect', () => {
          console.log(`🌐 Connected to multiplayer server with socket ID: ${this.socket!.id}`);
          this.isConnecting = false;
          this.isConnected = true;
          this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          this.resolveLocalIdSet(); // Resolve the promise when ID is available
          
          // Start heartbeat to keep connection active
          this.startHeartbeat();
          
          // Explicitly send a join event with all user data first
          console.log('📤 Sending player-join event with data:', this.localPlayer);
          this.socket!.emit('player-join', this.localPlayer);
          
          // Send initial player data immediately upon connection
          if (this.localPlayer) {
            this.sendInitialPlayerData({
              position: new THREE.Vector3(0, 0, 0), // Default position
              rotation: new THREE.Euler(0, 0, 0),
              isCarryingBrick: false
            });
            
            // Send a few rapid updates to ensure other clients see us immediately
            setTimeout(() => this.sendInitialPlayerData({
              position: new THREE.Vector3(0, 0, 0),
              rotation: new THREE.Euler(0, 0, 0),
              isCarryingBrick: false
            }), 100);
            
            setTimeout(() => this.sendInitialPlayerData({
              position: new THREE.Vector3(0, 0, 0),
              rotation: new THREE.Euler(0, 0, 0),
              isCarryingBrick: false
            }), 200);
          }
          
          resolve(true);
        });
        
        this.socket!.on('connect_error', (error: Error) => {
          console.error(`❌ Failed to connect to multiplayer server (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}):`, error.message);
          this.isConnecting = false;
          this.isConnected = false;
          this.reconnectAttempts++;
          resolve(false);
        });
        
        // Timeout after 8 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            console.warn('⏰ Connection timeout after 8 seconds');
            this.isConnecting = false;
            resolve(false);
          }
        }, 8000);
      });
    } catch (error) {
      console.error('❌ Network connection error:', error);
      this.isConnecting = false;
      return false;
    }
  }
  
  private handlePlayerListUpdate(players: any[], source: 'current-players' | 'sync-players'): void {
    console.log(`[${source}] Received player list with ${players.length} players.`);
    console.log(`📋 Raw player data:`, players.map(p => `${p.displayName} (${p.id})`));
    
    if (!this.socket) return;

    const localSocketId = this.socket.id;
    console.log(`🆔 Local socket ID: ${localSocketId}`);
    
    const newRemotePlayers = new Map<string, NetworkPlayer>();
    
    const networkPlayers: NetworkPlayer[] = players.map(p => {
      const networkPlayer: NetworkPlayer = {
        id: p.id,
        displayName: p.displayName,
        username: p.username,
        pfpUrl: p.pfpUrl,
        fid: p.fid,
        position: new THREE.Vector3(p.position?.x || 0, p.position?.y || 0, p.position?.z || 0),
        rotation: new THREE.Euler(p.rotation?.x || 0, p.rotation?.y || 0, p.rotation?.z || 0),
        isCarryingBrick: p.isCarryingBrick || false,
        lastUpdate: p.lastUpdate || Date.now()
      };
      
      if (p.id !== localSocketId) {
        console.log(`➕ Adding remote player to map: ${p.displayName} (${p.id})`);
        newRemotePlayers.set(p.id, networkPlayer);
      } else {
        console.log(`⏭️ Skipping local player: ${p.displayName} (${p.id})`);
      }
      
      return networkPlayer;
    });

    this.remotePlayers = newRemotePlayers;
    console.log(`✅ Updated remote players map. Now tracking ${this.remotePlayers.size} remote players.`);

    console.log(`📞 Calling onCurrentPlayersCallback with ${networkPlayers.length} players`);
    console.log(`📞 Callback exists: ${!!this.onCurrentPlayersCallback}`);
    
    this.onCurrentPlayersCallback?.(networkPlayers);
  }

  private setupEventListeners(): void {
    if (!this.socket) return;
    
    // Player events are now handled by the 'current-players' event for simplicity and reliability.
    // The server sends the full player list whenever there's a change.
    
    this.socket.on('player-update', (playerData: any) => {
      if (!playerData.id) {
        console.error('Player update event missing player ID:', playerData);
        return;
      }
      const playerId = playerData.id;
      const existingPlayer = this.remotePlayers.get(playerId);
      
      if (existingPlayer) {
        // Update existing player
        existingPlayer.position.set(
          playerData.position?.x || existingPlayer.position.x,
          playerData.position?.y || existingPlayer.position.y,
          playerData.position?.z || existingPlayer.position.z
        );
        existingPlayer.rotation.set(
          playerData.rotation?.x || existingPlayer.rotation.x,
          playerData.rotation?.y || existingPlayer.rotation.y,
          playerData.rotation?.z || existingPlayer.rotation.z
        );
        existingPlayer.isCarryingBrick = playerData.isCarryingBrick || false;
        existingPlayer.lastUpdate = Date.now();
        
        this.onPlayerUpdateCallback?.(existingPlayer);
      }
    });
    
    // Game events
    this.socket.on('brick-placed', (brickData: any) => {
      console.log('🧱 NetworkManager received brick-placed event from:', brickData.playerName);
      
      const networkBrickData: BrickData = {
        position: new THREE.Vector3(
          brickData.position?.x || 0,
          brickData.position?.y || 0,
          brickData.position?.z || 0
        ),
        worldPosition: new THREE.Vector3(
          brickData.worldPosition?.x || 0,
          brickData.worldPosition?.y || 0,
          brickData.worldPosition?.z || 0
        ),
        color: brickData.color || 0x4169E1,
        gridPosition: brickData.gridPosition || { x: 0, z: 0, layer: 0 },
        playerId: brickData.playerId,
        playerName: brickData.playerName
      };
      
      this.onBrickPlacedCallback?.(networkBrickData);
    });
    
    this.socket.on('game-state', (gameState: any) => {
      console.log('🎮 Received game state:', gameState);
      this.onGameStateCallback?.(gameState);
    });

    this.socket.on('current-players', (players: any[]) => {
      console.log('🔌 NetworkManager received current-players event:', players.length, 'players');
      this.handlePlayerListUpdate(players, 'current-players');
    });

    // Handle periodic sync from server
    this.socket.on('sync-players', (players: any[]) => {
      console.log('🔌 NetworkManager received sync-players event:', players.length, 'players');
      this.handlePlayerListUpdate(players, 'sync-players');
    });
    
    // Chat events
    this.socket.on('chat-message', (message: any) => {
      console.log('💬 Received chat message:', message);
      console.log('💬 Chat callback exists:', !!this.onChatMessageCallback);
      this.onChatMessageCallback?.(message);
    });
    
    // Clear all bricks event
    this.socket.on('clear-all-bricks', (data: any) => {
      console.log('🧹 Received clear all bricks from:', data.playerName);
      this.onClearAllBricksCallback?.();
    });
    
    // Connection events
    this.socket.on('disconnect', (reason: string) => {
      console.log(`🔌 Disconnected from multiplayer server. Reason: ${reason}`);
      this.isConnected = false;
      this.isConnecting = false;
      
      // Clear remote players to prevent ghost characters
      this.remotePlayers.clear();
      
      // Notify connection state manager about disconnection
      // This will be handled by the ConnectionStateManager in MultiplayerCore
      console.log(`📡 Disconnect reason: ${reason}`);
    });
    
    this.socket.on('connect_error', (error: Error) => {
      console.error('🚨 Connection error:', error.message);
      this.isConnected = false;
      this.isConnecting = false;
      
      // Schedule reconnection on connection error
      if (this.localPlayer) {
        this.scheduleReconnection();
      }
    });
    
    // Handle debug clear event
    this.socket.on('debug-clear-players', () => {
      console.log('🧹 Received debug clear players event');
      this.remotePlayers.clear();
    });
    
    // Handle sync request - force send current position when new player joins
    this.socket.on('sync-request', (data: any) => {
      console.log('🔄 Received sync request, sending current position');
      // Force an immediate position update
      if (this.localPlayer) {
        this.sendPlayerUpdate({
          position: new THREE.Vector3(0, 0, 0), // Will be updated by game loop
          rotation: new THREE.Euler(0, 0, 0),
          isCarryingBrick: false,
          forceUpdate: true
        });
      }
    });
    
    // Handle heartbeat acknowledgment
    this.socket.on('heartbeat-ack', (data: any) => {
      // Connection is healthy
    });
    
    // Handle player count updates from server
    this.socket.on('player-count-update', (data: any) => {
      console.log('👥 Received player count update from server:', data.count);
      // This will be handled by the current-players event, but we can use it for validation
    });
    
    this.socket.on('reconnect_error', (error: Error) => {
      console.error('🚨 Reconnection error:', error.message);
    });
  }
  
  private sendInitialPlayerData(data: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    isCarryingBrick: boolean;
  }): void {
    if (!this.socket || !this.isConnected || !this.localPlayer) return;
    
    // No throttling for initial connection
    const now = Date.now();
    this.lastPositionUpdate = now; // Set this to prevent immediate throttling of subsequent updates
    
    const playerData = {
      id: this.socket.id,
      displayName: this.localPlayer.displayName,
      username: this.localPlayer.username,
      pfpUrl: this.localPlayer.pfpUrl,
      fid: this.localPlayer.fid,position: {
        x: data.position.x,
        y: data.position.y,
        z: data.position.z
      },
      rotation: {
        x: data.rotation.x,
        y: data.rotation.y,
        z: data.rotation.z
      },
      isCarryingBrick: data.isCarryingBrick,
      timestamp: now
    };
    
    console.log('📤 Sending initial player data:', playerData);
    this.socket.emit('player-update', playerData);
  }

  public sendPlayerUpdate(data: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    isCarryingBrick: boolean;
    animationState?: string;
    forceUpdate?: boolean; // Allow bypassing throttling for critical updates
  }): void {
    if (!this.socket || !this.isConnected || !this.localPlayer) return;
    
    // Throttle position updates unless it's a forced update
    const now = Date.now();
    if (!data.forceUpdate && now - this.lastPositionUpdate < this.positionUpdateInterval) {
      return;
    }
    this.lastPositionUpdate = now;
    
    const playerData = {
      id: this.socket.id,
      displayName: this.localPlayer.displayName,
      username: this.localPlayer.username,
      pfpUrl: this.localPlayer.pfpUrl,
      fid: this.localPlayer.fid,
      position: {
        x: data.position.x,
        y: data.position.y,
        z: data.position.z
      },
      rotation: {
        x: data.rotation.x,
        y: data.rotation.y,
        z: data.rotation.z
      },
      isCarryingBrick: data.isCarryingBrick,
      animationState: data.animationState,
      timestamp: now
    };
    
    this.socket.emit('player-update', playerData);
  }
  
  public sendBrickPlaced(brickData: {
    position: THREE.Vector3;
    worldPosition: THREE.Vector3;
    color: number;
    gridPosition: { x: number, z: number, layer: number };
  }): void {
    if (!this.socket || !this.isConnected) {
      console.log('❌ Cannot send brick placement - no socket or not connected');
      return;
    }
    
    const networkBrickData = {
      position: {
        x: brickData.position.x,
        y: brickData.position.y,
        z: brickData.position.z
      },
      worldPosition: {
        x: brickData.worldPosition.x,
        y: brickData.worldPosition.y,
        z: brickData.worldPosition.z
      },
      color: brickData.color,
      gridPosition: brickData.gridPosition,
      timestamp: Date.now()
    };
    
    console.log('📤 Sending brick-placed event to server:', JSON.stringify(networkBrickData, null, 2));
    
    // Test if socket is working by sending a test event first
    console.log('🧪 Testing socket connection with heartbeat...');
    this.socket.emit('heartbeat', { test: 'brick-placement-test', timestamp: Date.now() });
    
    // Now send the actual brick placement
    this.socket.emit('brick-placed', networkBrickData);
    console.log('✅ brick-placed event emitted to server');
  }
  
  public sendChatMessage(message: ChatMessage): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot send chat message - not connected');
      return;
    }
    
    console.log('📤 Sending chat message:', message);
    this.socket.emit('chat-message', message);
  }
  
  public sendBrickPickedUp(): void {
    if (!this.socket || !this.isConnected) return;
    
    this.socket.emit('brick-picked-up', {
      timestamp: Date.now()
    });
  }
  
  public sendClearAllBricks(): void {
    if (!this.socket || !this.isConnected) return;
    
    console.log('📤 Sending clear all bricks request');
    this.socket.emit('clear-all-bricks', {
      timestamp: Date.now()
    });
  }
  
  // Callback setters
  public onPlayerJoined(callback: (player: NetworkPlayer) => void): void {
    this.onPlayerJoinedCallback = callback;
  }
  
  public onPlayerLeft(callback: (playerId: string) => void): void {
    this.onPlayerLeftCallback = callback;
  }
  
  public onPlayerUpdate(callback: (player: NetworkPlayer) => void): void {
    this.onPlayerUpdateCallback = callback;
  }
  
  public onBrickPlaced(callback: (brickData: BrickData) => void): void {
    this.onBrickPlacedCallback = callback;
  }
  
  public onChatMessage(callback: (message: ChatMessage) => void): void {
    this.onChatMessageCallback = callback;
  }
  
  public onClearAllBricks(callback: () => void): void {
    this.onClearAllBricksCallback = callback;
  }
  
  public onGameState(callback: (gameState: any) => void): void {
    this.onGameStateCallback = callback;
  }
  
  // Getters
  public getRemotePlayers(): Map<string, NetworkPlayer> {
    return this.remotePlayers;
  }
  
  public isConnectedToServer(): boolean {
    return this.isConnected;
  }

  public async whenReady(): Promise<void> {
    return this.localIdSet;
  }
  
  private scheduleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`🛑 Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection attempts.`);
      this.remotePlayers.clear(); // Clear players only after max attempts
      return;
    }
    
    // Use shorter delay for faster reconnection
    const delay = Math.min(1000 + (this.reconnectAttempts * 500), 3000); // Cap at 3 seconds
    console.log(`⏰ Scheduling reconnection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected && !this.isConnecting && this.localPlayer) {
        console.log(`🔄 Attempting reconnection ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
        this.reconnectAttempts++;
        this.connect(this.localPlayer);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat', { timestamp: Date.now() });
        this.lastHeartbeat = Date.now();
      }
    }, 5000); // Send heartbeat every 5 seconds
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public requestForceSync(): void {
    if (this.socket && this.isConnected) {
      console.log('🔄 Requesting force sync from server');
      this.socket.emit('request-force-sync', { timestamp: Date.now() });
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      console.log('🔌 Manually disconnecting from multiplayer server');
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0; // Reset reconnect attempts on manual disconnect
    this.remotePlayers.clear();
  }
}