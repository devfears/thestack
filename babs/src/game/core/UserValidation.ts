/**
 * UserValidation - Utility functions for validating users and restricting demo user actions
 * 
 * Demo users are identified by FIDs in the range 12345-22344 (12345 + 0-9999)
 * Only Farcaster users with real FIDs should be able to place bricks that persist
 */

export interface UserProfile {
  fid: number;
  displayName: string;
  username: string;
  pfpUrl?: string;
}

/**
 * Check if a user is a demo user (non-Farcaster user)
 * Demo users have FIDs in the range 12345-22344
 */
export function isDemoUser(user: UserProfile | null): boolean {
  if (!user) return true; // No user = demo user
  
  // Demo users have FIDs starting from 12345 with uniqueId added (0-9999)
  return user.fid >= 12345 && user.fid <= 22344;
}

/**
 * Check if a user is a real Farcaster user (has valid FID)
 */
export function isFarcasterUser(user: UserProfile | null): boolean {
  return !isDemoUser(user);
}

/**
 * Get user type description for logging
 */
export function getUserType(user: UserProfile | null): string {
  if (!user) return 'No User';
  if (isDemoUser(user)) return `Demo User (FID: ${user.fid})`;
  return `Farcaster User (FID: ${user.fid})`;
}

/**
 * Check if user can place bricks (only Farcaster users allowed)
 */
export function canUserPlaceBricks(user: UserProfile | null): boolean {
  return isFarcasterUser(user);
}

/**
 * Get restriction message for demo users
 */
export function getDemoUserMessage(): string {
  return "🔒 Only Farcaster users can place bricks. Open this game through Farcaster to participate!";
}