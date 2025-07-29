/**
 * Targeted fix for ghost character issue
 * Addresses T-pose characters appearing after movement
 */

console.log('🎯 Applying Ghost Character Fix...');

function applyGhostCharacterFix() {
    if (!window.game || !window.game.multiplayerSystem) {
        console.log('❌ Game or multiplayer system not available');
        return false;
    }

    const multiplayerSystem = window.game.multiplayerSystem;
    const scene = window.game.scene;

    console.log('🔧 Enhancing duplicate prevention...');

    // Enhance the createRemotePlayer method with stricter checks
    if (multiplayerSystem.remotePlayerManager) {
        const manager = multiplayerSystem.remotePlayerManager;
        const originalCreateRemotePlayer = manager.createRemotePlayer;

        manager.createRemotePlayer = function(player) {
            console.log('🎯 Enhanced createRemotePlayer called for:', player.displayName);

            const localPlayerId = this.core.getNetworkManager().getLocalPlayerId();
            
            // Skip local player
            if (player.id === localPlayerId) {
                console.log('🚫 Skipping local player');
                return;
            }

            // Enhanced duplicate checks
            if (this.remotePlayers.has(player.id)) {
                console.log('⚠️ Player already exists in tracking, skipping');
                return;
            }

            if (this.playersBeingCreated.has(player.id)) {
                console.log('⚠️ Player creation already in progress');
                return;
            }

            // CRITICAL: Aggressive cleanup of any existing objects
            const existingObjects = [];
            scene.traverse((child) => {
                if (child.name === `player-${player.id}`) {
                    existingObjects.push(child);
                }
            });

            if (existingObjects.length > 0) {
                console.log(`🧹 Found ${existingObjects.length} existing objects for ${player.id}, cleaning up...`);
                existingObjects.forEach(obj => {
                    scene.remove(obj);
                    // Dispose resources
                    obj.traverse((child) => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                });
            }

            // Ensure no creation timeout is pending
            const existingTimeout = this.playerCreationTimeouts.get(player.id);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
                this.playerCreationTimeouts.delete(player.id);
            }

            // Add to creation set
            this.playersBeingCreated.add(player.id);

            // Call original method
            originalCreateRemotePlayer.call(this, player);
        };

        console.log('✅ Enhanced createRemotePlayer applied');
    }

    // Fix the animation initialization to prevent T-pose flash
    if (multiplayerSystem.remotePlayerManager) {
        const manager = multiplayerSystem.remotePlayerManager;
        const originalLoadRemoteCharacterModel = manager.loadRemoteCharacterModel;

        manager.loadRemoteCharacterModel = async function(player) {
            try {
                console.log('🎭 Enhanced model loading for:', player.displayName);
                
                // Check if player still needs to be created
                if (!this.playersBeingCreated.has(player.id)) {
                    console.log('🚫 Player creation cancelled, skipping model load');
                    return;
                }

                const gltf = await new Promise<any>((resolve, reject) => {
                    this.loader.load(
                        '/assets/models/character-male-f copy.glb',
                        resolve,
                        undefined,
                        reject
                    );
                });

                // Create character container
                const playerGroup = new THREE.Group();
                playerGroup.name = `player-${player.id}`;

                const character = gltf.scene;
                character.position.set(0, 0, 0);
                character.scale.set(1.3, 1.3, 1.3);
                character.visible = false; // Start invisible
                character.matrixAutoUpdate = true;

                // Apply materials and setup shadows
                character.traverse((child) => {
                    if (child.isMesh) {
                        const mesh = child;
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        mesh.visible = true;
                        mesh.frustumCulled = true;
                        mesh.matrixAutoUpdate = true;

                        const characterMaterial = new THREE.MeshToonMaterial({
                            map: this.characterTexture.clone(),
                            transparent: false,
                            opacity: 1.0,
                            side: THREE.FrontSide,
                        });

                        mesh.material = characterMaterial;
                    }
                });

                // Initialize animations BEFORE making visible
                const mixer = new THREE.AnimationMixer(character);
                const animations = {
                    idle: null,
                    walk: null,
                    run: null,
                    jump: null,
                    current: null
                };

                // Map animations
                gltf.animations.forEach((clip) => {
                    const name = clip.name.toLowerCase();
                    if (name.includes('idle')) animations.idle = mixer.clipAction(clip);
                    else if (name.includes('walk')) animations.walk = mixer.clipAction(clip);
                    else if (name.includes('run')) animations.run = mixer.clipAction(clip);
                    else if (name.includes('jump')) animations.jump = mixer.clipAction(clip);
                });

                // Set initial animation to idle
                if (animations.idle) {
                    animations.idle.play();
                    animations.current = animations.idle;
                }

                // Store animation data
                this.remotePlayerAnimations.set(player.id, {
                    mixer,
                    actions: animations,
                    lastAnimationState: 'idle',
                    lastPosition: new THREE.Vector3(player.position.x, player.position.y, player.position.z)
                });

                // Create nametag
                const nametagDiv = document.createElement('div');
                nametagDiv.className = 'player-nametag';
                nametagDiv.textContent = player.displayName;
                nametagDiv.style.cssText = `
                    color: white;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    font-weight: bold;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                    pointer-events: none;
                    user-select: none;
                `;

                const nametag = new CSS2DObject(nametagDiv);
                nametag.position.set(0, 2.2, 0);
                playerGroup.add(nametag);

                // Add character to group
                playerGroup.add(character);

                // Position the player
                playerGroup.position.set(player.position.x, player.position.y, player.position.z);
                playerGroup.rotation.set(player.rotation.x, player.rotation.y, player.rotation.z);

                // Add to scene
                scene.add(playerGroup);

                // Add to tracking
                this.remotePlayers.set(player.id, playerGroup);
                this.playerTargets.set(player.id, {
                    position: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
                    rotation: new THREE.Euler(player.rotation.x, player.rotation.y, player.rotation.z),
                    lastUpdate: Date.now()
                });

                // Update nametag visibility
                nametag.visible = this.currentNametagVisibility;

                // Clean up creation state
                this.playersBeingCreated.delete(player.id);
                const timeout = this.playerCreationTimeouts.get(player.id);
                if (timeout) {
                    clearTimeout(timeout);
                    this.playerCreationTimeouts.delete(player.id);
                }

                // Make visible after setup
                setTimeout(() => {
                    character.visible = true;
                }, 100);

                console.log('✅ Enhanced remote player created:', player.displayName);

            } catch (error) {
                console.error('❌ Failed to load remote character model:', error);
                this.createFallbackRemotePlayer(player);
            }
        };

        console.log('✅ Enhanced model loading applied');
    }

    // Add aggressive cleanup function
    window.aggressiveCleanup = function() {
        console.log('🧹 Performing aggressive cleanup...');
        let cleaned = 0;
        
        const trackedPlayerIds = multiplayerSystem.remotePlayerManager ? 
            Array.from(multiplayerSystem.remotePlayerManager.remotePlayers.keys()) : [];
        
        scene.traverse((child) => {
            if (child.name && child.name.startsWith('player-')) {
                const playerId = child.name.replace('player-', '');
                if (!trackedPlayerIds.includes(playerId)) {
                    console.log(`Removing ghost: ${child.name}`);
                    scene.remove(child);
                    
                    // Dispose resources
                    child.traverse((subChild) => {
                        if (subChild.geometry) subChild.geometry.dispose();
                        if (subChild.material) {
                            if (Array.isArray(subChild.material)) {
                                subChild.material.forEach(mat => mat.dispose());
                            } else {
                                subChild.material.dispose();
                            }
                        }
                    });
                    
                    cleaned++;
                }
            }
        });

        // Clean up creation states
        if (multiplayerSystem.remotePlayerManager) {
            multiplayerSystem.remotePlayerManager.playersBeingCreated.clear();
            multiplayerSystem.remotePlayerManager.playerCreationTimeouts.forEach(timeout => {
                clearTimeout(timeout);
            });
            multiplayerSystem.remotePlayerManager.playerCreationTimeouts.clear();
        }

        console.log(`🧹 Aggressive cleanup complete. Removed ${cleaned} ghost characters.`);
    };

    // Add real-time monitoring
    let monitorInterval = null;
    window.startGhostMonitor = function() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
        }
        
        console.log('👁️ Starting ghost character monitor...');
        monitorInterval = setInterval(() => {
            const trackedPlayerIds = multiplayerSystem.remotePlayerManager ? 
                Array.from(multiplayerSystem.remotePlayerManager.remotePlayers.keys()) : [];
            
            const scenePlayerIds = [];
            scene.traverse((child) => {
                if (child.name && child.name.startsWith('player-')) {
                    scenePlayerIds.push(child.name.replace('player-', ''));
                }
            });

            const ghosts = scenePlayerIds.filter(id => !trackedPlayerIds.includes(id));
            
            if (ghosts.length > 0) {
                console.warn(`👻 Ghost characters detected: ${ghosts.join(', ')}`);
                window.aggressiveCleanup();
            }
        }, 2000);
    };

    window.stopGhostMonitor = function() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
            console.log('👁️ Ghost monitor stopped');
        }
    };

    console.log('✅ Ghost character fix applied!');
    console.log('Available commands:');
    console.log('  - diagnoseGhostCharacter() - Run diagnosis');
    console.log('  - aggressiveCleanup() - Force cleanup ghosts');
    console.log('  - startGhostMonitor() - Start real-time monitoring');
    console.log('  - stopGhostMonitor() - Stop monitoring');

    return true;
}

// Make it globally available
window.applyGhostCharacterFix = applyGhostCharacterFix;

console.log('✅ Ghost character fix script loaded. Run: applyGhostCharacterFix()');