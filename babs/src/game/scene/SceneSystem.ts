import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { SCENE_CONFIG, CAMERA_CONFIG, LIGHTING_CONFIG } from '../core/constants';
import { CameraSystem } from '../core/types';

export class SceneSystemManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public cameraSystem: CameraSystem;
  private isMobile: boolean = false;
  private frameCount: number = 0;
  private lastFPSCheck: number = 0;
  // private targetFPS: number = 60;

  constructor(mountElement: HTMLDivElement) {
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_CONFIG.BACKGROUND_COLOR);
    this.scene.fog = new THREE.Fog(
      SCENE_CONFIG.FOG_COLOR, 
      SCENE_CONFIG.FOG_NEAR, 
      SCENE_CONFIG.FOG_FAR
    );

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.FOV,
      window.innerWidth / window.innerHeight,
      CAMERA_CONFIG.NEAR,
      CAMERA_CONFIG.FAR
    );
    this.camera.position.copy(CAMERA_CONFIG.INITIAL_POSITION);
    this.camera.lookAt(0, 0, 0);

    // Initialize camera system
    this.cameraSystem = {
      camera: this.camera,
      target: new THREE.Vector3(),
      offset: CAMERA_CONFIG.OFFSET.clone(),
    };

    // Detect if it's a mobile device
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Get device capabilities
     const devicePixelRatio = window.devicePixelRatio;
 

     // Initialize renderer with aggressive mobile optimizations
     this.renderer = new THREE.WebGLRenderer({
       antialias: !this.isMobile, // Disable antialiasing on mobile
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false, // Better performance
      stencil: false, // Disable stencil buffer for better performance
      depth: true
    });

    // Aggressive mobile optimizations based on research
     if (this.isMobile) {
      // Clamp pixel ratio aggressively for mobile - research shows devicePixelRatio can be 3-4 on modern phones
      const mobilePixelRatio = Math.min(devicePixelRatio, 1.5); // Very conservative for performance
      this.renderer.setPixelRatio(mobilePixelRatio);
      
      // Disable expensive features
      this.renderer.shadowMap.enabled = false;
      this.renderer.localClippingEnabled = false;
      
      // Mobile-specific optimizations
      this.renderer.info.autoReset = false; // Manual reset for better performance monitoring
      

    } else {
      // Desktop settings - still conservative
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = false; // Disable shadows for brighter scene
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Fix color space issues and enhance saturation
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 2.2; // Increased exposure for brighter, more saturated scene
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Enhance color saturation through CSS filter on the canvas
    this.renderer.domElement.style.filter = 'saturate(1.4) contrast(1.1)';

    // Initialize controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Set camera limits to prevent clipping under the map
    this.controls.minDistance = 2; // Minimum zoom distance
    this.controls.maxDistance = 50; // Maximum zoom distance
    this.controls.minPolarAngle = 0; // Allow looking straight up
    this.controls.maxPolarAngle = Math.PI * 0.45; // Prevent camera from going below 45 degrees (prevents going under map)
    this.controls.enablePan = true; // Allow panning
    this.controls.panSpeed = 0.8; // Pan speed

    // Setup lighting
    this.setupLighting();

    // Add renderer to DOM
    mountElement.appendChild(this.renderer.domElement);

    // Setup resize handler
    this.setupResizeHandler();
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(
      LIGHTING_CONFIG.AMBIENT.COLOR,
      LIGHTING_CONFIG.AMBIENT.INTENSITY
    );
    this.scene.add(ambientLight);

    // Directional light (sun) with mobile optimization
    const sunLight = new THREE.DirectionalLight(
      LIGHTING_CONFIG.SUN.COLOR,
      LIGHTING_CONFIG.SUN.INTENSITY
    );
    sunLight.position.copy(LIGHTING_CONFIG.SUN.POSITION);
    
    // Configure shadows (disabled for brighter scene)
    sunLight.castShadow = false; // Disabled for maximum brightness
    sunLight.shadow.mapSize.width = LIGHTING_CONFIG.SUN.SHADOW_MAP_SIZE;
    sunLight.shadow.mapSize.height = LIGHTING_CONFIG.SUN.SHADOW_MAP_SIZE;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -LIGHTING_CONFIG.SUN.SHADOW_CAMERA_SIZE;
    sunLight.shadow.camera.right = LIGHTING_CONFIG.SUN.SHADOW_CAMERA_SIZE;
    sunLight.shadow.camera.top = LIGHTING_CONFIG.SUN.SHADOW_CAMERA_SIZE;
    sunLight.shadow.camera.bottom = -LIGHTING_CONFIG.SUN.SHADOW_CAMERA_SIZE;
    
    this.scene.add(sunLight);
  }

  private setupResizeHandler(): void {
    const handleResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
  }

  public updateCamera(character: THREE.Group | null, cameraFollowEnabled: boolean): void {
    if (!character || !cameraFollowEnabled) {
      this.controls.enabled = true;
      this.controls.update();
      return;
    }

    // Disable orbit controls when following character
    this.controls.enabled = false;

    // Third-person camera following
    const characterPosition = character.position;
    
    
    // Calculate desired camera position based on character rotation
    const characterRotation = character.rotation.y;
    const offset = this.cameraSystem.offset.clone();
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
    
    const desiredCameraPosition = new THREE.Vector3()
      .copy(characterPosition)
      .add(offset);
    
    
    
    // Smooth camera movement (more responsive)
    this.camera.position.lerp(desiredCameraPosition, 0.15);
    
    
    
    // Look at character
    this.cameraSystem.target.copy(characterPosition);
    this.cameraSystem.target.y += 1.8; // Look at character center
    this.camera.lookAt(this.cameraSystem.target);
  }

  public render(): void {
    // Performance monitoring for mobile
    if (this.isMobile) {
      this.frameCount++;
      const now = performance.now();
      
      if (now - this.lastFPSCheck >= 1000) { // Check every second
        const fps = this.frameCount;
        this.frameCount = 0;
        this.lastFPSCheck = now;
        
        // Log performance for debugging
        if (fps < 30) {
          console.warn(`Low FPS detected: ${fps}fps. Consider further optimizations.`);
        }
        
        // Reset renderer info for next measurement
        this.renderer.info.reset();
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.controls.dispose();
    this.renderer.dispose();
    
    // Remove resize listener
    window.removeEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
