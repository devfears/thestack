/**
 * Diagnostic script for ghost character issue
 * Run this in browser console to identify the root cause
 */

console.log('🔍 Diagnosing Ghost Character Issue...');

function diagnoseGhostCharacter() {
    console.log('\n=== Ghost Character Diagnosis ===');
    
    if (!window.game || !window.game.multiplayerSystem) {
        console.log('❌ Game or multiplayer system not available');
        return;
    }

    const multiplayerSystem = window.game.multiplayerSystem;
    const scene = window.game.scene;
    
    // Test 1: Check remote player tracking
    console.log('\n📊 Remote Player Tracking:');
    console.log('  - Remote players tracked:', multiplayerSystem.getRemotePlayerCount());
    
    if (multiplayerSystem.remotePlayerManager) {
        const manager = multiplayerSystem.remotePlayerManager;
        console.log('  - Remote players map size:', manager.remotePlayers.size);
        console.log('  - Players being created:', manager.playersBeingCreated.size);
        console.log('  - Player IDs:', Array.from(manager.remotePlayers.keys()));
    }

    // Test 2: Scene inspection for player objects
    console.log('\n🔍 Scene Player Objects:');
    const playerObjects = [];
    const playerNames = new Map();
    const playerPositions = new Map();
    
    scene.traverse((child) => {
        if (child.name && child.name.startsWith('player-')) {
            const playerId = child.name.replace('player-', '');
            const posKey = `${child.position.x.toFixed(2)},${child.position.y.toFixed(2)},${child.position.z.toFixed(2)}`;
            
            // Check for nametags
            let hasNametag = false;
            let nametagText = '';
            child.children.forEach(subChild => {
                if (subChild.element && subChild.element.textContent) {
                    hasNametag = true;
                    nametagText = subChild.element.textContent;
                }
            });

            // Check for T-pose
            let isInTPose = false;
            let hasAnimations = false;
            child.traverse((subChild) => {
                if (subChild.isSkinnedMesh) {
                    const bones = subChild.skeleton?.bones;
                    if (bones && bones.length > 0) {
                        // Check if bones are in default positions (T-pose indicator)
                        const armBones = bones.filter(bone => 
                            bone.name.toLowerCase().includes('arm') || 
                            bone.name.toLowerCase().includes('shoulder')
                        );
                        
                        if (armBones.some(bone => 
                            Math.abs(bone.rotation.z) < 0.1 && Math.abs(bone.rotation.x) < 0.1
                        )) {
                            isInTPose = true;
                        }
                        
                        hasAnimations = true;
                    }
                }
            });

            playerObjects.push({
                name: child.name,
                playerId: playerId,
                position: child.position.clone(),
                visible: child.visible,
                children: child.children.length,
                hasNametag: hasNametag,
                nametagText: nametagText,
                isInTPose: isInTPose,
                hasAnimations: hasAnimations,
                positionKey: posKey
            });

            // Track positions for duplicates
            if (playerPositions.has(posKey)) {
                playerPositions.set(posKey, playerPositions.get(posKey) + 1);
            } else {
                playerPositions.set(posKey, 1);
            }

            // Track names for duplicates
            if (nametagText) {
                if (playerNames.has(nametagText)) {
                    playerNames.set(nametagText, playerNames.get(nametagText) + 1);
                } else {
                    playerNames.set(nametagText, 1);
                }
            }
        }
    });

    console.log('  - Total player objects in scene:', playerObjects.length);
    playerObjects.forEach((obj, index) => {
        console.log(`  ${index + 1}. ${obj.name}:`);
        console.log(`     Position: ${obj.positionKey}`);
        console.log(`     Visible: ${obj.visible}`);
        console.log(`     Has nametag: ${obj.hasNametag} (${obj.nametagText || 'none'})`);
        console.log(`     Is in T-pose: ${obj.isInTPose}`);
        console.log(`     Has animations: ${obj.hasAnimations}`);
        console.log(`     Children: ${obj.children}`);
    });

    // Test 3: Check for duplicates
    console.log('\n🔍 Duplicate Analysis:');
    const nameDuplicates = Array.from(playerNames.entries()).filter(([name, count]) => count > 1);
    const positionDuplicates = Array.from(playerPositions.entries()).filter(([pos, count]) => count > 1);
    
    if (nameDuplicates.length > 0) {
        console.log('  ⚠️ Name duplicates found:');
        nameDuplicates.forEach(([name, count]) => {
            console.log(`     - ${name}: ${count} instances`);
        });
    }

    if (positionDuplicates.length > 0) {
        console.log('  ⚠️ Position duplicates found:');
        positionDuplicates.forEach(([pos, count]) => {
            console.log(`     - ${pos}: ${count} players`);
        });
    }

    if (nameDuplicates.length === 0 && positionDuplicates.length === 0) {
        console.log('  ✅ No duplicates found in tracking');
    }

    // Test 4: Check for ghost characters (players without tracking)
    console.log('\n👻 Ghost Character Detection:');
    const trackedPlayerIds = multiplayerSystem.remotePlayerManager ? 
        Array.from(multiplayerSystem.remotePlayerManager.remotePlayers.keys()) : [];
    
    const ghostCharacters = playerObjects.filter(obj => 
        !trackedPlayerIds.includes(obj.playerId)
    );

    if (ghostCharacters.length > 0) {
        console.log('  ⚠️ Ghost characters detected:');
        ghostCharacters.forEach(obj => {
            console.log(`     - ${obj.name} (not in tracking)`);
        });
    } else {
        console.log('  ✅ No ghost characters found');
    }

    // Test 5: Check local player
    console.log('\n🎯 Local Player Check:');
    if (window.game.multiplayerSystem.core) {
        const localPlayerId = window.game.multiplayerSystem.core.getNetworkManager().getLocalPlayerId();
        console.log('  - Local player ID:', localPlayerId);
        
        const localPlayerInScene = playerObjects.find(obj => obj.playerId === localPlayerId);
        if (localPlayerInScene) {
            console.log('  ⚠️ Local player found in scene as remote player!');
            console.log('    This could be causing duplication');
        } else {
            console.log('  ✅ Local player correctly excluded from remote players');
        }
    }

    // Test 6: Real-time monitoring
    console.log('\n📊 Starting real-time monitoring...');
    let monitorCount = 0;
    const monitorInterval = setInterval(() => {
        monitorCount++;
        const currentPlayers = [];
        scene.traverse((child) => {
            if (child.name && child.name.startsWith('player-')) {
                currentPlayers.push(child.name);
            }
        });
        
        const trackedCount = multiplayerSystem.remotePlayerManager ? 
            multiplayerSystem.remotePlayerManager.remotePlayers.size : 0;
        
        console.log(`Monitor ${monitorCount}: Scene players: ${currentPlayers.length}, Tracked: ${trackedCount}`);
        
        if (monitorCount >= 10) {
            clearInterval(monitorInterval);
            console.log('📊 Monitoring complete');
        }
    }, 1000);

    // Cleanup function
    window.cleanupGhostCharacters = () => {
        console.log('🧹 Cleaning up ghost characters...');
        let cleaned = 0;
        
        scene.traverse((child) => {
            if (child.name && child.name.startsWith('player-')) {
                const playerId = child.name.replace('player-', '');
                const isTracked = multiplayerSystem.remotePlayerManager && 
                    multiplayerSystem.remotePlayerManager.remotePlayers.has(playerId);
                
                if (!isTracked) {
                    console.log(`Removing ghost: ${child.name}`);
                    scene.remove(child);
                    cleaned++;
                }
            }
        });
        
        console.log(`Cleaned up ${cleaned} ghost characters`);
    };

    return {
        playerObjects,
        ghostCharacters,
        nameDuplicates,
        positionDuplicates,
        trackedPlayerIds
    };
}

// Make it globally available
window.diagnoseGhostCharacter = diagnoseGhostCharacter;

console.log('✅ Ghost character diagnostic loaded. Run: diagnoseGhostCharacter()');