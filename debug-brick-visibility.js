// Debug script for checking multiplayer brick visibility
// Run this in the browser console after placing bricks to diagnose visibility issues

console.log('🔍 Starting comprehensive brick visibility debug...');

// Function to check all bricks in the scene
function debugAllBricks() {
  console.log('\n🧱 === BRICK VISIBILITY DEBUG ===');
  
  const scene = window.gameManager?.multiplayerSystem?.core?.getScene?.();
  if (!scene) {
    console.error('❌ Could not access scene');
    return;
  }
  
  let localBricks = 0;
  let networkBricks = 0;
  let visibleBricks = 0;
  let invisibleBricks = 0;
  
  console.log('📊 Scene children count:', scene.children.length);
  
  scene.traverse((child) => {
    if (child.userData?.isBrick || child.name?.includes('brick')) {
      const isNetwork = child.userData?.isNetworkBrick || child.name?.includes('network-brick');
      const isVisible = child.visible;
      
      if (isNetwork) {
        networkBricks++;
      } else {
        localBricks++;
      }
      
      if (isVisible) {
        visibleBricks++;
      } else {
        invisibleBricks++;
      }
      
      console.log(`🧱 Brick: ${child.name}`, {
        type: isNetwork ? 'network' : 'local',
        visible: isVisible,
        position: child.position,
        scale: child.scale,
        inScene: scene.children.includes(child),
        material: child.material?.constructor?.name,
        materialVisible: child.material?.visible,
        frustumCulled: child.frustumCulled,
        layers: child.layers?.mask,
        userData: child.userData
      });
      
      // Check material properties in detail
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat, i) => {
            console.log(`  📦 Material[${i}]:`, {
              visible: mat.visible,
              transparent: mat.transparent,
              opacity: mat.opacity,
              color: mat.color?.getHex?.()?.toString(16),
              needsUpdate: mat.needsUpdate
            });
          });
        } else {
          console.log(`  📦 Material:`, {
            visible: child.material.visible,
            transparent: child.material.transparent,
            opacity: child.material.opacity,
            color: child.material.color?.getHex?.()?.toString(16),
            needsUpdate: child.material.needsUpdate
          });
        }
      }
    }
  });
  
  console.log('\n📈 Summary:', {
    totalBricks: localBricks + networkBricks,
    localBricks,
    networkBricks,
    visibleBricks,
    invisibleBricks
  });
  
  // Check camera and renderer
  const camera = window.gameManager?.camera;
  if (camera) {
    console.log('\n📷 Camera info:', {
      position: camera.position,
      rotation: camera.rotation,
      near: camera.near,
      far: camera.far,
      fov: camera.fov,
      matrixAutoUpdate: camera.matrixAutoUpdate
    });
  }
  
  // Check if there are any issues with the brick system
  const brickSystem = window.gameManager?.brickSystem;
  if (brickSystem) {
    console.log('\n🔧 Brick system info:', {
      placedBricksCount: brickSystem.placedBricks?.length || 0,
      occupiedPositionsCount: brickSystem.occupiedPositions?.size || 0,
      currentLayer: brickSystem.currentLayer || 0
    });
  }
}

// Function to force visibility on all network bricks
function forceNetworkBrickVisibility() {
  console.log('\n🔧 Forcing visibility on all network bricks...');
  
  const scene = window.gameManager?.multiplayerSystem?.core?.getScene?.();
  if (!scene) {
    console.error('❌ Could not access scene');
    return;
  }
  
  let fixed = 0;
  
  scene.traverse((child) => {
    if (child.userData?.isNetworkBrick || child.name?.includes('network-brick')) {
      console.log(`🔧 Forcing visibility on: ${child.name}`);
      
      // Force visibility
      child.visible = true;
      child.frustumCulled = false;
      child.matrixAutoUpdate = true;
      
      // Force material visibility
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            mat.visible = true;
            mat.needsUpdate = true;
            if (mat.transparent) {
              mat.opacity = 1.0;
            }
          });
        } else {
          child.material.visible = true;
          child.material.needsUpdate = true;
          if (child.material.transparent) {
            child.material.opacity = 1.0;
          }
        }
      }
      
      // Force matrix updates
      child.updateMatrix();
      child.updateMatrixWorld(true);
      
      // Trigger a small scale change to force render update
      const originalScale = child.scale.clone();
      child.scale.multiplyScalar(1.001);
      child.updateMatrixWorld(true);
      setTimeout(() => {
        child.scale.copy(originalScale);
        child.updateMatrixWorld(true);
      }, 10);
      
      fixed++;
    }
  });
  
  console.log(`✅ Forced visibility on ${fixed} network bricks`);
}

// Function to test brick placement
function testBrickPlacement() {
  console.log('\n🧪 Testing brick placement...');
  
  const brickSystem = window.gameManager?.brickSystem;
  if (!brickSystem) {
    console.error('❌ Brick system not available');
    return;
  }
  
  // Try placing a test brick at a visible location
  const testPos = { x: 0, z: 0, layer: 1 };
  const testColor = 0xFF0000; // Red
  
  console.log('🧱 Placing test remote brick at:', testPos);
  const brick = brickSystem.placeRemoteBrick(testPos, testColor);
  
  if (brick) {
    console.log('✅ Test brick created:', {
      name: brick.name,
      position: brick.position,
      visible: brick.visible,
      inScene: brick.parent !== null
    });
    
    // Force ultra-visibility
    brick.visible = true;
    brick.frustumCulled = false;
    brick.scale.set(2, 2, 2); // Make it bigger so it's easier to see
    
    if (brick.material instanceof THREE.MeshStandardMaterial) {
      brick.material.color.setHex(0xFF0000); // Bright red
      brick.material.emissive.setHex(0x440000); // Slight glow
      brick.material.needsUpdate = true;
    }
    
    console.log('🔥 Test brick should now be VERY visible!');
  } else {
    console.error('❌ Failed to create test brick');
  }
}

// Make functions available globally
window.debugAllBricks = debugAllBricks;
window.forceNetworkBrickVisibility = forceNetworkBrickVisibility;
window.testBrickPlacement = testBrickPlacement;

console.log('\n✅ Debug functions ready! Available commands:');
console.log('📊 debugAllBricks() - Check all bricks in scene');
console.log('🔧 forceNetworkBrickVisibility() - Force visibility on network bricks');
console.log('🧪 testBrickPlacement() - Place a test brick');
console.log('\n🚀 Run debugAllBricks() first to see current state!');
