const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const BrickPersistenceManager = require('./BrickPersistenceManager');
const { 
  getGlobalLeaderboard, 
  getPlayerStats, 
  updatePlayerBrickStats, 
  getDailyLeaderboard, 
  getPlayerAchievements, 
  checkAndUnlockAchievements,
  testConnection 
} = require('./supabaseClient');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173", 
      "http://localhost:4173", 
      "http://localhost:5174",
      "https://thestackgame.netlify.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,  // 60 seconds before timeout
  pingInterval: 25000, // Send ping every 25 seconds
  connectTimeout: 45000 // 45 seconds connection timeout
});

// More permissive CORS configuration for development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:4173', 
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://thestackgame.netlify.app'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // For legacy browser support
}));

app.use(express.json());

const PORT = process.env.PORT || 3002;

const players = new Map();
const brickManager = new BrickPersistenceManager();

app.get('/health', (req, res) => {
  const currentState = brickManager.getCurrentState();
  res.json({ 
    status: 'ok', 
    players: players.size,
    bricks: currentState.tower.length,
    currentLayer: currentState.currentLayer,
    uptime: process.uptime(),
    lastUpdated: currentState.lastUpdated
  });
});

// Add CORS headers middleware for API routes
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Tower management API endpoints
app.post('/api/tower/clear', (req, res) => {
  try {
    // Clear the tower state
    const clearedBricks = brickManager.getTowerState().tower.length;
    
    // Update in-memory state
    brickManager.clearTower();
    
    // Broadcast to all connected clients
    io.emit('tower-cleared');
    
    console.log(`🧹 Tower cleared via API - removed ${clearedBricks} bricks`);
    res.json({ 
      success: true, 
      message: 'Tower cleared successfully',
      bricksRemoved: clearedBricks
    });
  } catch (error) {
    console.error('Error clearing tower:', error);
    res.status(500).json({ error: 'Failed to clear tower' });
  }
});

// Leaderboard API endpoints
app.get('/api/leaderboard/global', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const leaderboard = await getGlobalLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting global leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

app.get('/api/leaderboard/daily', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const leaderboard = await getDailyLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting daily leaderboard:', error);
    res.status(500).json({ error: 'Failed to get daily leaderboard' });
  }
});

app.get('/api/player/:fid/stats', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    const stats = await getPlayerStats(fid);
    if (stats) {
      res.json(stats);
    } else {
      res.status(404).json({ error: 'Player not found' });
    }
  } catch (error) {
    console.error('Error getting player stats:', error);
    res.status(500).json({ error: 'Failed to get player stats' });
  }
});

// Player achievements endpoint
app.get('/api/player/:fid/achievements', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    const achievements = await getPlayerAchievements(fid);
    res.json(achievements);
  } catch (error) {
    console.error('Error getting player achievements:', error);
    res.status(500).json({ error: 'Failed to get player achievements' });
  }
});

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('player-join', async (playerData) => {
    if (!playerData?.username) return;
    
    const newPlayer = {
      ...playerData,
      id: socket.id,
      position: { x: Math.random() * 6 - 3, y: 0, z: Math.random() * 6 - 3 }
    };
    players.set(socket.id, newPlayer);
    
    console.log(`Player joined: ${playerData.username} (${socket.id})`);
    console.log(`Total players now: ${players.size}`);
    
    // Update player in database using Supabase
    try {
      await updatePlayerBrickStats(
        playerData.fid, 
        playerData.username, 
        playerData.displayName, 
        playerData.pfpUrl, 
        0 // 0 bricks for initial connection
      );
      console.log(`📊 Player ${playerData.displayName} updated in database`);
    } catch (error) {
      console.error('💥 Failed to update player in database:', error);
    }
    
    // Emit to all clients including the new player
    io.emit('current-players', Array.from(players.values()));
    socket.emit('game-state', brickManager.getCurrentState());
    
    // Emit player count update
    io.emit('player-count-update', { count: players.size });
  });

  socket.on('player-update', (playerData) => {
    const player = players.get(socket.id);
    if (player) {
      Object.assign(player, playerData);
      player.id = socket.id;
      socket.broadcast.emit('player-update', player);
    }
  });

  socket.on('chat-message', (message) => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`Chat from ${player.displayName}: ${message.text}`);
      io.emit('chat-message', message);
    }
  });

  socket.on('brick-placed', async (brickData) => {
    const player = players.get(socket.id);
    if (player) {
      // Use persistence manager to add brick with deduplication
      const success = brickManager.addBrick(brickData, socket.id, player.displayName);
      
      if (success) {
        // Get the enhanced brick data from the manager
        const currentState = brickManager.getCurrentState();
        const placedBrick = currentState.tower[currentState.tower.length - 1];
        
        console.log(`✅ Brick placed by ${player.displayName} at:`, placedBrick.gridPosition);
        console.log(`📊 Total bricks in tower: ${currentState.tower.length}`);
        
        // Update player stats in database
        try {
          await updatePlayerBrickStats(
            player.fid, 
            player.username, 
            player.displayName, 
            player.pfpUrl, 
            1
          );
          console.log(`📊 Updated database stats for ${player.displayName}`);
          
          // Check for new achievements
          const newAchievements = await checkAndUnlockAchievements(player.fid);
          if (newAchievements.length > 0) {
            socket.emit('achievements-unlocked', newAchievements);
            console.log(`🏆 ${newAchievements.length} new achievements unlocked for ${player.displayName}`);
          }
        } catch (error) {
          console.error('💥 Failed to update player stats in database:', error);
        }
        
        // Emit to all clients including the sender (for validation)
        io.emit('brick-placed', placedBrick);
        
        console.log(`🌐 Brick placement broadcasted to all ${players.size} players`);
      } else {
        console.log(`🚫 Brick placement rejected (duplicate) from ${player.displayName}`);
        // Optionally notify the player that their brick was rejected
        socket.emit('brick-rejected', { reason: 'duplicate', gridPosition: brickData.gridPosition });
      }
    } else {
      console.error(`❌ Player not found for socket ${socket.id} when placing brick`);
    }
  });

  // Handle heartbeat from clients
  socket.on('heartbeat', (data) => {
    socket.emit('heartbeat-ack', { timestamp: Date.now() });
  });

  // Handle player sync requests (for tab switching)
  socket.on('request-player-sync', () => {
    console.log(`🔄 Player sync requested by ${socket.id}`);
    // Send current players list to requesting client
    socket.emit('current-players', Array.from(players.values()));
  });

  // Handle force sync requests
  socket.on('request-force-sync', (data) => {
    console.log(`🔄 Force sync requested by ${socket.id}`);
    socket.emit('game-state', brickManager.getCurrentState());
    socket.emit('current-players', Array.from(players.values()));
  });

  // Handle clear all bricks
  socket.on('clear-all-bricks', (data) => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`🧹 Clear all bricks requested by ${player.displayName}`);
      brickManager.clearAllBricks(socket.id, player.displayName);
      io.emit('clear-all-bricks', { playerName: player.displayName });
    }
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`Player disconnected: ${player.displayName}`);
      players.delete(socket.id);
      console.log(`Total players now: ${players.size}`);
      
      // Emit to remaining clients
      io.emit('current-players', Array.from(players.values()));
      
      // Emit player count update
      io.emit('player-count-update', { count: players.size });
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed - running without database features');
    } else {
      // Using Supabase - no local database initialization needed
      console.log('✅ Database connection verified - using Supabase');
    }
  } catch (error) {
    console.warn('⚠️  Database initialization failed - running without database features:', error.message);
  }

  // Start the server
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 CORS: localhost:5173, localhost:4173, localhost:5174, thestackgame.netlify.app`);
    console.log(`🎮 Ready for connections!`);
  });
}

startServer();

process.on('SIGINT', () => {
  console.log('Shutting down...');
  console.log('💾 Saving final tower state...');
  brickManager.saveTowerState();
  server.close(() => process.exit(0));
});
