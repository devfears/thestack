import * as THREE from 'three';
import { KEY_MAPPINGS, WASD_MAPPINGS, CHARACTER_CONFIG } from '../core/constants';
import { GameState } from '../core/types';
import type { GameManager } from '../core/GameManager';
import { PhysicsSystemManager } from '../character/PhysicsSystem';
import { AnimationSystemManager } from '../character/AnimationSystem';


export class InputSystemManager {
  private gameState: GameState;
  private physicsSystem: PhysicsSystemManager;
  private animationSystem: AnimationSystemManager;
  private gameManager: GameManager;

  constructor(
    gameState: GameState, 
    physicsSystem: PhysicsSystemManager,
    animationSystem: AnimationSystemManager,
    gameManager: GameManager
  ) {
    this.gameState = gameState;
    this.physicsSystem = physicsSystem;
    this.animationSystem = animationSystem;
    this.gameManager = gameManager;
    
    this.bindEventListeners();
  }

  private bindEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.code.toLowerCase();
    
    
    this.gameState.keysPressed[key] = true;
    

    // Handle specific key actions
    switch (key) {
      case KEY_MAPPINGS.JUMP:
        if (!this.gameState.isJumping) {
          this.physicsSystem.initiateJump(this.gameState);
        }
        break;
        
      case KEY_MAPPINGS.TURN_LEFT:
      case KEY_MAPPINGS.TURN_RIGHT:
        break;
        
      case KEY_MAPPINGS.INTERACT:
        this.handlePickup();
        break;
        
      case KEY_MAPPINGS.BUILD:
        this.handlePlacement();
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    const key = event.code.toLowerCase();
    this.gameState.keysPressed[key] = false;
  }

  private handlePickup(): void {
    console.log('🎮 handlePickup called (E key), isCarryingBrick:', this.gameState.isCarryingBrick);
    const character = this.gameManager.getSceneObjects().character;
    const brickPile = this.gameManager.getSceneObjects().brickPile;

    if (!character) {
      console.log('❌ No character found');
      return;
    }

    if (this.gameState.isCarryingBrick) {
      console.log('⚠️ Already carrying a brick, use B to place it');
      this.gameManager.getUIManager().showToast('Already carrying a brick! Press B to place it.', 2000);
      return;
    }

    if (!brickPile) {
      console.log('❌ No brick pile found');
      return;
    }

    const distance = character.position.distanceTo(brickPile.position);
    console.log('📏 Distance to brick pile:', distance);
    if (distance < 3) {
      console.log('🧱 Attempting to pickup brick...');
      this.gameManager.pickupBrick();
    } else {
      this.gameManager.getUIManager().showToast('Get closer to the brick pile to pick up a brick.', 2000);
    }
  }

  private handlePlacement(): void {
    console.log('🎮 handlePlacement called (B key), isCarryingBrick:', this.gameState.isCarryingBrick);
    const character = this.gameManager.getSceneObjects().character;
    const carriedBrick = this.gameManager.getSceneObjects().carriedBrick;

    if (!character) {
      console.log('❌ No character found');
      return;
    }

    if (!this.gameState.isCarryingBrick) {
      console.log('⚠️ Not carrying a brick, use E to pick one up');
      this.gameManager.getUIManager().showToast('Not carrying a brick! Press E near the brick pile to pick one up.', 2000);
      return;
    }

    if (!carriedBrick || !carriedBrick.visible) {
      console.log('⚠️ Carried brick not visible, resetting state');
      this.gameState.isCarryingBrick = false;
      return;
    }

    console.log('🧱 Attempting to place brick...');
    const success = this.gameManager.placeBrick();
    console.log('🧱 Place brick result:', success);
    
    if (!success) {
      this.gameManager.getUIManager().showToast('Cannot place brick here. Move closer to the building platform.', 3000);
    }
  }

  private handleInteraction(): void {
    console.log('🎮 handleInteraction called (legacy), isCarryingBrick:', this.gameState.isCarryingBrick);
    // Legacy method - now redirects to appropriate handler
    if (this.gameState.isCarryingBrick) {
      this.handlePlacement();
    } else {
      this.handlePickup();
    }
  }







  public processMovement(
    character: THREE.Group | null,
    solidObjects: THREE.Object3D[],
    groundObjects: THREE.Object3D[],
    deltaTime: number
  ): void {
    if (!character) {
      
      return;
    }
    
    

    // Determine movement speed
    const isRunning = this.gameState.keysPressed[KEY_MAPPINGS.RUN.toLowerCase()];
    const speed = isRunning ? CHARACTER_CONFIG.RUN_SPEED : CHARACTER_CONFIG.SPEED;
    
    let hasMoved = false;

    // Handle joystick movement
    if (this.gameState.joystickData && this.gameState.joystickData.force > 0) {

      const { angle, force } = this.gameState.joystickData;
      const speed = (isRunning ? CHARACTER_CONFIG.RUN_SPEED : CHARACTER_CONFIG.SPEED) * force;

      // Get the camera's forward direction on the XZ plane
      const camera = this.gameManager.getCamera();
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0;
      cameraDirection.normalize();

      // Calculate camera yaw
      const cameraYaw = Math.atan2(cameraDirection.x, cameraDirection.z);

      // The joystick angle is absolute. We want to make it relative to the camera.
      // nipplejs has 0 radians pointing to the right. We want "up" (PI/2) to be forward.
      const joystickAngle = angle.radian;
      const moveAngle = cameraYaw + joystickAngle - (Math.PI / 2);

      const moveDirection = new THREE.Vector3(Math.sin(moveAngle), 0, Math.cos(moveAngle));


      hasMoved = this.physicsSystem.moveAndRotateCharacter(
        character,
        moveDirection,
        speed,
        solidObjects,
        groundObjects,
        deltaTime
      );
    } else {
      // Handle keyboard movement
    const forwardPressed = this.gameState.keysPressed[KEY_MAPPINGS.MOVE_FORWARD.toLowerCase()] || 
                          this.gameState.keysPressed[WASD_MAPPINGS.MOVE_FORWARD.toLowerCase()];
    const backwardPressed = this.gameState.keysPressed[KEY_MAPPINGS.MOVE_BACKWARD.toLowerCase()] || 
                           this.gameState.keysPressed[WASD_MAPPINGS.MOVE_BACKWARD.toLowerCase()];
    const leftPressed = this.gameState.keysPressed[KEY_MAPPINGS.TURN_LEFT.toLowerCase()] || 
                       this.gameState.keysPressed[WASD_MAPPINGS.TURN_LEFT.toLowerCase()];
    const rightPressed = this.gameState.keysPressed[KEY_MAPPINGS.TURN_RIGHT.toLowerCase()] || 
                        this.gameState.keysPressed[WASD_MAPPINGS.TURN_RIGHT.toLowerCase()];
    
    if (forwardPressed) {
      
      hasMoved = this.physicsSystem.moveCharacter(character, 'forward', speed, solidObjects, groundObjects);
    }
    
    if (backwardPressed) {
      
      hasMoved = this.physicsSystem.moveCharacter(character, 'backward', speed, solidObjects, groundObjects) || hasMoved;
    }

    // Handle keyboard rotation
    if (leftPressed) {
      this.gameState.rotationDirection = 1;
    } else if (rightPressed) {
      this.gameState.rotationDirection = -1;
    } else {
      this.gameState.rotationDirection = 0;
    }

    // Update rotation
    this.physicsSystem.updateRotation(character, this.gameState);
    }
  }

  public isMoving(): boolean {
    const keyboardMoving = this.gameState.keysPressed[KEY_MAPPINGS.MOVE_FORWARD.toLowerCase()] || 
                          this.gameState.keysPressed[KEY_MAPPINGS.MOVE_BACKWARD.toLowerCase()] ||
                          this.gameState.keysPressed[WASD_MAPPINGS.MOVE_FORWARD.toLowerCase()] || 
                          this.gameState.keysPressed[WASD_MAPPINGS.MOVE_BACKWARD.toLowerCase()];
    const joystickMoving = this.gameState.joystickData && this.gameState.joystickData.force > 0;
    return keyboardMoving || joystickMoving;
  }

  public isRunning(): boolean {
    return this.gameState.keysPressed[KEY_MAPPINGS.RUN.toLowerCase()];
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
}
