/**
 * Live Ghost Character Fix Test
 * Run this in your browser console to test the ghost character fix
 * 
 * Usage: 
 * 1. Open browser dev tools (F12)
 * 2. Paste this entire script into the console
 * 3. Press Enter to run
 * 4. Use the provided commands to test and monitor
 */

(function() {
    'use strict';
    
    console.log('🚀 Ghost Character Fix Test - Loading...');
    
    // Wait for the game to be ready
    let attempts = 0;
    const maxAttempts = 50;
    
    function waitForGame() {
        attempts++;
        
        if (attempts > maxAttempts) {
            console.error('❌ Game not ready after', maxAttempts, 'attempts');
            return;
        }
        
        if (!window.game || !window.game.core || !window.game.core.getScene) {
            setTimeout(waitForGame, 200);
            return;
        }
        
        console.log('✅ Game ready, starting ghost character tests...');
        initializeTests();
    }
    
    function initializeTests() {
        // Global test functions
        window.ghostTest = {
            // Check current player state
            checkPlayers: function() {
                const scene = window.game.core.getScene();
                const remotePlayerManager = window.game.core.getMultiplayerManager()?.getRemotePlayerManager();
                
                if (!remotePlayerManager) {
                    console.error('❌ RemotePlayerManager not found');
                    return;
                }
                
                const trackedPlayers = Array.from(remotePlayerManager.getRemotePlayers().keys());
                const sceneObjects = [];
                
                scene.traverse((child) => {
                    if (child.name && child.name.startsWith('player-')) {
                        sceneObjects.push({
                            name: child.name,
                            position: child.position.clone(),
                            visible: child.visible,
                            children: child.children.map(c => c.type)
                        });
                    }
                });
                
                console.log('📊 Player State Check:', {
                    trackedPlayers: trackedPlayers,
                    sceneObjects: sceneObjects.map(obj => ({
                        name: obj.name,
                        position: `(${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})`,
                        visible: obj.visible,
                        hasMesh: obj.children.includes('Mesh')
                    }))
                });
                
                return {
                    tracked: trackedPlayers,
                    scene: sceneObjects
                };
            },
            
            // Check for ghost characters (in scene but not tracked)
            findGhosts: function() {
                const result = this.checkPlayers();
                if (!result) return;
                
                const scenePlayerIds = result.scene.map(obj => obj.name.replace('player-', ''));
                const trackedPlayerIds = result.tracked;
                
                const ghosts = scenePlayerIds.filter(id => !trackedPlayerIds.includes(id));
                
                if (ghosts.length > 0) {
                    console.warn('👻 GHOST CHARACTERS FOUND:', ghosts);
                    return ghosts;
                } else {
                    console.log('✅ No ghost characters found');
                    return [];
                }
            },
            
            // Clean up ghost characters
            cleanGhosts: function() {
                const ghosts = this.findGhosts();
                if (ghosts.length === 0) return;
                
                const scene = window.game.core.getScene();
                
                ghosts.forEach(ghostId => {
                    const ghostObject = scene.getObjectByName(`player-${ghostId}`);
                    if (ghostObject) {
                        console.log('🧹 Cleaning ghost:', ghostId);
                        
                        // Dispose resources
                        ghostObject.traverse((child) => {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => mat.dispose());
                                } else {
                                    child.material.dispose();
                                }
                            }
                        });
                        
                        scene.remove(ghostObject);
                    }
                });
                
                console.log('✅ Ghost cleanup complete');
            },
            
            // Monitor for ghost characters over time
            startMonitor: function() {
                if (window.ghostMonitorInterval) {
                    console.log('⚠️ Monitor already running');
                    return;
                }
                
                console.log('👁️ Starting ghost character monitor...');
                window.ghostMonitorInterval = setInterval(() => {
                    const ghosts = this.findGhosts();
                    if (ghosts.length > 0) {
                        console.warn('🔴 Ghost detected:', ghosts);
                    }
                }, 2000);
                
                console.log('📊 Monitor running every 2 seconds. Use ghostTest.stopMonitor() to stop.');
            },
            
            // Stop monitoring
            stopMonitor: function() {
                if (window.ghostMonitorInterval) {
                    clearInterval(window.ghostMonitorInterval);
                    delete window.ghostMonitorInterval;
                    console.log('✅ Monitor stopped');
                } else {
                    console.log('⚠️ No monitor running');
                }
            },
            
            // Force a complete player cleanup
            forceCleanup: function() {
                console.log('🧹 Forcing complete player cleanup...');
                
                const remotePlayerManager = window.game.core.getMultiplayerManager()?.getRemotePlayerManager();
                if (remotePlayerManager && remotePlayerManager.forceCleanupAllRemotePlayers) {
                    remotePlayerManager.forceCleanupAllRemotePlayers();
                    console.log('✅ Force cleanup completed');
                } else {
                    console.error('❌ forceCleanupAllRemotePlayers method not found');
                }
            },
            
            // Test T-pose detection
            checkTPose: function() {
                const scene = window.game.core.getScene();
                const tPoseObjects = [];
                
                scene.traverse((child) => {
                    if (child.name && child.name.startsWith('player-') && child.visible) {
                        // Check for T-pose indicators
                        const hasArmsOut = child.children.some(mesh => 
                            mesh.type === 'Group' && mesh.children.some(subChild => 
                                subChild.type === 'SkinnedMesh' && subChild.skeleton
                            )
                        );
                        
                        if (hasArmsOut) {
                            tPoseObjects.push({
                                name: child.name,
                                position: child.position.clone(),
                                rotation: child.rotation.clone()
                            });
                        }
                    }
                });
                
                if (tPoseObjects.length > 0) {
                    console.warn('🤖 T-POSE DETECTED:', tPoseObjects);
                } else {
                    console.log('✅ No T-pose characters detected');
                }
                
                return tPoseObjects;
            },
            
            // Quick summary
            summary: function() {
                console.log('📋 GHOST CHARACTER TEST SUMMARY:');
                console.log('=============================');
                this.checkPlayers();
                this.findGhosts();
                this.checkTPose();
                console.log('=============================');
                console.log('Commands available:');
                console.log('  ghostTest.checkPlayers() - Check current player state');
                console.log('  ghostTest.findGhosts() - Find ghost characters');
                console.log('  ghostTest.cleanGhosts() - Clean up ghost characters');
                console.log('  ghostTest.startMonitor() - Start monitoring for ghosts');
                console.log('  ghostTest.stopMonitor() - Stop monitoring');
                console.log('  ghostTest.forceCleanup() - Force complete cleanup');
                console.log('  ghostTest.checkTPose() - Check for T-pose characters');
            }
        };
        
        // Auto-run summary
        setTimeout(() => {
            window.ghostTest.summary();
        }, 1000);
        
        console.log('🎯 Ghost Character Test Ready! Use ghostTest.summary() for help');
    }
    
    // Start the test
    waitForGame();
})();