import { useEffect, useState } from 'react';
import { sdk } from "@farcaster/miniapp-sdk";
import LeaderboardPage from './LeaderboardPage';

interface UserProfile {
  fid: number;
  displayName: string;
  username: string;
  pfpUrl?: string;
}

export default function LeaderboardWrapper() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

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

  if (isAuthenticating) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        fontSize: '20px', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: '"Press Start 2P", monospace',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', textShadow: '2px 2px 8px rgba(0, 0, 0, 0.7)' }}>Loading Leaderboard</div>
          <div>Authenticating...</div>
        </div>
      </div>
    );
  }

  return <LeaderboardPage user={user} />;
}