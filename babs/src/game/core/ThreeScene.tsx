import React, { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useGame } from './useGame';
import Joystick from '../input/Joystick';


interface UserProfile {
  fid: number;
  displayName: string;
  username: string;
  pfpUrl?: string;
}

interface ThreeSceneProps {
  user: UserProfile | null;
  gameStarted?: boolean;
  isChatOpen?: boolean;
  multiplayerConnected?: boolean;
  onMultiplayerConnectChange?: (isConnected: boolean) => void;
  onRemotePlayerCountChange?: (count: number) => void;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({ 
  user, 
  gameStarted = false,
  isChatOpen = false,
  multiplayerConnected = false,
  onMultiplayerConnectChange,
  onRemotePlayerCountChange
}) => {
  const { mountRef, error, actions } = useGame(user, onRemotePlayerCountChange || (() => {}));

  const [isConnecting, setIsConnecting] = useState(false);

  // Effect for handling connection logic - only run once when user is available
  useEffect(() => {
    if (user && actions.connectToMultiplayer && !multiplayerConnected && !isConnecting) {
      setIsConnecting(true);
      actions.connectToMultiplayer(user)
        .then(success => {
          onMultiplayerConnectChange?.(success);
          if (success) {
          } else {
            console.warn('⚠️ Multiplayer connection failed');
          }
        })
        .catch(error => {
          console.error('❌ Error connecting to multiplayer:', error);
          onMultiplayerConnectChange?.(false);
        })
        .finally(() => {
          setIsConnecting(false);
        });
    }
  }, [user?.fid]); // Only re-run when user ID changes, not when actions change

  // Effect for disconnecting on component unmount
  useEffect(() => {
    const disconnect = actions.disconnectFromMultiplayer;
    return () => {
      disconnect();
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  useEffect(() => {
    // Initialize Farcaster frame
    sdk.actions.ready();
  }, []);







  // Handle keyboard shortcuts for game actions
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.code.toLowerCase();
      
      switch (key) {
        case 'keye':
          // Try to pickup brick when near brick pile
          actions.pickupBrick();
          break;
          
        case 'keyb':
          // Place brick (if carrying brick)
          actions.placeBrick();
          break;
          
        case 'keyc':
          // Toggle camera follow
          actions.toggleCameraFollow();
          break;
      }
      
      // Debug: Multiplayer debug info
      if (event.code === 'KeyM' && event.shiftKey) {
        actions.debugMultiplayer();
      }
      
      // Debug: Toggle remote player debug boxes
      if (event.code === 'KeyR' && event.shiftKey) {
        actions.toggleRemotePlayerDebug();
      }
      
      // Debug: Force cleanup all remote players
      if (event.code === 'KeyX' && event.shiftKey) {
        actions.forceCleanupRemotePlayers();
      }
      
      // Debug: Show remote players debug info
      if (event.code === 'KeyD' && event.shiftKey) {
        actions.debugRemotePlayersInfo();
      }
      
      // Debug: Request force sync
      if (event.code === 'KeyS' && event.shiftKey) {
        actions.requestForceSync();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [actions]);



  if (error) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'red',
        fontSize: '18px',
        textAlign: 'center'
      }}>
        <h3>Game Error</h3>
        <p>{error}</p>
        <p>Please refresh the page to try again.</p>
      </div>
    );
  }

  return (
    <>
      {/* Game Mount Point */}
      <div 
        ref={mountRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'fixed',
          top: 0, 
          left: 0,
          overflow: 'hidden'
        }} 
      />

      {/* Game UI - Only show when game has started */}
      {gameStarted && (
        <>
          <Joystick />
          
          {/* Jump Button for Testing */}
          <button
        onClick={() => {
      
          // Simulate space key press for jump
          const jumpEvent = new KeyboardEvent('keydown', {
            code: 'Space',
            key: ' ',
            bubbles: true
          });
          window.dispatchEvent(jumpEvent);
        }}
        onTouchStart={(e) => {
          e.preventDefault(); // Prevent any interference
          e.stopPropagation(); // Stop event bubbling
      
          // Simulate space key press for jump on touch
          const jumpEvent = new KeyboardEvent('keydown', {
            code: 'Space',
            key: ' ',
            bubbles: true
          });
          window.dispatchEvent(jumpEvent);
        }}
        style={{
          position: 'fixed',
          bottom: '110px',
          left: '30px',
          width: '50px',
          height: '50px',
          borderRadius: '0px', // Remove rounded corners for pixelated look
          backgroundColor: '#4CAF50',
          color: 'white',
          border: '3px solid #ffffff',
          fontSize: '8px',
          fontWeight: 'bold',
          fontFamily: '"Press Start 2P", monospace',
          cursor: 'pointer',
          boxShadow: '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          textShadow: '2px 2px 0px #000000',
          letterSpacing: '1px',
          imageRendering: 'pixelated',
          textTransform: 'uppercase'
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        JUMP
      </button>
        </>
      )}
    </>
  );
};

export default ThreeScene;
