// Quick brick visibility test - paste this into browser console

console.log('🔍 Quick Brick Visibility Test');

// Step 1: Check scene
const scene = window.gameManager?.multiplayerSystem?.core?.getScene?.();
if (!scene) {
  console.error('❌ Cannot access scene');
} else {
  console.log('✅ Scene found with', scene.children.length, 'children');
}

// Step 2: Find all bricks
let networkBricks = [];
let localBricks = [];

scene?.traverse((child) => {
  if (child.userData?.isBrick || child.name?.includes('brick')) {
    if (child.userData?.isNetworkBrick || child.name?.includes('network')) {
      networkBricks.push(child);
    } else {
      localBricks.push(child);
    }
  }
});

console.log('📊 Found:', localBricks.length, 'local bricks,', networkBricks.length, 'network bricks');

// Step 3: Check network brick details
networkBricks.forEach((brick, i) => {
  console.log(`🧱 Network Brick ${i}:`, {
    name: brick.name,
    visible: brick.visible,
    position: `${brick.position.x.toFixed(2)}, ${brick.position.y.toFixed(2)}, ${brick.position.z.toFixed(2)}`,
    scale: `${brick.scale.x}, ${brick.scale.y}, ${brick.scale.z}`,
    materialVisible: brick.material?.visible,
    materialOpacity: brick.material?.opacity,
    inScene: scene.children.includes(brick),
    frustumCulled: brick.frustumCulled
  });
});

// Step 4: Force fix network bricks
console.log('🔧 Attempting to force fix network bricks...');
networkBricks.forEach((brick, i) => {
  // Make super visible
  brick.visible = true;
  brick.frustumCulled = false;
  brick.scale.set(1.5, 1.5, 1.5); // Make bigger
  
  if (brick.material) {
    brick.material.visible = true;
    brick.material.needsUpdate = true;
    if (brick.material.color) {
      brick.material.color.setHex(0xFF0000); // Make red
    }
    if (brick.material.emissive) {
      brick.material.emissive.setHex(0x220000); // Add glow
    }
  }
  
  brick.updateMatrixWorld(true);
  console.log(`✅ Fixed network brick ${i}`);
});

console.log('🎯 Test complete! Network bricks should now be RED and BIGGER if visible');
console.log('💡 If you still don\'t see them, the issue might be with camera position or layers');

// Step 5: Camera check
const camera = window.gameManager?.camera;
if (camera) {
  console.log('📷 Camera position:', camera.position);
  console.log('📷 Camera looking at:', {
    x: camera.position.x + Math.sin(camera.rotation.y),
    y: camera.position.y,
    z: camera.position.z + Math.cos(camera.rotation.y)
  });
}
