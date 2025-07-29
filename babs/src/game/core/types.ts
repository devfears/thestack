import * as THREE from 'three';

export interface GameState {
  isJumping: boolean;
  jumpVelocity: number;
  targetRotation: number;
  rotationDirection: number; // -1 for right, 1 for left, 0 for none
  currentRotation: number;
  isCarryingBrick: boolean;
  isBuildMode: boolean;
  cameraFollowEnabled: boolean;
  keysPressed: { [key: string]: boolean };
  lastAnimationState: string;
  animationStateChanged: boolean;
  joystickData: any;
}

export interface CharacterAnimations {
  idle: THREE.AnimationAction | null;
  walk: THREE.AnimationAction | null;
  run: THREE.AnimationAction | null;
  jump: THREE.AnimationAction | null;
  'pick-up': THREE.AnimationAction | null;
  current: THREE.AnimationAction | null;
}

export interface UserProfile {
  fid: number;
  displayName: string;
  username: string;
  pfpUrl?: string;
}

export interface SceneObjects {
  character: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  carriedBrick: THREE.Group | null;
  masterBrick: THREE.Group | null;
  brickPile: THREE.Group | null;
  ghostBrick: THREE.Mesh | null;
  rightHandBone: THREE.Bone | null;
  water: THREE.Mesh | null;
  solidObjects: THREE.Object3D[];
  groundObjects: THREE.Object3D[];
  buildingPlatform: THREE.Object3D | null;
  placedBricks: THREE.Object3D[];
  camera: THREE.PerspectiveCamera | null;
}

export interface CameraSystem {
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  offset: THREE.Vector3;
}

export interface PhysicsSystem {
  raycaster: THREE.Raycaster;
  groundRaycaster: THREE.Raycaster;
  tempVectors: THREE.Vector3[];
}

export interface WaterSystem {
  mesh: THREE.Mesh;
  initialPositions: THREE.BufferAttribute;
  lastUpdate: number;
}

export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'pickup';

export interface BuildingSystem {
  placeBrick: () => boolean;
  pickupBrick: () => boolean;
  dropBrick: () => void;
  toggleBuildMode: () => void;
  getIsCarryingBrick: () => boolean;
  getCurrentBrickColor: () => number;
  clearAllBricks: () => void;
}
