// import '@farcaster/auth-kit/dist/style.css';
// import { AuthKitProvider } from '@farcaster/auth-kit';
import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect, useState } from "react";

import ThreeScene from "./game/core/ThreeScene";
import { ChatBox, Message } from "./game/ui/ChatBox";



interface UserProfile {
  fid: number;
  displayName: string;
  username: string;
  pfpUrl?: string;
}



function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Multiplayer state
  const [multiplayerConnected, setMultiplayerConnected] = useState(false);
  const [remotePlayerCount, setRemotePlayerCount] = useState(0);
  
  // Camera state
  const [cameraFollowEnabled, setCameraFollowEnabled] = useState(true);

  
  // Listen for multiplayer chat messages
  useEffect(() => {
    const handleMultiplayerChat = (event: CustomEvent) => {
      const message = event.detail;
      console.log('📨 Received multiplayer chat message:', message);
      
      // Don't add our own messages again (they're already added locally)
      if (user && message.username !== user.displayName) {
        const newMessage: Message = {
          id: message.id || Date.now().toString(),
          username: message.username,
          text: message.text,
          timestamp: new Date(message.timestamp),
          pfpUrl: message.pfpUrl
        };
        
        // Check for duplicate messages before adding
        setMessages(prev => {
          const isDuplicate = prev.some(msg => 
            msg.id === newMessage.id || 
            (msg.username === newMessage.username && 
             msg.text === newMessage.text && 
             Math.abs(msg.timestamp.getTime() - newMessage.timestamp.getTime()) < 1000)
          );
          
          if (isDuplicate) {
            console.log('🚫 Duplicate chat message detected, skipping');
            return prev;
          }
          
          return [...prev, newMessage];
        });
        
        // Show unread message indicator if chat is closed
        if (!showChat) {
          setUnreadMessages(prev => prev + 1);
        }
      }
    };
    
    window.addEventListener('multiplayer-chat', handleMultiplayerChat as EventListener);
    
    return () => {
      window.removeEventListener('multiplayer-chat', handleMultiplayerChat as EventListener);
    };
  }, [user, showChat]);

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        // Initialize SDK first
        await sdk.actions.ready();
        
        // Check if we're in a Farcaster context
        const context = await sdk.context;
    
        
        // Try to get user info from context first
        if (context?.user) {
          setUser({
            fid: context.user.fid,
            displayName: (context.user.displayName || `User ${context.user.fid}`).replace(/"/g, ''),
            username: context.user.username || '',
            pfpUrl: context.user.pfpUrl || ''
          });
      
        } else {
          // Set a demo user for testing with unique identifier
          const uniqueId = Math.floor(Math.random() * 10000);
          setUser({
            fid: 12345 + uniqueId,
            displayName: `Demo User ${uniqueId}`,
            username: `demouser${uniqueId}`
          });
        }
      } catch (error) {
        console.error('Authentication failed:', error);
         // Continue without authentication - set a default user for demo with unique identifier
         const uniqueId = Math.floor(Math.random() * 10000);
         setUser({
           fid: 12345 + uniqueId,
           displayName: `Demo User ${uniqueId}`,
           username: `demouser${uniqueId}`
         });
       } finally {
        setIsAuthenticating(false);
      }
    };
    
    authenticateUser();
  }, []);
  


  const handleStartGame = () => {
    setGameStarted(true);

    const gameManager = (window as any).gameManager;
    if (gameManager) {
      gameManager.showLayerProgressUI();
    }
    
    // Add welcome messages when game starts
    const welcomeMessages: Message[] = [
      {
        id: '1',
        username: 'System',
        text: 'Welcome to The Stack! Start building your tower.',
        timestamp: new Date()
      },
      {
        id: '2', 
        username: 'BuilderBot',
        text: 'Use E to pick up bricks, B to place them. Happy building!',
        timestamp: new Date()
      }
    ];
    setMessages(welcomeMessages);
  };
  
  // Removed automatic multiplayer connection to prevent duplicate connections
  // Users can manually connect via the UI if needed


  
  const handleSendMessage = (text: string) => {
    if (!user) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      username: user.displayName,
      text,
      timestamp: new Date(),
      pfpUrl: user.pfpUrl
    };
    
    // Always add message locally first for immediate feedback
    setMessages(prev => [...prev, newMessage]);
    
    // Send message through multiplayer system if connected
    const gameManager = (window as any).gameManager;
    if (gameManager && gameManager.isMultiplayerConnected()) {
      gameManager.sendChatMessage(text, user);
    }
  };
  
  const handleToggleChat = () => {
    setShowChat(!showChat);
    if (!showChat) {
      setUnreadMessages(0);
    }
  };

  const handleToggleCamera = () => {
    const gameManager = (window as any).gameManager;
    if (gameManager) {
      gameManager.toggleCameraFollow();
      const newCameraState = !cameraFollowEnabled;
      setCameraFollowEnabled(newCameraState);
      
      // Hide local player nametag when camera controls are enabled (free camera mode)
      // When cameraFollowEnabled is false, we're in free camera mode, so hide the nametag
      gameManager.setLocalNametagVisible(newCameraState);
    }
  };

  // Handle nametag visibility based on game and chat state
  useEffect(() => {
    const gameManager = (window as any).gameManager;
    if (gameManager) {
      // For local player: consider both game/chat state AND camera state
      const baseVisibility = gameStarted && !showChat;
      const localNametagVisible = baseVisibility && cameraFollowEnabled; // Hide when in free camera mode
      gameManager.setLocalNametagVisible(localNametagVisible);
      
      // For remote players: only consider game/chat state (not affected by camera mode)
      const remoteNametagVisible = baseVisibility;
      // Use the correct method to set remote player nametag visibility
      if (gameManager.multiplayerManager) {
        gameManager.multiplayerManager.setNametagVisible(remoteNametagVisible);
      }
    }
  }, [gameStarted, showChat, cameraFollowEnabled]);





  return (
    <div style={{ 
      position: 'fixed', 
      width: '100%', 
      height: '100%', 
      overflow: 'hidden',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }}>
      {isAuthenticating ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', 
          fontSize: '20px', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', textShadow: '2px 2px 8px rgba(0, 0, 0, 0.7)' }}>Your Island Awaits</div>
            <div>Authenticating...</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ 
            width: '100%', 
            height: '100%', 
            filter: gameStarted ? 'none' : 'blur(10px)',
            transition: 'filter 0.5s ease-out'
          }}>
            <ThreeScene 
              user={user} 
              gameStarted={gameStarted}
              isChatOpen={showChat}
              multiplayerConnected={multiplayerConnected}
              onMultiplayerConnectChange={setMultiplayerConnected}
              onRemotePlayerCountChange={setRemotePlayerCount}

            />
          </div>

          {!gameStarted && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.3)'
            }}>
              <h1 style={{ 
                color: 'white', 
                fontSize: 'clamp(2rem, 8vw, 4rem)', 
                textShadow: '2px 2px 8px rgba(0,0,0,0.7)',
                margin: '0 20px',
                textAlign: 'center'
              }}>the stack</h1>
              <p style={{ 
                color: 'white', 
                fontSize: 'clamp(1rem, 4vw, 1.5rem)', 
                textShadow: '1px 1px 4px rgba(0,0,0,0.7)',
                margin: '10px 20px',
                textAlign: 'center'
              }}>the community tower</p>
              <button onClick={handleStartGame} style={{
                padding: 'clamp(12px, 3vw, 15px) clamp(20px, 6vw, 30px)',
                fontSize: 'clamp(1rem, 3vw, 1.2rem)',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#6c5ce7',
                border: '4px solid #ffffff',
                borderRadius: '0px',
                cursor: 'pointer',
                marginTop: '20px',
                minWidth: '120px',
                maxWidth: '90vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)',
                transition: 'all 0.1s ease',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                imageRendering: 'pixelated'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translate(2px, 2px)';
                e.currentTarget.style.boxShadow = '2px 2px 0px #2d3436, 4px 4px 0px rgba(0,0,0,0.3)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translate(0px, 0px)';
                e.currentTarget.style.boxShadow = '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translate(0px, 0px)';
                e.currentTarget.style.boxShadow = '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)';
              }}>
                <span style={{ fontSize: '1.2em' }}>🏗️</span>
                start stacking
              </button>
            </div>
          )}

          {gameStarted && (
            <>
              {/* Debug info */}
              {user && (
                <div 
                  className="fid-display"
                  style={{
                    position: 'fixed',
                    right: '10px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    textShadow: '1px 1px 1px rgba(0, 0, 0, 0.8)',
                    zIndex: 100, // Lower z-index than chat box
                    opacity: showChat ? 0.3 : 1, // Fade when chat is open
                    transition: 'opacity 0.3s ease',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                  FID: {user.fid}<br/>
                  {multiplayerConnected ? (
                    <span style={{ color: '#2ecc71' }}>🌐 Online ({remotePlayerCount + 1} players)</span>
                  ) : (
                    <span style={{ color: '#e74c3c' }}>🔌 Offline</span>
                  )}
                </div>
              )}
              

              
              {/* Chat toggle button */}
              <button
                onClick={handleToggleChat}
                style={{
                  position: 'fixed',
                  top: '10px',
                  left: '10px',
                  width: '50px',
                  height: '50px',
                  borderRadius: '0px', // Remove rounded corners for pixelated look
                  backgroundColor: showChat ? '#e74c3c' : '#3498db',
                  color: 'white',
                  border: '3px solid #ffffff',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)',
                  zIndex: 5000, // Higher than debug info but lower than chat box
                  fontFamily: '"Press Start 2P", monospace',
                  transition: 'all 0.2s ease',
                  imageRendering: 'pixelated',
                  textShadow: '2px 2px 0px #000000'
                }}
                title={showChat ? 'Close Chat' : 'Open Chat'}
              >
                {showChat ? '×' : '💬'}
                {unreadMessages > 0 && !showChat && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#e74c3c',
                    color: 'white',
                    borderRadius: '0px', // Remove rounded corners for pixelated look
                    border: '2px solid #ffffff',
                    width: '20px',
                    height: '20px',
                    fontSize: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontFamily: '"Press Start 2P", monospace',
                    textShadow: '1px 1px 0px #000000',
                    imageRendering: 'pixelated',
                    boxShadow: '2px 2px 0px #2d3436'
                  }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
              
              {/* Camera control button */}
              <button
                onClick={handleToggleCamera}
                style={{
                  position: 'fixed',
                  top: '70px', // Position below chat button
                  left: '10px', // Align with chat button
                  width: '50px',
                  height: '50px',
                  borderRadius: '0px', // Remove rounded corners for pixelated look
                  backgroundColor: cameraFollowEnabled ? '#e67e22' : '#9b59b6',
                  color: 'white',
                  border: '3px solid #ffffff',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: showChat ? 'none' : 'flex', // Hide when chat is open
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '4px 4px 0px #2d3436, 8px 8px 0px rgba(0,0,0,0.3)',
                  zIndex: 5000, // Higher than debug info but lower than chat box
                  fontFamily: '"Press Start 2P", monospace',
                  transition: 'all 0.2s ease',
                  imageRendering: 'pixelated',
                  textShadow: '2px 2px 0px #000000'
                }}
                title={cameraFollowEnabled ? 'Free Camera Mode' : 'Follow Camera Mode'}
              >
                📷
              </button>

              
              {/* ChatBox */}
              {showChat && (
                <ChatBox
                  user={user}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onClose={() => setShowChat(false)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
