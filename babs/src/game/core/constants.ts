import * as THREE from 'three';

// Mobile detection utility
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 2);
};

// Performance tier detection
export const getPerformanceTier = (): 'low' | 'medium' | 'high' => {
  if (typeof window === 'undefined') return 'medium';
  
  const mobile = isMobile();
  const memory = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  
  if (mobile && memory <= 2) return 'low';
  if (mobile && memory <= 4) return 'medium';
  if (!mobile && cores >= 8 && memory >= 8) return 'high';
  
  return 'medium';
};

// Scene configuration
export const SCENE_CONFIG = {
  BACKGROUND_COLOR: 0x87ceeb,
  FOG_COLOR: 0x87ceeb,
  FOG_NEAR: 1,
  FOG_FAR: 150,
} as const;

// Camera constants
export const CAMERA_CONFIG = {
  FOV: 75,
  NEAR: 0.1,
  FAR: 1000,
  INITIAL_POSITION: new THREE.Vector3(0, 5, -8), // Start closer to character
  OFFSET: new THREE.Vector3(0, 4, -6), // Behind and above character
} as const;

// Character constants
export const CHARACTER_CONFIG = {
  SPEED: 0.1,
  RUN_SPEED: 0.2,
  JUMP_FORCE: 0.18,
  GRAVITY: -0.012,
  ROTATION_SPEED: 0.02,
  JOYSTICK_ROTATION_SPEED: 0.0001,
  GROUND_LEVEL: -0.0, // Lower the character to touch the ground properly
} as const;

// Animation constants
export const ANIMATION_CONFIG = {
  FADE_DURATION: 0.2,
  WATER_UPDATE_INTERVAL: 1/30, // 30fps
} as const;

// Platform constants
export const PLATFORM_CONFIG = {
  BOUNDS: {
    MIN_X: -8,
    MAX_X: 8,
    MIN_Z: -8,
    MAX_Z: 8,
  },
  SCALE: 4,
} as const;

// Lighting constants
export const LIGHTING_CONFIG = {
  AMBIENT: {
    COLOR: 0x808080, // Brighter ambient color
    INTENSITY: 3.5, // Much brighter ambient light
  },
  SUN: {
    COLOR: 0xffffff,
    INTENSITY: 1.5, // Reduced sun intensity to balance with bright ambient
    POSITION: new THREE.Vector3(50, 50, 50),
    SHADOW_MAP_SIZE: 1024, // Reduced shadow quality for less prominent shadows
    SHADOW_CAMERA_SIZE: 50,
  },
} as const;

// Water constants
export const WATER_CONFIG = {
  SIZE: 250,
  SEGMENTS: 20,
  COLOR: 0x55aaff,
  OPACITY: 0.8,
  POSITION_Y: 0.2,
  WAVE_AMPLITUDE: 0.15,
  WAVE_FREQUENCY_X: 0.5,
  WAVE_FREQUENCY_Y: 0.5,
  TIME_FACTOR_1: 0.5,
  TIME_FACTOR_2: 0.4,
} as const;

// Key mappings
export const KEY_MAPPINGS = {
  MOVE_FORWARD: 'arrowup',
  MOVE_BACKWARD: 'arrowdown',
  TURN_LEFT: 'arrowleft',
  TURN_RIGHT: 'arrowright',
  RUN: 'shiftleft',
  JUMP: 'space',
  INTERACT: 'keye',
  BUILD: 'keyb',
} as const;

// Alternative WASD key mappings
export const WASD_MAPPINGS = {
  MOVE_FORWARD: 'keyw',
  MOVE_BACKWARD: 'keys',
  TURN_LEFT: 'keya',
  TURN_RIGHT: 'keyd',
} as const;
