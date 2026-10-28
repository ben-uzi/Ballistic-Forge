import { buildDope, convertVelocity, stationPressureInHg } from '@bf/engine';
import { toDopeOptions, toSolveInput } from '@/lib/calc/map';
import {
  UNIT_LABEL,
  fmtClicks,
  fmtCorrection,
  fmtEnergy,
  fmtRange,
  fmtTime,
  fmtVelocity,
} from '@/lib/calc/format';
import type { CalcForm } from '@/lib/calc/types';
import { effectiveMuzzleVelocity } from '@/lib/profiles/to-form';
import type { StoredLoad, StoredRifle } from '@/lib/store/types';

/**
 * Building a DOPE card.
 *
 * Everything the printed card shows is resolved here as strings, so the PDF
 * component is pure layout and the numbers can be tested without rendering a
 * document.
 */

export type DopeFormat = 'letter' | 'half' | 'band';

export interface DopeFormatSpec {
  readonly id: DopeFormat;
  readonly label: string;
  readonly description: string;
  /** Page size in PDF points. */
  readonly size: readonly [number, number];
  /** Columns to drop when space is tight. */
  readonly columns: readonly DopeColumn[];
  readonly fontSize: number;
}

export type DopeColumn = 'range' | 'elevation' | 'clicks' | 'wind' | 'velocity' | 'energy' | 'tof';

export const DOPE_FORMATS: Readonly<Record<DopeFormat, DopeFormatSpec>> = {
  letter: {
    id: 'letter',
    label: 'Letter',
    description: 'Full page. Every column, easy to read on a bench.',
    size: [612, 792],
    columns: ['range', 'elevation', 'clicks', 'wind', 'velocity', 'energy', 'tof'],
    fontSize: 9,
  },
  half: {
    id: 'half',
    label: 'Half page',
    description: 'Fits a data book pocket. Drops energy.',
    size: [396, 612],
    columns: ['range', 'elevation', 'clicks', 'wind', 'velocity', 'tof'],
    fontSize: 8,
  },
  band: {
    id: 'band',
    label: 'Scope cap / wrist',
    description: 'A narrow strip for a turret cap or wrist band. Elevation and wind only.',
    size: [180, 396],
    columns: ['range', 'elevation', 'wind'],
    fontSize: 7,
  },
};

export interface DopeCardRow {
  readonly range: string;
  readonly elevation: string;
  readonly clicks: string;
  /** One hold per configured wind speed, in the card's angular unit. */
  readonly winds: readonly string[];
  readonly velocity: string;
  readonly energy: string;
  readonly tof: string;
  readonly transonic: boolean;
  readonly subsonic: boolean;
}

export interface DopeCard {
  readonly rifleName: string;
  readonly loadName: string;
  readonly bullet: string;
  readonly bc: string;
  readonly muzzleVelocity: string;
  /** Spelled out when the velocity is trued or temperature-corrected. */
  readonly muzzleVelocityNote: string | null;
  readonly zero: string;
  readonly sightHeight: string;
  readonly clicks: string;
  readonly atmosphere: string;
  readonly suppressed: boolean;
  readonly windLabels: readonly string[];
  readonly units: {
    readonly range: string;
    readonly angular: string;
    readonly velocity: string;
    readonly energy: string;
  };
  readonly rows: readonly DopeCardRow[];
  readonly generatedAt: string;
}

export interface DopeCardOptions {
  /** Full-value crosswind speeds, in the form's wind unit. */
  readonly windSpeeds?: readonly number[];
  readonly suppressed?: boolean;
  readonly now?: Date;
}

export function buildDopeCard(
  rifle: StoredRifle,
  load: StoredLoad,
  form: CalcForm,
  options: DopeCardOptions = {},
): DopeCard {
  const windSpeeds = options.windSpeeds ?? form.windHoldSpeeds;
  const withHolds: CalcForm = { ...form, windHoldSpeeds: windSpeeds };

  const table = buildDope(toSolveInput(withHolds), toDopeOptions(withHolds));
  const { units } = form;
  const mv = effectiveMuzzleVelocity(load, form.temperature);

  const notes: string[] = [];
  if (mv.trued) notes.push(`trued ${load.truedMuzzleVelocityFps?.at ?? ''}`.trim());
  if (mv.temperatureAdjustmentFps !== 0) {
    notes.push(
      `${mv.temperatureAdjustmentFps > 0 ? '+' : ''}${String(mv.temperatureAdjustmentFps)} fps for temperature`,
    );
  }

  const atmosphere = table.solution.atmosphere;

  return {
    rifleName: rifle.name,
    loadName: load.name,
    bullet: `${String(load.bullet.weightGr)} gr ${load.bullet.name}`,
    bc: `${load.bullet.bcType} ${String(load.bullet.bcValue)}`,
    muzzleVelocity: `${String(Math.round(mv.fps))} fps`,
    muzzleVelocityNote: notes.length === 0 ? null : notes.join(', '),
    zero: `${String(rifle.zeroRangeYd)} yd`,
    sightHeight: `${String(rifle.sightHeightIn)} in`,
    clicks: describeClicks(form),
    atmosphere: `${String(Math.round(form.temperature))} ${UNIT_LABEL[units.temperature]} · ${stationPressureInHg(atmosphere).toFixed(2)} inHg station · ${String(Math.round(form.altitude))} ${UNIT_LABEL[units.altitude]} · ${String(Math.round(form.humidity))}% RH`,
    suppressed: options.suppressed ?? false,
    windLabels: windSpeeds.map((speed) => `${String(speed)} ${UNIT_LABEL[units.windSpeed]}`),
    units: {
      range: UNIT_LABEL[units.range],
      angular: UNIT_LABEL[units.angular],
      velocity: UNIT_LABEL[units.velocity],
      energy: UNIT_LABEL[units.energy],
    },
    rows: table.rows.map((row) => ({
      range: fmtRange(row.rangeM, units.range),
      elevation: fmtCorrection(row.elevation, units.angular),
      clicks: fmtClicks(row.elevation),
      winds: windSpeeds.map((speed) => {
        const target = convertVelocity(speed, units.windSpeed, 'mps');
        const hold = row.windHolds.find((entry) => Math.abs(entry.speedMps - target) < 1e-6);
        return hold === undefined ? '—' : fmtCorrection(hold.correction, units.angular);
      }),
      velocity: fmtVelocity(row.velocityMps, units.velocity),
      energy: fmtEnergy(row.energyJ, units.energy),
      tof: fmtTime(row.timeS),
      transonic: row.regime === 'transonic',
      subsonic: row.regime === 'subsonic',
    })),
    generatedAt: (options.now ?? new Date()).toISOString().slice(0, 16).replace('T', ' '),
  };
}

function describeClicks(form: CalcForm): string {
  const label: Record<string, string> = {
    mil_0_1: '0.1 mil',
    moa_0_25: '1/4 MOA',
    moa_0_125: '1/8 MOA',
  };
  const elevation = label[form.elevationClickKey] ?? form.elevationClickKey;
  const windage = label[form.windageClickKey] ?? form.windageClickKey;
  return elevation === windage ? elevation : `${elevation} elev / ${windage} wind`;
}
