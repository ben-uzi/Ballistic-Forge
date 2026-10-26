/**
 * Feature flags. In the pilot these are compile-time defaults; Phase 3 moves the
 * source of truth to the Supabase `app_flags` table and this module reads the
 * server-provided values with these as the fallback (BUILD_BRIEF §10.3).
 */

export interface AppFlags {
  /** The Field reveal switch. Stays false until the shot threshold is passed. */
  readonly fieldDataPublic: boolean;
  /** Shots logged before the public Field view is considered. */
  readonly fieldRevealThresholdShots: number;
  /** Minimum sessions in a group before an aggregate may be displayed. */
  readonly minSessionsToDisplay: number;
  /** Minimum distinct users in a group before an aggregate may be displayed. */
  readonly minUsersToDisplay: number;
}

export const DEFAULT_FLAGS: AppFlags = {
  fieldDataPublic: false,
  fieldRevealThresholdShots: 50_000,
  minSessionsToDisplay: 5,
  minUsersToDisplay: 3,
};

/**
 * Whether an aggregate may be shown to a non-admin.
 * Deliberately conservative: all three gates must pass.
 */
export function canDisplayAggregate(flags: AppFlags, sessions: number, users: number): boolean {
  return (
    flags.fieldDataPublic &&
    sessions >= flags.minSessionsToDisplay &&
    users >= flags.minUsersToDisplay
  );
}
