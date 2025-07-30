import { useRef, useEffect, useState, useMemo } from 'react';
import { GameManager } from './GameManager';
import { UserProfile } from './types';

export const useGame = (user: UserProfile | null, onRemotePlayerCountChange: (count: number) => void) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const initializeGame = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        gameManagerRef.current = new GameManager(mountRef.current!, user, onRemotePlayerCountChange);
        
        // Expose game manager globally for debugging
        (window as any).gameManager = gameManagerRef.current;
        (window as any).debugMultiplayer = () => gameManagerRef.current?.debugMultiplayer();
        (window as any).toggleRemotePlayerDebug = () => gameManagerRef.current?.toggleRemotePlayerDebug();
        (window as any).forceRemotePlayerFallback = () => gameManagerRef.current?.forceRemotePlayerFallback();
        (window as any).startUpdateFrequencyMonitor = () => gameManagerRef.current?.startUpdateFrequencyMonitor();
        (window as any).stopUpdateFrequencyMonitor = () => gameManagerRef.current?.stopUpdateFrequencyMonitor();
        
        // Wait for the game to be fully initialized
        const checkInitialization = () => {
          if (gameManagerRef.current?.isGameInitialized()) {
            setIsLoading(false);
          } else {
            setTimeout(checkInitialization, 100);
          }
        };
        
        checkInitialization();
        
      } catch (err) {
        console.error('Failed to initialize game:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize game');
        setIsLoading(false);
      }
    };

    initializeGame();

    // Cleanup
    return () => {
      if (gameManagerRef.current) {
        gameManagerRef.current.dispose();
        gameManagerRef.current = null;
      }
    };
  }, []);

    const gameActions = useMemo(() => ({
    setJoystickData: (data: any) => {
      gameManagerRef.current?.setJoystickData(data);
    },
    toggleCameraFollow: () => {
      gameManagerRef.current?.toggleCameraFollow();
    },
    
    pickupBrick: () => {
      return gameManagerRef.current?.pickupBrick() || false;
    },
    
    placeBrick: () => {
      return gameManagerRef.current?.placeBrick() || false;
    },
    
    toggleBuildMode: () => {
      gameManagerRef.current?.toggleBuildMode();
    },
    
    getGameState: () => {
      return gameManagerRef.current?.getGameState();
    },
    setNametagVisible: (visible: boolean) => {
      gameManagerRef.current?.setNametagVisible(visible);
    },
    
    getBuildingSystem: () => {
      return gameManagerRef.current?.getBuildingSystem();
    },
    
    // Layer progress methods
    getCurrentLayer: () => {
      return gameManagerRef.current?.getCurrentLayer() ?? 0;
    },
    
    getLayerProgress: () => {
      return gameManagerRef.current?.getLayerProgress() ?? { current: 0, total: 1000, percentage: 0 };
    },

    // Multiplayer methods
    connectToMultiplayer: async (userProfile: UserProfile) => {
      if (!gameManagerRef.current) return false;
      const success = await gameManagerRef.current.connectToMultiplayer(userProfile);
      return success;
    },
    
    disconnectFromMultiplayer: () => {
      gameManagerRef.current?.disconnectFromMultiplayer();
    },
    
    isMultiplayerConnected: () => {
      return gameManagerRef.current?.isMultiplayerConnected() ?? false;
    },
    
    getRemotePlayerCount: () => {
      return gameManagerRef.current?.getRemotePlayerCount() ?? 0;
    },
    
    sendChatMessage: (text: string, userProfile: UserProfile) => {
      gameManagerRef.current?.sendChatMessage(text, userProfile);
    },
    
    // Debug methods
    debugMultiplayer: () => {
      gameManagerRef.current?.debugMultiplayer();
    },
    
    toggleRemotePlayerDebug: () => {
      gameManagerRef.current?.toggleRemotePlayerDebug();
    },
    
    forceRemotePlayerFallback: () => {
      gameManagerRef.current?.forceRemotePlayerFallback();
    },
    
    startUpdateFrequencyMonitor: () => {
      gameManagerRef.current?.startUpdateFrequencyMonitor();
    },
    
    stopUpdateFrequencyMonitor: () => {
      gameManagerRef.current?.stopUpdateFrequencyMonitor();
    },
    
    forceCleanupRemotePlayers: () => {
      gameManagerRef.current?.forceCleanupRemotePlayers();
    },
    
    debugRemotePlayersInfo: () => {
      gameManagerRef.current?.debugRemotePlayersInfo();
    },
    
    requestForceSync: () => {
      gameManagerRef.current?.requestForceSync();
    }
  }), []); // Create actions object once to prevent re-renders

  return {
    mountRef,
    gameManager: gameManagerRef.current,
    isLoading,
    error,
    actions: gameActions
  };
};
