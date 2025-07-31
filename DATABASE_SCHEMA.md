# 🗄️ The Stack - Database Schema & Leaderboard Implementation

## Overview
This document outlines the complete database schema and leaderboard system for The Stack - a multiplayer Farcaster miniapp where users collaboratively build a community tower.

## Database Choice: Fly.io PostgreSQL

### Why Fly.io PostgreSQL
- **No Write Limits**: Unlike Vercel Postgres, no restrictions on database writes
- **Same Infrastructure**: Database and multiplayer server on same platform
- **Low Latency**: Sub-1ms queries between server and database
- **Cost Effective**: ~$3/month vs Vercel's $20/month minimum
- **Private Networking**: Secure internal communication
- **Unified Deployment**: Single platform for backend and database

## Core Database Schema

### 1. Players Table
Stores Farcaster user information and profile data.

```sql
CREATE TABLE players (
    fid BIGINT PRIMARY KEY,                    -- Farcaster ID (unique identifier)
    username VARCHAR(255) NOT NULL,           -- @username from Farcaster
    display_name VARCHAR(255) NOT NULL,       -- Display name from Farcaster
    pfp_url TEXT,                             -- Profile picture URL
    first_seen TIMESTAMP DEFAULT NOW(),       -- When player first joined
    last_active TIMESTAMP DEFAULT NOW(),      -- Last activity timestamp
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_last_active ON players(last_active);
```

### 2. Player Stats Table
Tracks comprehensive building statistics and achievements.

```sql
CREATE TABLE player_stats (
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
CREATE INDEX idx_player_stats_bricks_placed ON player_stats(bricks_placed DESC);
CREATE INDEX idx_player_stats_current_streak ON player_stats(current_streak DESC);
CREATE INDEX idx_player_stats_best_streak ON player_stats(best_streak DESC);
CREATE INDEX idx_player_stats_rank ON player_stats(rank_position);
```

### 3. Daily Activity Table
Tracks daily building activity for streak calculation and daily leaderboards.

```sql
CREATE TABLE daily_activity (
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
CREATE INDEX idx_daily_activity_date ON daily_activity(activity_date DESC);
CREATE INDEX idx_daily_activity_fid_date ON daily_activity(fid, activity_date);
CREATE INDEX idx_daily_activity_bricks_today ON daily_activity(activity_date, bricks_placed_today DESC);
```

### 4. Achievements Table
Defines available achievements and their requirements.

```sql
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    achievement_key VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'first_brick', 'streak_7'
    name VARCHAR(255) NOT NULL,                    -- Display name
    description TEXT NOT NULL,                     -- Achievement description
    icon_url TEXT,                                 -- Achievement icon
    category VARCHAR(50) NOT NULL,                -- 'building', 'streak', 'milestone', 'special'
    
    -- Requirements (JSON for flexibility)
    requirements JSONB NOT NULL,                  -- e.g., {"bricks_placed": 100}
    
    -- Rarity and Display
    rarity ENUM('common', 'rare', 'epic', 'legendary') DEFAULT 'common',
    points INTEGER DEFAULT 0,                     -- Achievement points
    is_hidden BOOLEAN DEFAULT FALSE,              -- Hidden until unlocked
    is_active BOOLEAN DEFAULT TRUE,               -- Can be earned
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sample achievements data
INSERT INTO achievements (achievement_key, name, description, category, requirements, rarity, points) VALUES
('first_brick', 'First Builder', 'Place your first brick in The Stack', 'building', '{"bricks_placed": 1}', 'common', 10),
('century_club', 'Century Club', 'Place 100 bricks in The Stack', 'milestone', '{"bricks_placed": 100}', 'rare', 100),
('streak_7', 'Week Warrior', 'Build for 7 consecutive days', 'streak', '{"current_streak": 7}', 'rare', 150),
('layer_pioneer', 'Layer Pioneer', 'Be first to complete a layer', 'special', '{}', 'epic', 500),
('thousand_club', 'Master Builder', 'Place 1000 bricks in The Stack', 'milestone', '{"bricks_placed": 1000}', 'legendary', 1000);
```

### 5. Player Achievements Table
Tracks which achievements each player has unlocked.

```sql
CREATE TABLE player_achievements (
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

-- Indexes
CREATE INDEX idx_player_achievements_fid ON player_achievements(fid);
CREATE INDEX idx_player_achievements_unlocked ON player_achievements(unlocked_at DESC);
```

### 6. Leaderboard Snapshots Table
Stores periodic leaderboard snapshots for historical tracking and rank change calculation.

```sql
CREATE TABLE leaderboard_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    snapshot_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
    
    -- Leaderboard data
    leaderboard_data JSONB NOT NULL,          -- Full leaderboard as JSON
    total_players INTEGER NOT NULL,
    total_bricks INTEGER NOT NULL,
    current_layer INTEGER NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(snapshot_date, snapshot_type)
);

-- Index for historical queries
CREATE INDEX idx_leaderboard_snapshots_date_type ON leaderboard_snapshots(snapshot_date DESC, snapshot_type);
```

## Database Functions & Triggers

### 1. Update Player Stats Function
Automatically updates player statistics when bricks are placed.

```sql
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called from the application
    -- when bricks are placed, not as a database trigger
    -- since we need application context
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Calculate Streak Function
Updates daily streaks based on building activity.

```sql
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
        last_build_date = build_date
    WHERE fid = player_fid;
    
    RETURN current_streak_count;
END;
$$ LANGUAGE plpgsql;
```

## API Endpoints

### Leaderboard Endpoints
- `GET /api/leaderboard/global` - Global all-time leaderboard
- `GET /api/leaderboard/daily` - Today's most active builders
- `GET /api/leaderboard/weekly` - This week's top builders
- `GET /api/leaderboard/streaks` - Longest current streaks

### Player Endpoints
- `GET /api/player/:fid/stats` - Individual player statistics
- `GET /api/player/:fid/achievements` - Player's achievements
- `GET /api/player/:fid/rank` - Player's current rank and position
- `POST /api/player/:fid/stats/update` - Update player stats (internal)

### Achievement Endpoints
- `GET /api/achievements` - All available achievements
- `POST /api/achievements/check/:fid` - Check for new achievements
- `POST /api/achievements/unlock` - Unlock specific achievement

### Social Sharing Endpoints
- `GET /api/share/rank/:fid` - Generate rank sharing content
- `GET /api/share/achievement/:fid/:achievement` - Achievement sharing
- `POST /api/share/cast` - Record successful cast sharing

## Caching Strategy

### Redis Caching (Optional)
For high-performance leaderboard queries:

```
leaderboard:global -> Top 100 players (30min TTL)
leaderboard:daily -> Today's top builders (5min TTL)
player:stats:{fid} -> Individual player stats (5min TTL)
achievements:available -> All achievements (1hour TTL)
```

## Performance Considerations

### Database Optimization
1. **Indexes**: All common query patterns indexed
2. **Materialized Views**: For complex leaderboard calculations
3. **Partitioning**: Daily activity table partitioned by date
4. **Connection Pooling**: Use connection pooling for Socket.io server

### Query Optimization
1. **Batch Updates**: Update multiple stats in single transaction
2. **Async Processing**: Achievement checking done asynchronously
3. **Cached Leaderboards**: Pre-computed leaderboard rankings
4. **Efficient Pagination**: Cursor-based pagination for large lists

## Social Integration Schema

### Sharing Metadata
Store information about social media shares:

```sql
CREATE TABLE social_shares (
    id SERIAL PRIMARY KEY,
    fid BIGINT REFERENCES players(fid),
    share_type ENUM('rank', 'achievement', 'milestone', 'streak'),
    content_data JSONB,                       -- What was shared
    platform VARCHAR(50) DEFAULT 'farcaster',
    cast_hash VARCHAR(255),                   -- Farcaster cast hash
    shared_at TIMESTAMP DEFAULT NOW()
);
```

## Migration Strategy

### Phase 1: Core Tables
1. Create players and player_stats tables
2. Migrate existing player data from current system
3. Implement basic leaderboard queries

### Phase 2: Achievements
1. Create achievements and player_achievements tables
2. Implement achievement checking system
3. Backfill achievements for existing players

### Phase 3: Social Features
1. Add social sharing tables
2. Implement OG image generation
3. Add Farcaster cast integration

## Monitoring & Analytics

### Key Metrics to Track
- Daily/Weekly/Monthly active builders
- Average bricks per session
- Streak distribution and retention
- Achievement unlock rates
- Social sharing conversion rates
- Leaderboard engagement metrics

### Database Health
- Query performance monitoring
- Connection pool utilization
- Storage growth patterns
- Index effectiveness

## Backup & Recovery

### Backup Strategy
- **Daily snapshots**: Full database backup
- **Real-time replication**: Fly.io managed Postgres features
- **Point-in-time recovery**: 30-day retention
- **Export functionality**: JSON exports of leaderboard data

This schema provides a robust foundation for The Stack's leaderboard and social features while maintaining performance and scalability for a growing Farcaster community.