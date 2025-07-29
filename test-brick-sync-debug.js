// Test script to debug brick syncing issues
console.log('🧪 Starting brick sync debug test...');

// Wait for game to be ready
setTimeout(() => {
  console.log('🎮 Game should be loaded, starting brick sync test...');
  
  // Check if multiplayer system exists
  const gameManager = window.gameManager;
  if (!gameManager) {
    console.error('❌ Game manager not found');
    return;
  }
  
  const multiplayerSystem = gameManager.multiplayerSystem;
  if (!multiplayerSystem) {
    console.error('❌ Multiplayer system not found');
    return;
  }
  
  console.log('🔍 Multiplayer system status:');
  console.log('  - Enabled:', multiplayerSystem.isMultiplayerEnabled());
  console.log('  - Connected:', multiplayerSystem.networkManager?.isConnectedToServer());
  console.log('  - Local player ID:', multiplayerSystem.networkManager?.getLocalPlayerId());
  console.log('  - Remote player count:', multiplayerSystem.getRemotePlayerCount());
  
  // Check brick system
  const brickSystem = gameManager.getBrickSystem();
  if (!brickSystem) {
    console.error('❌ Brick system not found');
    return;
  }
  
  console.log('🧱 Brick system status:');
  console.log('  - Exists:', !!brickSystem);
  console.log('  - Can place brick method exists:', typeof brickSystem.placeBrick === 'function');
  console.log('  - Place remote brick method exists:', typeof brickSystem.placeRemoteBrick === 'function');
  
  // Test brick placement if carrying a brick
  if (gameManager.gameState?.isCarryingBrick) {
    console.log('🧱 Player is carrying a brick, attempting to place...');
    const success = brickSystem.placeBrick();
    console.log('🧱 Brick placement result:', success);
  } else {
    console.log('🧱 Player is not carrying a brick, picking up one first...');
    const pickupSuccess = brickSystem.pickupBrick();
    console.log('🧱 Brick pickup result:', pickupSuccess);
    
    if (pickupSuccess) {
      setTimeout(() => {
        console.log('🧱 Now attempting to place the brick...');
        const placeSuccess = brickSystem.placeBrick();
        console.log('🧱 Brick placement result:', placeSuccess);
      }, 1000);
    }
  }
  
  // Monitor network events
  const networkManager = multiplayerSystem.networkManager;
  if (networkManager && networkManager.socket) {
    console.log('🔍 Setting up network event monitoring...');
    
    // Monitor outgoing brick placement
    const originalEmit = networkManager.socket.emit;
    networkManager.socket.emit = function(event, data) {
      if (event === 'brick-placed') {
        console.log('📤 OUTGOING brick-placed event:', data);
      }
      return originalEmit.call(this, event, data);
    };
    
    // Monitor incoming brick placement
    networkManager.socket.on('brick-placed', (data) => {
      console.log('📥 INCOMING brick-placed event:', data);
    });
  }
  
}, 3000);

// Also monitor the scene for brick objects
setInterval(() => {
  const gameManager = window.gameManager;
  if (!gameManager) return;
  
  const scene = gameManager.scene;
  if (!scene) return;
  
  let totalBricks = 0;
  let networkBricks = 0;
  let localBricks = 0;
  
  scene.traverse((child) => {
    if (child.userData?.isBrick) {
      totalBricks++;
      if (child.userData?.isNetworkBrick) {
        networkBricks++;
      } else {
        localBricks++;
      }
    }
  });
  
  if (totalBricks > 0) {
    console.log(`🧱 Scene brick count: ${totalBricks} total (${localBricks} local, ${networkBricks} network)`);
  }
}, 5000);