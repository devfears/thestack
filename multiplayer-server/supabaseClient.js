const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 🔐 Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env file.');
  console.log('Required variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 🎯 Leaderboard Functions
async function getGlobalLeaderboard(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .order('bricks_placed', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching global leaderboard:', error);
    throw error;
  }
}

async function getPlayerStats(fid) {
  try {
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .eq('fid', fid)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  } catch (error) {
    console.error(`❌ Error fetching player stats for FID ${fid}:`, error);
    throw error;
  }
}

async function updatePlayerBrickStats(fid, username, displayName, pfpUrl = null, bricksPlaced = 1) {
  try {
    // First, ensure player exists
    const { error: playerError } = await supabase
      .from('players')
      .upsert({
        fid: fid,
        username: username,
        display_name: displayName,
        pfp_url: pfpUrl,
        last_active: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'fid'
      });

    if (playerError) throw playerError;

    // Use the database function to update brick stats
    const { error: statsError } = await supabase.rpc('update_player_brick_stats', {
      player_fid: fid,
      bricks_delta: bricksPlaced
    });

    if (statsError) throw statsError;

    console.log(`✅ Updated stats for ${displayName} (FID: ${fid}): +${bricksPlaced} bricks`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating player stats for FID ${fid}:`, error);
    throw error;
  }
}

async function getDailyLeaderboard(limit = 50) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('daily_activity')
      .select(`
        fid,
        bricks_placed_today,
        players!inner(username, display_name, pfp_url)
      `)
      .eq('activity_date', today)
      .order('bricks_placed_today', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // Transform data to match leaderboard format
    const transformedData = data.map(row => ({
      fid: row.fid,
      username: row.players.username,
      display_name: row.players.display_name,
      pfp_url: row.players.pfp_url,
      bricks_placed: row.bricks_placed_today,
      current_streak: null, // Not needed for daily leaderboard
      best_streak: null,
      rank_position: null,
      rank_change: null
    }));

    return transformedData;
  } catch (error) {
    console.error('❌ Error fetching daily leaderboard:', error);
    throw error;
  }
}

async function getPlayerAchievements(fid) {
  try {
    const { data, error } = await supabase
      .from('player_achievements')
      .select(`
        *,
        achievements!inner(name, description, category, rarity, points, icon_url)
      `)
      .eq('fid', fid)
      .order('unlocked_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`❌ Error fetching achievements for FID ${fid}:`, error);
    throw error;
  }
}

async function checkAndUnlockAchievements(fid) {
  try {
    // Get player stats for achievement checking
    const playerStats = await getPlayerStats(fid);
    if (!playerStats) return [];

    // Get all available achievements
    const { data: achievements, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const newAchievements = [];

    for (const achievement of achievements) {
      // Check if player already has this achievement
      const { data: existing } = await supabase
        .from('player_achievements')
        .select('id')
        .eq('fid', fid)
        .eq('achievement_key', achievement.achievement_key)
        .single();

      if (existing) continue; // Already unlocked

      // Check if requirements are met
      const requirements = achievement.requirements;
      let qualified = true;

      if (requirements.bricks_placed && playerStats.bricks_placed < requirements.bricks_placed) {
        qualified = false;
      }
      if (requirements.current_streak && playerStats.current_streak < requirements.current_streak) {
        qualified = false;
      }
      if (requirements.bricks_picked_up && playerStats.bricks_picked_up < requirements.bricks_picked_up) {
        qualified = false;
      }
      if (requirements.layers_contributed && playerStats.layers_contributed < requirements.layers_contributed) {
        qualified = false;
      }

      if (qualified) {
        // Unlock achievement
        const { error: unlockError } = await supabase
          .from('player_achievements')
          .insert({
            fid: fid,
            achievement_key: achievement.achievement_key,
            brick_count_when_unlocked: playerStats.bricks_placed,
            unlocked_at: new Date().toISOString()
          });

        if (!unlockError) {
          newAchievements.push(achievement);
          console.log(`🏆 Achievement unlocked for FID ${fid}: ${achievement.name}`);
        }
      }
    }

    return newAchievements;
  } catch (error) {
    console.error(`❌ Error checking achievements for FID ${fid}:`, error);
    return [];
  }
}

// Test database connection
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('count')
      .limit(1);

    if (error) throw error;
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    return false;
  }
}

module.exports = {
  supabase,
  getGlobalLeaderboard,
  getPlayerStats,
  updatePlayerBrickStats,
  getDailyLeaderboard,
  getPlayerAchievements,
  checkAndUnlockAchievements,
  testConnection
};