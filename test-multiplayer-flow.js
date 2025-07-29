/**
 * Test script to debug multiplayer flow
 * Run this in browser console to test the multiplayer connection flow
 */

// Test function to manually trigger server sync
async function testServerSync() {
  console.log('🧪 Testing server sync...');
  
  try {
    const response = await fetch('http://localhost:3002/debug/force-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('📤 Server sync result:', result);
    
    // Wait a moment and check if we received the players
    setTimeout(() => {
      const gameManager = window.gameManager;
      if (gameManager && gameManager.multiplayerSystem) {
        const remoteCount = gameManager.multiplayerSystem.getRemotePlayerCount();
        console.log(`👥 Remote players after sync: ${remoteCount}`);
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Server sync failed:', error);
  }
}

// Test function to check network events
function testNetworkEvents() {
  console.log('🧪 Testing network events...');
  
  const gameManager = window.gameManager;
  if (!gameManager || !gameManager.multiplayerSystem) {
    console.error('❌ GameManager or MultiplayerSystem not found');
    return;
  }
  
  const networkManager = gameManager.multiplayerSystem.networkManager;
  if (!networkManager || !networkManager.socket) {
    console.error('❌ NetworkManager or socket not found');
    return;
  }
  
  // Listen for current-players events
  const originalOnCurrentPlayers = networkManager.onCurrentPlayersCallback;
  networkManager.onCurrentPlayersCallback = (players) => {
    console.log('🎯 INTERCEPTED current-players event:', players.length, 'players');
    players.forEach(p => {
      console.log(`  - ${p.displayName} (${p.id})`);
    });
    
    // Call original callback
    if (originalOnCurrentPlayers) {
      originalOnCurrentPlayers(players);
    }
  };
  
  // Listen for raw socket events
  networkManager.socket.on('current-players', (players) => {
    console.log('🔌 RAW current-players socket event:', players.length, 'players');
    players.forEach(p => {
      console.log(`  - ${p.displayName} (${p.id})`);
    });
  });
  
  console.log('✅ Network event listeners set up');
}

// Test function to manually create a player
function testManualPlayerCreation() {
  console.log('🧪 Testing manual player creation...');
  
  const gameManager = window.gameManager;
  if (!gameManager || !gameManager.multiplayerSystem) {
    console.error('❌ GameManager or MultiplayerSystem not found');
    return;
  }
  
  // Create a fake player
  const fakePlayer = {
    id: 'test-player-123',
    displayName: 'Test Player',
    username: 'testuser',
    position: new THREE.Vector3(2, 0, 2),
    rotation: new THREE.Euler(0, 0, 0),
    isCarryingBrick: false,
    lastUpdate: Date.now()
  };
  
  const playerStateManager = gameManager.multiplayerSystem.core.getPlayerStateManager();
  console.log('📞 Calling playerStateManager.handlePlayersList with fake player');
  playerStateManager.handlePlayersList([fakePlayer], 'manual-test');
  
  setTimeout(() => {
    const remoteCount = gameManager.multiplayerSystem.getRemotePlayerCount();
    console.log(`👥 Remote players after manual creation: ${remoteCount}`);
  }, 1000);
}

// Auto-run tests
console.log('🔧 Multiplayer flow test script loaded');
console.log('Available functions:');
console.log('  - testServerSync() - Force sync with server');
console.log('  - testNetworkEvents() - Set up event listeners');
console.log('  - testManualPlayerCreation() - Create fake player');

// Auto-run network event testing
testNetworkEvents();