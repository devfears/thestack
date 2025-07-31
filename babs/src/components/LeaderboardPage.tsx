import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LeaderboardPlayer {
  fid: string;
  username: string;
  display_name: string;
  pfp_url: string;
  bricks_placed: number;
  current_streak: number;
  best_streak: number;
  rank_position: number | null;
  last_build_date: string;
  building_sessions?: number;
  total_play_time?: number;
}

interface LeaderboardPageProps {
  user?: {
    fid: number;
    displayName: string;
    username: string;
    pfpUrl?: string;
  };
}

export default function LeaderboardPage({ user }: LeaderboardPageProps) {
  const navigate = useNavigate();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>([]);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<LeaderboardPlayer | null>(null);
  const [activeTab, setActiveTab] = useState('all-time');
  const [loading, setLoading] = useState(true);

  // Fetch leaderboard data
  const fetchLeaderboardData = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/leaderboard/global?limit=50');
      const data = await response.json();
      setLeaderboardData(data);
    } catch (error) {
      console.error('Failed to fetch leaderboard data:', error);
    }
  };

  // Fetch daily leaderboard
  const fetchDailyLeaderboard = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/leaderboard/daily?limit=20');
      const data = await response.json();
      setDailyLeaderboard(data);
    } catch (error) {
      console.error('Failed to fetch daily leaderboard data:', error);
    }
  };

  // Fetch player stats
  const fetchPlayerStats = async (fid: number) => {
    try {
      const response = await fetch(`http://localhost:3002/api/player/${fid}/stats`);
      if (response.ok) {
        const data = await response.json();
        setPlayerStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch player stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchLeaderboardData(),
        fetchDailyLeaderboard(),
        user?.fid ? fetchPlayerStats(user.fid) : Promise.resolve()
      ]);
      setLoading(false);
    };

    loadData();
  }, [user?.fid]);

  const handleBackToGame = () => {
    navigate('/');
  };

  const currentLeaderboard = activeTab === 'all-time' ? leaderboardData : dailyLeaderboard;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#181818',
      color: 'white',
      fontFamily: '"Press Start 2P", monospace',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#e74c3c',
        padding: '20px',
        borderBottom: '4px solid #ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div>
          <h1 style={{
            fontSize: 'clamp(14px, 4vw, 24px)',
            margin: '0 0 5px 0',
            textShadow: '3px 3px 0px #000000'
          }}>
            🏆 THE STACK LEADERBOARD
          </h1>
          <div style={{
            fontSize: 'clamp(8px, 2vw, 12px)',
            color: '#ffcccb'
          }}>
            Top builders in the community tower
          </div>
        </div>
        
        <button
          onClick={handleBackToGame}
          style={{
            background: '#2c3e50',
            border: '3px solid #ffffff',
            color: 'white',
            cursor: 'pointer',
            fontSize: 'clamp(8px, 2vw, 12px)',
            padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px)',
            fontFamily: '"Press Start 2P", monospace',
            textShadow: '2px 2px 0px #000000',
            boxShadow: '4px 4px 0px #000000',
            transition: 'all 0.1s ease'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translate(2px, 2px)';
            e.currentTarget.style.boxShadow = '2px 2px 0px #000000';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translate(0px, 0px)';
            e.currentTarget.style.boxShadow = '4px 4px 0px #000000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translate(0px, 0px)';
            e.currentTarget.style.boxShadow = '4px 4px 0px #000000';
          }}
        >
          ← BACK TO GAME
        </button>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: 'clamp(15px, 4vw, 30px)'
      }}>
        {/* Personal Stats Card */}
        {playerStats ? (
          <div style={{
            backgroundColor: 'rgba(52, 152, 219, 0.2)',
            border: '3px solid #3498db',
            padding: 'clamp(15px, 4vw, 25px)',
            marginBottom: 'clamp(20px, 5vw, 30px)',
            textAlign: 'center',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              fontSize: 'clamp(10px, 3vw, 16px)',
              marginBottom: '15px',
              color: '#3498db',
              textShadow: '2px 2px 0px #000000'
            }}>
              🎮 YOUR BUILDER STATS
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 'clamp(10px, 3vw, 20px)',
              fontSize: 'clamp(8px, 2vw, 12px)'
            }}>
              <div>
                <div style={{ color: '#f39c12', marginBottom: '5px' }}>RANK</div>
                <div style={{ fontSize: 'clamp(12px, 3vw, 18px)' }}>
                  #{playerStats.rank_position || 'Unranked'}
                </div>
              </div>
              <div>
                <div style={{ color: '#e74c3c', marginBottom: '5px' }}>BRICKS</div>
                <div style={{ fontSize: 'clamp(12px, 3vw, 18px)' }}>
                  {playerStats.bricks_placed.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ color: '#e67e22', marginBottom: '5px' }}>STREAK</div>
                <div style={{ fontSize: 'clamp(12px, 3vw, 18px)' }}>
                  {playerStats.current_streak} 🔥
                </div>
              </div>
              <div>
                <div style={{ color: '#9b59b6', marginBottom: '5px' }}>SESSIONS</div>
                <div style={{ fontSize: 'clamp(12px, 3vw, 18px)' }}>
                  {playerStats.building_sessions || 0}
                </div>
              </div>
            </div>
          </div>
        ) : user ? (
          <div style={{
            backgroundColor: 'rgba(241, 196, 15, 0.2)',
            border: '3px solid #f1c40f',
            padding: 'clamp(15px, 4vw, 25px)',
            marginBottom: 'clamp(20px, 5vw, 30px)',
            textAlign: 'center',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              fontSize: 'clamp(10px, 3vw, 14px)',
              color: '#f1c40f',
              textShadow: '2px 2px 0px #000000'
            }}>
              🧱 Place your first brick to join the leaderboard! 🧱
            </div>
          </div>
        ) : null}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: '20px',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'all-time', label: '🏆 ALL-TIME', color: '#e74c3c' },
            { id: 'daily', label: '📅 TODAY', color: '#f39c12' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? tab.color : 'transparent',
                border: `3px solid ${tab.color}`,
                color: 'white',
                cursor: 'pointer',
                fontSize: 'clamp(8px, 2vw, 12px)',
                padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px)',
                fontFamily: '"Press Start 2P", monospace',
                textShadow: '2px 2px 0px #000000',
                boxShadow: activeTab === tab.id ? '4px 4px 0px #000000' : '2px 2px 0px #000000',
                transition: 'all 0.1s ease',
                flex: '1',
                minWidth: '120px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: '3px solid #ffffff',
          borderRadius: '0px',
          overflow: 'hidden',
          boxShadow: '6px 6px 0px rgba(0,0,0,0.5)'
        }}>
          {loading ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              fontSize: 'clamp(8px, 2vw, 12px)',
              color: '#7f8c8d'
            }}>
              Loading leaderboard... 🎮
            </div>
          ) : currentLeaderboard.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              fontSize: 'clamp(8px, 2vw, 12px)',
              color: '#7f8c8d'
            }}>
              No players found for {activeTab === 'daily' ? 'today' : 'all-time'} 📊
            </div>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
              {currentLeaderboard.map((player, index) => (
                <div
                  key={player.fid}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'clamp(12px, 3vw, 20px)',
                    borderBottom: index < currentLeaderboard.length - 1 ? '2px solid rgba(255, 255, 255, 0.2)' : 'none',
                    backgroundColor: index < 3 ? 
                      (index === 0 ? 'rgba(255, 215, 0, 0.1)' : // Gold
                       index === 1 ? 'rgba(192, 192, 192, 0.1)' : // Silver  
                       'rgba(205, 127, 50, 0.1)') : // Bronze
                      'transparent',
                    fontSize: 'clamp(8px, 2vw, 12px)',
                    minHeight: 'clamp(50px, 12vw, 80px)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 'clamp(10px, 3vw, 20px)' }}>
                    {/* Rank */}
                    <div style={{
                      fontSize: 'clamp(14px, 4vw, 24px)',
                      fontWeight: 'bold',
                      minWidth: 'clamp(40px, 10vw, 60px)',
                      color: index === 0 ? '#f1c40f' : 
                             index === 1 ? '#95a5a6' : 
                             index === 2 ? '#cd7f32' : 'white',
                      textShadow: '2px 2px 0px #000000'
                    }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>

                    {/* Profile Picture */}
                    {player.pfp_url && (
                      <img
                        src={player.pfp_url}
                        alt={`${player.display_name} avatar`}
                        style={{
                          width: 'clamp(30px, 8vw, 50px)',
                          height: 'clamp(30px, 8vw, 50px)',
                          borderRadius: '0px',
                          border: '2px solid #ffffff',
                          display: 'block'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}

                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'clamp(10px, 2.5vw, 14px)',
                        fontWeight: 'bold',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        marginBottom: '2px'
                      }}>
                        {player.display_name}
                      </div>
                      <div style={{
                        fontSize: 'clamp(7px, 1.8vw, 10px)',
                        color: '#7f8c8d',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}>
                        @{player.username}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{
                    textAlign: 'right',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '4px'
                  }}>
                    <div style={{
                      fontSize: 'clamp(10px, 2.5vw, 16px)',
                      fontWeight: 'bold'
                    }}>
                      {activeTab === 'daily' 
                        ? `${(player as any).bricks_placed_today || 0} 🧱` 
                        : `${player.bricks_placed.toLocaleString()} 🧱`
                      }
                    </div>
                    {player.current_streak > 0 && (
                      <div style={{
                        fontSize: 'clamp(7px, 2vw, 10px)',
                        color: '#e67e22'
                      }}>
                        {player.current_streak}🔥
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 'clamp(20px, 5vw, 40px)',
          fontSize: 'clamp(8px, 2vw, 12px)',
          color: '#7f8c8d',
          borderTop: '2px solid rgba(255, 255, 255, 0.2)',
          paddingTop: '20px'
        }}>
          🏗️ Keep building to climb the ranks! Every brick counts! 🏗️
        </div>
      </div>
    </div>
  );
}