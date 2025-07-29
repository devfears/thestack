/**
 * Test script to manually test brick placement and sync
 * Run this in browser console to test brick placement
 */

// Test function to place a brick manually
function testManualBrickPlacement() {
  console.log('🧪 Testing manual brick placement...');
  
  const gameManager = window.gameManager;
  if (!gameManager) {
    console.error('❌ GameManager not found');
    return;
  }
  
  const brickSystem = gameManager.getBrickSystem();
  if (!brickSystem) {
    console.error('❌ BrickSystem not found');
    return;
  }
  
  // Test placing a brick at a specific position
  const testGridPos = { x: 2, z: 2, layer: 0 };
  const testColor = 0xFF0000; // Red
  
  console.log('🧱 Attempting to place brick at:', testGridPos);
  console.log('🎨 Color:', `#${testColor.toString(16).padStart(6, '0')}`);
  
  try {
    // First check if position is available
    const isOccupied = brickSystem.isPositionOccupied(testGridPos);
    console.log('🔍 Position occupied:', isOccupied);
    
    if (isOccupied) {
      console.warn('⚠️ Position already occupied, trying different position');
      testGridPos.x = Math.floor(Math.random() * 10) - 5;
      testGridPos.z = Math.floor(Math.random() * 10) - 5;
      console.log('🔄 New position:', testGridPos);
    }
    
    // Try to place the brick using the brick system's method
    const worldPos = brickSystem.gridToWorld(testGridPos);
    console.log('🌍 World position:', worldPos);
    
    // Create brick data
    const brickData = {
      position: worldPos,
      worldPosition: worldPos,
      color: testColor,
      gridPosition: testGridPos
    };
    
    // Check if multiplayer system is available
    const multiplayerSystem = gameManager.multiplayerSystem;
    if (multiplayerSystem && multiplayerSystem.isMultiplayerEnabled()) {
      console.log('📤 Sending brick to multiplayer system...');
      multiplayerSystem.sendBrickPlaced(brickData);
      console.log('✅ Brick sent to multiplayer system');
    } else {
      console.warn('⚠️ Multiplayer system not available or not enabled');
    }
    
    // Also try to place it locally for testing
    console.log('🏠 Placing brick locally for testing...');
    const localBrick = brickSystem.createOptimizedBrickMesh(worldPos, testColor);
    localBrick.userData.isBrick = true;
    localBrick.userData.gridPosition = testGridPos;
    localBrick.name = `test-brick-${testGridPos.x}-${testGridPos.z}-${testGridPos.layer}`;
    
    const scene = gameManager.multiplayerSystem?.core?.getScene();
    if (scene) {
      scene.add(localBrick);
      console.log('✅ Test brick added to scene');
    }
    
  } catch (error) {
    console.error('❌ Failed to place test brick:', error);
  }
}

// Test function to monitor network events
function monitorNetworkEvents() {
  console.log('🧪 Setting up network event monitoring...');
  
  const gameManager = window.gameManager;
  const networkManager = gameManager?.multiplayerSystem?.networkManager;
  
  if (!networkManager?.socket) {
    console.error('❌ No network socket found');
    return;
  }
  
  const socket = networkManager.socket;
  
  // Monitor outgoing brick-placed events
  const originalEmit = socket.emit;
  socket.emit = function(event, data) {
    if (event === 'brick-placed') {
      console.log('📤 OUTGOING brick-placed event:', data);
    }
    return originalEmit.call(this, event, data);
  };
  
  // Monitor incoming brick-placed events
  socket.on('brick-placed', (data) => {
    console.log('📥 INCOMING brick-placed event:', data);
    console.log('  - From player:', data.playerName);
    console.log('  - Position:', data.gridPosition);
    console.log('  - Color:', `#${(data.color || 0x4169E1).toString(16).padStart(6, '0')}`);
  });
  
  console.log('✅ Network event monitoring set up');
}

// Test function to check server state
async function checkServerBricks() {
  console.log('🧪 Checking server brick state...');
  
  try {
    const response = await fetch('http://localhost:3002/health');
    const data = await response.json();
    console.log('🏥 Server health:', data);
    console.log('🧱 Server bricks:', data.bricks);
  } catch (error) {
    console.error('❌ Failed to check server state:', error);
  }
}

// Auto-run setup
console.log('🔧 Brick placement test script loaded');
console.log('Available functions:');
console.log('  - testManualBrickPlacement() - Place a test brick');
console.log('  - monitorNetworkEvents() - Monitor network traffic');
console.log('  - checkServerBricks() - Check server brick count');

// Auto-run monitoring
monitorNetworkEvents();