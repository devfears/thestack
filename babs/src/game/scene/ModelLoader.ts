import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SceneObjects, UserProfile } from '../core/types';
import { AnimationSystemManager } from '../character/AnimationSystem';
// Building system import removed - now optional

export class ModelLoaderManager {
  private loader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private scene: THREE.Scene;
  private sceneObjects: SceneObjects;
  private animationSystem: AnimationSystemManager;
  private characterTexture: THREE.Texture;
  private platformMaterial: THREE.MeshToonMaterial;
  private labelRenderer: CSS2DRenderer;
  private user: UserProfile | null;
  private nametag: CSS2DObject | null = null;

  constructor(
    scene: THREE.Scene, 
    sceneObjects: SceneObjects, 
    animationSystem: AnimationSystemManager,
    user: UserProfile | null
  ) {
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.scene = scene;
    this.sceneObjects = sceneObjects;
    this.animationSystem = animationSystem;
    this.user = user;
    
    // Detect mobile for texture optimization
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Load the colormap texture with mobile optimizations
    this.characterTexture = this.textureLoader.load('/assets/models/Textures/colormap.png');
    this.characterTexture.flipY = false; // Important for GLB textures
    this.characterTexture.colorSpace = THREE.SRGBColorSpace; // Fix color space
    
    // Mobile texture optimizations
    if (isMobile) {
      this.characterTexture.generateMipmaps = false; // Disable mipmaps for performance
      this.characterTexture.minFilter = THREE.LinearFilter; // Simpler filtering
      this.characterTexture.magFilter = THREE.LinearFilter;
    }
    
    // Create materials with mobile-optimized settings
    this.platformMaterial = new THREE.MeshToonMaterial({ 
      map: this.characterTexture,
      // Mobile optimizations
      ...(isMobile && {
        flatShading: true, // Simpler shading for mobile
        fog: false // Disable fog calculations
      })
    });

    // Initialize CSS2DRenderer for nametags
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(this.labelRenderer.domElement);

    // Handle window resize
    window.addEventListener('resize', () => {
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public renderLabels(): void {
    if (this.sceneObjects.camera) {
      this.updateNametagScale();
      this.labelRenderer.render(this.scene, this.sceneObjects.camera);
    }
  }

  public setNametagVisible(visible: boolean): void {
    if (this.nametag) {
      this.nametag.visible = visible;
    }
  }

  private updateNametagScale(): void {
    if (this.nametag && this.sceneObjects.camera && this.sceneObjects.character) {
      // Calculate distance from camera to character
      const distance = this.sceneObjects.camera.position.distanceTo(this.sceneObjects.character.position);
      
      // Scale factor to keep nametag consistent size (adjust base scale as needed)
      const baseScale = 0.02; // Base scale factor
      const minScale = 0.5; // Minimum scale to prevent nametags from becoming too small
      const maxScale = 2.0; // Maximum scale to prevent nametags from becoming too large
      
      const scale = Math.max(minScale, Math.min(maxScale, distance * baseScale));
      
      // Apply scale to the nametag
      this.nametag.scale.set(scale, scale, scale);
    }
  }

  public async loadCharacter(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        '/assets/models/character-male-f copy.glb',
        (gltf) => {
          const character = gltf.scene;
          character.position.set(0, 0, 0); // Reset to origin, physics system will handle ground positioning
          character.scale.set(1.3, 1.3, 1.3); // Make character bigger
          
          // Setup character materials and disable shadows for brighter scene
          character.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = false;
              mesh.receiveShadow = false;
              
              // Apply colormap texture to character with mobile optimizations
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              const characterMaterial = new THREE.MeshToonMaterial({
                map: this.characterTexture,
                // Mobile optimizations
                ...(isMobile && {
                  flatShading: true, // Simpler shading for mobile
                  fog: false, // Disable fog calculations
                  transparent: false // Disable transparency for performance
                })
              });
              mesh.material = characterMaterial;
            }
            
            // Find right hand bone for brick carrying
            if (child instanceof THREE.Bone) {
              const name = child.name.toLowerCase();
              if (name.includes('hand') || name.includes('wrist') || name.includes('arm')) {
                this.sceneObjects.rightHandBone = child;
      
              }
            }
          });

          // CRITICAL FIX: Create a proper character container
          // Based on Three.js best practices for character controllers
          const characterContainer = new THREE.Group();
          characterContainer.name = 'CharacterContainer';
          characterContainer.position.set(0, 2.0, 0); // Start slightly above ground, physics will adjust
          
          // Reset character model position relative to container
          character.position.set(0, 0, 0);
          
          // Add character to container
          characterContainer.add(character);
          
          // Store the container as the main character object
          this.sceneObjects.character = characterContainer;
          this.scene.add(characterContainer);

          // Create nametag (hidden by default)
          const nametagDiv = document.createElement('div');
          nametagDiv.className = 'nametag';
          if (this.user?.fid === 1023416) {
            nametagDiv.classList.add('developer-nametag');
            nametagDiv.textContent = 'the DEV';
          } else {
            nametagDiv.textContent = this.user?.displayName || 'Player';
          }
          nametagDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          nametagDiv.style.color = '#ffffff';
          nametagDiv.style.padding = '8px 12px';
          nametagDiv.style.borderRadius = '4px';
          nametagDiv.style.fontSize = '10px';
          nametagDiv.style.fontFamily = '"Press Start 2P", cursive';
          nametagDiv.style.border = '2px solid #4a4a4a';
          nametagDiv.style.textShadow = '2px 2px 0px #000';
          nametagDiv.style.letterSpacing = '1px';
          nametagDiv.style.textAlign = 'center';
          nametagDiv.style.whiteSpace = 'nowrap';

          const nametag = new CSS2DObject(nametagDiv);
          nametag.position.set(0, 1.8, 0); // Position above character's head
          nametag.visible = false; // Hidden by default, controlled by game logic
          characterContainer.add(nametag); // Add to container, not character model
          this.nametag = nametag; // Store reference for show/hide control
          
          // CRITICAL FIX: Ensure all mesh children are properly configured
          character.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              // Ensure mesh is visible and properly configured
              mesh.visible = true;
              mesh.frustumCulled = true;
              mesh.matrixAutoUpdate = true;
            }
          });
          
          // Initialize animations with the character model (not the container)
          this.animationSystem.initializeAnimations(character, gltf);
          
          console.log('✅ Character container created successfully with model and nametag');
          
      
          resolve();
        },
        undefined,
        (error) => {
          console.error('Failed to load character:', error);
          reject(error);
        }
      );
    });
  }

  public async loadBrickPile(): Promise<void> {
    return new Promise((resolve) => {
      // Create a procedural brick pile using the same geometry as placed bricks
      const brickPile = this.createProceduralBrickPile();
      
      // Position the brick pile at the same location as the original
      brickPile.position.set(-15, 1.8, 10);
      
      // Add the brick pile to the scene
      this.scene.add(brickPile);
      this.sceneObjects.brickPile = brickPile;
      
      // Create a simplified collision mesh for the entire pile
      const collisionMesh = this.createSimplifiedCollisionMesh(brickPile);
      if (collisionMesh) {
        this.scene.add(collisionMesh);
        this.sceneObjects.solidObjects.push(collisionMesh);
        this.sceneObjects.groundObjects.push(collisionMesh);
      }
      
      resolve();
    });
  }

  private createProceduralBrickPile(): THREE.Group {
    const brickPile = new THREE.Group();
    brickPile.name = 'ProceduralBrickPile';

    const cellSize = 0.4;
    const brickHeight = 0.55;
    const geometry = new THREE.BoxGeometry(cellSize, brickHeight, cellSize);
    const brickColors = [
      0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0xf0932b, 0xeb4d4b, 0x6c5ce7,
      0xa55eea, 0x26de81, 0xfd79a8, 0x778ca3, 0xf8b500, 0x00d2d3, 0xff7675,
      0x74b9ff, 0x55a3ff, 0xfdcb6e, 0xe17055, 0x81ecec, 0xfab1a0, 0x00b894
    ];

    const layers = 5;
    const baseSize = 4;
    let brickIndex = 0;

    for (let y = 0; y < layers; y++) {
      const layerSize = baseSize - y;
      for (let x = 0; x < layerSize; x++) {
        for (let z = 0; z < layerSize; z++) {
          const color = brickColors[brickIndex % brickColors.length];
          const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.8,
            metalness: 0.1
          });
          const brick = new THREE.Mesh(geometry, material);
          brick.castShadow = false;
          brick.receiveShadow = false;

          const posX = (x - layerSize / 2) * cellSize;
          const posY = y * brickHeight;
          const posZ = (z - layerSize / 2) * cellSize;

          brick.position.set(posX, posY, posZ);
          brick.rotation.y = Math.random() * Math.PI * 2;
          brickPile.add(brick);
          brickIndex++;
        }
      }
    }

    return brickPile;
  }



  public async loadMasterBrick(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        '/assets/models/brick2x.glb',
        (gltf) => {
          const brickModel = gltf.scene;
          brickModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = false;
              child.receiveShadow = false;
            }
          });
          
          // Position the master brick away from the brick pile and make it invisible
          brickModel.position.set(-100, -100, -100); // Move far away from gameplay area
          brickModel.visible = false; // Make it invisible since it's just a template
          this.sceneObjects.masterBrick = brickModel;
          this.scene.add(brickModel);
          
          // Create ghost brick for building preview
          if (brickModel.children[0] && (brickModel.children[0] as THREE.Mesh).isMesh) {
            const ghostBrick = new THREE.Mesh(
              (brickModel.children[0] as THREE.Mesh).geometry,
              new THREE.MeshToonMaterial({ 
                color: 0x00ff00, 
                opacity: 0.5, 
                transparent: true 
              })
            );
            
            // Scale ghost brick to match placed brick size exactly (same as placed blocks)
            // Use updated cellSize and proportions
            const cellSize = 0.4;
            const brickHeight = cellSize * 0.6; // Consistent with GridSystem and BrickManager
            ghostBrick.scale.set(cellSize, brickHeight, cellSize);
            
            ghostBrick.visible = false;
            this.scene.add(ghostBrick);
            this.sceneObjects.ghostBrick = ghostBrick;
          }
          
      
          resolve();
        },
        undefined,
        reject
      );
    });
  }

  public async loadPlatform(gridSize: number, cellSize: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🏗️ Creating custom building platform...');
        
        // Create a custom platform that's perfectly aligned with our grid system
        // Make it wider to accommodate the full grid and prevent floating bricks
        const platformSize = gridSize * cellSize;
        const platformWidth = platformSize;
        const platformDepth = platformSize;
        const platformHeight = 0.5; // Keep original height

        // Create simple gray material instead of the textured one
        const grayMaterial = new THREE.MeshToonMaterial({
          color: 0x666666, // Medium gray
          side: THREE.DoubleSide,
          transparent: false,
          opacity: 1.0
        });

        // Create platform geometry
        const platformGeometry = new THREE.BoxGeometry(platformWidth, platformHeight, platformDepth);
        const platform = new THREE.Mesh(platformGeometry, grayMaterial);
        
        // Position the platform where the original was (more centered on the grass)
        // Based on the original GLB position: (3, 1, 15.0) but adjusted for our new system
        platform.position.set(3, 2, 15);
        
        // Disable shadows for brighter scene
        platform.castShadow = false;
        platform.receiveShadow = false;
        
        // Create a group to match the GLB structure
        const platformGroup = new THREE.Group();
        platformGroup.add(platform);
        platformGroup.name = 'custom-building-platform';
        
        // Add to scene and tracking
        this.scene.add(platformGroup);
        this.sceneObjects.groundObjects.push(platformGroup);
        this.sceneObjects.buildingPlatform = platformGroup;
        
        console.log('✅ Custom building platform created');
        console.log('📍 Platform position:', platformGroup.position);
        console.log('📏 Platform dimensions:', { width: platformWidth, height: platformHeight, depth: platformDepth });
        console.log('🔝 Platform top Y:', platform.position.y + platformHeight / 2);
        
        resolve();
      } catch (error) {
        console.error('❌ Failed to create custom platform:', error);
        reject(error);
      }
    });
  }

  public async loadIsland(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        '/assets/models/island.glb',
        (gltf) => {
          const island = gltf.scene;
          island.scale.set(1, 1, 1);
          island.position.set(0, 0, 0);

          island.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = false;
              child.receiveShadow = false;
              
              // Handle different parts of the island
              const name = child.name.toLowerCase();
              
              // Add all walkable surfaces to ground objects
              if (name.includes('grass') || name.includes('sand') || name.includes('dock') || 
                  name.includes('ground') || name.includes('terrain') || name.includes('floor') ||
                  name.includes('platform') || name.includes('path') || name.includes('beach') ||
                  name.includes('land') || name.includes('surface')) {
                this.sceneObjects.groundObjects.push(child);
        
              }
              
              // Add solid collision objects with enhanced collision meshes
              if (name.includes('tree') || name.includes('rock') || name.includes('stone') ||
                  name.includes('boulder') || name.includes('wall') || name.includes('fence')) {
                
                // Create simplified collision mesh for complex objects
                const collisionMesh = this.createSimplifiedCollisionMesh(child);
                if (collisionMesh) {
                  this.scene.add(collisionMesh);
                  this.sceneObjects.solidObjects.push(collisionMesh);
                } else {
                  // Fallback to original mesh if collision creation fails
                  this.sceneObjects.solidObjects.push(child);
                }
        
              }
              
              // If no specific category, add as ground by default (most island parts should be walkable)
              if (!name.includes('tree') && !name.includes('rock') && !name.includes('stone') &&
                  !name.includes('boulder') && !name.includes('wall') && !name.includes('fence') &&
                  !name.includes('water') && !name.includes('sky')) {
                this.sceneObjects.groundObjects.push(child);
        
              }
              
              // Apply proper color space to textures
              if (child.material instanceof THREE.Material) {
                const material = child.material as THREE.MeshStandardMaterial;
                if (material.map) {
                  material.map.colorSpace = THREE.SRGBColorSpace;
                }
              }
            }
          });

          this.scene.add(island);
      
          resolve();
        },
        undefined,
        reject
      );
    });
  }

  public async loadAllModels(): Promise<void> {
    try {
  
      
      // Load models individually to better identify which one fails
      const modelLoaders = [
        { name: 'Character', loader: () => this.loadCharacter() },
        { name: 'Brick Pile', loader: () => this.loadBrickPile() },
        { name: 'Master Brick', loader: () => this.loadMasterBrick() },
  
        { name: 'Island', loader: () => this.loadIsland() }
      ];
      
      for (const { name, loader } of modelLoaders) {
        try {
          await loader();
        } catch (error) {
          console.error(`❌ Failed to load ${name}:`, error);
          // Continue loading other models
        }
      }
      
  
    } catch (error) {
      console.error('Failed to load models:', error);
      throw error;
    }
  }



  // Create simplified collision mesh for complex objects like trees
  private createSimplifiedCollisionMesh(originalMesh: THREE.Object3D): THREE.Mesh | null {
    try {
      // Calculate bounding box of the original mesh
      const boundingBox = new THREE.Box3().setFromObject(originalMesh);
      const size = boundingBox.getSize(new THREE.Vector3());
      const center = boundingBox.getCenter(new THREE.Vector3());
      
      // Create a simplified collision shape based on object type
      const name = originalMesh.name.toLowerCase();
      let collisionGeometry: THREE.BufferGeometry;
      
      if (name.includes('proceduralbrickpile')) {
        collisionGeometry = new THREE.BoxGeometry(size.x * 0.9, size.y, size.z * 0.9);
      } else if (name.includes('tree')) {
        const radius = Math.max(size.x, size.z) * 0.8;
        const height = size.y * 0.8;
        collisionGeometry = new THREE.CylinderGeometry(radius, radius, height, 8);
        center.y -= size.y * 0.2;
      } else if (name.includes('rock') || name.includes('stone') || name.includes('boulder')) {
        const radius = Math.max(size.x, size.y, size.z) * 1.0;
        collisionGeometry = new THREE.SphereGeometry(radius, 8, 6);
      } else {
        collisionGeometry = new THREE.BoxGeometry(
          size.x * 1.5,
          size.y * 1.5,
          size.z * 1.5
        );
      }
      
      // Create invisible collision material
      const collisionMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        visible: false // Completely invisible
      });
      
      // Create collision mesh
      const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
      collisionMesh.position.copy(center);
      collisionMesh.userData.isCollisionMesh = true;
      collisionMesh.userData.originalObject = originalMesh;
      collisionMesh.userData.isInvisibleWall = true; // Mark as invisible wall for stricter collision
      collisionMesh.name = `collision_${originalMesh.name}`;
      
      return collisionMesh;
    } catch (error) {
      console.warn('Failed to create simplified collision mesh:', error);
      return null;
    }
  }
}
