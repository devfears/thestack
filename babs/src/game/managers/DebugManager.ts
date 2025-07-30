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
    
  }

  public debugSceneObjects(): void {
    
  }

  public debugBrickSystem(): void {
    
  }

  public debugMultiplayer(): void {
    
    this.multiplayerManager.debugRemotePlayersInfo();
  }

  public debugPerformance(): void {
    
  }

  public debugAll(): void {
    
    this.debugGameState();
    
    this.debugSceneObjects();
    
    this.debugBrickSystem();
    
    this.debugMultiplayer();
    
    this.debugPerformance();
    
  }

  // Expose debug functions globally
  public exposeGlobalDebugFunctions(): void {
    (window as any).debugGame = () => this.debugAll();
    (window as any).debugGameState = () => this.debugGameState();
    (window as any).debugScene = () => this.debugSceneObjects();
    (window as any).debugBricks = () => this.debugBrickSystem();
    (window as any).debugMultiplayer = () => this.debugMultiplayer();
    (window as any).debugPerformance = () => this.debugPerformance();
    
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
