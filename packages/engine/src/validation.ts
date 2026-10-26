import type { AtmosphereInput } from './atmosphere';
import type { StandardDragFunction } from './dragTables';
import type { SolveInput } from './solver';
import {
  KG_PER_GRAIN,
  METERS_PER_FOOT,
  METERS_PER_INCH,
  METERS_PER_YARD,
  MPS_PER_MPH,
  PA_PER_INHG,
  convertTemperature,
  convertVelocity,
} from './units';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** Dotted path into the input, e.g. `rifle.sightHeightM`. */
  readonly path: string;
  readonly code: string;
  readonly severity: IssueSeverity;
  /** Human-readable, US units first. */
  readonly message: string;
}

export class BallisticsInputError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(
      issues
        .filter((i) => i.severity === 'error')
        .map((i) => i.message)
        .join(' '),
    );
    this.name = 'BallisticsInputError';
    this.issues = issues;
  }
}

/** Compact number formatting for messages: at most `digits` decimals, no trailing zeros. */
const fmt = (value: number, digits = 1): string =>
  Number(value.toFixed(digits)).toLocaleString('en-US');

const DEG = Math.PI / 180;

class Issues {
  readonly list: ValidationIssue[] = [];

  error(path: string, code: string, message: string): void {
    this.list.push({ path, code, severity: 'error', message });
  }

  warn(path: string, code: string, message: string): void {
    this.list.push({ path, code, severity: 'warning', message });
  }

  /** Records an error and returns false when `value` is not a finite number. */
  finite(path: string, label: string, value: number): boolean {
    if (Number.isFinite(value)) return true;
    this.error(path, 'not-a-number', `${label} must be a number.`);
    return false;
  }

  positive(path: string, label: string, value: number): boolean {
    if (!this.finite(path, label, value)) return false;
    if (value > 0) return true;
    this.error(path, 'not-positive', `${label} must be greater than zero.`);
    return false;
  }
}

function checkAtmosphere(issues: Issues, path: string, atm: AtmosphereInput): void {
  if (issues.finite(`${path}.temperatureK`, 'Temperature', atm.temperatureK)) {
    const c = atm.temperatureK - 273.15;
    if (c < -60 || c > 65) {
      issues.error(
        `${path}.temperatureK`,
        'out-of-range',
        `Temperature of ${fmt(convertTemperature(atm.temperatureK, 'K', 'F'), 0)} °F (${fmt(c, 0)} °C) is outside −76…149 °F.`,
      );
    }
  }

  if (issues.positive(`${path}.pressurePa`, 'Pressure', atm.pressurePa)) {
    const inHg = atm.pressurePa / PA_PER_INHG;
    if (atm.pressureType === 'baro' && atm.pressurePa < 85_000 && atm.pressurePa >= 45_000) {
      issues.error(
        `${path}.pressurePa`,
        'baro-looks-like-station',
        `Barometric pressure of ${fmt(inHg, 2)} inHg is far below sea-level values — it looks like station pressure. Switch the pressure type to Station.`,
      );
    } else if (atm.pressurePa < 45_000 || atm.pressurePa > 110_000) {
      issues.error(
        `${path}.pressurePa`,
        'out-of-range',
        `Pressure of ${fmt(inHg, 2)} inHg (${fmt(atm.pressurePa / 100, 0)} hPa) is outside 13.3–32.5 inHg.`,
      );
    }
  }

  if (issues.finite(`${path}.altitudeM`, 'Altitude', atm.altitudeM)) {
    if (atm.altitudeM < -500 || atm.altitudeM > 9000) {
      issues.error(
        `${path}.altitudeM`,
        'out-of-range',
        `Altitude of ${fmt(atm.altitudeM / METERS_PER_FOOT, 0)} ft is outside −1,640…29,500 ft.`,
      );
    }
  }

  if (issues.finite(`${path}.relativeHumidity`, 'Relative humidity', atm.relativeHumidity)) {
    if (atm.relativeHumidity > 1 && atm.relativeHumidity <= 100) {
      issues.error(
        `${path}.relativeHumidity`,
        'percent-not-fraction',
        `Relative humidity of ${fmt(atm.relativeHumidity, 0)} looks like a percentage — pass ${fmt(atm.relativeHumidity / 100, 2)}.`,
      );
    } else if (atm.relativeHumidity < 0 || atm.relativeHumidity > 1) {
      issues.error(`${path}.relativeHumidity`, 'out-of-range', 'Relative humidity must be 0–100%.');
    }
  }
}

/** Validate a solve input. Errors block solving; warnings are advisory. */
export function validateSolveInput(input: SolveInput): ValidationIssue[] {
  const issues = new Issues();
  const { bullet, rifle, zero } = input;

  if (issues.positive('bullet.massKg', 'Bullet weight', bullet.massKg)) {
    const gr = bullet.massKg / KG_PER_GRAIN;
    if (gr < 10 || gr > 1000) {
      issues.warn(
        'bullet.massKg',
        'unusual',
        `Bullet weight of ${fmt(gr, 1)} gr is unusual — check it.`,
      );
    }
  }

  if (issues.positive('bullet.diameterM', 'Bullet diameter', bullet.diameterM)) {
    const inches = bullet.diameterM / METERS_PER_INCH;
    if (inches > 1 && inches / 25.4 >= 0.17 && inches / 25.4 <= 0.51) {
      issues.error(
        'bullet.diameterM',
        'looks-like-mm',
        `Bullet diameter of ${fmt(inches, 3)} in looks wrong — did you mean ${fmt(inches / 25.4, 3)} in (${fmt(inches, 1)} mm)?`,
      );
    } else if (inches < 0.17 || inches > 0.51) {
      issues.warn(
        'bullet.diameterM',
        'unusual',
        `Bullet diameter of ${fmt(inches, 3)} in is unusual for a rifle.`,
      );
    }
  }

  if (
    bullet.lengthM !== undefined &&
    issues.positive('bullet.lengthM', 'Bullet length', bullet.lengthM)
  ) {
    const calibers = bullet.lengthM / bullet.diameterM;
    if (calibers < 1 || calibers > 8) {
      issues.warn(
        'bullet.lengthM',
        'unusual',
        `Bullet length of ${fmt(bullet.lengthM / METERS_PER_INCH, 3)} in is ${fmt(calibers, 1)} calibers — check it.`,
      );
    }
  }

  if (issues.positive('muzzleVelocityMps', 'Muzzle velocity', input.muzzleVelocityMps)) {
    const fps = convertVelocity(input.muzzleVelocityMps, 'mps', 'fps');
    if (input.muzzleVelocityMps > 1600) {
      issues.error(
        'muzzleVelocityMps',
        'out-of-range',
        `Muzzle velocity of ${fmt(fps, 0)} fps (${fmt(input.muzzleVelocityMps, 0)} m/s) is beyond any rifle cartridge — check the units.`,
      );
    } else if (input.muzzleVelocityMps < 150) {
      issues.warn(
        'muzzleVelocityMps',
        'unusual',
        `Muzzle velocity of ${fmt(fps, 0)} fps is very low — check it.`,
      );
    }
  }

  if (issues.finite('rifle.sightHeightM', 'Sight height', rifle.sightHeightM)) {
    const inches = rifle.sightHeightM / METERS_PER_INCH;
    if (inches < 0) {
      issues.error('rifle.sightHeightM', 'negative', 'Sight height cannot be negative.');
    } else if (inches > 6) {
      const hint = inches / 10 <= 6 ? ` — did you mean ${fmt(inches / 10, 2)} in?` : '.';
      issues.error(
        'rifle.sightHeightM',
        'out-of-range',
        `Sight height of ${fmt(inches, 2)} in looks wrong${hint}`,
      );
    } else if (inches > 4) {
      issues.warn(
        'rifle.sightHeightM',
        'unusual',
        `Sight height of ${fmt(inches, 2)} in is unusually high.`,
      );
    }
  }

  if (rifle.twistM !== undefined && issues.positive('rifle.twistM', 'Twist rate', rifle.twistM)) {
    const inches = rifle.twistM / METERS_PER_INCH;
    if (inches < 4 || inches > 24) {
      issues.warn(
        'rifle.twistM',
        'unusual',
        `Twist of 1:${fmt(inches, 1)} in is unusual — check it.`,
      );
    }
  }

  if (issues.positive('zero.rangeM', 'Zero range', zero.rangeM)) {
    const yards = zero.rangeM / METERS_PER_YARD;
    if (zero.rangeM < 5 || zero.rangeM > 1500) {
      issues.error(
        'zero.rangeM',
        'out-of-range',
        `Zero range of ${fmt(yards, 0)} yd is outside 5–1,640 yd.`,
      );
    } else if (yards > 600) {
      issues.warn('zero.rangeM', 'unusual', `Zero range of ${fmt(yards, 0)} yd is unusually long.`);
    }
  }

  if (zero.offsetM !== undefined && issues.finite('zero.offsetM', 'Zero offset', zero.offsetM)) {
    if (Math.abs(zero.offsetM) > 0.3) {
      issues.warn(
        'zero.offsetM',
        'unusual',
        `Zero offset of ${fmt(zero.offsetM / METERS_PER_INCH, 1)} in is very large.`,
      );
    }
  }

  if (zero.muzzleVelocityMps !== undefined) {
    issues.positive('zero.muzzleVelocityMps', 'Zero muzzle velocity', zero.muzzleVelocityMps);
  }

  checkAtmosphere(issues, 'atmosphere', input.atmosphere);
  if (zero.atmosphere) checkAtmosphere(issues, 'zero.atmosphere', zero.atmosphere);

  if (input.wind) {
    if (issues.finite('wind.speedMps', 'Wind speed', input.wind.speedMps)) {
      const mph = input.wind.speedMps / MPS_PER_MPH;
      if (input.wind.speedMps < 0) {
        issues.error('wind.speedMps', 'negative', 'Wind speed cannot be negative.');
      } else if (input.wind.speedMps > 50) {
        issues.error(
          'wind.speedMps',
          'out-of-range',
          `Wind speed of ${fmt(mph, 0)} mph is not survivable range weather.`,
        );
      } else if (mph > 40) {
        issues.warn('wind.speedMps', 'unusual', `Wind speed of ${fmt(mph, 0)} mph is extreme.`);
      }
    }
    issues.finite('wind.fromRad', 'Wind direction', input.wind.fromRad);
  }

  if (input.inclineRad !== undefined && issues.finite('inclineRad', 'Incline', input.inclineRad)) {
    const deg = input.inclineRad / DEG;
    if (Math.abs(deg) > 80) {
      issues.error('inclineRad', 'out-of-range', `Incline of ${fmt(deg, 0)}° is outside ±80°.`);
    } else if (Math.abs(deg) > 45) {
      issues.warn(
        'inclineRad',
        'unusual',
        `Incline of ${fmt(deg, 0)}° is very steep — double-check the angle.`,
      );
    }
  }

  if (input.coriolis) {
    if (issues.finite('coriolis.latitudeRad', 'Latitude', input.coriolis.latitudeRad)) {
      if (Math.abs(input.coriolis.latitudeRad) > Math.PI / 2) {
        issues.error(
          'coriolis.latitudeRad',
          'out-of-range',
          'Latitude must be between −90° and 90°.',
        );
      }
    }
    issues.finite('coriolis.azimuthRad', 'Azimuth', input.coriolis.azimuthRad);
  }

  if (input.ranges.length === 0) {
    issues.error('ranges', 'empty', 'At least one range is required.');
  }
  input.ranges.forEach((r, i) => {
    if (!issues.finite(`ranges.${i}`, 'Range', r)) return;
    if (r < 0 || r > 5000) {
      issues.error(
        `ranges.${i}`,
        'out-of-range',
        `Range of ${fmt(r / METERS_PER_YARD, 0)} yd is outside 0–5,468 yd.`,
      );
    }
  });

  const dt = input.options?.dtS;
  if (
    dt !== undefined &&
    issues.positive('options.dtS', 'Time step', dt) &&
    (dt < 1e-5 || dt > 0.01)
  ) {
    issues.error('options.dtS', 'out-of-range', 'Time step must be between 0.01 ms and 10 ms.');
  }

  return issues.list;
}

export function assertValidSolveInput(input: SolveInput): void {
  const issues = validateSolveInput(input);
  if (issues.some((i) => i.severity === 'error')) throw new BallisticsInputError(issues);
}

/** Plausible published BC ranges (lb/in²). */
export const PLAUSIBLE_BC: Readonly<Record<StandardDragFunction, readonly [number, number]>> = {
  G1: [0.05, 1.2],
  G7: [0.03, 0.7],
};

export function validateStandardBc(fn: StandardDragFunction, bc: number): ValidationIssue[] {
  const issues = new Issues();
  if (issues.positive('bc', `${fn} BC`, bc)) {
    const [lo, hi] = PLAUSIBLE_BC[fn];
    if (bc < lo || bc > hi) {
      const hint = fn === 'G7' && bc > hi && bc <= PLAUSIBLE_BC.G1[1] ? ' Is this a G1 value?' : '';
      issues.error(
        'bc',
        'out-of-range',
        `${fn} BC of ${bc} is outside the plausible ${lo}–${hi}.${hint}`,
      );
    }
  }
  return issues.list;
}
