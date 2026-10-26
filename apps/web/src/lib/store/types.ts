import type { AngularUnit } from '@bf/engine';

/**
 * Stored domain types. Values are kept in the units the user typed them in
 * (US customary by default) and converted to SI at the engine boundary, so a
 * saved profile reads back exactly as it was entered.
 *
 * Deliberately absent: rifle serial numbers (BUILD_BRIEF §13).
 */

export type BcType = 'G1' | 'G7';
export type TwistDirection = 'right' | 'left';

export interface StoredBullet {
  readonly name: string;
  readonly manufacturer?: string;
  readonly diameterIn: number;
  readonly weightGr: number;
  readonly bcType: BcType;
  readonly bcValue: number;
  readonly lengthIn?: number;
  /** Where the numbers came from. Library rows always carry one. */
  readonly sourceUrl?: string;
  /** False until a human has checked it against the source (BUILD_BRIEF §7.4). */
  readonly verified: boolean;
}

export type MuzzleVelocitySource = 'advertised' | 'chronograph' | 'trued' | 'estimated';

export interface TruedValue {
  readonly value: number;
  /** ISO date the truing was performed. */
  readonly at: string;
  readonly atRangeYd: number;
  readonly note?: string;
}

export interface StoredLoad {
  readonly id: string;
  readonly rifleId: string;
  readonly name: string;
  readonly bullet: StoredBullet;
  readonly muzzleVelocityFps: number;
  readonly muzzleVelocitySource: MuzzleVelocitySource;
  /** fps per °F. Known for some factory powders; omit when unknown. */
  readonly temperatureSensitivityFpsPerF?: number;
  /** Temperature the muzzle velocity was measured at. */
  readonly muzzleVelocityAtTempF?: number;
  readonly truedMuzzleVelocityFps?: TruedValue;
  readonly truedBcScale?: TruedValue;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archived?: boolean;
}

export interface StoredRifle {
  readonly id: string;
  readonly name: string;
  readonly cartridge: string;
  readonly barrelLengthIn?: number;
  readonly twistIn?: number;
  readonly twistDirection: TwistDirection;
  readonly sightHeightIn: number;
  readonly zeroRangeYd: number;
  readonly angularUnit: AngularUnit;
  readonly elevationClickKey: string;
  readonly windageClickKey: string;
  /** Suppressor currently mounted, if any (The Can, Phase 5). */
  readonly suppressorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archived?: boolean;
}

export interface UnitPrefs {
  readonly range: 'yd' | 'm';
  readonly velocity: 'fps' | 'mps';
  readonly energy: 'ftlbf' | 'J';
  readonly temperature: 'F' | 'C';
  readonly pressure: 'inHg' | 'hPa';
  readonly angular: AngularUnit;
}

export const DEFAULT_UNIT_PREFS: UnitPrefs = {
  range: 'yd',
  velocity: 'fps',
  energy: 'ftlbf',
  temperature: 'F',
  pressure: 'inHg',
  angular: 'mil',
};

export interface StoreSnapshot {
  readonly version: 1;
  readonly exportedAt: string;
  readonly rifles: readonly StoredRifle[];
  readonly loads: readonly StoredLoad[];
  readonly prefs: UnitPrefs;
}

/**
 * Everything the app needs from persistence. `LocalStore` backs guest mode;
 * `SupabaseStore` takes over once a project is configured and a user signs in.
 * Both are async so swapping them changes no call sites.
 */
export interface ProfileStore {
  readonly kind: 'local' | 'supabase';

  listRifles(): Promise<StoredRifle[]>;
  getRifle(id: string): Promise<StoredRifle | null>;
  saveRifle(rifle: StoredRifle): Promise<StoredRifle>;
  deleteRifle(id: string): Promise<void>;

  listLoads(rifleId?: string): Promise<StoredLoad[]>;
  getLoad(id: string): Promise<StoredLoad | null>;
  saveLoad(load: StoredLoad): Promise<StoredLoad>;
  deleteLoad(id: string): Promise<void>;

  getPrefs(): Promise<UnitPrefs>;
  savePrefs(prefs: UnitPrefs): Promise<UnitPrefs>;

  /** Data export (BUILD_BRIEF §11) and guest → account migration. */
  exportAll(): Promise<StoreSnapshot>;
  importAll(snapshot: StoreSnapshot): Promise<void>;
  clearAll(): Promise<void>;
}
