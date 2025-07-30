/**
 * Quick Brick Sync Test
 * 
 * Simple test to verify brick synchronization is working.
 * Run this in one browser tab's console after opening multiple tabs.
 */

console.log('🧪 Quick Brick Sync Test');

// Wait for multiplayer to be ready
setTimeout(() => {
  const gameManager = window.gameManager;
  const multiplayerSystem = gameManager?.multiplayerSystem;
  const brickSystem = gameManager?.getBrickSystem();

  if (!multiplayerSystem || !brickSystem) {
    console.error('❌ Game systems not found');
    return;
  }

  console.log('📊 Initial Status:');
  console.log(`  - Multiplayer enabled: ${multiplayerSystem.isMultiplayerEnabled()}`);
  console.log(`  - Connected: ${multiplayerSystem.networkManager?.isConnectedToServer()}`);
  console.log(`  - Remote players: ${multiplayerSystem.getRemotePlayerCount()}`);

  if (!multiplayerSystem.isMultiplayerEnabled()) {
    console.error('❌ Multiplayer not enabled');
    return;
  }

  // Pick up a brick and place it
  console.log('🧱 Picking up brick...');
  const pickupResult = brickSystem.pickupBrick();
  console.log(`  - Pickup result: ${pickupResult}`);

  if (pickupResult) {
    setTimeout(() => {
      console.log('🔨 Placing brick...');
      const placeResult = brickSystem.placeBrick();
      console.log(`  - Place result: ${placeResult}`);
      
      if (placeResult) {
        console.log('✅ Brick placed! Check other tabs to see if it appeared.');
        console.log('🔍 If the brick doesn\'t appear in other tabs, check the console for errors.');
      }
    }, 1000);
  }
}, 3000);

console.log('⏳ Test will start in 3 seconds. Make sure you have multiple tabs open!');
