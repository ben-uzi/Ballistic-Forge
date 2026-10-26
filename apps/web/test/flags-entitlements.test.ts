import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAGS, canDisplayAggregate } from '@/lib/flags';
import { PILOT_TIER, hasFeature } from '@/lib/entitlements';
import {
  UNIT_LABEL,
  dropUnitFor,
  fmtAngle,
  fmtClicks,
  fmtCorrection,
  fmtDrop,
  fmtRange,
  fmtStability,
} from '@/lib/calc/format';

describe('field data flags', () => {
  it('ships with the public reveal switched off', () => {
    expect(DEFAULT_FLAGS.fieldDataPublic).toBe(false);
    expect(DEFAULT_FLAGS.fieldRevealThresholdShots).toBe(50_000);
  });

  it('hides aggregates while the reveal flag is off, however much data there is', () => {
    expect(canDisplayAggregate(DEFAULT_FLAGS, 1_000, 500)).toBe(false);
  });

  it('still hides aggregates with too few sessions or users once revealed', () => {
    const revealed = { ...DEFAULT_FLAGS, fieldDataPublic: true };
    expect(canDisplayAggregate(revealed, 4, 10)).toBe(false);
    expect(canDisplayAggregate(revealed, 10, 2)).toBe(false);
    expect(canDisplayAggregate(revealed, 5, 3)).toBe(true);
  });
});

describe('entitlements', () => {
  it('gives beta users everything', () => {
    expect(PILOT_TIER).toBe('founder');
    expect(hasFeature(PILOT_TIER, 'dope_pdf')).toBe(true);
    expect(hasFeature(PILOT_TIER, 'suppressor_module')).toBe(true);
  });

  it('keeps the calculator free', () => {
    expect(hasFeature('free', 'calculator')).toBe(true);
    expect(hasFeature('free', 'profiles')).toBe(true);
  });

  it('marks the Pro candidates', () => {
    expect(hasFeature('free', 'dope_pdf')).toBe(false);
    expect(hasFeature('pro', 'dope_pdf')).toBe(true);
  });
});

describe('formatting', () => {
  it('labels units the way shooters write them', () => {
    expect(UNIT_LABEL.mps).toBe('m/s');
    expect(UNIT_LABEL.moa).toBe('MOA');
    expect(UNIT_LABEL.ftlbf).toBe('ft·lb');
  });

  it('shows drop in inches for imperial and centimetres for metric', () => {
    expect(dropUnitFor('in')).toBe('in');
    expect(dropUnitFor('mm')).toBe('cm');
    expect(fmtDrop(-0.254, 'in')).toBe('-10.0');
    expect(fmtDrop(-0.254, 'mm')).toBe('-25.4');
  });

  it('gives MOA an extra digit because the clicks are finer', () => {
    const quarterMoa = (Math.PI / 10800) * 0.25;
    expect(fmtAngle(quarterMoa, 'moa')).toBe('0.25');
    expect(fmtAngle(0.001, 'mil')).toBe('1.0');
  });

  it('writes a correction as a magnitude plus a direction', () => {
    const correction = { value: -1.2, clicks: -12, dialed: -1.2, direction: 'D' } as const;
    expect(fmtCorrection(correction, 'mil')).toBe('1.2 D');
    expect(fmtClicks(correction)).toBe('12 D');
  });

  it('omits the direction when there is nothing to dial', () => {
    const zero = { value: 0, clicks: 0, dialed: 0, direction: null } as const;
    expect(fmtCorrection(zero, 'mil')).toBe('0.0');
    expect(fmtClicks(zero)).toBe('0');
  });

  it('never prints a negative zero', () => {
    expect(fmtDrop(-0.0001, 'in')).toBe('0.0');
  });

  it('says unknown rather than guessing a stability factor', () => {
    expect(fmtStability(null)).toBe('unknown');
    expect(fmtStability(1.567)).toBe('1.57');
  });

  it('rounds ranges to whole units', () => {
    expect(fmtRange(914.4, 'yd')).toBe('1000');
    expect(fmtRange(914.4, 'm')).toBe('914');
  });
});
