import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index';
import { coriolisAcceleration, earthRotationVector } from '../src/coriolis';
import { EARTH_ROTATION_RAD_PER_S } from '../src/constants';
import { temperatureAdjustedMuzzleVelocity } from '../src/load';
import { bisect, illinois, secant } from '../src/rootFinding';
import { litzAerodynamicJumpRad, litzSpinDriftM, millerStabilityFactor } from '../src/spinDrift';
import { convertMass } from '../src/units';
import { clockToRad, windComponents, windVector } from '../src/wind';
import { deg, fps, inch, toInch } from './helpers';

describe('engine package', () => {
  it('exposes a semver version string', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('wind', () => {
  it('maps clock positions to directions', () => {
    expect(clockToRad(12)).toBe(0);
    expect(clockToRad(3)).toBeCloseTo(Math.PI / 2, 12);
    expect(clockToRad(9)).toBeCloseTo((3 * Math.PI) / 2, 12);
  });

  it('splits into head and cross components', () => {
    const c = windComponents({ speedMps: 10, fromRad: clockToRad(2) });
    expect(c.headwindMps).toBeCloseTo(5, 12);
    expect(c.crosswindMps).toBeCloseTo(10 * Math.sin(Math.PI / 3), 12);
  });

  it('wind from 3 o’clock blows toward the left (−z)', () => {
    const v = windVector({ speedMps: 5, fromRad: clockToRad(3) });
    expect(v.z).toBeCloseTo(-5, 12);
    expect(v.x).toBeCloseTo(0, 12);
    expect(windVector({ speedMps: 5, fromRad: 0 }).x).toBe(-5);
  });
});

describe('coriolis acceleration', () => {
  it('is −2Ω×v', () => {
    const a = coriolisAcceleration({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(a.x).toBeCloseTo(0, 15);
    expect(a.y).toBeCloseTo(0, 15);
    expect(a.z).toBe(2);
  });
});

describe('earth rotation vector', () => {
  it('points along the polar axis', () => {
    const north = earthRotationVector({ latitudeRad: 0, azimuthRad: 0 });
    expect(north.x).toBeCloseTo(EARTH_ROTATION_RAD_PER_S, 15);
    const pole = earthRotationVector({ latitudeRad: Math.PI / 2, azimuthRad: 1 });
    expect(pole.y).toBeCloseTo(EARTH_ROTATION_RAD_PER_S, 15);
  });
});

describe('Miller stability', () => {
  const base = {
    massKg: convertMass(140, 'gr', 'kg'),
    diameterM: inch(0.264),
    lengthM: inch(1.4),
    twistM: inch(8),
    muzzleVelocityMps: fps(2700),
    temperatureK: 288.15,
    stationPressurePa: 29.92 * 3386.389,
  };

  it('matches a hand calculation of the Miller formula', () => {
    // 30·140 / (30.30² · 0.264³ · 5.303 · (1 + 5.303²)) · (2700/2800)^⅓ ≈ 1.595
    expect(millerStabilityFactor(base)).toBeCloseTo(1.595, 2);
  });

  it('scales with 1/twist², rises with velocity, falls with air density', () => {
    const sg = millerStabilityFactor(base);
    expect(millerStabilityFactor({ ...base, twistM: inch(10) })).toBeCloseTo(sg * 0.64, 9);
    expect(millerStabilityFactor({ ...base, muzzleVelocityMps: fps(3000) })).toBeGreaterThan(sg);
    expect(millerStabilityFactor({ ...base, stationPressurePa: 110_000 })).toBeLessThan(sg);
  });
});

describe('Litz approximations', () => {
  it('spin drift = 1.25·(Sg + 1.2)·t^1.83 inches', () => {
    expect(toInch(litzSpinDriftM(1.5, 1))).toBeCloseTo(3.375, 12);
    expect(litzSpinDriftM(1.5, 0)).toBe(0);
  });

  it('aerodynamic jump scales with crosswind and flips sign with direction', () => {
    const up = litzAerodynamicJumpRad(1.8, 5, 4.4704);
    expect(up).toBeGreaterThan(0);
    expect(litzAerodynamicJumpRad(1.8, 5, -4.4704)).toBeCloseTo(-up, 15);
  });
});

describe('powder temperature sensitivity', () => {
  it('is linear in temperature difference', () => {
    expect(temperatureAdjustedMuzzleVelocity(800, 288.15, 298.15, 0.5)).toBe(805);
    expect(temperatureAdjustedMuzzleVelocity(800, 288.15, 278.15, 0.5)).toBe(795);
  });
});

describe('root finding', () => {
  const f = (x: number) => x * x - 2;

  it('secant converges and reports failure on flat or non-finite functions', () => {
    expect(secant(f, 1, 2, 1e-12).x).toBeCloseTo(Math.SQRT2, 10);
    expect(secant(() => 1, 0, 1, 1e-12).converged).toBe(false);
    expect(secant(() => Number.NaN, 0, 1, 1e-12).converged).toBe(false);
    expect(secant((x) => Math.atan(x) - 10, 0, 1, 1e-12, 5).converged).toBe(false);
  });

  it('bisect handles infinite values and rejects non-brackets', () => {
    const r = bisect((x) => (x < 0.5 ? -Infinity : f(x)), 0, 2, 1e-12);
    expect(r?.x).toBeCloseTo(Math.SQRT2, 10);
    expect(bisect((x) => -f(x), 0, 2, 1e-12)?.x).toBeCloseTo(Math.SQRT2, 10);
    expect(bisect(f, 2, 3, 1e-12)).toBeNull();
    expect(bisect(f, 0, 2, 0, 0, 5)?.converged).toBe(false);
  });

  it('illinois converges, accepts exact endpoints, and rejects non-brackets', () => {
    expect(illinois(f, 0, 2, 1e-12, 1e-14)?.x).toBeCloseTo(Math.SQRT2, 10);
    expect(illinois((x) => x, 0, 1, 1e-12, 1e-12)?.x).toBe(0);
    expect(illinois((x) => x - 1, 0, 1, 1e-12, 1e-12)?.x).toBe(1);
    expect(illinois(f, 2, 3, 1e-12, 1e-12)).toBeNull();
    expect(illinois(() => Number.NaN, 0, 1, 1e-12, 1e-12)).toBeNull();
    const holeInMiddle = (x: number) => (x <= 0 ? -1 : x >= 1 ? 1 : Number.NaN);
    expect(illinois(holeInMiddle, 0, 1, 1e-12, 1e-12)?.converged).toBe(false);
    expect(illinois((x) => Math.cbrt(x - 0.3), 0, 1, 0, 0, 3)?.converged).toBe(false);
  });

  it('helpers: deg', () => {
    expect(deg(180)).toBeCloseTo(Math.PI, 12);
  });
});
