export interface RootResult {
  readonly x: number;
  readonly fx: number;
  readonly iterations: number;
  readonly converged: boolean;
}

type Fn = (x: number) => number;

/** Secant method from two starting points. Non-finite evaluations stop the search unconverged. */
export function secant(f: Fn, x0: number, x1: number, fTol: number, maxIter = 30): RootResult {
  let a = x0;
  let fa = f(a);
  let b = x1;
  let fb = f(b);
  for (let i = 1; i <= maxIter; i++) {
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) break;
    if (Math.abs(fb) < fTol) return { x: b, fx: fb, iterations: i, converged: true };
    if (fb === fa) break;
    const c = b - (fb * (b - a)) / (fb - fa);
    a = b;
    fa = fb;
    b = c;
    fb = f(c);
  }
  return { x: b, fx: fb, iterations: maxIter, converged: false };
}

/**
 * Bisection on a bracket where f(lo) < 0 < f(hi) (or the reverse). Tolerates −∞/+∞ values.
 * Returns null when the interval does not bracket a root.
 */
export function bisect(
  f: Fn,
  lo: number,
  hi: number,
  fTol: number,
  xTol = 1e-14,
  maxIter = 200,
): RootResult | null {
  let a = lo;
  let b = hi;
  const fa = f(a);
  const fb = f(b);
  if (!(Math.sign(fa) * Math.sign(fb) <= 0)) return null;
  const rising = fa < fb;
  let mid = (a + b) / 2;
  let fm = f(mid);
  for (let i = 1; i <= maxIter; i++) {
    if (Math.abs(fm) < fTol || b - a < xTol) {
      return { x: mid, fx: fm, iterations: i, converged: true };
    }
    if (fm < 0 === rising) a = mid;
    else b = mid;
    mid = (a + b) / 2;
    fm = f(mid);
  }
  return { x: mid, fx: fm, iterations: maxIter, converged: false };
}

/**
 * Illinois (modified regula falsi). Fast and bracket-safe for smooth monotonic functions.
 * Returns null when [lo, hi] does not bracket a root or an endpoint is not finite.
 */
export function illinois(
  f: Fn,
  lo: number,
  hi: number,
  fTol: number,
  xTol: number,
  maxIter = 100,
): RootResult | null {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  if (!(fa * fb <= 0)) return null;
  if (fa === 0) return { x: a, fx: 0, iterations: 0, converged: true };
  if (fb === 0) return { x: b, fx: 0, iterations: 0, converged: true };

  let side = 0;
  for (let i = 1; i <= maxIter; i++) {
    const c = (a * fb - b * fa) / (fb - fa);
    const fc = f(c);
    if (!Number.isFinite(fc)) return { x: c, fx: fc, iterations: i, converged: false };
    if (Math.abs(fc) < fTol || Math.abs(b - a) < xTol) {
      return { x: c, fx: fc, iterations: i, converged: true };
    }
    if (fc * fb > 0) {
      b = c;
      fb = fc;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      a = c;
      fa = fc;
      if (side === 1) fb /= 2;
      side = 1;
    }
  }
  return { x: (a + b) / 2, fx: f((a + b) / 2), iterations: maxIter, converged: false };
}
