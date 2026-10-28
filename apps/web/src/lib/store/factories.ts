import { DEFAULT_FORM } from '@/lib/calc/defaults';
import type {
  StoredBullet,
  StoredLoad,
  StoredRifle,
  StoredSuppressor,
  StoredSuppressorSetup,
} from './types';

/**
 * Constructors for new profile records.
 *
 * Pure except for the id and clock, which are injected so tests can pin them.
 * Defaults come from the calculator's opening state, so a brand-new rifle is
 * immediately solvable rather than a form full of zeroes.
 */

export interface Clock {
  now: () => string;
  id: () => string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  id: () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${String(Date.now())}-${Math.random().toString(36).slice(2, 10)}`,
};

export function newRifle(
  overrides: Partial<Omit<StoredRifle, 'id' | 'createdAt' | 'updatedAt'>> = {},
  clock: Clock = systemClock,
): StoredRifle {
  const at = clock.now();
  return {
    id: clock.id(),
    name: 'New rifle',
    cartridge: '',
    twistDirection: DEFAULT_FORM.twistDirection,
    sightHeightIn: DEFAULT_FORM.sightHeight,
    zeroRangeYd: DEFAULT_FORM.zeroRange,
    angularUnit: DEFAULT_FORM.units.angular,
    elevationClickKey: DEFAULT_FORM.elevationClickKey,
    windageClickKey: DEFAULT_FORM.windageClickKey,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

export function newBullet(overrides: Partial<StoredBullet> = {}): StoredBullet {
  const lengthIn = DEFAULT_FORM.bulletLength;
  return {
    name: DEFAULT_FORM.bulletName,
    diameterIn: DEFAULT_FORM.diameter,
    weightGr: DEFAULT_FORM.weight,
    bcType: DEFAULT_FORM.bcType,
    bcValue: DEFAULT_FORM.bcValue,
    // exactOptionalPropertyTypes: an absent key and an undefined value differ.
    ...(lengthIn === null ? {} : { lengthIn }),
    verified: false,
    ...overrides,
  };
}

export function newLoad(
  rifleId: string,
  overrides: Partial<Omit<StoredLoad, 'id' | 'rifleId' | 'createdAt' | 'updatedAt'>> = {},
  clock: Clock = systemClock,
): StoredLoad {
  const at = clock.now();
  return {
    id: clock.id(),
    rifleId,
    name: 'New load',
    bullet: newBullet(),
    muzzleVelocityFps: DEFAULT_FORM.muzzleVelocity,
    muzzleVelocitySource: 'advertised',
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

export function newSuppressor(
  overrides: Partial<Omit<StoredSuppressor, 'id' | 'createdAt' | 'updatedAt'>> = {},
  clock: Clock = systemClock,
): StoredSuppressor {
  const at = clock.now();
  return {
    id: clock.id(),
    name: 'New suppressor',
    // Everything the manufacturer has not told us stays absent: the
    // compatibility checker answers "unknown" from a missing value and would
    // answer "pass" from a guessed one.
    mountType: 'direct_thread',
    ratedCartridges: [],
    verified: false,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

export function newSuppressorSetup(
  rifleId: string,
  suppressorId: string,
  overrides: Partial<
    Omit<StoredSuppressorSetup, 'id' | 'rifleId' | 'suppressorId' | 'createdAt' | 'updatedAt'>
  > = {},
  clock: Clock = systemClock,
): StoredSuppressorSetup {
  const at = clock.now();
  return {
    id: clock.id(),
    rifleId,
    suppressorId,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

/** A copy under a new id, with "(copy)" appended so the list stays legible. */
export function duplicateRifle(rifle: StoredRifle, clock: Clock = systemClock): StoredRifle {
  const at = clock.now();
  return { ...rifle, id: clock.id(), name: `${rifle.name} (copy)`, createdAt: at, updatedAt: at };
}

export function duplicateLoad(load: StoredLoad, clock: Clock = systemClock): StoredLoad {
  const at = clock.now();
  return { ...load, id: clock.id(), name: `${load.name} (copy)`, createdAt: at, updatedAt: at };
}

export function touch<T extends { updatedAt: string }>(record: T, clock: Clock = systemClock): T {
  return { ...record, updatedAt: clock.now() };
}
