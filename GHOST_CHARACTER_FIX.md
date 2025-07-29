# Ghost Character Duplication Fix

## Problem Description

Users were experiencing character duplication where a "ghost" character would appear that:
- Doesn't move or follow the player
- Has no nametag or name display
- Appears as a static, invisible duplicate
- Shows up in the multiplayer player count but doesn't respond to updates

## Root Causes Identified

1. **Race Conditions in Player Creation**: Multiple rapid calls to `createRemotePlayer` could create duplicates before the first creation completed.

2. **Insufficient Scene Cleanup**: When players reconnected or refreshed, old player objects could remain in the scene without being properly tracked.

3. **Weak Duplicate Detection**: The original duplicate prevention only checked the tracking maps, not the actual scene objects.

4. **Orphaned Objects**: Player objects could exist in the scene without being in the tracking system, leading to inconsistent state.

5. **T-pose Flash Contributing to Perception**: Characters appearing in T-pose before animations loaded could make users think there were multiple characters.

## Fixes Applied

### 1. Enhanced Duplicate Prevention in `createRemotePlayer`

```typescript
// CRITICAL FIX: More comprehensive duplicate prevention
const alreadyExists = this.remotePlayers.has(player.id);
const beingCreated = this.playersBeingCreated.has(player.id);
const existingPlayerInScene = this.core.getScene().getObjectByName(`player-${player.id}`);

if (alreadyExists || beingCreated || existingPlayerInScene) {
  // Block creation and handle orphaned objects
  return;
}

// CRITICAL: Scan entire scene for any objects that might be duplicates
const allPlayerObjects: THREE.Object3D[] = [];
this.core.getScene().traverse((child) => {
  if (child.name && (
    child.name.startsWith('player-') || 
    child.name.includes(player.id) ||
    (child.userData && child.userData.playerId === player.id)
  )) {
    allPlayerObjects.push(child);
  }
});
```

### 2. Emergency Cleanup System

Added `performEmergencyCleanup` method to thoroughly clean up orphaned player objects:

```typescript
private performEmergencyCleanup(playerId: string, existingObject: THREE.Object3D): void {
  // Remove from scene immediately
  this.core.getScene().remove(existingObject);
  
  // Dispose of all materials and geometries
  existingObject.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        // Dispose materials properly
      }
    }
  });
  
  // Clean up all associated data
  this.remotePlayers.delete(playerId);
  this.playerTargets.delete(playerId);
  this.remotePlayerAnimations.delete(playerId);
  // ... etc
}
```

### 3. Improved Scene Consistency Checking

Enhanced `handleCurrentPlayersInternal` to:
- Scan for orphaned objects before processing
- Perform consistency checks between scene and tracking
- Handle orphaned objects by removing and recreating properly

### 4. Increased Debouncing

Increased debounce time from 200ms to 500ms to prevent rapid duplicate creation attempts.

### 5. Better Update Validation

Enhanced `updateRemotePlayer` to verify player exists before updating:

```typescript
const playerGroup = this.remotePlayers.get(player.id);
const target = this.playerTargets.get(player.id);

if (!playerGroup || !target) {
  // Don't create players here - let handleCurrentPlayers handle it
  return;
}
```

### 6. Animation Loading Fix

Fixed T-pose flash by ensuring animations are ready before making characters visible:

```typescript
// CRITICAL FIX: Initialize animations BEFORE adding to scene
const animationsReady = await this.initializeRemotePlayerAnimations(player.id, character, gltf);

if (animationsReady) {
  // Force an immediate animation update
  const animationData = this.remotePlayerAnimations.get(player.id);
  if (animationData && animationData.mixer) {
    animationData.mixer.update(0.016); // One frame at 60fps
  }
  
  character.visible = true;
}
```

## Testing

Created comprehensive test script `test-ghost-character-fix.js` that:

1. **Current State Check**: Scans for ghost characters and duplicates
2. **Consistency Check**: Verifies scene and tracking alignment
3. **Simulation Test**: Attempts to create duplicates (should be blocked)
4. **Real-time Monitoring**: Watches for ghost character creation
5. **Cleanup Function**: Removes any detected ghost characters

## Usage

1. Load the game and connect to multiplayer
2. Run the test script in browser console:
   ```javascript
   // Test the fix
   testGhostCharacterFix();
   
   // Start monitoring
   startGhostCharacterMonitor();
   
   // Clean up any existing ghosts
   cleanupGhostCharacters();
   ```

## Expected Results

After applying these fixes:
- ✅ No duplicate characters should appear
- ✅ All remote players should have proper nametags
- ✅ Player count should match actual visible players
- ✅ No T-pose flashing on character load
- ✅ Proper cleanup when players disconnect/reconnect
- ✅ Scene and tracking consistency maintained

## Monitoring

The fix includes real-time monitoring that will:
- Alert when ghost characters are detected
- Track player count changes
- Verify scene/tracking consistency
- Provide cleanup functions if issues occur

This comprehensive fix addresses all identified root causes of the ghost character duplication issue.