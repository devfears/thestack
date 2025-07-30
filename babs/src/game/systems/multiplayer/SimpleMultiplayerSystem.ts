import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { io, Socket } from 'socket.io-client';
import { UserProfile } from '../../core/types';
import { GameManager } from '../../core/GameManager';

export interface NetworkPlayer {
  id: string;
  displayName: string;
  username: string;
  pfpUrl?: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  isCarryingBrick: boolean;
  lastUpdate: number;
  // Animation properties
  lastPosition?: THREE.Vector3;
  isMoving?: boolean;
  currentAnimation?: string;
}

export interface BrickData {
  position: THREE.Vector3;
  worldPosition: THREE.Vector3;
  color: number;
  gridPosition: { x: number, z: number, layer: number };
  playerId: string;
  playerName: string;
}

/**
 * Simplified multiplayer system - single source of truth
 * No complex state managers, just direct socket communication
 */
export class SimpleMultiplayerSystem {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private localPlayer: UserProfile | null = null;
  private remotePlayers: Map<string, NetworkPlayer> = new Map();
  private remotePlayerMeshes: Map<string, THREE.Group> = new Map();
  private remotePlayerMixers: Map<string, THREE.AnimationMixer> = new Map();
  private remotePlayerAnimations: Map<string, { [key: string]: THREE.AnimationAction | null }> = new Map();
  
  private gameManager: GameManager;
  private scene: THREE.Scene;
  
  // Callbacks
  private onPlayerCountChange: ((count: number) => void) | null = null;
  
  // Update throttling
  private lastPositionUpdate: number = 0;
  private positionUpdateInterval: number = 50; // 20 FPS for position updates
  
  // Tab visibility handling
  private isTabVisible: boolean = true;
  private pausedAnimations: Map<string, boolean> = new Map();
  
  // Game state tracking
  private nametagsEnabled: boolean = false;
  
  constructor(gameManager: GameManager, scene: THREE.Scene) {
    this.gameManager = gameManager;
    this.scene = scene;
    this.setupTabVisibilityHandling();
  }

  public async connect(user: UserProfile): Promise<boolean> {
    if (this.isConnected) {
      console.log('✅ Already connected to multiplayer');
      return true;
    }

    this.localPlayer = user;
    const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL || 'http://localhost:3002';
    
    console.log(`🔌 Connecting to ${serverUrl}...`);
    
    try {
      this.socket = io(serverUrl, {
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });

      return new Promise((resolve) => {
        this.socket!.on('connect', () => {
          console.log(`✅ Connected with ID: ${this.socket!.id}`);
          this.isConnected = true;
          this.setupEventListeners();
          
          // Send join event
          this.socket!.emit('player-join', this.localPlayer);
          
          // Request fresh game state to ensure we have the latest tower
          setTimeout(() => {
            console.log('🔄 Requesting fresh game state...');
            this.socket!.emit('request-force-sync');
          }, 500); // Small delay to ensure server has processed the join
          
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          console.error('❌ Connection failed:', error.message);
          this.isConnected = false;
          resolve(false);
        });

        setTimeout(() => {
          if (!this.isConnected) {
            console.warn('⏰ Connection timeout');
            resolve(false);
          }
        }, 5000);
      });
    } catch (error) {
      console.error('❌ Connection error:', error);
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Player list updates
    this.socket.on('current-players', (players: any[]) => {
      console.log(`👥 Received ${players.length} players from server`);
      this.updatePlayerList(players);
    });

    // Individual player updates
    this.socket.on('player-update', (playerData: any) => {
      this.updateRemotePlayer(playerData);
    });

    // Brick placement
    this.socket.on('brick-placed', (brickData: any) => {
      console.log('🧱 Received brick placement from:', brickData.playerName);
      this.handleRemoteBrickPlaced(brickData);
    });

    // Game state sync
    this.socket.on('game-state', (gameState: any) => {
      console.log('🎮 Received game state with', gameState.tower?.length || 0, 'bricks');
      this.syncGameState(gameState);
    });

    // Chat messages
    this.socket.on('chat-message', (message: any) => {
      console.log('💬 Received chat message:', message);
      this.handleIncomingChatMessage(message);
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server:', reason);
      this.isConnected = false;
      this.clearAllRemotePlayers();
    });

    // Reconnection events
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
      
      // Re-send join event and request fresh state
      if (this.localPlayer) {
        this.socket!.emit('player-join', this.localPlayer);
        setTimeout(() => {
          console.log('🔄 Requesting fresh game state after reconnect...');
          this.socket!.emit('request-force-sync');
        }, 500);
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.log('❌ Reconnection failed - no more attempts');
      this.isConnected = false;
    });
  }

  private async updatePlayerList(players: any[]): Promise<void> {
    const localId = this.socket?.id;
    if (!localId) return;

    // Get current remote player IDs
    const currentPlayerIds = new Set(this.remotePlayers.keys());
    const newPlayerIds = new Set(players.filter(p => p.id !== localId).map(p => p.id));

    // Remove players that are no longer in the list
    for (const playerId of currentPlayerIds) {
      if (!newPlayerIds.has(playerId)) {
        console.log(`➖ Removing disconnected player: ${this.remotePlayers.get(playerId)?.displayName}`);
        this.removeRemotePlayer(playerId);
      }
    }

    // Add or update existing players
    const addPlayerPromises: Promise<void>[] = [];
    let remotePlayerCount = 0;
    
    for (const playerData of players) {
      if (playerData.id !== localId) {
        if (!this.remotePlayers.has(playerData.id)) {
          // New player - add them
          addPlayerPromises.push(this.addRemotePlayer(playerData));
        } else {
          // Existing player - update position only
          this.updateRemotePlayer(playerData);
        }
        remotePlayerCount++;
      }
    }

    // Wait for new players to be added
    await Promise.all(addPlayerPromises);

    // Update player count (remote + local)
    const totalPlayers = remotePlayerCount + 1;
    console.log(`👥 Player count: ${remotePlayerCount} remote + 1 local = ${totalPlayers} total`);
    
    if (this.onPlayerCountChange) {
      this.onPlayerCountChange(totalPlayers);
    }
  }

  private async addRemotePlayer(playerData: any): Promise<void> {
    const player: NetworkPlayer = {
      id: playerData.id,
      displayName: playerData.displayName,
      username: playerData.username,
      pfpUrl: playerData.pfpUrl,
      position: new THREE.Vector3(
        playerData.position?.x || 0,
        playerData.position?.y || 0,
        playerData.position?.z || 0
      ),
      rotation: new THREE.Euler(
        playerData.rotation?.x || 0,
        playerData.rotation?.y || 0,
        playerData.rotation?.z || 0
      ),
      isCarryingBrick: playerData.isCarryingBrick || false,
      lastUpdate: Date.now(),
      // Animation properties
      lastPosition: new THREE.Vector3(
        playerData.position?.x || 0,
        playerData.position?.y || 0,
        playerData.position?.z || 0
      ),
      isMoving: false,
      currentAnimation: 'idle'
    };

    this.remotePlayers.set(player.id, player);
    await this.createRemotePlayerMesh(player);
    
    console.log(`➕ Added remote player: ${player.displayName}`);
  }

  private async createRemotePlayerMesh(player: NetworkPlayer): Promise<void> {
    console.log(`🎭 Creating remote player mesh for: ${player.displayName}`);
    
    try {
      // Create the remote player container
      const remotePlayerContainer = new THREE.Group();
      remotePlayerContainer.name = `remote-player-${player.id}`;
      
      // Load the same character model directly using GLTFLoader
      const loader = new GLTFLoader();
      
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          '/assets/models/character-male-f copy.glb',
          resolve,
          undefined,
          reject
        );
      });
      
      const characterModel = gltf.scene;
      
      // Configure the character model exactly like the local player
      characterModel.position.set(0, 0, 0);
      characterModel.scale.set(1.3, 1.3, 1.3); // Same scale as local player
      
      // Load the same texture
      const textureLoader = new THREE.TextureLoader();
      const characterTexture = textureLoader.load('/assets/models/Textures/colormap.png');
      characterTexture.flipY = false;
      characterTexture.colorSpace = THREE.SRGBColorSpace;
      
      // Apply materials to all meshes
      characterModel.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mesh.visible = true;
          mesh.frustumCulled = false; // Ensure always visible
          
          // Apply the same material as local player
          const material = new THREE.MeshToonMaterial({
            map: characterTexture
          });
          mesh.material = material;
          
          console.log(`✅ Applied material to mesh: ${child.name}`);
        }
      });
      
      // Set up animations
      const mixer = new THREE.AnimationMixer(characterModel);
      const animations: { [key: string]: THREE.AnimationAction | null } = {
        idle: null,
        walk: null,
        run: null,
        jump: null,
        'pick-up': null
      };
      
      // Process animations from the GLTF
      for (const clip of gltf.animations) {
        // Remove position tracks to prevent animation from affecting movement
        clip.tracks = clip.tracks.filter((track: any) => !track.name.endsWith('.position'));
        
        const action = mixer.clipAction(clip);
        const name = clip.name.toLowerCase();
        
        if (name.includes('idle')) {
          animations.idle = action;
        } else if (name.includes('walk')) {
          animations.walk = action;
        } else if (name.includes('run')) {
          animations.run = action;
        } else if (name.includes('jump')) {
          animations.jump = action;
          action.setLoop(THREE.LoopOnce, 1);
        } else if (name.includes('pick-up') || name.includes('pickup')) {
          animations['pick-up'] = action;
          action.setLoop(THREE.LoopOnce, 1);
        }
      }
      
      // Start with idle animation
      if (animations.idle) {
        animations.idle.play();
      }
      
      // Store animation references
      this.remotePlayerMixers.set(player.id, mixer);
      this.remotePlayerAnimations.set(player.id, animations);
      
      // Add character to container
      remotePlayerContainer.add(characterModel);
      
      // Create optimized nametag
      const nametagDiv = this.createOptimizedNametag(player.displayName);
      // Initially hide nametag until game starts
      nametagDiv.style.display = this.nametagsEnabled ? 'block' : 'none';
      document.body.appendChild(nametagDiv);
      (remotePlayerContainer as any).nametagElement = nametagDiv;
      
      // Position the container
      remotePlayerContainer.position.copy(player.position);
      remotePlayerContainer.rotation.copy(player.rotation);
      remotePlayerContainer.visible = true;
      
      // Add to scene
      this.scene.add(remotePlayerContainer);
      this.remotePlayerMeshes.set(player.id, remotePlayerContainer);
      
      console.log(`✅ Successfully created remote player mesh for: ${player.displayName}`);
      console.log(`📊 Container has ${remotePlayerContainer.children.length} children, visible: ${remotePlayerContainer.visible}`);
      
    } catch (error) {
      console.error(`❌ Failed to load character model for ${player.displayName}:`, error);
      // Fallback to simple representation
      this.createFallbackPlayerMesh(player);
    }
  }


  private createFallbackPlayerMesh(player: NetworkPlayer): void {
    console.log(`⚙️ Creating fallback player mesh for: ${player.displayName}`);
    
    // Fallback to simple representation if model loading fails
    const group = new THREE.Group();
    group.name = `remote-player-fallback-${player.id}`;

    // Create a more detailed character representation
    // Body (torso)
    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.3);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2E8B57, // Sea green for shirt
      roughness: 0.7,
      metalness: 0.1
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.y = 0.4;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 8, 6);
    const headMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFDBAE, // Skin tone
      roughness: 0.8,
      metalness: 0.0
    });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.y = 1.1;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    group.add(headMesh);

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const legMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1E3A8A, // Dark blue for pants
      roughness: 0.8,
      metalness: 0.0
    });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, -0.4, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, -0.4, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    group.add(rightLeg);

    // Arms
    const armGeometry = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFDBAE, // Skin tone for arms
      roughness: 0.8,
      metalness: 0.0
    });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.4, 0.3, 0);
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.4, 0.3, 0);
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    group.add(rightArm);

    // Create optimized nametag
    const nametagDiv = this.createOptimizedNametag(player.displayName);
    // Initially hide nametag until game starts
    nametagDiv.style.display = this.nametagsEnabled ? 'block' : 'none';
    document.body.appendChild(nametagDiv);
    (group as any).nametagElement = nametagDiv;

    // Position the group
    group.position.copy(player.position);
    group.rotation.copy(player.rotation);

    this.scene.add(group);
    this.remotePlayerMeshes.set(player.id, group);
    
    console.log(`✅ Created fallback remote player mesh for: ${player.displayName}`);
  }

  private updateRemotePlayer(playerData: any): void {
    const player = this.remotePlayers.get(playerData.id);
    if (!player) return;

    // Store previous position for movement detection
    const previousPosition = player.lastPosition?.clone() || player.position.clone();
    
    // Update player data
    player.position.set(
      playerData.position?.x || player.position.x,
      playerData.position?.y || player.position.y,
      playerData.position?.z || player.position.z
    );
    player.rotation.set(
      playerData.rotation?.x || player.rotation.x,
      playerData.rotation?.y || player.rotation.y,
      playerData.rotation?.z || player.rotation.z
    );
    player.isCarryingBrick = playerData.isCarryingBrick || false;
    player.lastUpdate = Date.now();

    // Detect movement for animation
    const distanceMoved = previousPosition.distanceTo(player.position);
    const wasMoving = player.isMoving || false;
    player.isMoving = distanceMoved > 0.01; // Threshold for movement detection
    player.lastPosition = player.position.clone();

    // Update animation if movement state changed
    if (player.isMoving !== wasMoving) {
      this.updateRemotePlayerAnimation(player.id, player.isMoving ? 'walk' : 'idle');
    }

    // Update mesh position
    const mesh = this.remotePlayerMeshes.get(player.id);
    if (mesh) {
      mesh.position.copy(player.position);
      mesh.rotation.copy(player.rotation);
    }
  }

  private updateRemotePlayerAnimation(playerId: string, animationName: string): void {
    const animations = this.remotePlayerAnimations.get(playerId);
    const player = this.remotePlayers.get(playerId);
    
    if (!animations || !player) return;
    
    // Don't change if already playing this animation
    if (player.currentAnimation === animationName) return;
    
    const newAction = animations[animationName];
    const currentAction = player.currentAnimation ? animations[player.currentAnimation] : null;
    
    if (newAction) {
      // Fade out current animation and fade in new one
      if (currentAction) {
        currentAction.fadeOut(0.2);
      }
      
      newAction
        .reset()
        .fadeIn(0.2)
        .play();
      
      player.currentAnimation = animationName;
      console.log(`🎭 ${player.displayName} animation changed to: ${animationName}`);
    }
  }

  private handleRemoteBrickPlaced(brickData: any): void {
    const localId = this.socket?.id;
    if (brickData.playerId === localId) {
      console.log('🚫 Skipping own brick to avoid duplicate');
      return;
    }

    console.log('🧱 Placing remote brick at:', brickData.gridPosition);
    
    const brickSystem = this.gameManager.getBrickSystem();
    if (brickSystem) {
      brickSystem.placeRemoteBrick(brickData.gridPosition, brickData.color);
    }
  }

  private syncGameState(gameState: any): void {
    if (!gameState.tower) return;

    const brickSystem = this.gameManager.getBrickSystem();
    if (!brickSystem) return;

    console.log(`🔄 Syncing ${gameState.tower.length} bricks from server for new player`);

    // Clear existing remote bricks first to avoid duplicates
    brickSystem.clearRemoteBricks();

    // Place all bricks from server state
    // New players should see ALL bricks, including those from currently connected players
    for (const brickData of gameState.tower) {
      console.log(`🔄 Placing synced brick at layer ${brickData.gridPosition.layer} by ${brickData.playerName}`);
      
      // Place the brick - use placeRemoteBrick for all bricks during sync
      // This ensures proper rendering and grid management
      brickSystem.placeRemoteBrick(brickData.gridPosition, brickData.color);
    }

    console.log(`✅ Game state sync complete: ${gameState.tower.length} bricks placed`);
  }

  private removeRemotePlayer(playerId: string): void {
    // Remove specific player mesh from scene and clean up nametag
    const mesh = this.remotePlayerMeshes.get(playerId);
    if (mesh) {
      this.scene.remove(mesh);
      
      // Remove nametag element if it exists
      const nametagElement = (mesh as any).nametagElement;
      if (nametagElement && nametagElement.parentNode) {
        nametagElement.parentNode.removeChild(nametagElement);
      }
    }

    // Dispose of animation mixer for this player
    const mixer = this.remotePlayerMixers.get(playerId);
    if (mixer) {
      mixer.stopAllAction();
    }

    // Remove from maps
    this.remotePlayers.delete(playerId);
    this.remotePlayerMeshes.delete(playerId);
    this.remotePlayerMixers.delete(playerId);
    this.remotePlayerAnimations.delete(playerId);
  }

  private clearAllRemotePlayers(): void {
    // Remove all players using the individual removal method
    const playerIds = Array.from(this.remotePlayers.keys());
    for (const playerId of playerIds) {
      this.removeRemotePlayer(playerId);
    }
  }

  // Public API
  public isMultiplayerEnabled(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  public setOnPlayerCountChange(callback: (count: number) => void): void {
    this.onPlayerCountChange = callback;
  }

  public sendPlayerUpdate(data: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    isCarryingBrick: boolean;
  }): void {
    if (!this.isConnected || !this.socket || !this.localPlayer) return;

    // Throttle updates
    const now = Date.now();
    if (now - this.lastPositionUpdate < this.positionUpdateInterval) return;
    this.lastPositionUpdate = now;

    const updateData = {
      id: this.socket.id,
      displayName: this.localPlayer.displayName,
      username: this.localPlayer.username,
      pfpUrl: this.localPlayer.pfpUrl,
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
      timestamp: now
    };

    this.socket.emit('player-update', updateData);
  }

  public sendBrickPlaced(brickData: {
    position: THREE.Vector3;
    worldPosition: THREE.Vector3;
    color: number;
    gridPosition: { x: number, z: number, layer: number };
  }): void {
    if (!this.isConnected || !this.socket) {
      console.log('❌ Cannot send brick - not connected');
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

    console.log('📤 Sending brick placement to server');
    this.socket.emit('brick-placed', networkBrickData);
  }

  public getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.clearAllRemotePlayers();
  }

  public update(deltaTime: number): void {
    const camera = this.gameManager.getCamera();
    
    // Clamp deltaTime to prevent animation jumps when tab becomes active
    const clampedDelta = Math.min(deltaTime, 0.033); // Max 33ms (30fps equivalent)
    
    // Update animation mixers for remote players
    for (const [, mixer] of this.remotePlayerMixers) {
      mixer.update(clampedDelta);
    }
    
    // Smooth interpolation for remote players
    for (const [playerId, player] of this.remotePlayers) {
      const mesh = this.remotePlayerMeshes.get(playerId);
      if (!mesh) continue;

      // Simple interpolation towards target position
      const currentPos = mesh.position;
      const targetPos = player.position;
      const distance = currentPos.distanceTo(targetPos);

      if (distance > 0.01) {
        const lerpFactor = Math.min(deltaTime * 10, 0.5);
        mesh.position.lerp(targetPos, lerpFactor);
        
        // Interpolate rotation
        mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, player.rotation.x, lerpFactor);
        mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, player.rotation.y, lerpFactor);
        mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, player.rotation.z, lerpFactor);
      }

      // Update nametag position with optimized system
      const nametagElement = (mesh as any).nametagElement;
      if (nametagElement && camera) {
        // Check if we're in free camera mode (camera follow disabled)
        const gameState = this.gameManager.getGameState();
        const isFreeCameraMode = !gameState.cameraFollowEnabled;
        
        if (isFreeCameraMode || !this.nametagsEnabled) {
          // Hide nametags in free camera mode or if game hasn't started
          nametagElement.style.display = 'none';
        } else {
          // Use optimized nametag positioning
          this.updateNametagPosition(nametagElement, mesh.position, camera);
        }
      }
    }
  }

  private createOptimizedNametag(displayName: string): HTMLDivElement {
    const nametagDiv = document.createElement('div');
    nametagDiv.textContent = displayName;
    nametagDiv.className = 'remote-player-nametag';
    
    // Optimized styles for 3D scenes
    nametagDiv.style.position = 'absolute';
    nametagDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    nametagDiv.style.color = '#ffffff';
    nametagDiv.style.padding = '3px 6px';
    nametagDiv.style.borderRadius = '0px'; // Keep pixel style
    nametagDiv.style.fontSize = '8px'; // Smaller base size
    nametagDiv.style.fontFamily = '"Press Start 2P", cursive';
    nametagDiv.style.textAlign = 'center';
    nametagDiv.style.pointerEvents = 'none';
    nametagDiv.style.zIndex = '50'; // Below UI elements
    nametagDiv.style.whiteSpace = 'nowrap';
    nametagDiv.style.textShadow = '1px 1px 0px #000000';
    nametagDiv.style.letterSpacing = '0.5px';
    nametagDiv.style.imageRendering = 'pixelated';
    nametagDiv.style.userSelect = 'none';
    nametagDiv.style.transformOrigin = 'center bottom'; // For scaling
    nametagDiv.style.minWidth = '40px';
    nametagDiv.style.boxSizing = 'border-box';
    
    // Special styling for dev player - visible to everyone
    if (displayName === 'the DEV') {
      nametagDiv.classList.add('developer-nametag');
      // Rainbow animated border that everyone can see
      nametagDiv.style.border = '2px solid transparent';
      nametagDiv.style.background = 'linear-gradient(rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.9)) padding-box, linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3) border-box';
      nametagDiv.style.animation = 'rainbow-border 2s linear infinite';
    } else {
      nametagDiv.style.border = '1px solid #4a4a4a';
    }
    
    return nametagDiv;
  }

  private updateNametagPosition(nametagElement: HTMLDivElement, worldPosition: THREE.Vector3, camera: THREE.Camera): void {
    // Calculate screen position for nametag
    const nametagWorldPos = worldPosition.clone();
    nametagWorldPos.y += 2.2; // Position above player head
    
    // Project to screen coordinates
    const screenPos = nametagWorldPos.clone().project(camera);
    
    // Check if behind camera or outside view
    const isVisible = screenPos.z < 1 && screenPos.z > -1;
    
    if (!isVisible) {
      nametagElement.style.display = 'none';
      return;
    }
    
    // Convert to pixel coordinates
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
    
    // Calculate distance-based scale to keep consistent size
    const distance = camera.position.distanceTo(worldPosition);
    const baseScale = Math.max(0.8, Math.min(1.5, 8 / distance)); // Scale between 0.8x and 1.5x
    
    // Check for UI element overlap and adjust position
    let adjustedY = y - nametagElement.offsetHeight;
    
    // Check for layer UI overlap (top center)
    const layerUI = document.querySelector('[style*="position: absolute"][style*="top: 10px"]') as HTMLElement;
    if (layerUI && !layerUI.style.display.includes('none')) {
      const layerUIRect = layerUI.getBoundingClientRect();
      const nametagWidth = nametagElement.offsetWidth;
      
      // Check if nametag would overlap with layer UI
      if (x + nametagWidth/2 > layerUIRect.left && 
          x - nametagWidth/2 < layerUIRect.right && 
          adjustedY < layerUIRect.bottom + 10 && 
          adjustedY + nametagElement.offsetHeight > layerUIRect.top) {
        // Move nametag below layer UI
        adjustedY = layerUIRect.bottom + 10;
      }
    }
    
    // Check for chat box overlap
    const chatBox = document.querySelector('[style*="position: fixed"][style*="top: 70px"]') as HTMLElement;
    if (chatBox && !chatBox.style.display.includes('none')) {
      const chatBoxRect = chatBox.getBoundingClientRect();
      const nametagWidth = nametagElement.offsetWidth;
      
      // Check if nametag would overlap with chat box
      if (x + nametagWidth/2 > chatBoxRect.left && 
          x - nametagWidth/2 < chatBoxRect.right && 
          adjustedY < chatBoxRect.bottom + 10 && 
          adjustedY + nametagElement.offsetHeight > chatBoxRect.top) {
        // Move nametag below chat box
        adjustedY = chatBoxRect.bottom + 10;
      }
    }
    
    // Apply position and scale
    nametagElement.style.left = `${x - nametagElement.offsetWidth / 2}px`;
    nametagElement.style.top = `${adjustedY}px`;
    nametagElement.style.transform = `scale(${baseScale})`;
    nametagElement.style.display = 'block';
  }

  public setNametagVisible(visible: boolean): void {
    console.log(`👁️ Setting nametags ${visible ? 'visible' : 'hidden'}`);
    this.nametagsEnabled = visible;
    
    // Control visibility of all remote player nametags
    for (const [, mesh] of this.remotePlayerMeshes) {
      const nametagElement = (mesh as any).nametagElement;
      if (nametagElement) {
        if (visible) {
          // Only show if not in free camera mode and game has started
          const gameState = this.gameManager.getGameState();
          const isFreeCameraMode = !gameState.cameraFollowEnabled;
          nametagElement.style.display = isFreeCameraMode ? 'none' : 'block';
        } else {
          nametagElement.style.display = 'none';
        }
      }
    }
  }

  public sendChatMessage(text: string, user: any): void {
    if (!this.isConnected || !this.socket) {
      console.log('❌ Cannot send chat message - not connected to multiplayer');
      return;
    }

    const chatMessage = {
      id: Date.now().toString(),
      username: user.displayName,
      text: text,
      timestamp: new Date().toISOString(),
      pfpUrl: user.pfpUrl
    };

    console.log('📤 Sending chat message:', chatMessage);
    this.socket.emit('chat-message', chatMessage);
  }

  private handleIncomingChatMessage(message: any): void {
    // Skip if it's our own message to avoid duplicates
    if (this.localPlayer && message.username === this.localPlayer.displayName) {
      console.log('📨 Skipping own chat message to avoid duplicate');
      return;
    }

    console.log('📨 Processing incoming chat message from:', message.username, ':', message.text);
    
    // Dispatch custom event for the frontend to handle
    const chatEvent = new CustomEvent('multiplayer-chat', {
      detail: {
        id: message.id,
        username: message.username,
        text: message.text,
        timestamp: message.timestamp,
        pfpUrl: message.pfpUrl
      }
    });
    window.dispatchEvent(chatEvent);
  }

  private setupTabVisibilityHandling(): void {
    // Handle page visibility changes to prevent desync
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isTabVisible;
      this.isTabVisible = !document.hidden;
      
      console.log(`👁️ Tab visibility changed: ${this.isTabVisible ? 'visible' : 'hidden'}`);
      
      if (!wasVisible && this.isTabVisible) {
        // Tab became visible - resume animations and sync state
        console.log('🔄 Tab became visible - resuming animations');
        this.resumeAllAnimations();
        
        // Request fresh player positions to avoid desync
        if (this.socket && this.isConnected) {
          setTimeout(() => {
            console.log('🔄 Requesting position sync after tab focus...');
            this.socket!.emit('request-player-sync');
          }, 100);
        }
      } else if (wasVisible && !this.isTabVisible) {
        // Tab became hidden - note current animation states
        console.log('⏸️ Tab became hidden - saving animation states');
        this.saveAnimationStates();
      }
    });
  }

  private saveAnimationStates(): void {
    for (const [playerId, player] of this.remotePlayers) {
      this.pausedAnimations.set(playerId, player.isMoving || false);
    }
  }

  private resumeAllAnimations(): void {
    for (const [playerId, player] of this.remotePlayers) {
      const wasMoving = this.pausedAnimations.get(playerId) || false;
      // Ensure animation state is correct
      const targetAnimation = wasMoving ? 'walk' : 'idle';
      if (player.currentAnimation !== targetAnimation) {
        this.updateRemotePlayerAnimation(playerId, targetAnimation);
      }
    }
    this.pausedAnimations.clear();
  }

  public dispose(): void {
    // Remove visibility event listener
    document.removeEventListener('visibilitychange', () => {});
    
    // Stop all animation mixers
    for (const [, mixer] of this.remotePlayerMixers) {
      mixer.stopAllAction();
    }
    
    this.clearAllRemotePlayers();
    this.disconnect();
  }
}