/**
 * Suppressor compatibility.
 *
 * The governing rule, from the brief: **missing data is never a pass.** A
 * checker that shrugs and says "looks fine" because it has no bore diameter is
 * worse than no checker at all, so every rule returns `unknown` rather than
 * guessing, and `unknown` beats `warn` when the overall verdict is formed.
 *
 * What this deliberately does not do:
 *  - rank cartridges by pressure or powder capacity. There is no public dataset
 *    behind that, so the only ordering used is bullet diameter, and the message
 *    says so rather than implying a pressure judgement.
 *  - parse manufacturer prose. A minimum-barrel-length note is quoted verbatim
 *    and handed to the user; inferring "16" from free text is how you get it
 *    wrong.
 *  - recommend adapters as a way around an incompatible interface.
 *
 * Pure, zero-dependency and free of DOM/Node APIs, like the rest of the engine.
 */

export type FitStatus = 'pass' | 'warn' | 'unknown' | 'fail';

export type FitCheckId = 'bore' | 'cartridge' | 'mount' | 'barrel-length';

export interface FitCheck {
  readonly id: FitCheckId;
  readonly status: FitStatus;
  /** One line, safe to show on its own. */
  readonly summary: string;
  /** Extra context, including anything quoted from the manufacturer. */
  readonly detail?: string;
}

export interface FitResult {
  readonly status: FitStatus;
  readonly checks: readonly FitCheck[];
}

export type MountType =
  'direct_thread' | 'hub_1375x24' | 'asr' | 'keymo' | 'omega_qd' | 'proprietary_qd' | 'other';

export interface SuppressorFitSpec {
  /** Smallest hole the bullet passes through, inches. */
  readonly boreDiameterIn?: number;
  readonly mountType?: MountType;
  /** The can's own thread, for direct-thread models, e.g. '5/8x24'. */
  readonly threadPitch?: string;
  readonly ratedCartridges?: readonly string[];
  readonly maxRatedCartridge?: string;
  /** Bullet diameter of `maxRatedCartridge`, when the library knows it. */
  readonly maxRatedCartridgeDiameterIn?: number;
  /** Quoted verbatim from the manufacturer. Never parsed. */
  readonly minBarrelLengthNote?: string;
  readonly modelName?: string;
}

export interface HostFitSpec {
  readonly cartridge?: string;
  readonly bulletDiameterIn?: number;
  /** The muzzle thread on the rifle, e.g. '5/8x24'. */
  readonly threadPitch?: string;
  readonly barrelLengthIn?: number;
}

/**
 * Clearance below which a bore is tight enough to be worth mentioning. Bores
 * are published inconsistently — some makers quote the calibre, some the actual
 * hole — so an exact match is a warning to check, not a failure.
 */
export const TIGHT_BORE_CLEARANCE_IN = 0.004;

/** Mounts that attach to a muzzle device rather than to the barrel thread. */
const DEVICE_MOUNTS: Readonly<Record<MountType, string | null>> = {
  direct_thread: null,
  hub_1375x24: 'a 1.375x24 HUB-standard mount',
  asr: 'the matching ASR muzzle device',
  keymo: 'the matching KeyMo muzzle device',
  omega_qd: 'the matching Omega QD muzzle device',
  proprietary_qd: "the manufacturer's own quick-detach muzzle device",
  other: null,
};

export function checkSuppressorFit(suppressor: SuppressorFitSpec, host: HostFitSpec): FitResult {
  const checks: FitCheck[] = [
    checkBore(suppressor, host),
    checkCartridge(suppressor, host),
    checkMount(suppressor, host),
    checkBarrelLength(suppressor),
  ];
  return { status: worstOf(checks), checks };
}

/**
 * Aggregate verdict.
 *
 * `fail` dominates everything. `unknown` then beats `warn`, because a result
 * built on missing data must not read as a known, bounded concern — and must
 * never read as a pass.
 */
export function worstOf(checks: readonly FitCheck[]): FitStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'unknown')) return 'unknown';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}

function checkBore(suppressor: SuppressorFitSpec, host: HostFitSpec): FitCheck {
  const bore = suppressor.boreDiameterIn;
  const bullet = host.bulletDiameterIn;

  if (bore === undefined || bullet === undefined) {
    return {
      id: 'bore',
      status: 'unknown',
      summary: 'Bore clearance unknown',
      detail:
        bore === undefined
          ? 'No bore diameter is published for this suppressor.'
          : 'No bullet diameter is set for this rifle.',
    };
  }

  if (bullet > bore) {
    return {
      id: 'bore',
      status: 'fail',
      summary: `Bullet is larger than the bore (${fmt(bullet)} in through ${fmt(bore)} in)`,
      detail:
        'The projectile will not pass through this suppressor. Firing it would strike the baffles.',
    };
  }

  const clearance = bore - bullet;
  if (clearance < TIGHT_BORE_CLEARANCE_IN) {
    return {
      id: 'bore',
      status: 'warn',
      summary: `Bore clearance is ${fmt(clearance, 4)} in`,
      detail:
        'That is at or near zero. Manufacturers publish bore diameter inconsistently — some quote the calibre, some the actual hole — so confirm the real bore with the manufacturer before firing.',
    };
  }

  return {
    id: 'bore',
    status: 'pass',
    summary: `Bore clears the bullet by ${fmt(clearance, 3)} in`,
  };
}

function checkCartridge(suppressor: SuppressorFitSpec, host: HostFitSpec): FitCheck {
  const { cartridge } = host;
  const rated = suppressor.ratedCartridges ?? [];

  if (cartridge === undefined || cartridge.trim() === '') {
    return {
      id: 'cartridge',
      status: 'unknown',
      summary: 'Cartridge rating unknown',
      detail: 'No cartridge is set for this rifle.',
    };
  }

  if (rated.length > 0 && rated.some((entry) => sameCartridge(entry, cartridge))) {
    return {
      id: 'cartridge',
      status: 'pass',
      summary: `${cartridge} is on the rated list`,
    };
  }

  const maxDiameter = suppressor.maxRatedCartridgeDiameterIn;
  const bullet = host.bulletDiameterIn;

  if (maxDiameter !== undefined && bullet !== undefined && bullet > maxDiameter) {
    return {
      id: 'cartridge',
      status: 'fail',
      summary: `${cartridge} is a larger calibre than the highest rated cartridge`,
      detail: `This suppressor is rated to ${suppressor.maxRatedCartridge ?? 'a smaller cartridge'} (${fmt(maxDiameter)} in). Yours is ${fmt(bullet)} in.`,
    };
  }

  if (rated.length === 0 && suppressor.maxRatedCartridge === undefined) {
    return {
      id: 'cartridge',
      status: 'unknown',
      summary: 'No cartridge ratings are published for this suppressor',
      detail: 'Check the manufacturer before firing anything through it.',
    };
  }

  return {
    id: 'cartridge',
    status: 'warn',
    summary: `${cartridge} is not on the rated list`,
    detail:
      suppressor.maxRatedCartridge === undefined
        ? 'It may still be fine, but this app will not assume so. Confirm with the manufacturer.'
        : `The calibre is within the maximum rated cartridge (${suppressor.maxRatedCartridge}), but rating depends on chamber pressure and powder volume, which this app does not model. Confirm with the manufacturer.`,
  };
}

function checkMount(suppressor: SuppressorFitSpec, host: HostFitSpec): FitCheck {
  const mount = suppressor.mountType;
  if (mount === undefined) {
    return {
      id: 'mount',
      status: 'unknown',
      summary: 'Mount type unknown',
      detail: 'No mounting standard is recorded for this suppressor.',
    };
  }

  if (mount === 'direct_thread') {
    const canThread = suppressor.threadPitch;
    const hostThread = host.threadPitch;
    if (canThread === undefined || hostThread === undefined) {
      return {
        id: 'mount',
        status: 'unknown',
        summary: 'Thread pitch unknown',
        detail:
          canThread === undefined
            ? 'No thread pitch is recorded for this suppressor.'
            : 'No muzzle thread is recorded for this rifle.',
      };
    }
    if (sameThread(canThread, hostThread)) {
      return {
        id: 'mount',
        status: 'pass',
        summary: `Threads directly onto ${hostThread}`,
      };
    }
    return {
      id: 'mount',
      status: 'fail',
      summary: `Thread mismatch: suppressor is ${canThread}, barrel is ${hostThread}`,
      detail:
        'These do not screw together. Thread adapters exist, but which ones are safe on a given host is a question for the manufacturer, not for this app.',
    };
  }

  const device = DEVICE_MOUNTS[mount];
  if (device === null) {
    return {
      id: 'mount',
      status: 'unknown',
      summary: 'Mounting interface is not a standard this app recognises',
      detail: "Check the manufacturer's mounting instructions.",
    };
  }

  const hostThread = host.threadPitch;
  if (hostThread === undefined) {
    return {
      id: 'mount',
      status: 'unknown',
      summary: `Needs ${device}, but the barrel thread is unknown`,
      detail: 'Record the muzzle thread on the rifle to see which device you need.',
    };
  }

  return {
    id: 'mount',
    status: 'warn',
    summary: `Needs ${device} in ${hostThread}`,
    detail: 'This suppressor does not thread straight onto the barrel.',
  };
}

function checkBarrelLength(suppressor: SuppressorFitSpec): FitCheck {
  const note = suppressor.minBarrelLengthNote;
  if (note === undefined || note.trim() === '') {
    return {
      id: 'barrel-length',
      status: 'unknown',
      summary: 'No minimum barrel length is published',
      detail:
        'Short barrels raise pressure and velocity at the muzzle. Ask the manufacturer what this suppressor is rated for.',
    };
  }
  return {
    id: 'barrel-length',
    status: 'warn',
    summary: 'Check your barrel against the manufacturer restriction',
    // Quoted, never parsed: these notes carry conditions that a number cannot.
    detail: note,
  };
}

/**
 * Loose cartridge-name matching.
 *
 * Deliberately conservative: case, punctuation and spacing are ignored and only
 * the handful of abbreviations that are unambiguous in cartridge names are
 * expanded. Nothing here guesses that two differently named cartridges are the
 * same one.
 */
export function normalizeCartridge(name: string): string {
  const expanded = name
    .toLowerCase()
    .replace(/[.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(' ');
  return expanded.replace(/\s/g, '');
}

const ABBREVIATIONS: Readonly<Record<string, string>> = {
  win: 'winchester',
  rem: 'remington',
  mag: 'magnum',
  sprg: 'springfield',
  spr: 'special',
  creed: 'creedmoor',
  cm: 'creedmoor',
  lapua: 'lapua',
  wsm: 'winchestershortmagnum',
  nato: 'nato',
};

export function sameCartridge(a: string, b: string): boolean {
  return normalizeCartridge(a) === normalizeCartridge(b);
}

/** `5/8x24`, `5/8-24` and `5/8 x 24` are the same thread. */
export function normalizeThread(pitch: string): string {
  return (
    pitch
      .toLowerCase()
      .replace(/[\s”"]/g, '')
      // A dash or star between the diameter and the pitch means the same as an x.
      .replace(/[-*]/g, 'x')
      .replace(/x+/g, 'x')
  );
}

export function sameThread(a: string, b: string): boolean {
  return normalizeThread(a) === normalizeThread(b);
}

function fmt(value: number, digits = 3): string {
  return value.toFixed(digits);
}
