/**
 * Test script to check server state and debug multiplayer issues
 * Run this in browser console to test server communication
 */

async function testServerState() {
  console.log('🧪 Testing server state...');
  
  try {
    // Check server health
    const healthResponse = await fetch('http://localhost:3002/health');
    const healthData = await healthResponse.json();
    console.log('🏥 Server health:', healthData);
    
    // Force sync to get current players
    const syncResponse = await fetch('http://localhost:3002/debug/force-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const syncData = await syncResponse.json();
    console.log('🔄 Server sync result:', syncData);
    
    // Check local multiplayer state
    const gameManager = window.gameManager;
    if (gameManager && gameManager.multiplayerSystem) {
      console.log('🎮 Local multiplayer state:');
      console.log('  - Connection state:', gameManager.multiplayerSystem.getConnectionState());
      console.log('  - Multiplayer enabled:', gameManager.multiplayerSystem.isMultiplayerEnabled());
      console.log('  - Remote player count:', gameManager.multiplayerSystem.getRemotePlayerCount());
      
      const networkManager = gameManager.multiplayerSystem.networkManager;
      if (networkManager) {
        console.log('  - Network connected:', networkManager.isConnectedToServer());
        console.log('  - Local player ID:', networkManager.getLocalPlayerId());
        console.log('  - Remote players in NetworkManager:', networkManager.getRemotePlayers().size);
      }
      
      // Check PlayerStateManager
      const playerStateManager = gameManager.multiplayerSystem.core?.getPlayerStateManager();
      if (playerStateManager) {
        const activePlayers = playerStateManager.getActivePlayers();
        console.log('  - Active players in PlayerStateManager:', activePlayers.length);
        activePlayers.forEach(player => {
          console.log(`    - ${player.displayName} (${player.id})`);
        });
      }
      
      // Check scene for player objects
      const scene = gameManager.multiplayerSystem.core?.getScene();
      if (scene) {
        let scenePlayerCount = 0;
        scene.traverse((child) => {
          if (child.name && child.name.startsWith('player-')) {
            scenePlayerCount++;
            console.log(`    - Scene player: ${child.name}`);
          }
        });
        console.log('  - Player objects in scene:', scenePlayerCount);
      }
    }
    
  } catch (error) {
    console.error('❌ Server test failed:', error);
  }
}

// Test network events
function testNetworkEvents() {
  console.log('🧪 Setting up network event monitoring...');
  
  const gameManager = window.gameManager;
  if (!gameManager?.multiplayerSystem?.networkManager?.socket) {
    console.error('❌ No socket connection found');
    return;
  }
  
  const socket = gameManager.multiplayerSystem.networkManager.socket;
  
  // Monitor current-players events
  socket.on('current-players', (players) => {
    console.log('📡 Received current-players event:', players.length, 'players');
    players.forEach(p => {
      console.log(`  - ${p.displayName} (${p.id}) at [${p.position?.x?.toFixed(1)}, ${p.position?.y?.toFixed(1)}, ${p.position?.z?.toFixed(1)}]`);
    });
  });
  
  // Monitor player-update events
  socket.on('player-update', (player) => {
    console.log('📡 Received player-update event:', player.displayName, `(${player.id})`);
  });
  
  console.log('✅ Network event monitoring set up');
}

// Auto-run tests
console.log('🔧 Server state test script loaded');
console.log('Available functions:');
console.log('  - testServerState() - Check server and client state');
console.log('  - testNetworkEvents() - Monitor network events');

// Auto-run
testServerState();
testNetworkEvents();