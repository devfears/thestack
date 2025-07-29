import { GameState, SceneObjects, UserProfile } from '../core/types';
import { UnifiedBrickSystem } from '../building/UnifiedBrickSystem';
import { MultiplayerManager } from '../core/MultiplayerManager';

export class DebugManager {
  private gameState: GameState;
  private sceneObjects: SceneObjects;
  private brickSystem: UnifiedBrickSystem;
  private multiplayerManager: MultiplayerManager;
  private user: UserProfile | null;
  private isMobile: boolean;
  private targetFrameTime: number;
  private frameCount: number;
  private lastFrameTime: number;
  private animationFrameId: number | null;

  constructor(
    gameState: GameState,
    sceneObjects: SceneObjects,
    brickSystem: UnifiedBrickSystem,
    multiplayerManager: MultiplayerManager,
    user: UserProfile | null,
    isMobile: boolean,
    targetFrameTime: number,
    frameCount: number,
    lastFrameTime: number,
    animationFrameId: number | null
  ) {
    this.gameState = gameState;
    this.sceneObjects = sceneObjects;
    this.brickSystem = brickSystem;
    this.multiplayerManager = multiplayerManager;
    this.user = user;
    this.isMobile = isMobile;
    this.targetFrameTime = targetFrameTime;
    this.frameCount = frameCount;
    this.lastFrameTime = lastFrameTime;
    this.animationFrameId = animationFrameId;
  }

  public debugGameState(): void {
    console.log('🎮 Game State Debug:');
    console.log('- Is jumping:', this.gameState.isJumping);
    console.log('- Is carrying brick:', this.gameState.isCarryingBrick);
    console.log('- Is build mode:', this.gameState.isBuildMode);
    console.log('- Camera follow enabled:', this.gameState.cameraFollowEnabled);
    console.log('- Last animation state:', this.gameState.lastAnimationState);
    console.log('- User profile:', this.user);
  }

  public debugSceneObjects(): void {
    console.log('🎬 Scene Objects Debug:');
    console.log('- Character position:', this.sceneObjects.character?.position);
    console.log('- Character rotation:', this.sceneObjects.character?.rotation);
    console.log('- Camera position:', this.sceneObjects.camera?.position);
    console.log('- Camera rotation:', this.sceneObjects.camera?.rotation);
    console.log('- Placed bricks count:', this.sceneObjects.placedBricks?.length || 0);
  }

  public debugBrickSystem(): void {
    console.log('🧱 Brick System Debug:');
    console.log('- Current layer:', this.brickSystem.getCurrentActiveLayer());
    console.log('- Layer progress:', this.brickSystem.getLayerProgress(this.brickSystem.getCurrentActiveLayer()));
    console.log('- Grid size:', this.brickSystem.getGridSize());
    console.log('- Carried brick:', !!this.sceneObjects.carriedBrick);
    console.log('- Ghost brick visible:', !!this.sceneObjects.ghostBrick?.visible);
  }

  public debugMultiplayer(): void {
    console.log('🔍 Multiplayer Debug Info:');
    console.log('- Connected:', this.multiplayerManager.isConnected());
    console.log('- Remote players:', this.multiplayerManager.getRemotePlayerCount());
    this.multiplayerManager.debugRemotePlayersInfo();
  }

  public debugPerformance(): void {
    console.log('⚡ Performance Debug:');
    console.log('- Is mobile:', this.isMobile);
    console.log('- Target frame time:', this.targetFrameTime);
    console.log('- Frame count:', this.frameCount);
    console.log('- Last frame time:', this.lastFrameTime);
    console.log('- Animation frame ID:', this.animationFrameId);
  }

  public debugAll(): void {
    console.log('\n=== COMPLETE GAME DEBUG ===');
    this.debugGameState();
    console.log('');
    this.debugSceneObjects();
    console.log('');
    this.debugBrickSystem();
    console.log('');
    this.debugMultiplayer();
    console.log('');
    this.debugPerformance();
    console.log('=== END DEBUG ===\n');
  }

  // Expose debug functions globally
  public exposeGlobalDebugFunctions(): void {
    (window as any).debugGame = () => this.debugAll();
    (window as any).debugGameState = () => this.debugGameState();
    (window as any).debugScene = () => this.debugSceneObjects();
    (window as any).debugBricks = () => this.debugBrickSystem();
    (window as any).debugMultiplayer = () => this.debugMultiplayer();
    (window as any).debugPerformance = () => this.debugPerformance();
    console.log('🔧 Debug functions exposed globally: debugGame(), debugGameState(), debugScene(), debugBricks(), debugMultiplayer(), debugPerformance()');
  }

  // Update methods to keep debug info current
  public updatePerformanceInfo(frameCount: number, lastFrameTime: number, animationFrameId: number | null): void {
    this.frameCount = frameCount;
    this.lastFrameTime = lastFrameTime;
    this.animationFrameId = animationFrameId;
  }

  public updateUser(user: UserProfile | null): void {
    this.user = user;
  }
}