/** Descriptive statistics, Student-t confidence intervals and robust outlier filtering. */

function requireCount(values: readonly number[], min: number, what: string): void {
  if (values.length < min) {
    throw new RangeError(`${what} needs at least ${min} value${min === 1 ? '' : 's'}`);
  }
}

export function mean(values: readonly number[]): number {
  requireCount(values, 1, 'mean');
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation (n − 1). */
export function standardDeviation(values: readonly number[]): number {
  requireCount(values, 2, 'standardDeviation');
  const m = mean(values);
  const ss = values.reduce((sum, v) => sum + (v - m) * (v - m), 0);
  return Math.sqrt(ss / (values.length - 1));
}

/** Extreme spread: max − min. */
export function extremeSpread(values: readonly number[]): number {
  requireCount(values, 1, 'extremeSpread');
  return Math.max(...values) - Math.min(...values);
}

export function median(values: readonly number[]): number {
  requireCount(values, 1, 'median');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const upper = sorted[mid] ?? NaN;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? NaN) + upper) / 2;
}

/** Median absolute deviation (unscaled). */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/** Scale factor making MAD a consistent estimator of σ for normal data. */
export const MAD_SCALE = 1.4826;

export interface StringSummary {
  readonly n: number;
  readonly mean: number;
  /** Null for a single shot. */
  readonly sd: number | null;
  readonly es: number;
  readonly min: number;
  readonly max: number;
}

export function summarize(values: readonly number[]): StringSummary {
  requireCount(values, 1, 'summarize');
  return {
    n: values.length,
    mean: mean(values),
    sd: values.length >= 2 ? standardDeviation(values) : null,
    es: extremeSpread(values),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** ln Γ(x) via the Lanczos approximation (g = 7, n = 9). */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0] ?? 0;
  for (let i = 1; i < LANCZOS.length; i++) a += (LANCZOS[i] ?? 0) / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (Lentz's method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-15) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Student t cumulative distribution function. */
export function studentTCdf(t: number, df: number): number {
  const tail = 0.5 * regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Inverse of the Student t CDF (bisection; p in (0, 1)). */
export function studentTQuantile(p: number, df: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  if (!(df > 0)) throw new RangeError('degrees of freedom must be positive');
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  let lo = 0;
  let hi = 1;
  while (studentTCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-12 * hi; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface ConfidenceInterval {
  readonly n: number;
  readonly mean: number;
  readonly sd: number;
  readonly low: number;
  readonly high: number;
  readonly halfWidth: number;
  readonly level: number;
}

/** t-based confidence interval on the mean. */
export function meanConfidenceInterval(
  values: readonly number[],
  level = 0.95,
): ConfidenceInterval {
  requireCount(values, 2, 'meanConfidenceInterval');
  const m = mean(values);
  const sd = standardDeviation(values);
  const t = studentTQuantile(1 - (1 - level) / 2, values.length - 1);
  const halfWidth = (t * sd) / Math.sqrt(values.length);
  return {
    n: values.length,
    mean: m,
    sd,
    low: m - halfWidth,
    high: m + halfWidth,
    halfWidth,
    level,
  };
}

export interface ExcludedValue {
  readonly index: number;
  readonly value: number;
  /** |x − median| / robust scale. */
  readonly score: number;
}

export interface OutlierFilterResult {
  readonly kept: readonly number[];
  readonly excluded: readonly ExcludedValue[];
  readonly center: number;
  /** Robust σ estimate used for scoring (0 = nothing could be excluded). */
  readonly scale: number;
}

/**
 * Exclude values with |x − median| > threshold × 1.4826·MAD. When MAD is 0 (more than half the
 * values identical), falls back to 1.2533 × mean absolute deviation from the median.
 */
export function filterOutliersMad(values: readonly number[], threshold = 3.5): OutlierFilterResult {
  requireCount(values, 1, 'filterOutliersMad');
  const center = median(values);
  const deviations = values.map((v) => Math.abs(v - center));
  let scale = MAD_SCALE * median(deviations);
  if (scale === 0) scale = 1.2533 * mean(deviations);
  if (scale === 0) return { kept: [...values], excluded: [], center, scale };

  const kept: number[] = [];
  const excluded: ExcludedValue[] = [];
  values.forEach((value, index) => {
    const score = Math.abs(value - center) / scale;
    if (score > threshold) excluded.push({ index, value, score });
    else kept.push(value);
  });
  return { kept, excluded, center, scale };
}
