import { describe, expect, it } from 'vitest';
import { standardDragModel, type StandardDragFunction } from '../src/dragTables';
import { solve, type SolveInput } from '../src/solver';
import { convertMass, convertPressure, convertTemperature, convertVelocity } from '../src/units';
import { clockToRad } from '../src/wind';
import fixture from './fixtures/reference_cases.json';
import { deg, fps, inch, toFps, yd } from './helpers';

interface ReferenceCase {
  readonly id: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly notes?: string;
  readonly input: {
    readonly dragFunction: StandardDragFunction;
    readonly bc: number;
    readonly bulletWeightGr: number;
    readonly bulletDiameterIn: number;
    readonly bulletLengthIn?: number;
    readonly muzzleVelocityFps: number;
    readonly sightHeightIn: number;
    readonly zeroRangeYd: number;
    readonly twistIn?: number;
    readonly twistDirection?: 'right' | 'left';
    readonly temperatureF: number;
    readonly pressureInHg: number;
    readonly pressureType: 'station' | 'baro';
    readonly altitudeFt: number;
    readonly humidityPercent: number;
    readonly windSpeedMph?: number;
    readonly windClock?: number;
    readonly inclineDeg?: number;
    readonly spinDrift?: boolean;
  };
  readonly expected: readonly {
    readonly rangeYd: number;
    readonly dropIn?: number;
    readonly elevationMil?: number;
    readonly windageIn?: number;
    readonly velocityFps?: number;
  }[];
  readonly tolerance?: {
    readonly elevationMil?: number;
    readonly windageMil?: number;
    readonly velocityPercent?: number;
  };
}

interface ReferenceFile {
  readonly schemaVersion: number;
  readonly cases: readonly ReferenceCase[];
}

const reference = fixture as unknown as ReferenceFile;

function toSolveInput(c: ReferenceCase): SolveInput {
  const i = c.input;
  return {
    bullet: {
      massKg: convertMass(i.bulletWeightGr, 'gr', 'kg'),
      diameterM: inch(i.bulletDiameterIn),
      ...(i.bulletLengthIn !== undefined ? { lengthM: inch(i.bulletLengthIn) } : {}),
      drag: standardDragModel(i.dragFunction, i.bc),
    },
    rifle: {
      sightHeightM: inch(i.sightHeightIn),
      ...(i.twistIn !== undefined ? { twistM: inch(i.twistIn) } : {}),
      twistDirection: i.twistDirection ?? 'right',
    },
    zero: { rangeM: yd(i.zeroRangeYd) },
    muzzleVelocityMps: fps(i.muzzleVelocityFps),
    atmosphere: {
      temperatureK: convertTemperature(i.temperatureF, 'F', 'K'),
      pressurePa: convertPressure(i.pressureInHg, 'inHg', 'Pa'),
      pressureType: i.pressureType,
      altitudeM: i.altitudeFt * 0.3048,
      relativeHumidity: i.humidityPercent / 100,
    },
    ...(i.windSpeedMph
      ? {
          wind: {
            speedMps: convertVelocity(i.windSpeedMph, 'mph', 'mps'),
            fromRad: clockToRad(i.windClock ?? 3),
          },
        }
      : {}),
    ...(i.inclineDeg ? { inclineRad: deg(i.inclineDeg) } : {}),
    ranges: c.expected.map((e) => yd(e.rangeYd)),
    options: { spinDrift: i.spinDrift ?? false },
  };
}

describe('reference case fixture', () => {
  it('has the documented shape', () => {
    expect(reference.schemaVersion).toBe(1);
    expect(Array.isArray(reference.cases)).toBe(true);
    for (const c of reference.cases) {
      expect(c.source.length).toBeGreaterThan(0);
      expect(c.sourceUrl).toMatch(/^https?:\/\//);
      expect(c.expected.length).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(reference.cases.length === 0)('external reference trajectories', () => {
  it.each(reference.cases.map((c) => [c.id, c] as const))('%s', (_, c) => {
    const solution = solve(toSolveInput(c));
    const elevationTol = c.tolerance?.elevationMil ?? 0.1;
    const windageTol = c.tolerance?.windageMil ?? 0.1;
    const velocityTol = (c.tolerance?.velocityPercent ?? 1) / 100;

    for (const e of c.expected) {
      const row = solution.rows.find((r) => Math.abs(r.rangeM - yd(e.rangeYd)) < 1e-6);
      expect(row, `${c.id} @ ${e.rangeYd} yd reached`).toBeDefined();
      if (!row) continue;
      const rangeIn = e.rangeYd * 36;
      const refElevationMil =
        e.elevationMil ?? (e.dropIn !== undefined ? -Math.atan2(e.dropIn, rangeIn) * 1000 : null);
      if (refElevationMil !== null) {
        expect(
          Math.abs(row.elevationRad * 1000 - refElevationMil),
          `${c.id} elevation @ ${e.rangeYd} yd`,
        ).toBeLessThanOrEqual(elevationTol);
      }
      if (e.windageIn !== undefined) {
        const refWindMil = Math.atan2(e.windageIn, rangeIn) * 1000;
        const ourWindMil = Math.atan2(row.windageM, row.rangeM) * 1000;
        expect(
          Math.abs(ourWindMil - refWindMil),
          `${c.id} windage @ ${e.rangeYd} yd`,
        ).toBeLessThanOrEqual(windageTol);
      }
      if (e.velocityFps !== undefined) {
        expect(
          Math.abs(toFps(row.velocityMps) / e.velocityFps - 1),
          `${c.id} velocity @ ${e.rangeYd} yd`,
        ).toBeLessThanOrEqual(velocityTol);
      }
    }
  });
});
