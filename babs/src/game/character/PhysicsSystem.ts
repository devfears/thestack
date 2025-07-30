import * as THREE from 'three';
import { CHARACTER_CONFIG } from '../core/constants';
import { GameState } from '../core/types';

export class PhysicsSystemManager {
  private groundRaycaster: THREE.Raycaster;
  private collisionRaycaster: THREE.Raycaster;
  private tempVectors: THREE.Vector3[];
  private tempBox: THREE.Box3;
  private tempBox2: THREE.Box3; // Reusable box for collision checks

  constructor() {
    this.groundRaycaster = new THREE.Raycaster();
    this.collisionRaycaster = new THREE.Raycaster();
    this.tempVectors = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ];
    this.tempBox = new THREE.Box3();
    this.tempBox2 = new THREE.Box3(); // Reusable box for collision checks
  }

  checkSolidCollision(character: THREE.Group, solidObjects: THREE.Object3D[]): boolean {
    if (!character) return false;

    this.tempBox.setFromObject(character);
    
    // Make the collision box slightly smaller for smoother movement
    const shrinkAmount = 0.05;
    this.tempBox.min.addScalar(shrinkAmount);
    this.tempBox.max.subScalar(shrinkAmount);
    
    for (const obj of solidObjects) {
      // Check for invisible wall collision meshes first (strictest collision)
      if (obj.userData?.isInvisibleWall || obj.userData?.isCollisionMesh) {
        this.tempBox2.setFromObject(obj);
        // Expand collision box slightly for invisible walls to ensure no phasing
        this.tempBox2.expandByScalar(0.1);
        if (this.tempBox.intersectsBox(this.tempBox2)) {
          return true;
        }
      }
      // Enhanced collision detection for complex geometries like trees
      else if (this.isComplexGeometry(obj)) {
        // Use raycasting for complex objects like trees
        if (this.checkRaycastCollision(character, obj)) {
          return true;
        }
      } else {
        // Use bounding box for simple objects like bricks
        this.tempBox2.setFromObject(obj);
        
        if (this.tempBox.intersectsBox(this.tempBox2)) {
          return true;
        }
      }
    }
    return false;
  }

  // Check if object is a complex geometry that needs raycasting
  private isComplexGeometry(obj: THREE.Object3D): boolean {
    const name = obj.name.toLowerCase();
    return name.includes('tree') || name.includes('rock') || name.includes('stone') ||
           name.includes('boulder') || name.includes('wall') || name.includes('fence') ||
           (obj.children && obj.children.length > 5); // Complex multi-mesh objects
  }

  // Enhanced raycasting collision detection for complex geometries
  private checkRaycastCollision(character: THREE.Group, obj: THREE.Object3D): boolean {
    const characterPosition = character.position;
    const characterRadius = 1.2; // Increased collision radius for stricter detection
    
    // Cast multiple rays around the character to detect collision
    const rayDirections = [
      new THREE.Vector3(1, 0, 0),   // Right
      new THREE.Vector3(-1, 0, 0),  // Left
      new THREE.Vector3(0, 0, 1),   // Forward
      new THREE.Vector3(0, 0, -1),  // Backward
      new THREE.Vector3(0.707, 0, 0.707),   // Diagonal
      new THREE.Vector3(-0.707, 0, 0.707),  // Diagonal
      new THREE.Vector3(0.707, 0, -0.707),  // Diagonal
      new THREE.Vector3(-0.707, 0, -0.707), // Diagonal
      // Additional rays for more precise detection
      new THREE.Vector3(0.5, 0, 0.866),     // 30-degree angles
      new THREE.Vector3(-0.5, 0, 0.866),
      new THREE.Vector3(0.866, 0, 0.5),
      new THREE.Vector3(-0.866, 0, 0.5),
      new THREE.Vector3(0.5, 0, -0.866),
      new THREE.Vector3(-0.5, 0, -0.866),
      new THREE.Vector3(0.866, 0, -0.5),
      new THREE.Vector3(-0.866, 0, -0.5),
    ];
    
    for (const direction of rayDirections) {
      const rayOrigin = characterPosition.clone();
      rayOrigin.y += 0.5; // Cast from character center height
      
      this.collisionRaycaster.set(rayOrigin, direction);
      const intersects = this.collisionRaycaster.intersectObject(obj, true);
      
      if (intersects.length > 0 && intersects[0].distance < characterRadius) {
        return true;
      }
    }
    
    // Additional vertical collision check to prevent climbing
    const upDirection = new THREE.Vector3(0, 1, 0);
    this.collisionRaycaster.set(characterPosition, upDirection);
    const upIntersects = this.collisionRaycaster.intersectObject(obj, true);
    if (upIntersects.length > 0 && upIntersects[0].distance < 2.0) {
      return true; // Block if tree is directly above
    }
    
    return false;
  }

  // Minecraft-style movement with step-up functionality
  canMoveToPosition(
    character: THREE.Group, 
    newPosition: THREE.Vector3, 
    groundObjects: THREE.Object3D[], 
    solidObjects: THREE.Object3D[]
  ): { canMove: boolean; adjustedPosition?: THREE.Vector3 } {
    if (!character) return { canMove: false };

    // Store current position
    this.tempVectors[0].copy(character.position);
    
    // First, try the exact position
    character.position.copy(newPosition);
    const hasSolidCollision = this.checkSolidCollision(character, solidObjects);
    
    if (!hasSolidCollision) {
      // No collision, check if there's ground support
      const hasGroundSupport = this.hasGroundSupport(newPosition, groundObjects);
      character.position.copy(this.tempVectors[0]); // Restore position
      return { canMove: hasGroundSupport, adjustedPosition: newPosition };
    }
    
    // There's a collision, try step-up (Minecraft-style)
    const stepHeight = 0.6; // Allow stepping up onto blocks
    const stepUpPosition = newPosition.clone();
    stepUpPosition.y += stepHeight;
    
    character.position.copy(stepUpPosition);
    const hasStepUpCollision = this.checkSolidCollision(character, solidObjects);
    
    if (!hasStepUpCollision) {
      // Can step up, check if there's ground support at the stepped-up position
      const hasGroundSupport = this.hasGroundSupport(stepUpPosition, groundObjects);
      character.position.copy(this.tempVectors[0]); // Restore position
      
      if (hasGroundSupport) {
        return { canMove: true, adjustedPosition: stepUpPosition };
      }
    }
    
    // Restore original position and return false
    character.position.copy(this.tempVectors[0]);
    return { canMove: false };
  }

  // Check if there's walkable ground at a position
  private hasGroundSupport(position: THREE.Vector3, groundObjects: THREE.Object3D[]): boolean {
    // Cast ray downward from above the position to find ground
    const rayStart = new THREE.Vector3(position.x, position.y + 2, position.z);
    this.collisionRaycaster.set(
      rayStart,
      new THREE.Vector3(0, -1, 0)
    );

    const intersects = this.collisionRaycaster.intersectObjects(groundObjects, true);
    
    if (intersects.length > 0) {
      // Check if ground is within reasonable distance (not too far below)
      const groundDistance = intersects[0].distance;
      const hasSupport = groundDistance < 5; // Allow up to 5 units below
      return hasSupport;
    }
    
    return false;
  }

  updateGroundPosition(
    character: THREE.Group, 
    groundObjects: THREE.Object3D[], 
    gameState: GameState
  ): void {
    if (!character || gameState.isJumping) return;

    const characterPosition = character.position;
    
    // Cast a ray straight down from the character's center to find the ground
    const rayOrigin = new THREE.Vector3(characterPosition.x, characterPosition.y + 1, characterPosition.z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    this.groundRaycaster.set(rayOrigin, rayDirection);

    // Filter out invisible walls from ground detection
    const walkableGround = groundObjects.filter(obj => !obj.userData?.isInvisibleWall);
    const intersects = this.groundRaycaster.intersectObjects(walkableGround, true);
    
    if (intersects.length > 0) {
      // Prioritize brick objects over terrain
      intersects.sort((a, b) => a.distance - b.distance);
      
      let selectedIntersect = intersects[0]; // Default to closest
      
      // Look for the closest brick object
      for (const intersect of intersects) {
        if (intersect.object.userData.isBrick) {
          selectedIntersect = intersect;
          break;
        }
      }
      
      const groundY = selectedIntersect.point.y;
      const intersectedObject = selectedIntersect.object;
      
      // Check if we hit a brick (collision mesh)
      if (intersectedObject.userData.isBrick) {
        // For bricks, the character should stand on top of the collision mesh
        // The brick's position.y is already at its center, so we need to add half the height
        // to get the top surface. BRICK_HEIGHT is 0.24 by default.
        const brickHeight = 0.24; // Standard brick height from UnifiedBrickSystem
        
        // Calculate the brick's top surface correctly
        const brickTop = intersectedObject.position.y + (brickHeight / 2);
        const targetY = brickTop + CHARACTER_CONFIG.GROUND_LEVEL;
        
        // Use a smaller threshold for more responsive collision
        if (Math.abs(character.position.y - targetY) > 0.005) {
          character.position.y = targetY;
        }
      } else {
        // For terrain/platform, use the standard ground level
        const targetY = groundY + CHARACTER_CONFIG.GROUND_LEVEL;
        // Only update Y position if it's significantly different to avoid micro-adjustments
        if (Math.abs(character.position.y - targetY) > 0.01) {
          character.position.y = targetY;
        }
      }
    } else {
      // No ground detected. This could mean the character is off the map.
    }
  }

  updateJumpPhysics(character: THREE.Group, gameState: GameState, groundObjects: THREE.Object3D[]): void {
    if (!character || !gameState.isJumping) return;

    // Apply gravity
    gameState.jumpVelocity += CHARACTER_CONFIG.GRAVITY;
    character.position.y += gameState.jumpVelocity;

    // Only check for landing if we're falling (negative velocity)
    if (gameState.jumpVelocity <= 0) {
      const characterPosition = character.position;
      
      // Cast ray downward from character position
      this.groundRaycaster.set(
        new THREE.Vector3(characterPosition.x, characterPosition.y + 0.5, characterPosition.z),
        new THREE.Vector3(0, -1, 0)
      );

      const intersects = this.groundRaycaster.intersectObjects(groundObjects, true);
      
      if (intersects.length > 0) {
        // CRITICAL FIX: Prioritize brick objects over terrain for landing
        intersects.sort((a, b) => a.distance - b.distance);
        
        let selectedIntersect = intersects[0]; // Default to closest
        
        // Look for the closest brick object
        for (const intersect of intersects) {
          if (intersect.object.userData.isBrick) {
            selectedIntersect = intersect;
            break;
          }
        }
        
        const groundY = selectedIntersect.point.y;
        const intersectedObject = selectedIntersect.object;
        
        let targetY: number;
        
        // Check if we hit a brick (collision mesh)
        if (intersectedObject.userData.isBrick) {
          // For bricks, the character should land on top of the collision mesh
          // The brick's position.y is already at its center, so we need to add half the height
          // to get the top surface. BRICK_HEIGHT is 0.24 by default.
          const brickHeight = 0.24; // Standard brick height from UnifiedBrickSystem
          
          // Calculate the brick's top surface correctly
          const brickTop = intersectedObject.position.y + (brickHeight / 2);
          targetY = brickTop + CHARACTER_CONFIG.GROUND_LEVEL;
        } else {
          // For terrain/platform, use the standard ground level
          targetY = groundY + CHARACTER_CONFIG.GROUND_LEVEL;
        }
        
        // Check if we've hit the ground
        if (character.position.y <= targetY) {
          character.position.y = targetY;
          gameState.isJumping = false;
          gameState.jumpVelocity = 0;
        }
      } else if (character.position.y <= CHARACTER_CONFIG.GROUND_LEVEL) {
        // If no ground is detected and we are below the default ground level, land us there.
        character.position.y = CHARACTER_CONFIG.GROUND_LEVEL;
        gameState.isJumping = false;
        gameState.jumpVelocity = 0;
      }
    }
  }

  initiateJump(gameState: GameState): void {
    if (!gameState.isJumping) {
      gameState.isJumping = true;
      gameState.jumpVelocity = CHARACTER_CONFIG.JUMP_FORCE;
    }
  }

  moveAndRotateCharacter(
    character: THREE.Group | null,
    direction: THREE.Vector3, // Renamed for clarity
    speed: number,
    solidObjects: THREE.Object3D[],
    groundObjects: THREE.Object3D[],
    deltaTime: number // for smooth rotation
  ): boolean {
    if (!character) {
      return false;
    }
    
    // Ensure we're moving the container, which should move all children
    character.updateMatrixWorld(true);
    
    if (direction.lengthSq() === 0) {
      return false;
    }

    // --- Smooth Rotation ---
    const targetQuaternion = new THREE.Quaternion();
    // Use atan2 to get the angle from the direction vector and create a quaternion
    const targetRotation = Math.atan2(direction.x, direction.z);

    targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotation);

    // Slerp for smooth rotation. Adjust the multiplier for faster/slower rotation.
    character.quaternion.slerp(targetQuaternion, CHARACTER_CONFIG.JOYSTICK_ROTATION_SPEED * deltaTime);
    
    // --- Movement ---
    // Calculate the movement vector based on speed and the joystick direction
    const actualSpeed = speed;
    const moveVector = direction.clone().normalize().multiplyScalar(actualSpeed * deltaTime);
    this.tempVectors[1].copy(character.position).add(moveVector);

    const moveResult = this.canMoveToPosition(character, this.tempVectors[1], groundObjects, solidObjects);
    if (moveResult.canMove && moveResult.adjustedPosition) {
      character.position.copy(moveResult.adjustedPosition);
      return true;
    }

    // --- Sliding Logic (if direct movement is blocked) ---
    // Try moving along the X-axis only
    const xOnlyPosition = character.position.clone();
    xOnlyPosition.x += moveVector.x;
    const xMoveResult = this.canMoveToPosition(character, xOnlyPosition, groundObjects, solidObjects);
    
    if (xMoveResult.canMove && xMoveResult.adjustedPosition) {
      character.position.copy(xMoveResult.adjustedPosition);
      return true;
    }
    
    // Try moving along the Z-axis only
    const zOnlyPosition = character.position.clone();
    zOnlyPosition.z += moveVector.z;
    const zMoveResult = this.canMoveToPosition(character, zOnlyPosition, groundObjects, solidObjects);
    
    if (zMoveResult.canMove && zMoveResult.adjustedPosition) {
      character.position.copy(zMoveResult.adjustedPosition);
      return true;
    }

    return false;
  }

  moveCharacter(
    character: THREE.Group,
    direction: 'forward' | 'backward',
    speed: number,
    solidObjects: THREE.Object3D[],
    groundObjects: THREE.Object3D[]
  ): boolean {
    
    if (!character) {
      
      return false;
    }
    
    // Calculate new position
    const moveDistance = direction === 'forward' ? speed : -speed;
    this.tempVectors[1].copy(character.position);
    
    // Apply movement in character's local forward direction
    // Note: In Three.js, positive Z is forward for our character setup
    const forward = new THREE.Vector3(0, 0, moveDistance);
    forward.applyQuaternion(character.quaternion);
    this.tempVectors[1].add(forward);
    
    // Check if we can move to this position (with step-up support)
    const moveResult = this.canMoveToPosition(character, this.tempVectors[1], groundObjects, solidObjects);
    if (moveResult.canMove && moveResult.adjustedPosition) {
      character.position.copy(moveResult.adjustedPosition);
      return true;
    }
    
    // If direct movement failed, try sliding along X and Z axes separately (Minecraft-style)
    // Try X-axis movement only
    const xOnlyPosition = character.position.clone();
    xOnlyPosition.x = this.tempVectors[1].x;
    const xMoveResult = this.canMoveToPosition(character, xOnlyPosition, groundObjects, solidObjects);
    
    if (xMoveResult.canMove && xMoveResult.adjustedPosition) {
      character.position.copy(xMoveResult.adjustedPosition);
      return true;
    }
    
    // Try Z-axis movement only
    const zOnlyPosition = character.position.clone();
    zOnlyPosition.z = this.tempVectors[1].z;
    const zMoveResult = this.canMoveToPosition(character, zOnlyPosition, groundObjects, solidObjects);
    
    if (zMoveResult.canMove && zMoveResult.adjustedPosition) {
      character.position.copy(zMoveResult.adjustedPosition);
      return true;
    }
    
    return false;
  }

  updateRotation(character: THREE.Group, gameState: GameState): void {
    if (!character) return;

    if (gameState.rotationDirection !== 0) {
      const rotationAmount = gameState.rotationDirection * CHARACTER_CONFIG.ROTATION_SPEED;
      character.rotation.y += rotationAmount;
      gameState.currentRotation = character.rotation.y;
    }
  }

  getTempVector(index: number): THREE.Vector3 {
    return this.tempVectors[index] || this.tempVectors[0];
  }
}
