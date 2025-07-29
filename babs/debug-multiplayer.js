// Debug helper for multiplayer issues
// Run this in the browser console to get detailed multiplayer info

function debugMultiplayer() {
  console.log('=== MULTIPLAYER DEBUG HELPER ===');
  
  // Check if game manager exists
  if (typeof window.gameManager === 'undefined') {
    console.error('❌ GameManager not found on window object');
    return;
  }
  
  const gm = window.gameManager;
  
  // Basic multiplayer info
  console.log('🌐 Multiplayer Status:');
  console.log('  - Connected:', gm.isMultiplayerConnected());
  console.log('  - Remote players:', gm.getRemotePlayerCount());
  
  // Get multiplayer system directly
  const multiplayerSystem = gm.multiplayerSystem;
  if (multiplayerSystem) {
    console.log('🎮 Multiplayer System:');
    console.log('  - Enabled:', multiplayerSystem.isMultiplayerEnabled());
    console.log('  - Remote players map size:', multiplayerSystem.remotePlayers?.size || 0);
    console.log('  - Players being created:', multiplayerSystem.playersBeingCreated?.size || 0);
    console.log('  - Player targets:', multiplayerSystem.playerTargets?.size || 0);
    
    // Debug remote players
    multiplayerSystem.debugRemotePlayers();
  }
  
  // Network manager info
  const networkManager = multiplayerSystem?.networkManager;
  if (networkManager) {
    console.log('🔌 Network Manager:');
    console.log('  - Connected to server:', networkManager.isConnectedToServer());
    console.log('  - Local player ID:', networkManager.getLocalPlayerId());
    console.log('  - Remote players in network:', networkManager.getRemotePlayers().size);
  }
  
  console.log('=== END DEBUG ===');
}

function forceCleanupPlayers() {
  console.log('🧹 Force cleaning up all remote players...');
  if (window.gameManager) {
    window.gameManager.forceCleanupRemotePlayers();
  }
}

function toggleDebugBoxes() {
  console.log('📦 Toggling debug boxes...');
  if (window.gameManager) {
    window.gameManager.toggleRemotePlayerDebug();
  }
}

// Expose functions globally
window.debugMultiplayer = debugMultiplayer;
window.forceCleanupPlayers = forceCleanupPlayers;
window.toggleDebugBoxes = toggleDebugBoxes;

console.log('🔧 Multiplayer debug helper loaded!');
console.log('Available commands:');
console.log('  - debugMultiplayer() - Show detailed multiplayer info');
console.log('  - forceCleanupPlayers() - Force cleanup all remote players');
console.log('  - toggleDebugBoxes() - Toggle debug boxes around players');