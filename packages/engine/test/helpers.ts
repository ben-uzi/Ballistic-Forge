import { ICAO_STANDARD_ATMOSPHERE } from '../src/atmosphere';
import { standardDragModel } from '../src/dragTables';
import type { SolveInput } from '../src/solver';
import { convertLength, convertMass, convertVelocity } from '../src/units';

export const yd = (v: number) => convertLength(v, 'yd', 'm');
export const inch = (v: number) => convertLength(v, 'in', 'm');
export const fps = (v: number) => convertVelocity(v, 'fps', 'mps');
export const toFps = (v: number) => convertVelocity(v, 'mps', 'fps');
export const toInch = (v: number) => convertLength(v, 'm', 'in');
export const deg = (v: number) => (v * Math.PI) / 180;

/**
 * SYNTHETIC test profile — a 6.5 mm-class match bullet shape. These numbers are round values for
 * exercising the physics, NOT published data for any real product.
 */
export function syntheticInput(overrides: Partial<SolveInput> = {}): SolveInput {
  return {
    bullet: {
      massKg: convertMass(140, 'gr', 'kg'),
      diameterM: inch(0.264),
      lengthM: inch(1.4),
      drag: standardDragModel('G7', 0.3),
    },
    rifle: { sightHeightM: inch(1.9), twistM: inch(8), twistDirection: 'right' },
    zero: { rangeM: yd(100) },
    muzzleVelocityMps: fps(2700),
    atmosphere: ICAO_STANDARD_ATMOSPHERE,
    ranges: [0, yd(100), yd(500), yd(1000)],
    ...overrides,
  };
}
