import * as THREE from 'three';
import { GameManager } from '../core/GameManager';

export class InteractionSystem {
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private sceneObjects: any;
  private gameState: any;
  private gameManager: GameManager;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor(
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    sceneObjects: any,
    gameState: any,
    gameManager: GameManager
  ) {
    this.camera = camera;
    this.renderer = renderer;
    this.sceneObjects = sceneObjects;
    this.gameState = gameState;
    this.gameManager = gameManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.bindEventListeners();
  }

  private bindEventListeners(): void {
    // Handle both mouse clicks and touch events for mobile
    this.renderer.domElement.addEventListener('click', this.handleClick.bind(this));
    this.renderer.domElement.addEventListener('touchend', this.handleTouch.bind(this));
  }

  private handleClick(event: MouseEvent): void {
    event.preventDefault();
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.performRaycast();
  }

  private handleTouch(event: TouchEvent): void {
    event.preventDefault();
    
    // Use the first touch point
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      this.performRaycast();
    }
  }

  private performRaycast(): void {
    // Update the raycaster with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Create an array of objects to test for intersection
    const interactableObjects: THREE.Object3D[] = [];
    
    // Add brick pile if it exists
    if (this.sceneObjects.brickPile) {
      interactableObjects.push(this.sceneObjects.brickPile);
    }
    
    // Add building platform if it exists
    if (this.sceneObjects.buildingPlatform) {
      interactableObjects.push(this.sceneObjects.buildingPlatform);
    }

    // Perform raycast
    const intersects = this.raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      this.handleObjectInteraction(intersectedObject);
    }
  }

  private handleObjectInteraction(object: THREE.Object3D): void {
    // Check if the clicked object is part of the brick pile
    if (this.isPartOfBrickPile(object)) {
      
      this.handleBrickPileInteraction();
    }
    // Check if the clicked object is part of the building platform
    else if (this.isPartOfBuildingPlatform(object)) {
      
      this.handleBuildingPlatformInteraction();
    }
  }

  private isPartOfBrickPile(object: THREE.Object3D): boolean {
    if (!this.sceneObjects.brickPile) return false;
    
    // Check if the object is the brick pile itself or a child of it
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current === this.sceneObjects.brickPile) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private isPartOfBuildingPlatform(object: THREE.Object3D): boolean {
    if (!this.sceneObjects.buildingPlatform) return false;
    
    // Check if the object is the building platform itself or a child of it
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current === this.sceneObjects.buildingPlatform) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private handleBrickPileInteraction(): void {
    // Check if character is close enough to brick pile
    const character = this.sceneObjects.character;
    const brickPile = this.sceneObjects.brickPile;
    
    if (!character || !brickPile) {
      
      return;
    }
    
    const distance = character.position.distanceTo(brickPile.position);
    
    if (distance > 3) { // Must be within 3 units (same as keyboard interaction)
      
      this.gameManager.getUIManager().showToast('Get closer to the brick pile to pick up a brick.', 2000);
      return;
    }
    
    // Only allow pickup if not already carrying a brick
    if (!this.gameState.isCarryingBrick) {
      const success = this.gameManager.getBrickSystem().pickupBrick();
      if (success) {
        
      } else {
        
      }
    } else {
      
    }
  }

  private handleBuildingPlatformInteraction(): void {
    // Only allow placement if carrying a brick
    if (this.gameState.isCarryingBrick) {
      const success = this.gameManager.getBrickSystem().placeBrick();
      if (success) {
  
      } else {
  
      }
    } else {

    }
  }

  public dispose(): void {
    // Remove event listeners
    this.renderer.domElement.removeEventListener('click', this.handleClick.bind(this));
    this.renderer.domElement.removeEventListener('touchend', this.handleTouch.bind(this));
  }
}
