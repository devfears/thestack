const { Pool } = require('pg');
require('dotenv').config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual environment variables if DATABASE_URL is not set
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'thestack_dev',
  user: process.env.DB_USER || 'thestack_user',
  password: process.env.DB_PASSWORD,
  // Connection pool settings
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('🗄️  Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('💥 Database connection error:', err);
});

/**
 * Execute a query with error handling
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executed', { text: text.substring(0, 50) + '...', duration: `${duration}ms`, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('💥 Database query error:', error);
    throw error;
  }
}

/**
 * Initialize database schema
 */
async function initializeDatabase() {
  console.log('🔨 Initializing database schema...');
  
  try {
    // Create players table
    await query(`
      CREATE TABLE IF NOT EXISTS players (
        fid BIGINT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        pfp_url TEXT,
        first_seen TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for players table
    await query('CREATE INDEX IF NOT EXISTS idx_players_username ON players(username)');
    await query('CREATE INDEX IF NOT EXISTS idx_players_last_active ON players(last_active)');

    // Create player_stats table
    await query(`
      CREATE TABLE IF NOT EXISTS player_stats (
        fid BIGINT PRIMARY KEY REFERENCES players(fid) ON DELETE CASCADE,
        bricks_placed INTEGER DEFAULT 0,
        bricks_picked_up INTEGER DEFAULT 0,
        layers_contributed INTEGER DEFAULT 0,
        building_sessions INTEGER DEFAULT 0,
        total_play_time INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        last_build_date DATE,
        achievements JSONB DEFAULT '{}',
        rank_position INTEGER,
        rank_change INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for player_stats table
    await query('CREATE INDEX IF NOT EXISTS idx_player_stats_bricks_placed ON player_stats(bricks_placed DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_player_stats_current_streak ON player_stats(current_streak DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_player_stats_best_streak ON player_stats(best_streak DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_player_stats_rank ON player_stats(rank_position)');

    // Create daily_activity table
    await query(`
      CREATE TABLE IF NOT EXISTS daily_activity (
        id SERIAL PRIMARY KEY,
        fid BIGINT REFERENCES players(fid) ON DELETE CASCADE,
        activity_date DATE NOT NULL,
        bricks_placed_today INTEGER DEFAULT 0,
        bricks_picked_today INTEGER DEFAULT 0,
        session_count INTEGER DEFAULT 0,
        play_time_today INTEGER DEFAULT 0,
        daily_achievements JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(fid, activity_date)
      )
    `);

    // Create indexes for daily_activity table
    await query('CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(activity_date DESC)');
    await query('CREATE INDEX IF NOT EXISTS idx_daily_activity_fid_date ON daily_activity(fid, activity_date)');
    await query('CREATE INDEX IF NOT EXISTS idx_daily_activity_bricks_today ON daily_activity(activity_date, bricks_placed_today DESC)');

    // Create achievements table
    await query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        achievement_key VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        icon_url TEXT,
        category VARCHAR(50) NOT NULL,
        requirements JSONB NOT NULL,
        rarity VARCHAR(20) DEFAULT 'common',
        points INTEGER DEFAULT 0,
        is_hidden BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create player_achievements table
    await query(`
      CREATE TABLE IF NOT EXISTS player_achievements (
        id SERIAL PRIMARY KEY,
        fid BIGINT REFERENCES players(fid) ON DELETE CASCADE,
        achievement_key VARCHAR(100) REFERENCES achievements(achievement_key),
        unlocked_at TIMESTAMP DEFAULT NOW(),
        brick_count_when_unlocked INTEGER,
        layer_when_unlocked INTEGER,
        shared_to_farcaster BOOLEAN DEFAULT FALSE,
        share_cast_hash VARCHAR(255),
        UNIQUE(fid, achievement_key)
      )
    `);

    // Create indexes for player_achievements table
    await query('CREATE INDEX IF NOT EXISTS idx_player_achievements_fid ON player_achievements(fid)');
    await query('CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked ON player_achievements(unlocked_at DESC)');

    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('💥 Failed to initialize database schema:', error);
    throw error;
  }
}

/**
 * Insert or update player information
 */
async function upsertPlayer(playerData) {
  const { fid, username, displayName, pfpUrl } = playerData;
  
  try {
    const result = await query(`
      INSERT INTO players (fid, username, display_name, pfp_url, last_active, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (fid) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        pfp_url = EXCLUDED.pfp_url,
        last_active = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [fid, username, displayName, pfpUrl]);

    // Also ensure player_stats record exists
    await query(`
      INSERT INTO player_stats (fid)
      VALUES ($1)
      ON CONFLICT (fid) DO NOTHING
    `, [fid]);

    return result.rows[0];
  } catch (error) {
    console.error('💥 Error upserting player:', error);
    throw error;
  }
}

/**
 * Update player stats when brick is placed
 */
async function updatePlayerStats(fid, brickPlaced = true) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Update player_stats
    await query(`
      UPDATE player_stats 
      SET 
        bricks_placed = bricks_placed + $2,
        updated_at = NOW()
      WHERE fid = $1
    `, [fid, brickPlaced ? 1 : 0]);

    // Update or create daily_activity record
    await query(`
      INSERT INTO daily_activity (fid, activity_date, bricks_placed_today, session_count, updated_at)
      VALUES ($1, $2, $3, 1, NOW())
      ON CONFLICT (fid, activity_date) DO UPDATE SET
        bricks_placed_today = daily_activity.bricks_placed_today + $3,
        updated_at = NOW()
    `, [fid, today, brickPlaced ? 1 : 0]);

    console.log(`📊 Updated stats for player ${fid}: +${brickPlaced ? 1 : 0} bricks`);
  } catch (error) {
    console.error('💥 Error updating player stats:', error);
    throw error;
  }
}

/**
 * Get leaderboard data
 */
async function getLeaderboard(limit = 50) {
  try {
    const result = await query(`
      SELECT 
        p.fid,
        p.username,
        p.display_name,
        p.pfp_url,
        ps.bricks_placed,
        ps.current_streak,
        ps.best_streak,
        ps.rank_position,
        ps.last_build_date
      FROM players p
      JOIN player_stats ps ON p.fid = ps.fid
      ORDER BY ps.bricks_placed DESC, p.display_name ASC
      LIMIT $1
    `, [limit]);

    return result.rows;
  } catch (error) {
    console.error('💥 Error getting leaderboard:', error);
    throw error;
  }
}

/**
 * Get daily leaderboard
 */
async function getDailyLeaderboard(limit = 50) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await query(`
      SELECT 
        p.fid,
        p.username,
        p.display_name,
        p.pfp_url,
        da.bricks_placed_today,
        ps.bricks_placed as total_bricks
      FROM players p
      JOIN daily_activity da ON p.fid = da.fid
      JOIN player_stats ps ON p.fid = ps.fid
      WHERE da.activity_date = $1 AND da.bricks_placed_today > 0
      ORDER BY da.bricks_placed_today DESC, p.display_name ASC
      LIMIT $2
    `, [today, limit]);

    return result.rows;
  } catch (error) {
    console.error('💥 Error getting daily leaderboard:', error);
    throw error;
  }
}

/**
 * Get player stats by FID
 */
async function getPlayerStats(fid) {
  try {
    const result = await query(`
      SELECT 
        p.fid,
        p.username,
        p.display_name,
        p.pfp_url,
        ps.bricks_placed,
        ps.current_streak,
        ps.best_streak,
        ps.rank_position,
        ps.last_build_date,
        ps.building_sessions,
        ps.total_play_time
      FROM players p
      JOIN player_stats ps ON p.fid = ps.fid
      WHERE p.fid = $1
    `, [fid]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('💥 Error getting player stats:', error);
    throw error;
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('🎯 Database connection test successful:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('💥 Database connection test failed:', error);
    return false;
  }
}

module.exports = {
  pool,
  query,
  initializeDatabase,
  upsertPlayer,
  updatePlayerStats,
  getLeaderboard,
  getDailyLeaderboard,
  getPlayerStats,
  testConnection
};