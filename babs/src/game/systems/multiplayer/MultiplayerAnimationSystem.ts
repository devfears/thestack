import * as THREE from 'three';
import { NetworkPlayer } from '../../network/NetworkManager';

/**
 * Handles animations for remote players
 */
export class MultiplayerAnimationSystem {
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

  constructor() {
    // Animation system is self-contained
  }

  public initializeRemotePlayerAnimations(playerId: string, character: THREE.Group, gltf: any): void {
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

    for (const clip of animationClips) {
      // Remove position tracks to prevent animation from affecting movement
      clip.tracks = clip.tracks.filter((track: any) => !track.name.endsWith('.position'));

      const action = mixer.clipAction(clip);

      // Map animation names to actions
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
        action.clampWhenFinished = false;
      }
    }

    // Start with idle animation
    if (animations.idle) {
      animations.idle.play();
      animations.current = animations.idle;
    }

    // Store animation data for this remote player
    this.remotePlayerAnimations.set(playerId, {
      mixer,
      actions: animations,
      lastAnimationState: 'idle',
      lastPosition: new THREE.Vector3()
    });

  }

  public updateRemotePlayerAnimation(playerId: string, currentPosition: THREE.Vector3): void {
    const animationData = this.remotePlayerAnimations.get(playerId);
    if (!animationData) return;

    const { mixer, actions, lastPosition } = animationData;

    // Calculate movement speed to determine animation
    const movement = currentPosition.distanceTo(lastPosition);
    const movementThreshold = 0.01; // Minimum movement to trigger walk animation
    const runThreshold = 0.1; // Movement speed to trigger run animation

    let targetAnimation: THREE.AnimationAction | null = null;
    let animationState = 'idle';

    // Determine which animation to play based on movement
    if (movement > runThreshold) {
      targetAnimation = actions.run || actions.walk;
      animationState = actions.run ? 'run' : 'walk';
    } else if (movement > movementThreshold) {
      targetAnimation = actions.walk;
      animationState = 'walk';
    } else {
      targetAnimation = actions.idle;
      animationState = 'idle';
    }

    // Only change animation if it's different from current
    if (targetAnimation && targetAnimation !== actions.current) {
      // Fade out current animation
      if (actions.current) {
        actions.current.fadeOut(0.2);
      }

      // Fade in new animation
      targetAnimation.reset().fadeIn(0.2).play();
      actions.current = targetAnimation;
      animationData.lastAnimationState = animationState;

    }

    // Update last position for next frame
    lastPosition.copy(currentPosition);
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

    }
  }

  public updateAnimations(deltaTime: number): void {
    // Update all animation mixers
    this.remotePlayerAnimations.forEach((animationData, playerId) => {
      if (animationData.mixer) {
        animationData.mixer.update(deltaTime);
      }
    });
  }

  public removePlayerAnimations(playerId: string): void {
    const animationData = this.remotePlayerAnimations.get(playerId);
    if (animationData && animationData.mixer) {
      animationData.mixer.stopAllAction();
      animationData.mixer.uncacheRoot(animationData.mixer.getRoot());
      this.remotePlayerAnimations.delete(playerId);
      
    }
  }

  public getPlayerAnimationState(playerId: string): string | null {
    const animationData = this.remotePlayerAnimations.get(playerId);
    return animationData ? animationData.lastAnimationState : null;
  }

  public hasPlayerAnimations(playerId: string): boolean {
    return this.remotePlayerAnimations.has(playerId);
  }

  public dispose(): void {
    
    // Clean up all animation mixers
    this.remotePlayerAnimations.forEach((animationData, playerId) => {
      if (animationData.mixer) {
        animationData.mixer.stopAllAction();
        animationData.mixer.uncacheRoot(animationData.mixer.getRoot());
      }
    });

    this.remotePlayerAnimations.clear();

  }
}
