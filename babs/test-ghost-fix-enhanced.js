/**
 * Enhanced Ghost Character Detection and Debugging Script
 * Run this in the browser console to debug ghost character issues
 * 
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter to run
 * 4. Use the provided commands to debug
 */

(function() {
  'use strict';
  
  console.log('🔍 Enhanced Ghost Character Debugger loaded!');
  console.log('Available commands:');
  console.log('  ghostMonitor() - Start monitoring for ghost characters');
  console.log('  ghostScan() - Immediate scan for ghost characters');
  console.log('  playerStates() - Show all player states with timestamps');
  console.log('  forceCleanup() - Force complete cleanup of all remote players');
  console.log('  debugSync() - Force a sync with server');
  console.log('  stopMonitor() - Stop the monitoring');
  
  let monitorInterval = null;
  let lastPlayerCount = 0;
  
  // Get access to multiplayer systems
  function getMultiplayerSystem() {
    if (window.gameManager && window.gameManager.multiplayerSystem) {
      return window.gameManager.multiplayerSystem;
    }
    return null;
  }
  
  function getRemotePlayerManager() {
    const mp = getMultiplayerSystem();
    if (mp && mp.multiplayerSystem && mp.multiplayerSystem.remotePlayerManager) {
      return mp.multiplayerSystem.remotePlayerManager;
    }
    return null;
  }
  
  // Enhanced ghost detection
  window.ghostScan = function() {
    const rpm = getRemotePlayerManager();
    if (!rpm) {
      console.error('❌ RemotePlayerManager not found');
      return;
    }
    
    console.log('🔍 Running enhanced ghost scan...');
    
    const scene = rpm.core.getScene();
    const allSceneObjects = [];
    const now = Date.now();
    
    // Scan scene for all player objects
    scene.traverse((child) => {
      if (child.name && child.name.startsWith('player-')) {
        allSceneObjects.push({
          object: child,
          playerId: child.name.replace('player-', ''),
          type: 'scene-object'
        });
      }
    });
    
    // Get tracked players
    const trackedPlayers = Array.from(rpm.remotePlayers.keys());
    const playerTargets = Array.from(rpm.playerTargets.keys());
    const playersBeingCreated = Array.from(rpm.playersBeingCreated);
    
    console.log('📊 Current State:');
    console.log('  Scene objects:', allSceneObjects.map(o => o.playerId));
    console.log('  Tracked players:', trackedPlayers);
    console.log('  Player targets:', playerTargets);
    console.log('  Being created:', playersBeingCreated);
    
    // Identify ghosts
    const ghosts = [];
    
    allSceneObjects.forEach(obj => {
      const isTracked = trackedPlayers.includes(obj.playerId);
      const hasTarget = playerTargets.includes(obj.playerId);
      const isBeingCreated = playersBeingCreated.includes(obj.playerId);
      
      if (!isTracked || !hasTarget) {
        ghosts.push({
          playerId: obj.playerId,
          reason: !isTracked ? 'not tracked' : !hasTarget ? 'no target' : 'unknown',
          object: obj.object
        });
      }
    });
    
    if (ghosts.length > 0) {
      console.log('👻 Ghost characters found:', ghosts);
      
      // Clean up ghosts
      ghosts.forEach(ghost => {
        console.log(`🧹 Removing ghost: ${ghost.playerId} (${ghost.reason})`);
        
        // Dispose geometry and materials
        ghost.object.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        
        scene.remove(ghost.object);
        rpm.remotePlayers.delete(ghost.playerId);
        rpm.playerTargets.delete(ghost.playerId);
      });
      
      console.log('✅ Ghost cleanup completed');
    } else {
      console.log('✅ No ghost characters found');
    }
    
    return ghosts;
  };
  
  // Monitor player states with timestamps
  window.playerStates = function() {
    const rpm = getRemotePlayerManager();
    if (!rpm) {
      console.error('❌ RemotePlayerManager not found');
      return;
    }
    
    const now = Date.now();
    console.log('📈 Player States Analysis:');
    console.log('Current time:', now);
    
    // Show tracked players
    console.log('\n🎯 Tracked Players:');
    rpm.remotePlayers.forEach((group, playerId) => {
      const target = rpm.playerTargets.get(playerId);
      const timeSinceUpdate = target ? now - target.lastUpdate : 'N/A';
      
      console.log(`  ${playerId}:`);
      console.log(`    Position: ${group.position.x.toFixed(2)}, ${group.position.y.toFixed(2)}, ${group.position.z.toFixed(2)}`);
      console.log(`    Target: ${target ? target.position.x.toFixed(2) + ', ' + target.position.y.toFixed(2) + ', ' + target.position.z.toFixed(2) : 'N/A'}`);
      console.log(`    Last update: ${timeSinceUpdate}ms ago`);
      console.log(`    Stale: ${timeSinceUpdate > 3000 ? 'YES' : 'NO'}`);
    });
    
    // Show player targets
    console.log('\n🎯 Player Targets:');
    rpm.playerTargets.forEach((target, playerId) => {
      const timeSinceUpdate = now - target.lastUpdate;
      console.log(`  ${playerId}: ${timeSinceUpdate}ms ago (${timeSinceUpdate > 3000 ? 'STALE' : 'OK'})`);
    });
    
    // Show being created
    console.log('\n🔄 Players being created:', Array.from(rpm.playersBeingCreated));
    
    return {
      tracked: Array.from(rpm.remotePlayers.keys()),
      targets: Array.from(rpm.playerTargets.keys()),
      creating: Array.from(rpm.playersBeingCreated)
    };
  };
  
  // Start monitoring
  window.ghostMonitor = function() {
    if (monitorInterval) {
      console.log('⚠️ Monitor already running, stopping first...');
      window.stopMonitor();
    }
    
    console.log('🔍 Starting ghost character monitoring...');
    console.log('Monitoring every 500ms. Use stopMonitor() to stop.');
    
    let checkCount = 0;
    monitorInterval = setInterval(() => {
      checkCount++;
      const rpm = getRemotePlayerSystem();
      if (!rpm) return;
      
      const scene = rpm.core.getScene();
      const scenePlayers = [];
      
      scene.traverse((child) => {
        if (child.name && child.name.startsWith('player-')) {
          scenePlayers.push(child.name.replace('player-', ''));
        }
      });
      
      const trackedPlayers = Array.from(rpm.remotePlayers.keys());
      const totalPlayers = scenePlayers.length;
      
      if (totalPlayers !== lastPlayerCount) {
        console.log(`🔄 Player count changed: ${lastPlayerCount} → ${totalPlayers}`);
        console.log(`  Scene: ${scenePlayers.join(', ') || 'none'}`);
        console.log(`  Tracked: ${trackedPlayers.join(', ') || 'none'}`);
        
        if (totalPlayers > lastPlayerCount) {
          // New players detected
          const newPlayers = scenePlayers.filter(id => !trackedPlayers.includes(id));
          if (newPlayers.length > 0) {
            console.log(`⚠️ Ghost players detected: ${newPlayers.join(', ')}`);
            window.ghostScan(); // Auto-clean ghosts
          }
        }
        
        lastPlayerCount = totalPlayers;
      }
      
      if (checkCount % 10 === 0) { // Every 5 seconds
        window.playerStates();
      }
      
    }, 500);
    
    console.log('✅ Ghost monitoring started');
  };
  
  // Stop monitoring
  window.stopMonitor = function() {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
      console.log('⏹️ Ghost monitoring stopped');
    }
  };
  
  // Force complete cleanup
  window.forceCleanup = function() {
    const rpm = getRemotePlayerManager();
    if (!rpm) {
      console.error('❌ RemotePlayerManager not found');
      return;
    }
    
    console.log('🧹 Force cleanup initiated...');
    
    // Clean up all remote players
    const allPlayerIds = Array.from(rpm.remotePlayers.keys());
    allPlayerIds.forEach(playerId => {
      rpm.removeRemotePlayer(playerId);
    });
    
    // Clear all tracking
    rpm.remotePlayers.clear();
    rpm.playerTargets.clear();
    rpm.playersBeingCreated.clear();
    rpm.remotePlayerAnimations.clear();
    rpm.playerMaterials.clear();
    rpm.playerCreationTimeouts.clear();
    
    console.log('✅ Force cleanup completed');
  };
  
  // Force sync with server
  window.debugSync = function() {
    const mp = getMultiplayerSystem();
    if (!mp) {
      console.error('❌ MultiplayerSystem not found');
      return;
    }
    
    console.log('🔄 Forcing sync with server...');
    
    // Force a debug dump
    if (mp.multiplayerSystem && mp.multiplayerSystem.debugRemotePlayersInfo) {
      mp.multiplayerSystem.debugRemotePlayersInfo();
    }
    
    console.log('✅ Sync requested');
  };
  
  // Auto-start monitoring
  setTimeout(() => {
    console.log('🚀 Auto-starting ghost monitoring in 3 seconds...');
    setTimeout(() => {
      window.ghostMonitor();
    }, 3000);
  }, 1000);
  
  console.log('🔧 Enhanced debugger ready!');
  
})();