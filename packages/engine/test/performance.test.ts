import { describe, expect, it } from 'vitest';
import { rangeSteps } from '../src/dope';
import { solve } from '../src/solver';
import { syntheticInput, yd } from './helpers';

describe('performance', () => {
  it('solves 0–1,500 yd at 1 yd resolution well inside the 50 ms phone budget', () => {
    const input = syntheticInput({
      ranges: rangeSteps(0, yd(1500), yd(1)),
      wind: { speedMps: 4, fromRad: 1 },
      coriolis: { latitudeRad: 0.7, azimuthRad: 1 },
    });
    solve(input);
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      solve(input);
      times.push(performance.now() - t0);
    }
    const median = [...times].sort((a, b) => a - b)[2] ?? Infinity;
    console.info(`0–1,500 yd @ 1 yd with wind + Coriolis: median ${median.toFixed(1)} ms`);
    // A desktop runs several times faster than a mid-range phone; keep a 5× margin.
    expect(median).toBeLessThan(10);
  });
});
