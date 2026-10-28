import { describe, expect, it } from 'vitest';
import {
  ChronoImportError,
  findTable,
  importChronoCsv,
  importPastedVelocities,
} from '../src/chrono.ts';

/** A plain export: header on line one, one row per shot. */
const SIMPLE = `Shot,Velocity (fps)
1,2690
2,2695
3,2688
4,2692
5,2691
`;

/** What these devices actually produce: session metadata above the table. */
const WITH_PREAMBLE = `Garmin Xero C1 Pro
Session,12
Date,2026-05-01
Bullet Weight,140

Shot Number,Speed (FPS),Time
1,2690,09:14:02
2,2695,09:14:31
3,2688,09:15:02
`;

const METRIC = `Shot,Velocity (m/s)
1,820.0
2,821.5
3,819.0
`;

describe('finding the table', () => {
  it('reads a header on the first line', () => {
    const { header, rows } = findTable(SIMPLE);
    expect(header).toEqual(['Shot', 'Velocity (fps)']);
    expect(rows).toHaveLength(5);
  });

  it('skips the metadata a chronograph writes above the table', () => {
    const { header, rows } = findTable(WITH_PREAMBLE);
    expect(header).toEqual(['Shot Number', 'Speed (FPS)', 'Time']);
    expect(rows).toHaveLength(3);
  });

  it('refuses an empty file', () => {
    expect(() => findTable('')).toThrow(ChronoImportError);
  });

  it('refuses a file with no table in it', () => {
    expect(() => findTable('just some prose\nwith no columns\n')).toThrow(/no table was found/i);
  });
});

describe('importing', () => {
  it('reads the velocity column', () => {
    const result = importChronoCsv(SIMPLE);
    expect(result.column).toBe('Velocity (fps)');
    expect(result.velocitiesFps).toEqual([2690, 2695, 2688, 2692, 2691]);
    expect(result.unit).toBe('fps');
  });

  it('finds the velocity column under a different name', () => {
    const result = importChronoCsv(WITH_PREAMBLE);
    expect(result.column).toBe('Speed (FPS)');
    expect(result.velocitiesFps).toEqual([2690, 2695, 2688]);
  });

  it('converts metric exports to fps', () => {
    const result = importChronoCsv(METRIC);
    expect(result.unit).toBe('mps');
    expect(result.velocitiesFps[0]).toBeCloseTo(2690.3, 0);
  });

  it('detects metric from the magnitudes when the header says nothing', () => {
    const result = importChronoCsv('Shot,V\n1,820\n2,821\n3,819\n');
    expect(result.unit).toBe('mps');
    expect(result.velocitiesFps[0]).toBeCloseTo(2690.3, 0);
  });

  it('ignores the shot-number column', () => {
    expect(importChronoCsv(SIMPLE).column).not.toBe('Shot');
  });

  it('lets the caller override the column', () => {
    const text = 'Velocity,Backup\n2690,2700\n2695,2705\n2688,2698\n';
    expect(importChronoCsv(text, 'Backup').velocitiesFps).toEqual([2700, 2705, 2698]);
  });

  it('rejects an override that is not in the file', () => {
    expect(() => importChronoCsv(SIMPLE, 'Nope')).toThrow(/no column called "Nope"/);
  });

  it('offers the plausible columns so the user can choose', () => {
    const text = 'Velocity,Backup\n2690,2700\n2695,2705\n2688,2698\n';
    expect(importChronoCsv(text).candidates).toEqual(['Velocity', 'Backup']);
  });

  it('drops readings that cannot be muzzle velocities', () => {
    const text = 'Shot,Velocity\n1,2690\n2,0\n3,2695\n4,99999\n5,2688\n';
    const result = importChronoCsv(text);
    expect(result.velocitiesFps).toEqual([2690, 2695, 2688]);
    expect(result.skipped).toBe(2);
  });

  it('skips blank rows without counting them as shots', () => {
    const text = 'Shot,Velocity\n1,2690\n2,\n3,2695\n4,2688\n';
    const result = importChronoCsv(text);
    expect(result.velocitiesFps).toHaveLength(3);
    expect(result.skipped).toBe(1);
  });

  it('copes with thousands separators', () => {
    const text = 'Shot,Velocity\n1,"2,690"\n2,"2,695"\n3,"2,688"\n';
    expect(importChronoCsv(text).velocitiesFps).toEqual([2690, 2695, 2688]);
  });

  it('says what it did, including the conversion', () => {
    expect(importChronoCsv(METRIC).note).toMatch(/3 shots read, converted from m\/s/);
  });

  it('refuses a column with nothing velocity-shaped in it', () => {
    const text = 'Shot,Temp\n1,70\n2,71\n3,72\n';
    expect(() => importChronoCsv(text, 'Temp')).toThrow(/no readings that look like muzzle/i);
  });

  it('refuses a file with a header and no shots', () => {
    expect(() => importChronoCsv('Shot,Velocity\n')).toThrow(ChronoImportError);
  });
});

describe('pasted text', () => {
  it('reads a column of numbers', () => {
    expect(importPastedVelocities('2690\n2695\n2688')).toEqual([2690, 2695, 2688]);
  });

  it('reads numbers separated any way a phone keyboard produces', () => {
    expect(importPastedVelocities('2690, 2695; 2688  2692')).toEqual([2690, 2695, 2688, 2692]);
  });

  it('ignores anything that is not a plausible velocity', () => {
    expect(importPastedVelocities('shot 1: 2690 fps\nshot 2: 2695 fps')).toEqual([2690, 2695]);
  });

  it('converts a metric paste', () => {
    const [first] = importPastedVelocities('820 821 819', 'mps');
    expect(first).toBeCloseTo(2690.3, 0);
  });

  it('returns nothing rather than guessing from empty text', () => {
    expect(importPastedVelocities('')).toEqual([]);
    expect(importPastedVelocities('no numbers here')).toEqual([]);
  });
});
