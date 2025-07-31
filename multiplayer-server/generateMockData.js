const { query, initializeDatabase } = require('./database');
require('dotenv').config();

// Mock player data based on LEADERBOARD_UI_STRATEGY.md
const mockPlayers = [
  // Top Tier Players (Ranks 1-5)
  { fid: 3621, username: 'mike_builds', displayName: 'BuilderMike', bricks: 2847, streak: 23 },
  { fid: 7891, username: 'sarah_stacks', displayName: 'StackQueen', bricks: 2301, streak: 15 },
  { fid: 4532, username: 'alex_brick', displayName: 'BrickMaster', bricks: 1956, streak: 8 },
  { fid: 9876, username: 'king_tower', displayName: 'TowerKing', bricks: 1743, streak: 12 },
  { fid: 2345, username: 'champ_block', displayName: 'BlockChamp', bricks: 1502, streak: 6 },
  
  // Mid Tier Players (Ranks 6-15)
  { fid: 5678, username: 'build_bot', displayName: 'BuildBot', bricks: 987, streak: 4 },
  { fid: 8901, username: 'stack_attack', displayName: 'StackAttack', bricks: 756, streak: 2 },
  { fid: 3456, username: 'brick_ninja', displayName: 'BrickNinja', bricks: 654, streak: 1 },
  { fid: 7890, username: 'tower_build', displayName: 'TowerBuilder', bricks: 543, streak: 3 },
  { fid: 1234, username: 'demouser3731', displayName: 'Demo User 3731', bricks: 456, streak: 5 },
  { fid: 4567, username: 'pixel_builder', displayName: 'PixelBuilder', bricks: 398, streak: 2 },
  { fid: 8912, username: 'cube_master', displayName: 'CubeMaster', bricks: 367, streak: 1 },
  { fid: 2468, username: 'block_star', displayName: 'BlockStar', bricks: 334, streak: 4 },
  { fid: 1357, username: 'brick_hero', displayName: 'BrickHero', bricks: 298, streak: 0 },
  { fid: 9753, username: 'stack_pro', displayName: 'StackPro', bricks: 267, streak: 1 },
  
  // Casual Players (Ranks 16-30)
  { fid: 1111, username: 'newbie_builder', displayName: 'Newbie Builder', bricks: 234, streak: 0 },
  { fid: 2222, username: 'casual_stacker', displayName: 'Casual Stacker', bricks: 198, streak: 1 },
  { fid: 3333, username: 'weekend_warrior', displayName: 'Weekend Warrior', bricks: 167, streak: 0 },
  { fid: 4444, username: 'brick_rookie', displayName: 'Brick Rookie', bricks: 145, streak: 2 },
  { fid: 5555, username: 'tower_fan', displayName: 'Tower Fan', bricks: 123, streak: 0 },
  { fid: 6666, username: 'block_buddy', displayName: 'Block Buddy', bricks: 98, streak: 1 },
  { fid: 7777, username: 'stack_starter', displayName: 'Stack Starter', bricks: 87, streak: 0 },
  { fid: 8888, username: 'build_beginner', displayName: 'Build Beginner', bricks: 76, streak: 0 },
  { fid: 9999, username: 'cube_curious', displayName: 'Cube Curious', bricks: 65, streak: 1 },
  { fid: 1122, username: 'pixel_pal', displayName: 'Pixel Pal', bricks: 54, streak: 0 },
  { fid: 3344, username: 'brick_buddy', displayName: 'Brick Buddy', bricks: 43, streak: 0 },
  { fid: 5566, username: 'tower_newbie', displayName: 'Tower Newbie', bricks: 32, streak: 1 },
  { fid: 7788, username: 'stack_student', displayName: 'Stack Student', bricks: 21, streak: 0 },
  { fid: 9900, username: 'build_explorer', displayName: 'Build Explorer', bricks: 15, streak: 0 },
  { fid: 1010, username: 'first_timer', displayName: 'First Timer', bricks: 8, streak: 0 }
];

// Today's activity (random distribution)
const generateTodaysActivity = () => {
  return mockPlayers.map((player, index) => {
    // Top players are more active today
    let todaysBricks = 0;
    if (index < 5) {
      todaysBricks = Math.floor(Math.random() * 30) + 20; // 20-50 bricks today
    } else if (index < 10) {
      todaysBricks = Math.floor(Math.random() * 20) + 10; // 10-30 bricks today
    } else if (index < 20) {
      todaysBricks = Math.floor(Math.random() * 15) + 5; // 5-20 bricks today
    } else {
      todaysBricks = Math.floor(Math.random() * 10) + 1; // 1-10 bricks today
    }
    
    return {
      fid: player.fid,
      bricks_today: todaysBricks
    };
  });
};

async function generateMockData() {
  console.log('🎭 Generating mock data for The Stack leaderboard...');
  
  try {
    // Ensure database is initialized
    await initializeDatabase();
    
    console.log('📝 Inserting mock players...');
    
    // Insert players
    for (const player of mockPlayers) {
      await query(`
        INSERT INTO players (fid, username, display_name, pfp_url, first_seen, last_active)
        VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 24)} hours')
        ON CONFLICT (fid) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          last_active = EXCLUDED.last_active
      `, [player.fid, player.username, player.displayName, `https://picsum.photos/200/200?random=${player.fid}`]);
      
      // Insert player stats
      await query(`
        INSERT INTO player_stats (fid, bricks_placed, current_streak, best_streak, last_build_date, building_sessions, total_play_time)
        VALUES ($1, $2, $3, $4, CURRENT_DATE - INTERVAL '${player.streak === 0 ? Math.floor(Math.random() * 7) + 1 : 0} days', $5, $6)
        ON CONFLICT (fid) DO UPDATE SET
          bricks_placed = EXCLUDED.bricks_placed,
          current_streak = EXCLUDED.current_streak,
          best_streak = EXCLUDED.best_streak,
          last_build_date = EXCLUDED.last_build_date,
          building_sessions = EXCLUDED.building_sessions,
          total_play_time = EXCLUDED.total_play_time
      `, [
        player.fid, 
        player.bricks, 
        player.streak, 
        Math.max(player.streak, Math.floor(player.streak * 1.5)), // best_streak is at least current streak
        Math.floor(player.bricks / 10) + Math.floor(Math.random() * 20), // building_sessions
        player.bricks * 60 + Math.floor(Math.random() * 3600) // total_play_time in seconds
      ]);
    }
    
    console.log('📅 Generating today\'s activity...');
    
    // Generate today's activity
    const todaysActivity = generateTodaysActivity();
    const today = new Date().toISOString().split('T')[0];
    
    for (const activity of todaysActivity) {
      await query(`
        INSERT INTO daily_activity (fid, activity_date, bricks_placed_today, session_count, play_time_today)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (fid, activity_date) DO UPDATE SET
          bricks_placed_today = EXCLUDED.bricks_placed_today,
          session_count = EXCLUDED.session_count,
          play_time_today = EXCLUDED.play_time_today
      `, [
        activity.fid,
        today,
        activity.bricks_today,
        Math.floor(Math.random() * 3) + 1, // 1-3 sessions today
        activity.bricks_today * 30 + Math.floor(Math.random() * 600) // play time today in seconds
      ]);
    }
    
    console.log('🏆 Inserting sample achievements...');
    
    // Insert sample achievements
    const achievements = [
      { key: 'first_brick', name: 'First Builder', description: 'Place your first brick in The Stack', category: 'building', rarity: 'common', points: 10 },
      { key: 'century_club', name: 'Century Club', description: 'Place 100 bricks in The Stack', category: 'milestone', rarity: 'rare', points: 100 },
      { key: 'streak_7', name: 'Week Warrior', description: 'Build for 7 consecutive days', category: 'streak', rarity: 'rare', points: 150 },
      { key: 'layer_pioneer', name: 'Layer Pioneer', description: 'Be first to complete a layer', category: 'special', rarity: 'epic', points: 500 },
      { key: 'thousand_club', name: 'Master Builder', description: 'Place 1000 bricks in The Stack', category: 'milestone', rarity: 'legendary', points: 1000 }
    ];
    
    for (const achievement of achievements) {
      await query(`
        INSERT INTO achievements (achievement_key, name, description, category, rarity, points, requirements)
        VALUES ($1, $2, $3, $4, $5, $6, '{}')
        ON CONFLICT (achievement_key) DO NOTHING
      `, [achievement.key, achievement.name, achievement.description, achievement.category, achievement.rarity, achievement.points]);
    }
    
    console.log('🎖️ Assigning achievements to players...');
    
    // Assign achievements to players based on their stats
    for (const player of mockPlayers) {
      // Everyone gets first_brick
      await query(`
        INSERT INTO player_achievements (fid, achievement_key, brick_count_when_unlocked)
        VALUES ($1, 'first_brick', 1)
        ON CONFLICT (fid, achievement_key) DO NOTHING
      `, [player.fid]);
      
      // Century club for players with 100+ bricks
      if (player.bricks >= 100) {
        await query(`
          INSERT INTO player_achievements (fid, achievement_key, brick_count_when_unlocked)
          VALUES ($1, 'century_club', 100)
          ON CONFLICT (fid, achievement_key) DO NOTHING
        `, [player.fid]);
      }
      
      // Week warrior for players with 7+ day streak
      if (player.streak >= 7) {
        await query(`
          INSERT INTO player_achievements (fid, achievement_key, brick_count_when_unlocked)
          VALUES ($1, 'streak_7', $2)
          ON CONFLICT (fid, achievement_key) DO NOTHING
        `, [player.fid, player.bricks]);
      }
      
      // Master builder for players with 1000+ bricks
      if (player.bricks >= 1000) {
        await query(`
          INSERT INTO player_achievements (fid, achievement_key, brick_count_when_unlocked)
          VALUES ($1, 'thousand_club', 1000)
          ON CONFLICT (fid, achievement_key) DO NOTHING
        `, [player.fid]);
      }
    }
    
    // Give layer_pioneer to top 5 players
    for (let i = 0; i < 5; i++) {
      await query(`
        INSERT INTO player_achievements (fid, achievement_key, brick_count_when_unlocked, layer_when_unlocked)
        VALUES ($1, 'layer_pioneer', $2, $3)
        ON CONFLICT (fid, achievement_key) DO NOTHING
      `, [mockPlayers[i].fid, mockPlayers[i].bricks, i + 1]);
    }
    
    console.log('✅ Mock data generation complete!');
    console.log(`📊 Generated data for ${mockPlayers.length} players`);
    console.log(`🏆 ${achievements.length} achievements created`);
    console.log(`📅 Today's activity generated for all players`);
    console.log(`🎖️ Achievements distributed based on player performance`);
    
    // Test the data by running a quick leaderboard query
    const testLeaderboard = await query(`
      SELECT 
        p.display_name,
        ps.bricks_placed,
        ps.current_streak,
        da.bricks_placed_today
      FROM players p
      JOIN player_stats ps ON p.fid = ps.fid
      LEFT JOIN daily_activity da ON p.fid = da.fid AND da.activity_date = CURRENT_DATE
      ORDER BY ps.bricks_placed DESC
      LIMIT 10
    `);
    
    console.log('\n🏆 Top 10 Leaderboard Preview:');
    testLeaderboard.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.display_name}: ${row.bricks_placed} bricks (${row.current_streak} day streak) - ${row.bricks_placed_today || 0} today`);
    });
    
  } catch (error) {
    console.error('💥 Error generating mock data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateMockData()
    .then(() => {
      console.log('🎉 Mock data generation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Mock data generation failed:', error);
      process.exit(1);
    });
}

module.exports = { generateMockData };