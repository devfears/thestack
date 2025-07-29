import * as THREE from 'three';
import { ANIMATION_CONFIG } from '../core/constants';
import { CharacterAnimations, AnimationState, GameState } from '../core/types';

export class AnimationSystemManager {
  private animations: CharacterAnimations;
  private mixer: THREE.AnimationMixer | null = null;
  private lastTime: number = 0;
  private frameCount: number = 0;

  constructor() {
    this.animations = {
      idle: null,
      walk: null,
      run: null,
      jump: null,
      'pick-up': null,
      current: null,
    };
  }

  initializeAnimations(character: THREE.Group, gltf: any): void {
    this.mixer = new THREE.AnimationMixer(character);
    
    // Find and create animation actions
    const animations = gltf.animations;
    
    for (const clip of animations) {
      // Remove position tracks to prevent animation from affecting movement
      clip.tracks = clip.tracks.filter((track: any) => !track.name.endsWith('.position'));

      const action = this.mixer.clipAction(clip);
      
      // Map animation names to actions
      const name = clip.name.toLowerCase();
      
      if (name.includes('idle')) {
        this.animations.idle = action;
      } else if (name.includes('walk')) {
        this.animations.walk = action;
      } else if (name.includes('run')) {
        this.animations.run = action;
      } else if (name.includes('jump')) {
        this.animations.jump = action;
        // Configure jump animation
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false; // Don't clamp to allow proper transitions
      } else if (name.includes('pick-up') || name.includes('pickup')) {
        this.animations['pick-up'] = action;
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
    }

    // Start with idle animation
    if (this.animations.idle) {
      this.animations.idle.play();
      this.animations.current = this.animations.idle;
    }

    
  }

  fadeToAction(
    action: THREE.AnimationAction | null, 
    duration: number = ANIMATION_CONFIG.FADE_DURATION
  ): void {
    if (!action || !this.mixer) return;

    const previousAction = this.animations.current;

    if (previousAction && previousAction !== action) {
      // Always fade out the previous action
      previousAction.fadeOut(duration);
    }

    // Reset and play the new action
    action.reset();
    action.fadeIn(duration);
    action.play();
    this.animations.current = action;
  }

  private getAnimationState(
    isMoving: boolean, 
    isRunning: boolean, 
    isJumping: boolean
  ): AnimationState {
    // If jumping, always return jump state
    if (isJumping) {
      return 'jump';
    }
    
    // If moving, return appropriate movement state
    if (isMoving) {
      return isRunning ? 'run' : 'walk';
    }
    
    // Default to idle
    return 'idle';
  }

  updateAnimations(gameState: GameState, inputSystem?: any): void {
    if (!this.mixer) return;

    // Performance optimization: Use more efficient timing with mobile-aware capping
    const currentTime = performance.now();
    const deltaTime = this.lastTime === 0 ? 0.016 : Math.min((currentTime - this.lastTime) / 1000, 0.033);
    this.lastTime = currentTime;
    this.frameCount++;
    
    // Debug logging for animation performance
    if (this.frameCount % 300 === 0) { // Every 5 seconds at 60fps
      
    }

    // Determine current animation state - check keyboard input
    const keyboardMoving = gameState.keysPressed['arrowup'] || gameState.keysPressed['arrowdown'];
    const isMoving = inputSystem ? inputSystem.isMoving() : keyboardMoving;
    const isRunning = gameState.keysPressed['shiftleft'];
    
    const newAnimationState = this.getAnimationState(isMoving, isRunning, gameState.isJumping);
    
    // Only change animation if state changed (performance optimization)
    if (newAnimationState !== gameState.lastAnimationState) {
      gameState.animationStateChanged = true;
      gameState.lastAnimationState = newAnimationState;
      
      switch (newAnimationState) {
        case 'idle':
          this.fadeToAction(this.animations.idle);
          break;
        case 'walk':
          this.fadeToAction(this.animations.walk);
          break;
        case 'run':
          this.fadeToAction(this.animations.run);
          break;
        case 'jump':
          // Only play jump animation if we just started jumping
          if (this.animations.jump && !this.animations.jump.isRunning()) {
            this.fadeToAction(this.animations.jump, 0.1);
            
            // Set up jump completion handler
            const onJumpFinished = (event: any) => {
              if (event.action === this.animations.jump) {
                this.mixer?.removeEventListener('finished', onJumpFinished);
                // Force animation state update after jump
                gameState.lastAnimationState = 'jump_finished';
              }
            };
            
            if (this.mixer) {
              this.mixer.addEventListener('finished', onJumpFinished);
            }
          }
          break;
      }
    }

    // Update mixer with actual delta time
    this.mixer.update(deltaTime);
  }

  public playPickupAnimation(): void {
    const pickupAction = this.animations['pick-up'];
    if (!pickupAction || !this.mixer) return;

    // Ensure normal forward playback for pickup
    pickupAction.timeScale = 1;
    this.fadeToAction(pickupAction, 0.2);

    const onFinished = (event: any) => {
      if (event.action === pickupAction) {
        this.mixer?.removeEventListener('finished', onFinished);
        // Return to idle after pickup
        this.fadeToAction(this.animations.idle);
      }
    };

    this.mixer.addEventListener('finished', onFinished);
  }

  public playPlaceAnimation(): void {
    const pickupAction = this.animations['pick-up'];
    
    if (!pickupAction || !this.mixer) {
      return;
    }

    // Stop current animation and reset
    pickupAction.stop();
    pickupAction.reset();
    
    // Set the animation to play in reverse
    pickupAction.timeScale = -1;
    
    // Start from the end of the animation
    pickupAction.time = pickupAction.getClip().duration;
    
    // Enable and play the action
    pickupAction.enabled = true;
    pickupAction.setEffectiveTimeScale(1);
    pickupAction.setEffectiveWeight(1);
    
    // Use direct play instead of fadeToAction for reverse animation
    pickupAction.play();
    this.animations.current = pickupAction;

    const onFinished = (event: any) => {
      if (event.action === pickupAction) {
        this.mixer?.removeEventListener('finished', onFinished);
        // Reset timeScale back to normal for future pickup animations
        pickupAction.timeScale = 1;
        pickupAction.setEffectiveTimeScale(1);
        // Return to idle after placement
        this.fadeToAction(this.animations.idle);
      }
    };

    this.mixer.addEventListener('finished', onFinished);
  }

  getMixer(): THREE.AnimationMixer | null {
    return this.mixer;
  }

  getAnimations(): CharacterAnimations {
    return this.animations;
  }

  dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
    }
  }
}
