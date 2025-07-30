/**
 * Final Brick Synchronization Test Script
 * 
 * This script helps test and debug brick synchronization in multiplayer mode.
 * 
 * Instructions:
 * 1. Open two browser tabs/windows pointing to your game (localhost:5173)
 * 2. Wait for both to connect to multiplayer (you should see "Online (2 players)" or similar)
 * 3. In one tab, open the browser console (F12) and paste this entire script
 * 4. Run the commands below to test brick synchronization
 */

console.log('🧱 Brick Synchronization Test Helper Loaded!');
console.log('📋 Available Commands:');
console.log('  - testBrickSync() - Full brick synchronization test');
console.log('  - placeBrick() - Manually place a test brick');
console.log('  - checkBricks() - Count bricks in scene');
console.log('  - clearBricks() - Clear all bricks');
console.log('  - monitorBricks() - Monitor brick events for 30 seconds');

// Global test state
let isMonitoring = false;
let monitoringInterval = null;

// Test function to check if multiplayer is properly connected
function checkMultiplayerConnection() {
  const gameManager = window.gameManager;
  if (!gameManager) {
    console.error('❌ GameManager not found');
    return false;
  }

  const multiplayerSystem = gameManager.multiplayerSystem;
  if (!multiplayerSystem) {
    console.error('❌ MultiplayerSystem not found');
    return false;
  }

  const isEnabled = multiplayerSystem.isMultiplayerEnabled();
  const isConnected = multiplayerSystem.networkManager?.isConnectedToServer();
  const remotePlayerCount = multiplayerSystem.getRemotePlayerCount();

  console.log('🔍 Multiplayer Status:');
  console.log(`  - Enabled: ${isEnabled}`);
  console.log(`  - Connected: ${isConnected}`);
  console.log(`  - Remote Players: ${remotePlayerCount}`);

  if (!isEnabled || !isConnected) {
    console.error('❌ Multiplayer is not properly connected');
    return false;
  }

  if (remotePlayerCount === 0) {
    console.warn('⚠️ No remote players detected. Make sure you have multiple tabs open.');
  }

  return true;
}

// Function to manually place a test brick
function placeBrick() {
  console.log('🧱 Attempting to place test brick...');
  
  if (!checkMultiplayerConnection()) {
    return;
  }

  const gameManager = window.gameManager;
  const brickSystem = gameManager.getBrickSystem();
  
  if (!brickSystem) {
    console.error('❌ BrickSystem not found');
    return;
  }

  // Pick up a brick first if not carrying one
  if (!gameManager.gameState?.isCarryingBrick) {
    console.log('📦 Picking up a brick first...');
    const pickupSuccess = brickSystem.pickupBrick();
    console.log(`📦 Pickup ${pickupSuccess ? 'successful' : 'failed'}`);
    
    if (!pickupSuccess) {
      console.error('❌ Could not pick up brick');
      return;
    }
  }

  // Try to place the brick
  setTimeout(() => {
    console.log('🔨 Placing brick...');
    const placeSuccess = brickSystem.placeBrick();
    console.log(`🔨 Placement ${placeSuccess ? 'successful' : 'failed'}`);
    
    if (placeSuccess) {
      console.log('✅ Brick placed successfully! Check other tabs to see if it synced.');
    }
  }, 500);
}

// Function to check brick count in scene
function checkBricks() {
  console.log('📊 Checking bricks in scene...');
  
  const gameManager = window.gameManager;
  if (!gameManager) {
    console.error('❌ GameManager not found');
    return;
  }

  let localBricks = 0;
  let networkBricks = 0;
  let totalBricks = 0;

  // Check scene for brick objects
  const scene = gameManager.multiplayerSystem?.core?.getScene();
  if (scene) {
    scene.traverse((child) => {
      if (child.userData && child.userData.isBrick) {
        totalBricks++;
        if (child.userData.isNetworkBrick) {
          networkBricks++;
          console.log(`🌐 Network brick: ${child.name} at [${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)}]`);
        } else {
          localBricks++;
          console.log(`🏠 Local brick: ${child.name} at [${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)}]`);
        }
      }
    });
  }

  console.log('📊 Brick Summary:');
  console.log(`  - Total: ${totalBricks}`);
  console.log(`  - Local: ${localBricks}`);
  console.log(`  - Network: ${networkBricks}`);

  // Also check brick system state
  const brickSystem = gameManager.getBrickSystem();
  if (brickSystem) {
    console.log(`  - BrickSystem count: ${brickSystem.getPlacedBricksCount()}`);
  }

  return { total: totalBricks, local: localBricks, network: networkBricks };
}

// Function to clear all bricks
function clearBricks() {
  console.log('🧹 Clearing all bricks...');
  
  const gameManager = window.gameManager;
  if (!gameManager) {
    console.error('❌ GameManager not found');
    return;
  }

  const multiplayerSystem = gameManager.multiplayerSystem;
  if (multiplayerSystem) {
    multiplayerSystem.sendClearAllBricks();
    console.log('📤 Clear bricks command sent to server');
  }

  const brickSystem = gameManager.getBrickSystem();
  if (brickSystem) {
    brickSystem.clearAllBricks();
    console.log('🏠 Local bricks cleared');
  }

  setTimeout(() => {
    checkBricks();
  }, 1000);
}

// Function to monitor brick events
function monitorBricks() {
  if (isMonitoring) {
    console.log('⏹️ Stopping brick monitoring...');
    isMonitoring = false;
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    return;
  }

  console.log('👁️ Starting brick monitoring for 30 seconds...');
  console.log('   (Place bricks in any tab to see events)');
  
  isMonitoring = true;
  const startTime = Date.now();
  let eventCount = 0;

  const gameManager = window.gameManager;
  const networkManager = gameManager?.multiplayerSystem?.networkManager;
  
  if (!networkManager?.socket) {
    console.error('❌ No socket connection found');
    return;
  }

  const socket = networkManager.socket;

  // Monitor outgoing brick placement events
  const originalEmit = socket.emit;
  socket.emit = function(event, data) {
    if (event === 'brick-placed') {
      eventCount++;
      console.log(`📤 [${eventCount}] OUTGOING brick-placed:`, {
        gridPosition: data.gridPosition,
        color: `#${data.color?.toString(16).padStart(6, '0')}`,
        timestamp: new Date(data.timestamp).toLocaleTimeString()
      });
    }
    return originalEmit.call(this, event, data);
  };

  // Monitor incoming brick placement events
  const brickPlacedHandler = (data) => {
    eventCount++;
    console.log(`📥 [${eventCount}] INCOMING brick-placed:`, {
      from: data.playerName,
      gridPosition: data.gridPosition,
      color: `#${data.color?.toString(16).padStart(6, '0')}`,
      timestamp: new Date(data.timestamp).toLocaleTimeString()
    });
  };

  socket.on('brick-placed', brickPlacedHandler);

  // Stop monitoring after 30 seconds
  setTimeout(() => {
    isMonitoring = false;
    socket.emit = originalEmit; // Restore original emit
    socket.off('brick-placed', brickPlacedHandler);
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`⏹️ Monitoring stopped after ${duration.toFixed(1)}s`);
    console.log(`📊 Total events captured: ${eventCount}`);
    
    checkBricks();
  }, 30000);
}

// Comprehensive brick synchronization test
function testBrickSync() {
  console.log('🚀 Starting comprehensive brick synchronization test...');
  
  // Step 1: Check multiplayer connection
  console.log('\n1️⃣ Checking multiplayer connection...');
  if (!checkMultiplayerConnection()) {
    console.error('❌ Test aborted: Multiplayer not properly connected');
    return;
  }

  // Step 2: Check initial brick state
  console.log('\n2️⃣ Checking initial brick state...');
  const initialBricks = checkBricks();

  // Step 3: Start monitoring
  console.log('\n3️⃣ Starting event monitoring...');
  monitorBricks();

  // Step 4: Place a test brick
  console.log('\n4️⃣ Placing test brick in 2 seconds...');
  setTimeout(() => {
    placeBrick();
  }, 2000);

  // Step 5: Check final state
  console.log('\n5️⃣ Will check final state in 10 seconds...');
  setTimeout(() => {
    console.log('\n📊 Final brick count:');
    const finalBricks = checkBricks();
    
    const change = finalBricks.total - initialBricks.total;
    if (change > 0) {
      console.log(`✅ Success! ${change} new brick(s) detected.`);
      console.log('🔍 Check other browser tabs to verify synchronization.');
    } else {
      console.log('❌ No new bricks detected. Check console for errors.');
    }
    
    console.log('\n🏁 Test completed!');
  }, 10000);
}

// Expose functions globally
window.testBrickSync = testBrickSync;
window.placeBrick = placeBrick;
window.checkBricks = checkBricks;
window.clearBricks = clearBricks;
window.monitorBricks = monitorBricks;

console.log('\n✅ Test helper ready! Run testBrickSync() to start the full test.');
