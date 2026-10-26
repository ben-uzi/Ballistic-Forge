import { describe, expect, it } from 'vitest';
import {
  DRAG_TABLES,
  G1_TABLE,
  G7_TABLE,
  VACUUM_DRAG,
  interpolateCd,
  scaledDragModel,
  standardDragModel,
} from '../src/dragTables';
import { bcToSI } from '../src/units';

describe('drag tables', () => {
  it.each(Object.entries(DRAG_TABLES))(
    '%s Mach values are strictly ascending, Cd positive',
    (_, table) => {
      for (let i = 1; i < table.length; i++) {
        expect(table[i]?.[0]).toBeGreaterThan(table[i - 1]?.[0] ?? Infinity);
      }
      for (const [, cd] of table) expect(cd).toBeGreaterThan(0);
    },
  );

  it('peak drag is just above Mach 1 (G7 ≈ 1.05, G1 ≈ 1.4)', () => {
    const peak = (t: typeof G1_TABLE) => t.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(peak(G7_TABLE)[0]).toBe(1.05);
    expect(peak(G1_TABLE)[0]).toBe(1.4);
  });

  it('interpolates exactly at table points and linearly between them', () => {
    expect(interpolateCd(G7_TABLE, 1.0)).toBe(0.3803);
    expect(interpolateCd(G7_TABLE, 1.0125)).toBeCloseTo((0.3803 + 0.4015) / 2, 12);
    expect(interpolateCd(G1_TABLE, 2.55)).toBeCloseTo((0.5397 + 0.5325) / 2, 12);
  });

  it('clamps outside the table', () => {
    expect(interpolateCd(G7_TABLE, -1)).toBe(0.1198);
    expect(interpolateCd(G7_TABLE, 9)).toBe(0.1618);
  });

  it('throws on an empty table', () => {
    expect(() => interpolateCd([], 1)).toThrow(RangeError);
  });
});

describe('drag models', () => {
  it('single BC: coefficient = Cd / BC(SI)', () => {
    const model = standardDragModel('G7', 0.3);
    expect(model.coefficient(2, 680)).toBeCloseTo(0.298 / bcToSI(0.3), 15);
    expect(model.id).toBe('G7:0.3');
  });

  it('velocity bands pick the band for the current speed, lowest below all thresholds', () => {
    const model = standardDragModel('G1', [
      { bc: 0.5, minVelocityMps: 800 },
      { bc: 0.4, minVelocityMps: 500 },
    ]);
    const cd = interpolateCd(G1_TABLE, 2);
    expect(model.coefficient(2, 900)).toBeCloseTo(cd / bcToSI(0.5), 15);
    expect(model.coefficient(2, 600)).toBeCloseTo(cd / bcToSI(0.4), 15);
    expect(model.coefficient(2, 100)).toBeCloseTo(cd / bcToSI(0.4), 15);
    expect(model.id).toContain('bands');
  });

  it('rejects invalid BCs', () => {
    expect(() => standardDragModel('G1', 0)).toThrow(RangeError);
    expect(() => standardDragModel('G1', Number.NaN)).toThrow(RangeError);
    expect(() => standardDragModel('G1', [])).toThrow(RangeError);
    expect(() => standardDragModel('G1', [{ bc: -1, minVelocityMps: 0 }])).toThrow(RangeError);
    expect(() => scaledDragModel(VACUUM_DRAG, 0)).toThrow(RangeError);
  });

  it('scaling the BC divides the coefficient', () => {
    const base = standardDragModel('G7', 0.3);
    const scaled = scaledDragModel(base, 1.1);
    expect(scaled.coefficient(1.5, 500)).toBeCloseTo(base.coefficient(1.5, 500) / 1.1, 15);
    expect(scaled.id).toContain('×1.1');
  });

  it('vacuum has no drag', () => {
    expect(VACUUM_DRAG.coefficient(2, 700)).toBe(0);
  });
});
