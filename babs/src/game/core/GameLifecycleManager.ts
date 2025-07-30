import * as THREE from 'three';
import { GameState, SceneObjects } from './types';

/**
 * Manages the game lifecycle including initialization, game loop, and disposal
 * Follows Single Responsibility Principle by focusing only on lifecycle management
 */
export class GameLifecycleManager {
  private animationFrameId: number | null = null;
  private clock: THREE.Clock;
  private isInitialized = false;
  
  // Performance optimization
  private isMobile: boolean = false;
  private lastFrameTime: number = 0;
  private targetFrameTime: number = 16.67; // 60 FPS default
  private frameCount: number = 0;

  constructor() {
    this.clock = new THREE.Clock();
    
    // Detect mobile device and set performance targets
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    this.targetFrameTime = this.isMobile ? 33.33 : 16.67; // 30 FPS mobile, 60 FPS desktop
  }

  /**
   * Start the main game loop
   */
  public startGameLoop(updateCallback: (deltaTime: number) => void): void {
    const animate = (currentTime: number) => {
      this.animationFrameId = requestAnimationFrame(animate);

      // Frame rate limiting for mobile performance
      if (this.isMobile) {
        const deltaTime = currentTime - this.lastFrameTime;
        if (deltaTime < this.targetFrameTime) {
          return; // Skip this frame to maintain target FPS
        }
        this.lastFrameTime = currentTime;
      }

      const deltaTime = this.clock.getDelta();
      this.frameCount++;
      
      updateCallback(deltaTime);
    };
    animate(performance.now());
  }

  /**
   * Stop the game loop
   */
  public stopGameLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Mark the game as initialized
   */
  public setInitialized(initialized: boolean): void {
    this.isInitialized = initialized;
  }

  /**
   * Check if the game is initialized
   */
  public isGameInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current frame count for performance monitoring
   */
  public getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Check if running on mobile device
   */
  public isMobileDevice(): boolean {
    return this.isMobile;
  }

  /**
   * Dispose of lifecycle resources
   */
  public dispose(): void {
    this.stopGameLoop();
  }
}
