const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const BrickPersistenceManager = require('./BrickPersistenceManager');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,  // 60 seconds before timeout
  pingInterval: 25000, // Send ping every 25 seconds
  connectTimeout: 45000 // 45 seconds connection timeout
});

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:4173"],
  credentials: true
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

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('player-join', (playerData) => {
    if (!playerData?.username) return;
    
    const newPlayer = {
      ...playerData,
      id: socket.id,
      position: { x: Math.random() * 6 - 3, y: 0, z: Math.random() * 6 - 3 }
    };
    players.set(socket.id, newPlayer);
    
    console.log(`Player joined: ${playerData.username} (${socket.id})`);
    console.log(`Total players now: ${players.size}`);
    
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

  socket.on('brick-placed', (brickData) => {
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

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS: localhost:5173, localhost:4173`);
  console.log(`🎮 Ready for connections!`);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  console.log('💾 Saving final tower state...');
  brickManager.saveTowerState();
  server.close(() => process.exit(0));
});
