-- 🗄️ The Stack - Supabase Database Migration
-- Adapted from DATABASE_SCHEMA.md for Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
DO $$ BEGIN
    CREATE TYPE rarity_type AS ENUM ('common', 'rare', 'epic', 'legendary');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE snapshot_type AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE share_type AS ENUM ('rank', 'achievement', 'milestone', 'streak');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Players Table
CREATE TABLE IF NOT EXISTS players (
    fid BIGINT PRIMARY KEY,                    -- Farcaster ID (unique identifier)
    username VARCHAR(255) NOT NULL,           -- @username from Farcaster
    display_name VARCHAR(255) NOT NULL,       -- Display name from Farcaster
    pfp_url TEXT,                             -- Profile picture URL
    first_seen TIMESTAMP DEFAULT NOW(),       -- When player first joined
    last_active TIMESTAMP DEFAULT NOW(),      -- Last activity timestamp
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for players
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_last_active ON players(last_active);

-- 2. Player Stats Table
CREATE TABLE IF NOT EXISTS player_stats (
    fid BIGINT PRIMARY KEY REFERENCES players(fid) ON DELETE CASCADE,
    
    -- Core Building Metrics
    bricks_placed INTEGER DEFAULT 0,          -- Total bricks placed in tower
    bricks_picked_up INTEGER DEFAULT 0,       -- Total bricks picked up
    layers_contributed INTEGER DEFAULT 0,      -- Number of different layers built on
    
    -- Session & Engagement Metrics
    building_sessions INTEGER DEFAULT 0,       -- Number of times player connected
    total_play_time INTEGER DEFAULT 0,        -- Total seconds spent building
    
    -- Streak System
    current_streak INTEGER DEFAULT 0,         -- Current consecutive building days
    best_streak INTEGER DEFAULT 0,            -- Longest consecutive days ever
    last_build_date DATE,                     -- Last day player built (for streaks)
    
    -- Achievement System
    achievements JSONB DEFAULT '{}',          -- Flexible achievements storage
    
    -- Computed Fields (updated via triggers)
    rank_position INTEGER,                    -- Current leaderboard rank
    rank_change INTEGER DEFAULT 0,            -- Change from previous day
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_player_stats_bricks_placed ON player_stats(bricks_placed DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_current_streak ON player_stats(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_best_streak ON player_stats(best_streak DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_rank ON player_stats(rank_position);

-- 3. Daily Activity Table
CREATE TABLE IF NOT EXISTS daily_activity (
    id SERIAL PRIMARY KEY,
    fid BIGINT REFERENCES players(fid) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    
    -- Daily Metrics
    bricks_placed_today INTEGER DEFAULT 0,
    bricks_picked_today INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,          -- Sessions today
    play_time_today INTEGER DEFAULT 0,        -- Seconds played today
    
    -- Daily Achievements
    daily_achievements JSONB DEFAULT '[]',    -- Achievements earned today
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint: one record per player per day
    UNIQUE(fid, activity_date)
);

-- Indexes for daily queries
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activity_fid_date ON daily_activity(fid, activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_activity_bricks_today ON daily_activity(activity_date, bricks_placed_today DESC);

-- 4. Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    achievement_key VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'first_brick', 'streak_7'
    name VARCHAR(255) NOT NULL,                    -- Display name
    description TEXT NOT NULL,                     -- Achievement description
    icon_url TEXT,                                 -- Achievement icon
    category VARCHAR(50) NOT NULL,                -- 'building', 'streak', 'milestone', 'special'
    
    -- Requirements (JSON for flexibility)
    requirements JSONB NOT NULL,                  -- e.g., {"bricks_placed": 100}
    
    -- Rarity and Display
    rarity rarity_type DEFAULT 'common',
    points INTEGER DEFAULT 0,                     -- Achievement points
    is_hidden BOOLEAN DEFAULT FALSE,              -- Hidden until unlocked
    is_active BOOLEAN DEFAULT TRUE,               -- Can be earned
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Player Achievements Table
CREATE TABLE IF NOT EXISTS player_achievements (
    id SERIAL PRIMARY KEY,
    fid BIGINT REFERENCES players(fid) ON DELETE CASCADE,
    achievement_key VARCHAR(100) REFERENCES achievements(achievement_key),
    
    -- Achievement context
    unlocked_at TIMESTAMP DEFAULT NOW(),
    brick_count_when_unlocked INTEGER,         -- For milestone context
    layer_when_unlocked INTEGER,              -- For layer-specific achievements
    
    -- Social sharing
    shared_to_farcaster BOOLEAN DEFAULT FALSE,
    share_cast_hash VARCHAR(255),             -- If shared, store cast hash
    
    UNIQUE(fid, achievement_key)
);

-- Indexes for player achievements
CREATE INDEX IF NOT EXISTS idx_player_achievements_fid ON player_achievements(fid);
CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked ON player_achievements(unlocked_at DESC);

-- 6. Leaderboard Snapshots Table
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    snapshot_type snapshot_type NOT NULL,
    
    -- Leaderboard data
    leaderboard_data JSONB NOT NULL,          -- Full leaderboard as JSON
    total_players INTEGER NOT NULL,
    total_bricks INTEGER NOT NULL,
    current_layer INTEGER NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(snapshot_date, snapshot_type)
);

-- Index for historical queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_date_type ON leaderboard_snapshots(snapshot_date DESC, snapshot_type);

-- 7. Social Shares Table
CREATE TABLE IF NOT EXISTS social_shares (
    id SERIAL PRIMARY KEY,
    fid BIGINT REFERENCES players(fid),
    share_type share_type,
    content_data JSONB,                       -- What was shared
    platform VARCHAR(50) DEFAULT 'farcaster',
    cast_hash VARCHAR(255),                   -- Farcaster cast hash
    shared_at TIMESTAMP DEFAULT NOW()
);

-- Database Functions

-- Calculate Streak Function
CREATE OR REPLACE FUNCTION calculate_streak(player_fid BIGINT, build_date DATE)
RETURNS INTEGER AS $$
DECLARE
    yesterday_built BOOLEAN;
    current_streak_count INTEGER;
BEGIN
    -- Check if player built yesterday
    SELECT EXISTS(
        SELECT 1 FROM daily_activity 
        WHERE fid = player_fid 
        AND activity_date = build_date - INTERVAL '1 day'
        AND bricks_placed_today > 0
    ) INTO yesterday_built;
    
    -- Get current streak
    SELECT current_streak INTO current_streak_count
    FROM player_stats WHERE fid = player_fid;
    
    -- Handle NULL case (new player)
    IF current_streak_count IS NULL THEN
        current_streak_count := 0;
    END IF;
    
    -- Update streak logic
    IF yesterday_built THEN
        -- Continue streak
        current_streak_count := current_streak_count + 1;
    ELSE
        -- Reset streak
        current_streak_count := 1;
    END IF;
    
    -- Update player stats
    UPDATE player_stats 
    SET 
        current_streak = current_streak_count,
        best_streak = GREATEST(best_streak, current_streak_count),
        last_build_date = build_date,
        updated_at = NOW()
    WHERE fid = player_fid;
    
    RETURN current_streak_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample achievements data
INSERT INTO achievements (achievement_key, name, description, category, requirements, rarity, points) VALUES
('first_brick', 'First Builder', 'Place your first brick in The Stack', 'building', '{"bricks_placed": 1}', 'common', 10),
('century_club', 'Century Club', 'Place 100 bricks in The Stack', 'milestone', '{"bricks_placed": 100}', 'rare', 100),
('streak_7', 'Week Warrior', 'Build for 7 consecutive days', 'streak', '{"current_streak": 7}', 'rare', 150),
('layer_pioneer', 'Layer Pioneer', 'Be first to complete a layer', 'special', '{}', 'epic', 500),
('thousand_club', 'Master Builder', 'Place 1000 bricks in The Stack', 'milestone', '{"bricks_placed": 1000}', 'legendary', 1000),
('brick_collector', 'Brick Collector', 'Pick up 50 bricks', 'building', '{"bricks_picked_up": 50}', 'common', 25),
('speed_builder', 'Speed Builder', 'Place 10 bricks in one session', 'building', '{"session_bricks": 10}', 'common', 50),
('streak_30', 'Monthly Devotee', 'Build for 30 consecutive days', 'streak', '{"current_streak": 30}', 'epic', 300),
('community_helper', 'Community Helper', 'Participate in 5 different layers', 'building', '{"layers_contributed": 5}', 'rare', 75)
ON CONFLICT (achievement_key) DO NOTHING;

-- Create a view for easy leaderboard queries
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT 
    p.fid,
    p.username,
    p.display_name,
    p.pfp_url,
    ps.bricks_placed,
    ps.current_streak,
    ps.best_streak,
    ps.rank_position,
    ps.rank_change,
    ps.building_sessions,
    ps.layers_contributed,
    p.last_active
FROM players p
LEFT JOIN player_stats ps ON p.fid = ps.fid
ORDER BY ps.bricks_placed DESC NULLS LAST;

-- Function to update player stats (called from application)
CREATE OR REPLACE FUNCTION update_player_brick_stats(
    player_fid BIGINT,
    bricks_delta INTEGER DEFAULT 1,
    layer_number INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
BEGIN
    -- Ensure player exists in player_stats
    INSERT INTO player_stats (fid, bricks_placed, layers_contributed, building_sessions, updated_at)
    VALUES (player_fid, 0, 0, 0, NOW())
    ON CONFLICT (fid) DO NOTHING;
    
    -- Update player stats
    UPDATE player_stats 
    SET 
        bricks_placed = bricks_placed + bricks_delta,
        updated_at = NOW()
    WHERE fid = player_fid;
    
    -- Update or create daily activity
    INSERT INTO daily_activity (fid, activity_date, bricks_placed_today)
    VALUES (player_fid, today_date, bricks_delta)
    ON CONFLICT (fid, activity_date) 
    DO UPDATE SET 
        bricks_placed_today = daily_activity.bricks_placed_today + bricks_delta,
        updated_at = NOW();
    
    -- Update streak
    PERFORM calculate_streak(player_fid, today_date);
    
    -- Update last active in players table
    UPDATE players 
    SET last_active = NOW()
    WHERE fid = player_fid;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_fid ON players(fid);
CREATE INDEX IF NOT EXISTS idx_player_stats_fid ON player_stats(fid);
CREATE INDEX IF NOT EXISTS idx_daily_activity_combined ON daily_activity(fid, activity_date, bricks_placed_today);

-- Enable Row Level Security (RLS) for better security (optional)
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
-- CREATE POLICY "Players can view all profiles" ON players FOR SELECT USING (true);
-- CREATE POLICY "Players can update own profile" ON players FOR UPDATE USING (auth.uid()::text = fid::text);

COMMIT;