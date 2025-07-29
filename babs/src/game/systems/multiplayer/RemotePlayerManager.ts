import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { NetworkPlayer } from '../../network/NetworkManager';
import { MultiplayerCore } from './MultiplayerCore';

/**
 * Manages remote player creation, updates, and cleanup
 */
export class RemotePlayerManager {
  private core: MultiplayerCore;
  private remotePlayers: Map<string, THREE.Group> = new Map();
  private playersBeingCreated: Set<string> = new Set();
  private playerCreationTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Debounce mechanism for handleCurrentPlayers
  private lastHandleCurrentPlayersCall: number = 0;
  private handleCurrentPlayersTimeout: NodeJS.Timeout | null = null;
  
  // Model loading
  private loader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private characterTexture: THREE.Texture;

  // Player visual components (fallback)
  private playerGeometry: THREE.BoxGeometry;
  private playerMaterials: Map<string, THREE.MeshLambertMaterial> = new Map();
  
  // Track current nametag visibility state
  private currentNametagVisibility: boolean = false;

  // Interpolation for smooth movement
  private playerTargets: Map<string, {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    lastUpdate: number;
  }> = new Map();

  // Animation system for remote players
  private remotePlayerAnimations: Map<string, {
    mixer: THREE.AnimationMixer;
    actions: {
      idle: THREE.AnimationAction | null;
      walk: THREE.AnimationAction | null;
      run: THREE.AnimationAction | null;
      jump: THREE.AnimationAction | null;
      current: THREE.AnimationAction | null;
    };
    lastAnimationState: string;
    lastPosition: THREE.Vector3;
  }> = new Map();

  constructor(core: MultiplayerCore) {
    this.core = core;

    // Initialize loaders
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    // Load character texture
    this.characterTexture = this.textureLoader.load(
      '/assets/models/Textures/colormap.png',
      (texture) => {
        console.log('✅ Character texture loaded successfully for multiplayer');
      },
      undefined,
      (error) => {
        console.error('❌ Failed to load character texture for multiplayer:', error);
      }
    );
    this.characterTexture.flipY = false;
    this.characterTexture.colorSpace = THREE.SRGBColorSpace;

    // Create fallback player geometry (simple box)
    this.playerGeometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    
    // Connect to player state manager
    this.setupPlayerStateManager();
  }

  private setupPlayerStateManager(): void {
    const playerStateManager = this.core.getPlayerStateManager();
    
    // Override the callbacks to use our methods
    playerStateManager.setCallbacks(
      (player) => this.createRemotePlayer(player),
      (playerId) => this.removeRemotePlayer(playerId),
      (player) => this.updateRemotePlayer(player),
      (players) => {
        // Update player count callback if needed
        console.log(`👥 Player list updated: ${players.length} players`);
      }
    );
  }

  public createRemotePlayer(player: NetworkPlayer): void {
    const localPlayerId = this.core.getNetworkManager().getLocalPlayerId();

    console.log('🔍 createRemotePlayer called for:', {
      playerId: player.id,
      displayName: player.displayName,
      localPlayerId: localPlayerId,
      alreadyExists: this.remotePlayers.has(player.id),
      beingCreated: this.playersBeingCreated.has(player.id),
      currentRemotePlayers: Array.from(this.remotePlayers.keys())
    });
    
    console.log('🎭 RemotePlayerManager.createRemotePlayer - START');

    if (player.id === localPlayerId) {
      console.log('🚫 Skipping local player:', player.displayName);
      return; // Never create a remote player for ourselves
    }

    // Enhanced duplicate prevention - multiple layers of protection
    if (this.remotePlayers.has(player.id)) {
      console.log('⚠️ Player already exists in tracking, skipping creation:', player.displayName);
      return;
    }

    if (this.playersBeingCreated.has(player.id)) {
      console.log('⚠️ Player already being created, skipping:', player.displayName);
      return;
    }

    // CRITICAL: Aggressive duplicate detection and cleanup
    const existingPlayerInScene = this.core.getScene().getObjectByName(`player-${player.id}`);
    if (existingPlayerInScene) {
      console.log('🧹 CRITICAL: Player object already exists in scene, performing complete cleanup:', player.displayName);
      
      // Remove from scene immediately
      this.core.getScene().remove(existingPlayerInScene);
      
      // Dispose of all materials and geometries in the existing player
      existingPlayerInScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      
      // Clean up all associated data
      this.playerTargets.delete(player.id);
      this.remotePlayerAnimations.delete(player.id);
      this.playerMaterials.delete(player.id);
      
      // Clear any existing timeout
      const existingTimeout = this.playerCreationTimeouts.get(player.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.playerCreationTimeouts.delete(player.id);
      }
      
      console.log('✅ Existing player completely cleaned up, proceeding with fresh creation');
    }

    // Additional check: ensure no orphaned objects exist
    const orphanedObjects: THREE.Object3D[] = [];
    this.core.getScene().traverse((child: THREE.Object3D) => {
      if (child.name && child.name === `player-${player.id}`) {
        orphanedObjects.push(child);
      }
    });
    
    if (orphanedObjects.length > 0) {
      console.log(`🧹 Found ${orphanedObjects.length} orphaned objects for ${player.id}, cleaning up...`);
      orphanedObjects.forEach(obj => {
        this.core.getScene().remove(obj);
        obj.traverse((subChild: THREE.Object3D) => {
          if (subChild instanceof THREE.Mesh) {
            if (subChild.geometry) subChild.geometry.dispose();
            if (subChild.material) subChild.material.dispose();
          }
        });
      });
    }

    console.log('✅ Creating remote player:', player.displayName, 'at position:', player.position);
    this.playersBeingCreated.add(player.id);

    // Set a timeout to prevent players from being stuck in "being created" state
    const timeout = setTimeout(() => {
      console.warn(`⏰ Player creation timeout for ${player.displayName}, cleaning up`);
      this.playersBeingCreated.delete(player.id);
      this.playerCreationTimeouts.delete(player.id);
      
      // Clean up any partially created objects
      const partialPlayer = this.core.getScene().getObjectByName(`player-${player.id}`);
      if (partialPlayer) {
        this.core.getScene().remove(partialPlayer);
        partialPlayer.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          }
        });
      }
    }, 8000); // Reduced to 8 seconds for faster cleanup
    
    this.playerCreationTimeouts.set(player.id, timeout);

    // Try to load actual character model, fallback to simple geometry
    this.loadRemoteCharacterModel(player);
  }

  private async loadRemoteCharacterModel(player: NetworkPlayer): Promise<void> {
    try {
      // Load a fresh instance of the character model for each remote player
      const gltf = await new Promise<any>((resolve, reject) => {
        this.loader.load(
          '/assets/models/character-male-f copy.glb',
          resolve,
          undefined,
          reject
        );
      });

      // Create character container similar to local player
      const playerGroup = new THREE.Group();
      playerGroup.name = `player-${player.id}`;

      // Use the scene directly instead of cloning (fresh instance)
      const character = gltf.scene;
      character.position.set(0, 0, 0);
      character.scale.set(1.3, 1.3, 1.3);
      character.visible = false; // Start invisible to prevent T-pose flash
      character.matrixAutoUpdate = true;

      // Apply materials and setup shadows - EXACTLY like the local player
      character.traverse((child: any) => {
        if (child.isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.visible = true;
          mesh.frustumCulled = true;
          mesh.matrixAutoUpdate = true;

          // Create a fresh material instance for each remote player
          const characterMaterial = new THREE.MeshToonMaterial({
            map: this.characterTexture.clone(), // Clone the texture
            transparent: false,
            opacity: 1.0,
            side: THREE.FrontSide,
          });

          mesh.material = characterMaterial;
        }
      });

      // Add character to group
      playerGroup.add(character);

      // Initialize animations for this remote player BEFORE making visible
      const animationsReady = await this.initializeRemotePlayerAnimations(player.id, character, gltf);
      
      // Only make character visible after animations are properly initialized
      if (animationsReady) {
        // Longer delay to ensure animation is fully initialized and T-pose is avoided
        setTimeout(() => {
          character.visible = true;
          console.log(`🎭 Character ${player.displayName} made visible after animation setup`);
        }, 300);
      } else {
        // Fallback: make visible anyway after a longer delay
        setTimeout(() => {
          character.visible = true;
          console.log(`⚠️ Character ${player.displayName} made visible (fallback)`);
        }, 1000);
      }

      // Create name label
      const nameLabel = this.createNameLabel(player.displayName, player.fid);
      nameLabel.position.set(0, 2.5, 0);
      // Apply current nametag visibility state to new player
      nameLabel.visible = this.currentNametagVisibility;
      playerGroup.add(nameLabel);

      // Set initial position - ensure it's above ground
      const spawnPosition = new THREE.Vector3(
        player.position.x || 0,
        Math.max(player.position.y || 0, 2.0), // Start higher to ensure visibility
        player.position.z || 0
      );
      playerGroup.position.copy(spawnPosition);

      if (player.rotation) {
        playerGroup.rotation.copy(player.rotation);
      }

      // Force update matrices
      playerGroup.updateMatrix();
      playerGroup.updateMatrixWorld(true);
      character.updateMatrix();
      character.updateMatrixWorld(true);

      // Add to scene and tracking
      this.core.getScene().add(playerGroup);
      this.remotePlayers.set(player.id, playerGroup);
      this.playersBeingCreated.delete(player.id);
      
      // Clear the creation timeout
      const timeout = this.playerCreationTimeouts.get(player.id);
      if (timeout) {
        clearTimeout(timeout);
        this.playerCreationTimeouts.delete(player.id);
      }

      // Set up interpolation target
      this.playerTargets.set(player.id, {
        position: spawnPosition.clone(),
        rotation: player.rotation ? player.rotation.clone() : new THREE.Euler(),
        lastUpdate: Date.now()
      });

      console.log(`✅ Remote player ${player.displayName} created with character model`);

    } catch (error) {
      console.warn(`⚠️ Failed to load character model for ${player.displayName}, using fallback:`, error);
      // Ensure we clean up the playersBeingCreated set even on error
      this.playersBeingCreated.delete(player.id);
      this.createFallbackRemotePlayer(player);
    }
  }

  private createFallbackRemotePlayer(player: NetworkPlayer): void {
    // Create player group
    const playerGroup = new THREE.Group();
    playerGroup.name = `player-${player.id}`;

    // Create player material with unique color
    const playerColor = this.generatePlayerColor(player.id);
    const playerMaterial = new THREE.MeshLambertMaterial({
      color: playerColor,
      emissive: playerColor,
      emissiveIntensity: 0.2
    });
    this.playerMaterials.set(player.id, playerMaterial);

    // Create player mesh
    const playerMesh = new THREE.Mesh(this.playerGeometry, playerMaterial);
    playerMesh.position.set(0, 0.9, 0);
    playerMesh.castShadow = true;
    playerMesh.receiveShadow = true;
    playerMesh.scale.setScalar(1.5);
    playerMesh.visible = false; // Start invisible to prevent T-pose flash

    // Create name label
    const nameLabel = this.createNameLabel(player.displayName, player.fid);
    nameLabel.position.set(0, 2.5, 0);
    // Apply current nametag visibility state to new player
    nameLabel.visible = this.currentNametagVisibility;

    // Add components to group
    playerGroup.add(playerMesh);
    playerGroup.add(nameLabel);

    // Set initial position
    const spawnPosition = new THREE.Vector3(
      player.position.x || 0,
      Math.max(player.position.y || 0, 0.5),
      player.position.z || 0
    );
    playerGroup.position.copy(spawnPosition);

    if (player.rotation) {
      playerGroup.rotation.copy(player.rotation);
    }

    // Add to scene and tracking
    this.core.getScene().add(playerGroup);
    this.remotePlayers.set(player.id, playerGroup);
    this.playersBeingCreated.delete(player.id);
    
    // Clear the creation timeout
    const timeout = this.playerCreationTimeouts.get(player.id);
    if (timeout) {
      clearTimeout(timeout);
      this.playerCreationTimeouts.delete(player.id);
    }

    // Set up interpolation target
    this.playerTargets.set(player.id, {
      position: player.position.clone(),
      rotation: player.rotation.clone(),
      lastUpdate: Date.now()
    });

    // Make fallback player visible after a delay to prevent T-pose flash
    setTimeout(() => {
      const playerMesh = playerGroup.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
      if (playerMesh) {
        playerMesh.visible = true;
      }
    }, 300);

    console.log(`✅ Remote player ${player.displayName} created with fallback geometry`);
  }

  public removeRemotePlayer(playerId: string): void {
    console.log('👋 Removing remote player:', playerId);

    const playerGroup = this.remotePlayers.get(playerId);
    if (playerGroup) {
      // More thorough cleanup of the player group
      console.log(`🧹 Cleaning up player group for ${playerId}`);

      // Remove all children from the group first
      while (playerGroup.children.length > 0) {
        const child = playerGroup.children[0];
        playerGroup.remove(child);

        // Dispose of any geometries and materials
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      }

      // Remove the group from the scene
      this.core.getScene().remove(playerGroup);

      // Clean up tracking maps
      this.remotePlayers.delete(playerId);
      this.playerTargets.delete(playerId);
      this.playersBeingCreated.delete(playerId);
      
      // Clear any pending creation timeout
      const timeout = this.playerCreationTimeouts.get(playerId);
      if (timeout) {
        clearTimeout(timeout);
        this.playerCreationTimeouts.delete(playerId);
      }

      // Clean up animation mixer
      const animationData = this.remotePlayerAnimations.get(playerId);
      if (animationData && animationData.mixer) {
        animationData.mixer.stopAllAction();
        animationData.mixer.uncacheRoot(animationData.mixer.getRoot());
        this.remotePlayerAnimations.delete(playerId);
      }

      // Clean up material
      const material = this.playerMaterials.get(playerId);
      if (material) {
        material.dispose();
        this.playerMaterials.delete(playerId);
      }

      console.log(`✅ Successfully removed player ${playerId}. Remaining players: ${this.remotePlayers.size}`);
    } else {
      console.warn(`⚠️ Attempted to remove non-existent player: ${playerId}`);

      // Still clean up any orphaned data
      this.playerTargets.delete(playerId);
      this.playersBeingCreated.delete(playerId);
      this.remotePlayerAnimations.delete(playerId);
      this.playerMaterials.delete(playerId);
      
      // Clear any pending creation timeout
      const timeout = this.playerCreationTimeouts.get(playerId);
      if (timeout) {
        clearTimeout(timeout);
        this.playerCreationTimeouts.delete(playerId);
      }
    }
  }

  public updateRemotePlayer(player: NetworkPlayer): void {
    const localPlayerId = this.core.getNetworkManager().getLocalPlayerId();
    if (player.id === localPlayerId) return;

    const target = this.playerTargets.get(player.id);
    if (target) {
      // Update interpolation target for existing player
      const adjustedPosition = player.position.clone();
      // Ensure players stay visible on the ground
      adjustedPosition.y = Math.max(adjustedPosition.y, 0);

      // Calculate the distance moved to determine if this is a significant update
      const distanceMoved = target.position.distanceTo(adjustedPosition);

      // Update target position and rotation for smooth interpolation
      target.position.copy(adjustedPosition);
      target.rotation.copy(player.rotation);
      target.lastUpdate = Date.now();

      // Only snap for teleport-like movements, otherwise let the smooth interpolation handle it
      const playerGroup = this.remotePlayers.get(player.id);
      if (playerGroup && distanceMoved > 2.0) {
        // Snap to position for teleport-like movements only
        playerGroup.position.copy(adjustedPosition);
        playerGroup.rotation.copy(player.rotation);
        
        // Force matrix updates for immediate visual feedback
        playerGroup.updateMatrix();
        playerGroup.updateMatrixWorld(true);
      }
      // For normal movements, let the smooth interpolation in update() handle the positioning
    } else if (!this.playersBeingCreated.has(player.id)) {
      // Player does not exist and is not being created, likely a sync issue.
      // AGGRESSIVE: Force cleanup of any orphaned objects for this player
      const playerGroup = this.core.getScene().getObjectByName(`player-${player.id}`);
      if (playerGroup) {
        console.log(`🧹 Found orphaned player object during update: ${player.id}`);
        this.core.getScene().remove(playerGroup);
        
        // Dispose of all materials and geometries
        playerGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    }
  }

  public handleCurrentPlayers(players: NetworkPlayer[]): void {
    // Use the player state manager to handle the player list
    const playerStateManager = this.core.getPlayerStateManager();
    playerStateManager.handlePlayersList(players, 'current-players');
  }

  private handleCurrentPlayersInternal(players: NetworkPlayer[]): void {
    console.log('👥 handleCurrentPlayers called with:', {
      playersCount: players.length,
      playerNames: players.map(p => p.displayName),
      currentRemotePlayers: Array.from(this.remotePlayers.keys()),
      playersBeingCreated: Array.from(this.playersBeingCreated)
    });
    
    const localPlayerId = this.core.getNetworkManager().getLocalPlayerId();

    if (!localPlayerId) {
      console.error('🚨 Critical: Local player ID not available');
      return;
    }

    const serverPlayerIds = new Set(players.map(p => p.id));
    const now = Date.now();

    // AGGRESSIVE: Scan for ghost characters - players in scene but not in server list
    const allSceneObjects: THREE.Object3D[] = [];
    this.core.getScene().traverse((child: THREE.Object3D) => {
      if (child.name && child.name.startsWith('player-')) {
        allSceneObjects.push(child);
      }
    });

    // Remove ghost characters (in scene but not on server)
    for (const sceneObject of allSceneObjects) {
      const playerId = sceneObject.name.replace('player-', '');
      if (playerId !== localPlayerId && !serverPlayerIds.has(playerId)) {
        console.log('🧹 AGGRESSIVE: Removing ghost character from scene:', playerId);
        this.core.getScene().remove(sceneObject);
        
        // Dispose of all materials and geometries
        sceneObject.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        
        // Clean up tracking
        this.remotePlayers.delete(playerId);
        this.playerTargets.delete(playerId);
        this.remotePlayerAnimations.delete(playerId);
        this.playerMaterials.delete(playerId);
      }
    }

    // Remove players that are no longer on the server
    for (const existingPlayerId of this.remotePlayers.keys()) {
      if (existingPlayerId !== localPlayerId && !serverPlayerIds.has(existingPlayerId)) {
        console.log('➖ Removing player no longer on server:', existingPlayerId);
        this.removeRemotePlayer(existingPlayerId);
      }
    }

    // AGGRESSIVE: Check for players with stale data (older than 5 seconds)
    const staleDataThreshold = 5000; // 5 seconds
    for (const [playerId, target] of this.playerTargets.entries()) {
      const timeSinceUpdate = now - target.lastUpdate;
      if (timeSinceUpdate > staleDataThreshold && playerId !== localPlayerId) {
        console.log(`🧹 Removing player with stale data (${Math.floor(timeSinceUpdate/1000)}s old):`, playerId);
        this.removeRemotePlayer(playerId);
      }
    }

    // Add new players from the server list
    for (const player of players) {
      if (player.id !== localPlayerId) {
        const playerExists = this.remotePlayers.has(player.id);
        const playerBeingCreated = this.playersBeingCreated.has(player.id);
        const playerInScene = !!this.core.getScene().getObjectByName(`player-${player.id}`);
        
        if (!playerExists && !playerBeingCreated && !playerInScene) {
          console.log('➕ Adding new player from server list:', player.displayName);
          this.createRemotePlayer(player);
        } else if (playerInScene && (playerExists || playerBeingCreated)) {
          // Player exists in tracking, ensure consistency
          console.log('✅ Player consistency check passed:', player.displayName);
          
          // Update lastUpdate timestamp to prevent stale data removal
          const target = this.playerTargets.get(player.id);
          if (target) {
            target.lastUpdate = now;
          }
        } else if (playerInScene && !playerExists && !playerBeingCreated) {
          // This should be caught by the ghost character removal above, but double-check
          console.log('🔧 Player in scene but not tracked, re-adding to tracking:', player.displayName);
          const playerGroup = this.core.getScene().getObjectByName(`player-${player.id}`) as THREE.Group;
          if (playerGroup) {
            this.remotePlayers.set(player.id, playerGroup);
            // Set up interpolation target
            this.playerTargets.set(player.id, {
              position: player.position.clone(),
              rotation: player.rotation ? player.rotation.clone() : new THREE.Euler(),
              lastUpdate: now
            });
          }
        }
      }
    }

    console.log('✅ handleCurrentPlayers completed. Remote players:', this.remotePlayers.size);
  }

  public getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }

  public getRemotePlayers(): Map<string, THREE.Group> {
    return this.remotePlayers;
  }

  public getPlayerTargets(): Map<string, { position: THREE.Vector3; rotation: THREE.Euler; lastUpdate: number }> {
    return this.playerTargets;
  }

  public setNametagVisible(visible: boolean): void {
    // Store the current visibility state for newly created players
    this.currentNametagVisibility = visible;
    
    // Apply to all existing remote players
    for (const playerGroup of this.remotePlayers.values()) {
      const nametag = playerGroup.children.find(child => child instanceof CSS2DObject);
      if (nametag) {
        nametag.visible = visible;
      }
    }
  }

  public updateNametagScaling(camera: THREE.Camera): void {
    for (const playerGroup of this.remotePlayers.values()) {
      const nametag = playerGroup.children.find(child => child instanceof CSS2DObject) as CSS2DObject;
      if (nametag && nametag.visible) {
        // Calculate distance from camera to player
        const distance = camera.position.distanceTo(playerGroup.position);
        
        // Scale factor to keep nametag consistent size (same as local player)
        const baseScale = 0.02; // Base scale factor
        const minScale = 0.5; // Minimum scale to prevent nametags from becoming too small
        const maxScale = 2.0; // Maximum scale to prevent nametags from becoming too large
        
        const scale = Math.max(minScale, Math.min(maxScale, distance * baseScale));
        
        // Apply scale to the nametag
        nametag.scale.set(scale, scale, scale);
      }
    }
  }

  private createNameLabel(name: string, fid?: number): CSS2DObject {
    // Create nametag div with same styling as local player
    const nametagDiv = document.createElement('div');
    nametagDiv.className = 'nametag';
    if (fid === 1023416) {
      nametagDiv.classList.add('developer-nametag');
      nametagDiv.textContent = 'the DEV';
    } else {
      nametagDiv.textContent = name;
    }
    nametagDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    nametagDiv.style.color = '#ffffff';
    nametagDiv.style.padding = '8px 12px';
    nametagDiv.style.borderRadius = '4px';
    nametagDiv.style.fontSize = '10px';
    nametagDiv.style.fontFamily = '"Press Start 2P", cursive';
    nametagDiv.style.border = '2px solid #4a4a4a';
    nametagDiv.style.textShadow = '2px 2px 0px #000';
    nametagDiv.style.letterSpacing = '1px';
    nametagDiv.style.textAlign = 'center';
    nametagDiv.style.whiteSpace = 'nowrap';
    nametagDiv.style.pointerEvents = 'none';

    const nametag = new CSS2DObject(nametagDiv);
    nametag.visible = false; // Start hidden, will be controlled by game logic

    return nametag;
  }

  private async initializeRemotePlayerAnimations(playerId: string, character: THREE.Group, gltf: any): Promise<boolean> {
    try {
      const mixer = new THREE.AnimationMixer(character);

      const animations = {
        idle: null as THREE.AnimationAction | null,
        walk: null as THREE.AnimationAction | null,
        run: null as THREE.AnimationAction | null,
        jump: null as THREE.AnimationAction | null,
        current: null as THREE.AnimationAction | null,
      };

      // Find and create animation actions
      const animationClips = gltf.animations;

      if (!animationClips || animationClips.length === 0) {
        console.warn(`⚠️ No animations found for player ${playerId}`);
        return false;
      }

      for (const clip of animationClips) {
        // Remove position tracks to prevent animation from affecting movement
        clip.tracks = clip.tracks.filter((track: any) => !track.name.endsWith('.position'));

        const action = mixer.clipAction(clip);

        // Map animation names to actions
        const name = clip.name.toLowerCase();

        if (name.includes('idle')) {
          animations.idle = action;
          // Configure idle animation for smooth looping
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
        } else if (name.includes('walk')) {
          animations.walk = action;
          action.setLoop(THREE.LoopRepeat, Infinity);
        } else if (name.includes('run')) {
          animations.run = action;
          action.setLoop(THREE.LoopRepeat, Infinity);
        } else if (name.includes('jump')) {
          animations.jump = action;
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = false;
        }
      }

      // Store animation data for this remote player BEFORE starting animation
      this.remotePlayerAnimations.set(playerId, {
        mixer,
        actions: animations,
        lastAnimationState: 'idle',
        lastPosition: new THREE.Vector3()
      });

      // Start with idle animation and ensure it's properly initialized
      if (animations.idle) {
        // Reset and start the idle animation immediately
        animations.idle.reset();
        animations.idle.setEffectiveWeight(1.0);
        animations.idle.setEffectiveTimeScale(1.0);
        animations.idle.play();
        animations.current = animations.idle;
        
        // Force multiple immediate mixer updates to ensure animation is applied
        mixer.update(0);
        mixer.update(0.016); // One frame at 60fps
        mixer.update(0.032); // Two frames at 60fps
        
        // Force matrix updates to ensure proper positioning
        character.updateMatrix();
        character.updateMatrixWorld(true);
        
        console.log(`✅ Initialized animations for remote player ${playerId} with idle animation active`);
        return true;
      } else {
        console.warn(`⚠️ No idle animation found for player ${playerId}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to initialize animations for player ${playerId}:`, error);
      return false;
    }
  }

  private generatePlayerColor(playerId: string): number {
    // Predefined vibrant colors for better visibility
    const colors = [
      0xFF6B6B, // Red
      0x4ECDC4, // Teal
      0x45B7D1, // Blue
      0x96CEB4, // Green
      0xFECA57, // Yellow
      0xFF9FF3, // Pink
      0x54A0FF, // Light Blue
      0x5F27CD, // Purple
      0x00D2D3, // Cyan
      0xFF9F43, // Orange
      0x1DD1A1, // Mint
      0xFD79A8, // Rose
      0x6C5CE7, // Indigo
      0xA29BFE, // Lavender
      0xFD79A8  // Hot Pink
    ];

    // Use a simple hash of the player ID to pick a color
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }



  public forceCleanupAllRemotePlayers(): void {
    console.log('🧹 Force cleaning up all remote players...');
    const playerIds = Array.from(this.remotePlayers.keys());

    playerIds.forEach(playerId => {
      this.removeRemotePlayer(playerId);
    });

    // Double-check cleanup
    this.remotePlayers.clear();
    this.playerTargets.clear();
    this.playersBeingCreated.clear();
    this.remotePlayerAnimations.clear();
    this.playerMaterials.clear();
    
    // Clear all creation timeouts
    this.playerCreationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.playerCreationTimeouts.clear();

    console.log('✅ All remote players forcefully cleaned up');
  }

  public updateAnimations(deltaTime: number): void {
    // Update all animation mixers
    this.remotePlayerAnimations.forEach((animationData, playerId) => {
      if (animationData.mixer) {
        animationData.mixer.update(deltaTime);
      }

      // Update animation based on movement
      const playerGroup = this.remotePlayers.get(playerId);
      if (playerGroup) {
        const currentPosition = playerGroup.position;
        const lastPosition = animationData.lastPosition;
        const movement = currentPosition.distanceTo(lastPosition);
        const movementThreshold = 0.01;
        const runThreshold = 0.1;

        let targetAnimation: THREE.AnimationAction | null = null;
        let animationState = 'idle';

        // Determine which animation to play based on movement
        if (movement > runThreshold) {
          targetAnimation = animationData.actions.run || animationData.actions.walk;
          animationState = animationData.actions.run ? 'run' : 'walk';
        } else if (movement > movementThreshold) {
          targetAnimation = animationData.actions.walk;
          animationState = 'walk';
        } else {
          targetAnimation = animationData.actions.idle;
          animationState = 'idle';
        }

        // Only change animation if it's different from current
        if (targetAnimation && targetAnimation !== animationData.actions.current) {
          // Fade out current animation
          if (animationData.actions.current) {
            animationData.actions.current.fadeOut(0.2);
          }

          // Fade in new animation
          targetAnimation.reset().fadeIn(0.2).play();
          animationData.actions.current = targetAnimation;
          animationData.lastAnimationState = animationState;

          console.log(`🎭 Player ${playerId} animation changed to: ${animationState}`);
        }

        // Update last position for next frame
        lastPosition.copy(currentPosition);
      }
    });
  }

  public playRemotePlayerAnimation(playerId: string, animationName: string): void {
    const animationData = this.remotePlayerAnimations.get(playerId);
    if (!animationData) return;

    const { actions } = animationData;
    let targetAnimation: THREE.AnimationAction | null = null;

    // Map animation name to action
    switch (animationName.toLowerCase()) {
      case 'idle':
        targetAnimation = actions.idle;
        break;
      case 'walk':
        targetAnimation = actions.walk;
        break;
      case 'run':
        targetAnimation = actions.run;
        break;
      case 'jump':
        targetAnimation = actions.jump;
        break;
    }

    if (targetAnimation && targetAnimation !== actions.current) {
      // Fade out current animation
      if (actions.current) {
        actions.current.fadeOut(0.2);
      }

      // Fade in new animation
      if (animationName.toLowerCase() === 'jump') {
        // Jump animation should play once
        targetAnimation.reset().fadeIn(0.1).play();
        
        // Return to idle after jump completes
        setTimeout(() => {
          if (actions.idle) {
            targetAnimation!.fadeOut(0.2);
            actions.idle.reset().fadeIn(0.2).play();
            actions.current = actions.idle;
            animationData.lastAnimationState = 'idle';
          }
        }, targetAnimation.getClip().duration * 1000);
      } else {
        targetAnimation.reset().fadeIn(0.2).play();
      }

      actions.current = targetAnimation;
      animationData.lastAnimationState = animationName.toLowerCase();

      console.log(`🎭 Player ${playerId} forced animation: ${animationName}`);
    }
  }

  public update(deltaTime: number): void {
    if (!this.core.isMultiplayerEnabled()) return;

    // Update remote player animations and movement interpolation
    this.updateAnimations(deltaTime);

    // Update nametag scaling for consistent size
    const camera = this.core.getGameManager().getCamera();
    this.updateNametagScaling(camera);

    // Smooth interpolation for remote player positions
    const remotePlayers = this.remotePlayers;
    const playerTargets = this.playerTargets;
    const now = Date.now();

    // AGGRESSIVE: Remove players that haven't been updated in 3 seconds
    const staleThreshold = 3000; // 3 seconds
    for (const [playerId, target] of playerTargets.entries()) {
      const timeSinceUpdate = now - target.lastUpdate;
      if (timeSinceUpdate > staleThreshold) {
        console.log(`🧹 Removing stale player (no update for ${Math.floor(timeSinceUpdate/1000)}s):`, playerId);
        this.removeRemotePlayer(playerId);
      }
    }

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

  public dispose(): void {
    console.log('🧹 Disposing remote player manager...');

    // Clean up all remote players
    this.forceCleanupAllRemotePlayers();

    // Clean up textures and geometries
    if (this.characterTexture) {
      this.characterTexture.dispose();
    }
    if (this.playerGeometry) {
      this.playerGeometry.dispose();
    }

    // Clear all creation timeouts
    this.playerCreationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.playerCreationTimeouts.clear();

    // Clear debounce timeout
    if (this.handleCurrentPlayersTimeout) {
      clearTimeout(this.handleCurrentPlayersTimeout);
      this.handleCurrentPlayersTimeout = null;
    }

    console.log('✅ Remote player manager disposed');
  }
}