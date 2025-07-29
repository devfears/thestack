/**
 * Test script for debugging multiplayer brick synchronization
 * 
 * Instructions:
 * 1. Open two browser tabs/windows to localhost:5173
 * 2. Make sure both are connected to multiplayer (you should see player count > 1)
 * 3. Run this script in the browser console of one tab
 * 4. Check the other tab to see if the brick appears
 */

console.log('🧪 Starting Multiplayer Brick Sync Test...');

// Test 1: Check multiplayer connection status
function testMultiplayerConnection() {
  console.log('\n=== Test 1: Multiplayer Connection ===');
  
  if (typeof debugMultiplayerState === 'function') {
    debugMultiplayerState();
  } else {
    console.log('❌ debugMultiplayerState function not available');
  }
}

// Test 2: Place a test brick and monitor sync
function testBrickPlacement() {
  console.log('\n=== Test 2: Brick Placement Test ===');
  
  // First, pick up a brick if not carrying one
  if (typeof giveBrick === 'function') {
    console.log('🎯 Picking up a brick...');
    const pickupResult = giveBrick();
    console.log('📊 Pickup result:', pickupResult);
    
    if (pickupResult) {
      // Wait a moment, then try to place it
      setTimeout(() => {
        console.log('🧱 Attempting to place brick...');
        if (typeof testMultiplayerBrick === 'function') {
          testMultiplayerBrick();
        } else {
          console.log('❌ testMultiplayerBrick function not available');
        }
      }, 1000);
    }
  } else {
    console.log('❌ giveBrick function not available');
  }
}

// Test 3: Force resync to check server state
function testForceResync() {
  console.log('\n=== Test 3: Force Resync Test ===');
  
  if (typeof forceResyncBricks === 'function') {
    console.log('🔄 Forcing brick resync from server...');
    forceResyncBricks();
  } else {
    console.log('❌ forceResyncBricks function not available');
  }
}

// Test 4: Check scene for bricks
function testSceneBricks() {
  console.log('\n=== Test 4: Scene Brick Analysis ===');
  
  // Count bricks in scene
  let localBricks = 0;
  let networkBricks = 0;
  let totalBricks = 0;
  
  if (window.game && window.game.scene) {
    window.game.scene.traverse((child) => {
      if (child.userData && child.userData.isBrick) {
        totalBricks++;
        if (child.userData.isNetworkBrick) {
          networkBricks++;
          console.log('🌐 Network brick found:', {
            name: child.name,
            position: child.position,
            visible: child.visible,
            gridPosition: child.userData.gridPosition
          });
        } else {
          localBricks++;
          console.log('🏠 Local brick found:', {
            name: child.name,
            position: child.position,
            visible: child.visible,
            gridPosition: child.userData.gridPosition
          });
        }
      }
    });
  }
  
  console.log('📊 Brick count summary:', {
    total: totalBricks,
    local: localBricks,
    network: networkBricks
  });
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running all multiplayer brick sync tests...\n');
  
  testMultiplayerConnection();
  
  setTimeout(() => {
    testSceneBricks();
  }, 500);
  
  setTimeout(() => {
    testBrickPlacement();
  }, 1000);
  
  setTimeout(() => {
    testForceResync();
  }, 3000);
  
  setTimeout(() => {
    console.log('\n=== Final Scene Check ===');
    testSceneBricks();
    console.log('\n✅ All tests completed!');
    console.log('📝 Check the other browser tab to see if bricks synced properly.');
  }, 5000);
}

// Expose functions globally for manual testing
window.testMultiplayerConnection = testMultiplayerConnection;
window.testBrickPlacement = testBrickPlacement;
window.testForceResync = testForceResync;
window.testSceneBricks = testSceneBricks;
window.runAllTests = runAllTests;

console.log('🎮 Test functions available:');
console.log('  - testMultiplayerConnection() - Check connection status');
console.log('  - testBrickPlacement() - Test placing a brick');
console.log('  - testForceResync() - Force resync from server');
console.log('  - testSceneBricks() - Analyze bricks in scene');
console.log('  - runAllTests() - Run all tests automatically');
console.log('\n🏃 Running all tests automatically in 2 seconds...');

// Auto-run tests after a short delay
setTimeout(runAllTests, 2000);