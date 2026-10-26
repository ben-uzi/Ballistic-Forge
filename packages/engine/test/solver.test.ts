import { describe, expect, it } from 'vitest';
import { ICAO_STANDARD_ATMOSPHERE } from '../src/atmosphere';
import { STANDARD_GRAVITY } from '../src/constants';
import { rangeSteps } from '../src/dope';
import { VACUUM_DRAG } from '../src/dragTables';
import { flightRegime, solve, solveRiflemansRule, type TrajectoryRow } from '../src/solver';
import { footPoundsFromGrainsFps, JOULES_PER_FOOT_POUND } from '../src/units';
import { BallisticsInputError } from '../src/validation';
import { ZeroUnreachableError } from '../src/zero';
import { deg, fps, inch, syntheticInput, toFps, yd } from './helpers';

const at = (rows: readonly TrajectoryRow[], rangeM: number): TrajectoryRow => {
  const row = rows.find((r) => Math.abs(r.rangeM - rangeM) < 1e-9);
  if (!row) throw new Error(`no row at ${rangeM}`);
  return row;
};

describe('vacuum trajectory', () => {
  it('matches the analytical parabola within 1e-6 relative', () => {
    const input = syntheticInput({
      bullet: { ...syntheticInput().bullet, drag: VACUUM_DRAG },
      ranges: [yd(300), yd(1000)],
      options: { spinDrift: false },
    });
    const s = solve(input);
    const v0 = input.muzzleVelocityMps;
    const a = s.zeroAngleRad;
    const h = input.rifle.sightHeightM;
    for (const row of s.rows) {
      const x = row.rangeM;
      const exact =
        -h + x * Math.tan(a) - (STANDARD_GRAVITY * x * x) / (2 * v0 * v0 * Math.cos(a) ** 2);
      expect(Math.abs(row.pathM - exact) / Math.abs(exact)).toBeLessThan(1e-6);
      expect(row.timeS).toBeCloseTo(x / (v0 * Math.cos(a)), 9);
    }
  });
});

describe('zeroing', () => {
  it('path crosses the line of sight at the zero range within 0.001 in', () => {
    const s = solve(syntheticInput({ ranges: [yd(100)] }));
    expect(Math.abs(at(s.rows, yd(100)).pathM)).toBeLessThan(inch(0.001));
  });

  it('honors a zero offset (POI high at the zero range)', () => {
    const s = solve(syntheticInput({ zero: { rangeM: yd(100), offsetM: inch(1.5) } }));
    expect(at(s.rows, yd(100)).pathM).toBeCloseTo(inch(1.5), 5);
  });

  it('uses the zero atmosphere: zeroed cold, shooting warm hits high at the zero range', () => {
    const cold = { ...ICAO_STANDARD_ATMOSPHERE, temperatureK: 263.15 };
    const warm = { ...ICAO_STANDARD_ATMOSPHERE, temperatureK: 308.15 };
    const s = solve(
      syntheticInput({
        zero: { rangeM: yd(100), atmosphere: cold },
        atmosphere: warm,
        ranges: [yd(100), yd(800)],
      }),
    );
    expect(at(s.rows, yd(100)).pathM).toBeGreaterThan(inch(0.001));
    expect(s.zeroAtmosphere.densityKgM3).toBeGreaterThan(s.atmosphere.densityKgM3);
  });

  it('keeps the zero angle from the zero muzzle velocity', () => {
    const s = solve(
      syntheticInput({
        zero: { rangeM: yd(100), muzzleVelocityMps: fps(2650) },
        ranges: [yd(100)],
      }),
    );
    expect(at(s.rows, yd(100)).pathM).toBeGreaterThan(0);
  });

  it('throws when the zero range cannot be reached', () => {
    expect(() => solve(syntheticInput({ options: { velocityFloorMps: fps(2690) } }))).toThrow(
      ZeroUnreachableError,
    );
  });
});

describe('flat fire in still air', () => {
  const s = solve(syntheticInput({ ranges: rangeSteps(0, yd(1500), yd(10)) }));

  it('velocity decreases strictly with range', () => {
    for (let i = 1; i < s.rows.length; i++) {
      expect(s.rows[i]?.velocityMps).toBeLessThan(s.rows[i - 1]?.velocityMps ?? 0);
    }
  });

  it('starts at the muzzle: sight height below LOS, MV, zero corrections', () => {
    const muzzle = at(s.rows, 0);
    expect(muzzle.pathM).toBeCloseTo(-inch(1.9), 12);
    expect(toFps(muzzle.velocityMps)).toBeCloseTo(2700, 9);
    expect(muzzle.elevationRad).toBe(0);
    expect(muzzle.windageRad).toBe(0);
  });

  it('energy (½mv²) agrees with the traditional ft-lbf formula within 0.1%', () => {
    for (const row of s.rows) {
      const traditional =
        footPoundsFromGrainsFps(140, toFps(row.velocityMps)) * JOULES_PER_FOOT_POUND;
      expect(Math.abs(row.energyJ / traditional - 1)).toBeLessThan(1e-3);
    }
  });

  it('flags transonic and subsonic rows', () => {
    const regimes = new Set(s.rows.map((r) => r.regime));
    expect(regimes).toEqual(new Set(['supersonic', 'transonic', 'subsonic']));
    for (const r of s.rows) expect(r.regime).toBe(flightRegime(r.mach));
  });

  it('elevation correction grows with range past the zero', () => {
    expect(at(s.rows, yd(1000)).elevationRad).toBeGreaterThan(at(s.rows, yd(500)).elevationRad);
    expect(at(s.rows, yd(500)).elevationRad).toBeGreaterThan(0);
  });
});

describe('flightRegime', () => {
  it('classifies by Mach', () => {
    expect(flightRegime(1.5)).toBe('supersonic');
    expect(flightRegime(1.2)).toBe('transonic');
    expect(flightRegime(1.0)).toBe('subsonic');
  });
});

describe('step size convergence', () => {
  it('halving dt changes the 1,000 yd drop by < 0.05%', () => {
    const drop = (dtS: number) =>
      at(solve(syntheticInput({ ranges: [yd(1000)], options: { dtS } })).rows, yd(1000)).pathM;
    const coarse = drop(0.0005);
    const fine = drop(0.00025);
    expect(Math.abs(coarse / fine - 1)).toBeLessThan(5e-4);
  });
});

describe('wind', () => {
  const windy = (clock: number) =>
    at(
      solve(
        syntheticInput({
          ranges: [yd(800)],
          wind: { speedMps: 4.4704, fromRad: (clock / 12) * 2 * Math.PI },
          options: { spinDrift: false },
        }),
      ).rows,
      yd(800),
    );

  it('3 o’clock and 9 o’clock winds give mirror-image drift', () => {
    const right = windy(3);
    const left = windy(9);
    expect(right.windageM).toBeLessThan(0);
    expect(left.windageM).toBeCloseTo(-right.windageM, 9);
    expect(left.pathM).toBeCloseTo(right.pathM, 9);
  });

  it('headwind drops more than tailwind', () => {
    expect(windy(12).pathM).toBeLessThan(windy(6).pathM);
  });
});

describe('incline', () => {
  const elevation = (inclineDeg: number) =>
    at(solve(syntheticInput({ ranges: [yd(600)], inclineRad: deg(inclineDeg) })).rows, yd(600))
      .elevationRad;

  it('uphill and downhill are nearly identical and both less than flat', () => {
    const flat = elevation(0);
    const up = elevation(20);
    const down = elevation(-20);
    expect(up).toBeLessThan(flat);
    expect(down).toBeLessThan(flat);
    expect(Math.abs(up - down) / flat).toBeLessThan(0.05);
  });

  it("the rifleman's rule is close to, but not the same as, true incline integration", () => {
    const input = syntheticInput({ ranges: [yd(600)], inclineRad: deg(20) });
    const rr = at(solveRiflemansRule(input).rows, yd(600));
    const truth = elevation(20);
    expect(rr.rangeM).toBeCloseTo(yd(600), 9);
    expect(rr.pathM).toBeCloseTo(-Math.tan(rr.elevationRad) * yd(600), 12);
    expect(rr.elevationRad).not.toBeCloseTo(truth, 6);
    expect(Math.abs(rr.elevationRad - truth) / truth).toBeLessThan(0.05);
  });

  it("the rifleman's rule with no incline equals level fire", () => {
    const input = syntheticInput({ ranges: [yd(600)] });
    expect(at(solveRiflemansRule(input).rows, yd(600)).elevationRad).toBeCloseTo(elevation(0), 12);
  });
});

describe('coriolis', () => {
  const row = (latitudeDeg: number, azimuthDeg: number) =>
    at(
      solve(
        syntheticInput({
          ranges: [yd(1000)],
          coriolis: { latitudeRad: deg(latitudeDeg), azimuthRad: deg(azimuthDeg) },
          options: { spinDrift: false },
        }),
      ).rows,
      yd(1000),
    );

  it('deflects right in the northern hemisphere and left in the southern', () => {
    expect(row(45, 0).coriolisHorizontalM).toBeGreaterThan(0);
    expect(row(-45, 0).coriolisHorizontalM).toBeLessThan(0);
    expect(row(45, 0).windageM).toBeCloseTo(row(45, 0).coriolisHorizontalM, 9);
  });

  it('firing east hits high, firing west hits low (Eötvös)', () => {
    expect(row(30, 90).coriolisVerticalM).toBeGreaterThan(0);
    expect(row(30, 270).coriolisVerticalM).toBeLessThan(0);
  });

  it('is a small effect (well under 0.1 mil horizontal at 1,000 yd, 45°N)', () => {
    const h = row(45, 0).coriolisHorizontalM;
    expect(h / yd(1000)).toBeLessThan(1e-4);
    expect(h).toBeGreaterThan(0.01);
  });

  it('is zero when not requested', () => {
    const s = solve(syntheticInput({ ranges: [yd(1000)] }));
    expect(at(s.rows, yd(1000)).coriolisHorizontalM).toBe(0);
    expect(at(s.rows, yd(1000)).coriolisVerticalM).toBe(0);
  });
});

describe('spin drift and stability', () => {
  it('drifts right for right-hand twist and left for left-hand twist', () => {
    const right = solve(syntheticInput({ ranges: [yd(1000)] }));
    const left = solve(
      syntheticInput({
        ranges: [yd(1000)],
        rifle: { sightHeightM: inch(1.9), twistM: inch(8), twistDirection: 'left' },
      }),
    );
    expect(at(right.rows, yd(1000)).spinDriftM).toBeGreaterThan(0);
    expect(at(left.rows, yd(1000)).spinDriftM).toBeCloseTo(
      -at(right.rows, yd(1000)).spinDriftM,
      12,
    );
    expect(right.stabilityFactor).toBeGreaterThan(1.4);
    expect(right.warnings).toEqual([]);
  });

  it('is disabled with a reason when bullet length is unknown', () => {
    const { lengthM: _omit, ...noLength } = syntheticInput().bullet;
    const s = solve(syntheticInput({ bullet: noLength }));
    expect(s.stabilityFactor).toBeNull();
    expect(s.rows.every((r) => r.spinDriftM === 0)).toBe(true);
    expect(s.warnings.map((w) => w.code)).toEqual(['spin-drift-unavailable']);
    expect(s.warnings[0]?.message).toContain('bullet length');
  });

  it('names both missing inputs', () => {
    const { lengthM: _omit, ...noLength } = syntheticInput().bullet;
    const s = solve(syntheticInput({ bullet: noLength, rifle: { sightHeightM: inch(1.9) } }));
    expect(s.warnings[0]?.message).toContain('bullet length and twist rate');
  });

  it('can be turned off without a warning', () => {
    const s = solve(syntheticInput({ options: { spinDrift: false } }));
    expect(s.warnings).toEqual([]);
    expect(s.rows.every((r) => r.spinDriftM === 0)).toBe(true);
  });

  it('warns on marginal and unstable twist', () => {
    const withTwist = (twistIn: number) =>
      solve(
        syntheticInput({ rifle: { sightHeightM: inch(1.9), twistM: inch(twistIn) } }),
      ).warnings.map((w) => w.code);
    expect(withTwist(9.5)).toEqual(['marginally-stable']);
    expect(withTwist(12)).toEqual(['unstable']);
  });
});

describe('aerodynamic jump', () => {
  const wind = { speedMps: 4.4704, fromRad: Math.PI / 2 };

  it('raises impact for a right-hand twist in wind from the right', () => {
    const base = syntheticInput({ ranges: [yd(600)], wind });
    const off = at(solve(base).rows, yd(600));
    const on = at(solve({ ...base, options: { aerodynamicJump: true } }).rows, yd(600));
    expect(on.pathM).toBeGreaterThan(off.pathM);
  });

  it('warns when stability inputs are missing', () => {
    const { lengthM: _omit, ...noLength } = syntheticInput().bullet;
    const s = solve(syntheticInput({ bullet: noLength, wind, options: { aerodynamicJump: true } }));
    expect(s.warnings.map((w) => w.code)).toContain('aerodynamic-jump-unavailable');
  });
});

describe('poi offset', () => {
  it('shifts impact by angle × range', () => {
    const base = syntheticInput({ ranges: [yd(500)] });
    const shifted = solve({
      ...base,
      options: { poiOffset: { verticalRad: 1e-3, horizontalRad: -5e-4 } },
    });
    const plain = at(solve(base).rows, yd(500));
    const row = at(shifted.rows, yd(500));
    expect(row.pathM - plain.pathM).toBeCloseTo(1e-3 * yd(500), 9);
    expect(row.windageM - plain.windageM).toBeCloseTo(-5e-4 * yd(500), 9);
  });
});

describe('termination', () => {
  it('stops at the velocity floor and says so', () => {
    const s = solve(
      syntheticInput({
        ranges: rangeSteps(0, yd(1500), yd(100)),
        options: { velocityFloorMps: fps(2000) },
      }),
    );
    expect(s.termination?.reason).toBe('velocity-floor');
    expect(s.rows.length).toBeLessThan(16);
    expect(s.warnings.map((w) => w.code)).toContain('terminated');
  });

  it('stops at the time cap', () => {
    const s = solve(syntheticInput({ ranges: [yd(100), yd(1500)], options: { maxTimeS: 1 } }));
    expect(s.termination?.reason).toBe('time-cap');
    expect(s.rows).toHaveLength(1);
  });

  it('sorts and de-duplicates requested ranges', () => {
    const s = solve(syntheticInput({ ranges: [yd(300), yd(100), yd(300)] }));
    expect(s.rows.map((r) => r.rangeM)).toEqual([yd(100), yd(300)]);
  });
});

describe('input validation', () => {
  it('rejects nonsense with a human message', () => {
    expect(() => solve(syntheticInput({ rifle: { sightHeightM: inch(25) } }))).toThrow(
      BallisticsInputError,
    );
    expect(() => solve(syntheticInput({ rifle: { sightHeightM: inch(25) } }))).toThrow(
      /did you mean 2\.5 in/,
    );
  });
});
