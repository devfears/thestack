import * as THREE from 'three';
import { GameManager } from '../core/GameManager';
import { GameState, SceneObjects } from '../core/types';

export class SimpleInteractionSystem {
  private camera: THREE.Camera; // Used for raycasting
  private renderer: THREE.WebGLRenderer; // Used for event binding
  private sceneObjects: SceneObjects; // Used for object access
  private gameState: GameState; // Used for state checks
  private gameManager: GameManager; // Used for method calls
  private raycaster: THREE.Raycaster; // Used for future raycasting
  private mouse: THREE.Vector2; // Used for future raycasting

  constructor(
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    sceneObjects: SceneObjects,
    gameState: GameState,
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
    this.renderer.domElement.addEventListener('click', this.handleClick.bind(this));
    this.renderer.domElement.addEventListener('touchend', this.handleTouch.bind(this));
  }

  private handleClick(event: MouseEvent): void {
    event.preventDefault();
    this.handleInteraction();
  }

  private handleTouch(event: TouchEvent): void {
    event.preventDefault();
    this.handleInteraction();
  }

  private handleInteraction(): void {
    const character = this.sceneObjects.character;
    const brickPile = this.sceneObjects.brickPile;
    
    if (!character) {
      
      return;
    }

    // Check if we're carrying a brick
    if (this.gameState.isCarryingBrick) {
      // Try to place brick
      
      const success = this.gameManager.placeBrick();
      if (success) {
        
      } else {
        
        // Show helpful message to user
        
      }
    } else {
      // Try to pick up brick (only if near brick pile)
      if (!brickPile) {
        
        return;
      }

      const distance = character.position.distanceTo(brickPile.position);
      
      if (distance > 3) {
        
        return;
      }

      this.gameManager.pickupBrick();
      // Note: pickupBrick returns void, success is logged internally
    }
  }

  public dispose(): void {
    this.renderer.domElement.removeEventListener('click', this.handleClick.bind(this));
    this.renderer.domElement.removeEventListener('touchend', this.handleTouch.bind(this));
  }
}
