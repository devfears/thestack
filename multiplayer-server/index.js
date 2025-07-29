const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable CORS for Express
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://localhost:8080", "https://strand-above-resume-office.trycloudflare.com"],
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 3002;

// Game state
const players = new Map(); // Store player data by socket ID (allows multiple tabs per user)
const disconnectionTimeouts = new Map(); // Store disconnection timeouts by socket ID
const gameState = {
  tower: [], // Array of placed bricks
  currentLayer: 0
};
const rooms = new Map(); // For future room-based multiplayer

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    players: players.size,
    bricks: gameState.tower.length,
    uptime: process.uptime()
  });
});

// Debug endpoint to clear all players
app.post('/debug/clear-players', (req, res) => {
  console.log('🧹 Clearing all players via debug endpoint');
  players.clear();
  disconnectionTimeouts.forEach(timeout => clearTimeout(timeout));
  disconnectionTimeouts.clear();
  io.emit('debug-clear-players');
  res.json({ 
    status: 'cleared', 
    players: players.size 
  });
});

// Debug endpoint to force sync all players
app.post('/debug/force-sync', (req, res) => {
  console.log('🔄 Force syncing all players via debug endpoint');
  const allPlayers = Array.from(players.values());
  
  // Send current players list to all connected clients
  io.emit('current-players', allPlayers);
  
  // Also send individual player updates
  allPlayers.forEach(player => {
    io.emit('player-update', player);
  });
  
  console.log(`📤 Sent sync data for ${allPlayers.length} players to all clients`);
  res.json({ 
    status: 'synced', 
    players: allPlayers.length,
    connectedSockets: io.sockets.sockets.size
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New connection from socket: ${socket.id}`);

  socket.on('player-join', (playerData) => {
    if (!playerData || !playerData.username) {
      console.warn(`⚠️ Player join from ${socket.id} missing username.`);
      return;
    }

    const { username } = playerData;
    console.log(`🔍 Player join attempt: ${username} (${socket.id}) with data:`, JSON.stringify(playerData, null, 2));
    
    // Check if this specific socket already has a player (shouldn't happen, but safety check)
    const existingPlayer = players.get(socket.id);
    if (existingPlayer) {
      console.log(`🔄 Socket ${socket.id} already has a player, updating data`);
      
      // Cancel any pending disconnection for this socket
      if (disconnectionTimeouts.has(socket.id)) {
        clearTimeout(disconnectionTimeouts.get(socket.id));
        disconnectionTimeouts.delete(socket.id);
        console.log(`🎉 Reconnection detected for socket ${socket.id}, removal canceled.`);
      }
      
      // Update existing player data
      Object.assign(existingPlayer, playerData);
      existingPlayer.id = socket.id; // Ensure socket ID is correct
      
      // Send current state to reconnecting player
      const allPlayers = Array.from(players.values());
      socket.emit('current-players', allPlayers);
      socket.emit('game-state', gameState);
      
      // Notify others of the reconnection
      socket.broadcast.emit('player-update', existingPlayer);
      return;
    }

    // Create new player entry using socket ID as key (allows multiple tabs per user)
    const newPlayerData = {
      ...playerData,
      id: socket.id, // The current socket ID
      fid: playerData.fid,
      position: { x: Math.random() * 6 - 3, y: 0, z: Math.random() * 6 - 3 }
    };
    players.set(socket.id, newPlayerData); // Use socket ID as key instead of username
    console.log(`✨ New player ${username} (${socket.id}) joined. Total players: ${players.size}`);

    // Store username on socket for reference (but don't use as primary key)
    socket.username = username;
    
    // Send the full, current list of players to every client
    const allPlayers = Array.from(players.values());
    
    // Use a small delay to prevent race conditions with rapid connections
    setTimeout(() => {
      io.emit('current-players', allPlayers);
      console.log(`📤 Sent updated player list (${allPlayers.length} players) to all clients.`);
    }, 100);

    // Send the current game state
    socket.emit('game-state', gameState);
    

  });

  // Rate limiting for position updates
  const updateRateLimits = new Map(); // Track last update time per player
  const UPDATE_THROTTLE_MS = 16; // ~60fps max update rate
  
  socket.on('player-update', (playerData) => {
    if (!playerData || !playerData.username) {
      console.warn(`⚠️ Player update from ${socket.id} missing username.`);
      return;
    }

    const existingPlayer = players.get(socket.id); // Use socket ID to find player
    const now = Date.now();
    
    // Rate limiting - only log significant updates
    const lastUpdate = updateRateLimits.get(socket.id) || 0;
    const shouldThrottle = (now - lastUpdate) < UPDATE_THROTTLE_MS;
    
    if (shouldThrottle && existingPlayer) {
      // Silently update without logging for frequent position updates
      const previousPosition = existingPlayer.position ? { ...existingPlayer.position } : { x: 0, y: 0, z: 0 };
      Object.assign(existingPlayer, playerData);
      existingPlayer.id = socket.id; // Ensure socket ID stays correct
      existingPlayer.lastUpdate = now;
      
      // Calculate movement for animation hints
      if (previousPosition && playerData.position) {
        const movement = Math.sqrt(
          Math.pow(playerData.position.x - previousPosition.x, 2) +
          Math.pow(playerData.position.z - previousPosition.z, 2)
        );
        existingPlayer.isMoving = movement > 0.01;
      }
      
      socket.broadcast.emit('player-update', existingPlayer);
      return;
    }
    
    updateRateLimits.set(socket.id, now);

    if (existingPlayer) {
      // Update player data
      const previousPosition = existingPlayer.position ? { ...existingPlayer.position } : { x: 0, y: 0, z: 0 };
      Object.assign(existingPlayer, playerData);
      existingPlayer.id = socket.id; // Ensure socket ID stays correct
      existingPlayer.lastUpdate = now;
      
      // Calculate movement for animation hints
      if (previousPosition && playerData.position) {
        const movement = Math.sqrt(
          Math.pow(playerData.position.x - previousPosition.x, 2) +
          Math.pow(playerData.position.z - previousPosition.z, 2)
        );
        existingPlayer.isMoving = movement > 0.01;
        
        // Only log significant movements
        if (movement > 0.5) {
          console.log(`🔄 Player update from ${playerData.username} (${socket.id}): position [${playerData.position?.x?.toFixed(2)}, ${playerData.position?.y?.toFixed(2)}, ${playerData.position?.z?.toFixed(2)}] movement: ${movement.toFixed(2)}`);
        }
      }
      
      // Broadcast the update to other players
      socket.broadcast.emit('player-update', existingPlayer);

    } else {
      console.warn(`⚠️ Player update for unknown socket ${socket.id} (username: ${playerData.username})`);
      console.log('Available players:', Array.from(players.keys()));
    }
  });

  // Handle chat messages
  socket.on('chat-message', (message) => {
    console.log(`💬 Received chat message from ${socket.id}:`, message);
    
    // Find player by socket ID
    const player = players.get(socket.id);
    
    if (player) {
      console.log(`💬 Chat from ${player.displayName}: ${message.text}`);
      // Broadcast to all players including sender
      io.emit('chat-message', message);
      console.log(`📤 Chat message broadcasted to all ${players.size} players`);
    } else {
      console.warn(`⚠️ Chat message from unknown socket: ${socket.id}`);
      console.log('Available players:', Array.from(players.keys()));
      
      // Still broadcast the message even if player not found in our records
      io.emit('chat-message', message);
      console.log(`📤 Chat message broadcasted anyway`);
    }
  });

  // Handle brick placement
  socket.on('brick-placed', (brickData) => {
    // Find player by socket ID
    const player = players.get(socket.id);
    
    if (player) {
      console.log(`🧱 Brick placed by ${player.displayName}:`, brickData);
      
      // Add brick to game state
      gameState.tower.push({
        ...brickData,
        playerId: socket.id,
        playerName: player.displayName,
        timestamp: Date.now()
      });
      
      // Update current layer if necessary
      if (brickData.gridPosition && brickData.gridPosition.layer > gameState.currentLayer) {
        gameState.currentLayer = brickData.gridPosition.layer;
      }
      
      // Broadcast to all players including sender for consistency
      io.emit('brick-placed', {
        ...brickData,
        playerId: socket.id,
        playerName: player.displayName,
        timestamp: Date.now()
      });
    } else {
      console.warn(`⚠️ Brick placement from unknown socket: ${socket.id}`);
    }
  });

  // Handle brick pickup (for inventory sync)
  socket.on('brick-picked-up', (data) => {
    // Find player by socket ID
    const player = players.get(socket.id);
    
    if (player) {
      console.log(`🤏 Brick picked up by ${player.displayName}`);
      socket.broadcast.emit('brick-picked-up', {
        playerId: socket.id,
        playerName: player.displayName,
        ...data
      });
    } else {
      console.warn(`⚠️ Brick pickup from unknown socket: ${socket.id}`);
    }
  });

  // Handle clear all bricks
  socket.on('clear-all-bricks', (data) => {
    // Find player by socket ID
    const player = players.get(socket.id);
    
    if (player) {
      console.log(`🧹 Clear all bricks requested by ${player.displayName}`);
      
      // Clear the server's game state
      gameState.tower = [];
      gameState.currentLayer = 0;
      
      // Broadcast to all players including sender for consistency
      io.emit('clear-all-bricks', {
        playerId: socket.id,
        playerName: player.displayName,
        timestamp: Date.now()
      });
      
      console.log(`✅ All bricks cleared by ${player.displayName}, broadcasted to all players`);
    } else {
      console.warn(`⚠️ Clear all bricks from unknown socket: ${socket.id}`);
    }
  });

  // Handle player disconnection
  socket.on('disconnect', (reason) => {
    console.log(`👋 Socket ${socket.id} disconnected. Reason: ${reason}`);
    
    const player = players.get(socket.id);
    if (player) {
      console.log(`🔍 Player ${player.displayName} (${socket.id}) disconnected`);
      
      // For page refresh/close, remove immediately for better UX
      if (reason === 'transport close' || reason === 'client namespace disconnect') {
        players.delete(socket.id);
        
        // Send the updated player list to all clients
        io.emit('current-players', Array.from(players.values()));
        console.log(`🗑️ Player ${player.displayName} (${socket.id}) removed immediately (${reason}). Sent updated list. Total players: ${players.size}`);
        return;
      }
      
      // For other disconnections, use a very short timeout
      const timeoutId = setTimeout(() => {
        if (players.has(socket.id)) {
          const playerToRemove = players.get(socket.id);
          players.delete(socket.id);
          
          // Send the updated player list to all clients
          io.emit('current-players', Array.from(players.values()));
          console.log(`🗑️ Player ${playerToRemove.displayName} (${socket.id}) fully removed after timeout. Sent updated list. Total players: ${players.size}`);
          disconnectionTimeouts.delete(socket.id);
        } else {
          console.log(`🔄 Socket ${socket.id} reconnected before timeout, keeping player data.`);
        }
      }, 200); // Very short 200ms timeout for real-time feel

      disconnectionTimeouts.set(socket.id, timeoutId);
      console.log(`⏰ Set 200ms removal timeout for ${socket.id}`);
    } else {
      console.log(`❓ Socket ${socket.id} disconnected without a registered player.`);
    }
  });

  // Handle heartbeat to keep connections active
  socket.on('heartbeat', (data) => {
    // Simply acknowledge the heartbeat - this keeps the connection active
    socket.emit('heartbeat-ack', { timestamp: Date.now() });
  });

  // Handle force sync request
  socket.on('request-force-sync', (data) => {
    const player = players.get(socket.id);
    const playerName = player ? player.displayName : socket.id;
    console.log(`🔄 Force sync requested by ${playerName} (${socket.id})`);
    
    const allPlayers = Array.from(players.values());
    
    // Send current players list to the requesting client
    socket.emit('current-players', allPlayers);
    
    // Also send individual player updates for all other players
    allPlayers.forEach(player => {
      if (player.id !== socket.id) {
        socket.emit('player-update', player);
      }
    });
    
    console.log(`📤 Sent force sync data for ${allPlayers.length} players to ${playerName}`);
  });

  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`🚨 Socket error for ${socket.id}:`, error);
  });
});

// Periodic sync to ensure all clients stay synchronized
setInterval(() => {
  if (players.size > 0) {
    const allPlayers = Array.from(players.values());
    io.emit('sync-players', allPlayers);
    console.log(`🔄 Periodic sync: ${allPlayers.length} players to ${io.sockets.sockets.size} clients`);
  }
}, 5000); // Sync every 5 seconds

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Multiplayer server running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: http://localhost:5173, http://localhost:5174, http://localhost:3000, http://localhost:8080, https://strand-above-resume-office.trycloudflare.com`);
  console.log(`🎮 Ready for player connections!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});