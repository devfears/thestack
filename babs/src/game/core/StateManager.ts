import * as THREE from 'three';
import { GameState, SceneObjects, UserProfile } from './types';
import { UnifiedBrickSystem } from '../building/UnifiedBrickSystem';
import { BuildingManager } from './BuildingManager';
import { MultiplayerManager } from './MultiplayerManager';

/**
 * Manages all game state and provides getter methods
 * Follows Single Responsibility Principle by focusing only on state management
 */
export class StateManager {
  private gameState: GameState;
  private sceneObjects: SceneObjects;
  private buildingManager: BuildingManager;
  private multiplayerManager: MultiplayerManager;
  private brickSystem: UnifiedBrickSystem;
  private userProfile: UserProfile | null = null;

  constructor(
    gameState: GameState,
    sceneObjects: SceneObjects,
    buildingManager: BuildingManager,
    multiplayerManager: MultiplayerManager,
    brickSystem: UnifiedBrickSystem
  ) {
    this.gameState = gameState;
    this.sceneObjects = sceneObjects;
    this.buildingManager = buildingManager;
    this.multiplayerManager = multiplayerManager;
    this.brickSystem = brickSystem;
  }

  /**
   * Set user profile
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
  }

  /**
   * Get user profile
   */
  public getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  // ===== GAME STATE GETTERS =====

  /**
   * Check if character is jumping
   */
  public isJumping(): boolean {
    return this.gameState.isJumping;
  }

  /**
   * Check if in build mode
   */
  public isBuildMode(): boolean {
    return this.gameState.isBuildMode;
  }

  /**
   * Check if carrying a brick
   */
  public isCarryingBrick(): boolean {
    return this.gameState.isCarryingBrick;
  }

  /**
   * Check if camera follow is enabled
   */
  public isCameraFollowEnabled(): boolean {
    return this.gameState.cameraFollowEnabled;
  }

  /**
   * Check if multiplayer is enabled
   */
  public isMultiplayerEnabled(): boolean {
    return this.multiplayerManager.isConnected();
  }

  /**
   * Check if nametags are visible
   */
  public areNametagsVisible(): boolean {
    // This would need to be tracked separately if needed
    return true; // Default to visible
  }

  /**
   * Get joystick data
   */
  public getJoystickData(): { x: number; y: number } {
    return this.gameState.joystickData;
  }

  // ===== SCENE OBJECT GETTERS =====

  /**
   * Get character object
   */
  public getCharacter(): THREE.Object3D | null {
    return this.sceneObjects.character;
  }

  /**
   * Get camera object
   */
  public getCamera(): THREE.Camera | null {
    return this.sceneObjects.camera;
  }

  /**
   * Get scene object (not stored in SceneObjects)
   */
  public getScene(): THREE.Scene | null {
    // Scene is passed to managers but not stored in SceneObjects
    return null;
  }

  /**
   * Get renderer object (not stored in SceneObjects)
   */
  public getRenderer(): THREE.WebGLRenderer | null {
    // Renderer is not stored in SceneObjects
    return null;
  }

  /**
   * Get master brick object
   */
  public getMasterBrick(): THREE.Object3D | null {
    return this.sceneObjects.masterBrick;
  }

  /**
   * Get carried brick object
   */
  public getCarriedBrick(): THREE.Object3D | null {
    return this.sceneObjects.carriedBrick;
  }

  /**
   * Get ghost brick object
   */
  public getGhostBrick(): THREE.Object3D | null {
    return this.sceneObjects.ghostBrick;
  }

  /**
   * Get brick pile object
   */
  public getBrickPile(): THREE.Object3D | null {
    return this.sceneObjects.brickPile;
  }

  /**
   * Get building platform object
   */
  public getBuildingPlatform(): THREE.Object3D | null {
    return this.sceneObjects.buildingPlatform;
  }

  /**
   * Get all placed bricks
   */
  public getPlacedBricks(): THREE.Object3D[] {
    return this.sceneObjects.placedBricks;
  }

  /**
   * Get solid objects array
   */
  public getSolidObjects(): THREE.Object3D[] {
    return this.sceneObjects.solidObjects;
  }

  /**
   * Get ground objects array
   */
  public getGroundObjects(): THREE.Object3D[] {
    return this.sceneObjects.groundObjects;
  }

  // ===== BUILDING SYSTEM GETTERS =====

  /**
   * Get current layer
   */
  public getCurrentLayer(): number {
    return this.buildingManager.getCurrentLayer();
  }

  /**
   * Get maximum layers
   */
  public getMaxLayers(): number {
    return this.buildingManager.getMaxLayers();
  }

  /**
   * Get placed bricks count
   */
  public getPlacedBricksCount(): number {
    return this.buildingManager.getPlacedBricksCount();
  }

  /**
   * Get grid size
   */
  public getGridSize(): { x: number; z: number } {
    return this.buildingManager.getGridSize();
  }

  /**
   * Get cell size
   */
  public getCellSize(): number {
    return this.buildingManager.getCellSize();
  }

  /**
   * Get brick height
   */
  public getBrickHeight(): number {
    return this.buildingManager.getBrickHeight();
  }

  /**
   * Get grid origin
   */
  public getGridOrigin(): THREE.Vector3 {
    return this.buildingManager.getGridOrigin();
  }

  // ===== MULTIPLAYER GETTERS =====

  /**
   * Check if multiplayer is connected
   */
  public isMultiplayerConnected(): boolean {
    return this.multiplayerManager.isConnected();
  }

  /**
   * Get remote player count
   */
  public getRemotePlayerCount(): number {
    return this.multiplayerManager.getRemotePlayerCount();
  }

  // ===== STATE SETTERS =====

  /**
   * Set jumping state
   */
  public setJumping(isJumping: boolean): void {
    this.gameState.isJumping = isJumping;
  }

  /**
   * Set build mode
   */
  public setBuildMode(isBuildMode: boolean): void {
    this.gameState.isBuildMode = isBuildMode;
  }

  /**
   * Set carrying brick state
   */
  public setCarryingBrick(isCarrying: boolean): void {
    this.gameState.isCarryingBrick = isCarrying;
  }

  /**
   * Set camera follow enabled
   */
  public setCameraFollowEnabled(enabled: boolean): void {
    this.gameState.cameraFollowEnabled = enabled;
  }

  /**
   * Set multiplayer enabled (handled by connection state)
   */
  public setMultiplayerEnabled(enabled: boolean): void {
    // Multiplayer state is managed by connection, not a separate flag
    console.log(`Multiplayer ${enabled ? 'enabled' : 'disabled'} - managed by connection state`);
  }

  /**
   * Set nametags visible
   */
  public setNametagsVisible(visible: boolean): void {
    // This would need to be tracked separately if needed
    this.multiplayerManager.setNametagVisible(visible);
  }

  /**
   * Set joystick data
   */
  public setJoystickData(data: { x: number; y: number }): void {
    this.gameState.joystickData = data;
  }

  /**
   * Toggle camera follow
   */
  public toggleCameraFollow(): void {
    this.gameState.cameraFollowEnabled = !this.gameState.cameraFollowEnabled;
    console.log(`📷 Camera follow: ${this.gameState.cameraFollowEnabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Toggle build mode
   */
  public toggleBuildMode(): void {
    this.buildingManager.toggleBuildMode();
  }

  /**
   * Get comprehensive game state for debugging
   */
  public getDebugState(): any {
    return {
      gameState: {
        isJumping: this.gameState.isJumping,
        isBuildMode: this.gameState.isBuildMode,
        isCarryingBrick: this.gameState.isCarryingBrick,
        cameraFollowEnabled: this.gameState.cameraFollowEnabled,
        joystickData: this.gameState.joystickData
      },
      building: {
        currentLayer: this.getCurrentLayer(),
        maxLayers: this.getMaxLayers(),
        placedBricksCount: this.getPlacedBricksCount(),
        gridSize: this.getGridSize(),
        cellSize: this.getCellSize(),
        brickHeight: this.getBrickHeight()
      },
      multiplayer: {
        isConnected: this.isMultiplayerConnected(),
        remotePlayerCount: this.getRemotePlayerCount()
      },
      scene: {
        hasCharacter: !!this.sceneObjects.character,
        hasCamera: !!this.sceneObjects.camera,
        hasMasterBrick: !!this.sceneObjects.masterBrick,
        hasCarriedBrick: !!this.sceneObjects.carriedBrick,
        hasGhostBrick: !!this.sceneObjects.ghostBrick,
        hasBrickPile: !!this.sceneObjects.brickPile,
        hasBuildingPlatform: !!this.sceneObjects.buildingPlatform,
        placedBricksCount: this.sceneObjects.placedBricks.length,
        solidObjectsCount: this.sceneObjects.solidObjects.length,
        groundObjectsCount: this.sceneObjects.groundObjects.length
      }
    };
  }
}