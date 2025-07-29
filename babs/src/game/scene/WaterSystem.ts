import * as THREE from 'three';
import { WATER_CONFIG, ANIMATION_CONFIG } from '../core/constants';

export class WaterSystemManager {
  public waterMesh!: THREE.Mesh;
  private initialPositions!: THREE.BufferAttribute;
  private lastUpdate: number = 0;
  private clock: THREE.Clock;

  constructor(scene: THREE.Scene) {
    this.clock = new THREE.Clock();
    this.createWater(scene);
  }

  private createWater(scene: THREE.Scene): void {
    // Create water geometry
    const waterGeometry = new THREE.PlaneGeometry(
      WATER_CONFIG.SIZE, 
      WATER_CONFIG.SIZE, 
      WATER_CONFIG.SEGMENTS, 
      WATER_CONFIG.SEGMENTS
    );

    // Create water material
    const waterMaterial = new THREE.MeshToonMaterial({
      color: WATER_CONFIG.COLOR,
      transparent: true,
      opacity: WATER_CONFIG.OPACITY
    });

    // Create water mesh
    this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = WATER_CONFIG.POSITION_Y;
    this.waterMesh.receiveShadow = true;

    // Store initial positions for wave animation
    this.initialPositions = this.waterMesh.geometry.attributes.position.clone();

    scene.add(this.waterMesh);

  }

  public update(): void {
    const time = this.clock.getElapsedTime();
    
    // Throttle updates for performance
    if (time - this.lastUpdate < ANIMATION_CONFIG.WATER_UPDATE_INTERVAL) {
      return;
    }
    
    this.lastUpdate = time;
    
    // Animate water waves
    this.animateWaves(time);
  }

  private animateWaves(time: number): void {
    const positionAttribute = this.waterMesh.geometry.attributes.position;
    
    // Pre-compute time factors for performance
    const timeFactor1 = time * WATER_CONFIG.TIME_FACTOR_1;
    const timeFactor2 = time * WATER_CONFIG.TIME_FACTOR_2;
    
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = this.initialPositions.getX(i);
      const y = this.initialPositions.getY(i);
      
      // Calculate wave displacement
      const wave1 = WATER_CONFIG.WAVE_AMPLITUDE * Math.sin(
        x * WATER_CONFIG.WAVE_FREQUENCY_X + timeFactor1
      );
      const wave2 = WATER_CONFIG.WAVE_AMPLITUDE * Math.sin(
        y * WATER_CONFIG.WAVE_FREQUENCY_Y + timeFactor2
      );
      
      // Apply wave displacement to Z coordinate
      positionAttribute.setZ(i, wave1 + wave2);
    }
    
    positionAttribute.needsUpdate = true;
  }

  public getMesh(): THREE.Mesh {
    return this.waterMesh;
  }

  public dispose(): void {
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      if (this.waterMesh.material instanceof THREE.Material) {
        this.waterMesh.material.dispose();
      }
    }
  }
}
