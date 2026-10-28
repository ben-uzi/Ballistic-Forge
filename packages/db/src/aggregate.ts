import {
  filterOutliersMad,
  mean,
  meanConfidenceInterval,
  standardDeviation,
  summarize,
} from '@bf/engine';
import type { ChronoType } from './types.ts';

/**
 * The Field aggregation core.
 *
 * Pure functions over already-fetched rows, so the same code runs in a test, in
 * an Edge Function on submit, and in the nightly recompute. Nothing here reads
 * a database or a clock.
 *
 * The shape of the problem: many shooters, each contributing a few chronograph
 * strings, with wildly different equipment and honesty. The defences, in order:
 *
 *  1. consent and standing  - opted-out and flagged accounts never count
 *  2. plausibility gates    - physically impossible numbers are dropped
 *  3. per-user cap          - one prolific shooter cannot become the dataset
 *  4. trust weighting       - a Garmin string of 20 outweighs an unknown one of 2
 *  5. robust outlier filter - MAD on the session means, not the raw shots
 *  6. disclosure thresholds - nothing is published until enough people agree
 *
 * The session, not the shot, is the unit of analysis throughout. Twenty shots
 * from one barrel on one day are one opinion about that load, not twenty.
 */

export const NORMALIZATION_TEMP_F = 59;
export const DEFAULT_SESSIONS_PER_USER = 3;
export const MAD_THRESHOLD = 3.5;
/** A chronograph reading outside this is a misread, not a load. */
export const PLAUSIBLE_MV_FPS: readonly [number, number] = [300, 5000];
/** How far a session mean may sit from the advertised velocity. */
export const ADVERTISED_TOLERANCE = 0.2;
/** Above this, the string is noise rather than a measurement. */
export const MAX_PLAUSIBLE_SD_FPS = 100;

export interface StringSample {
  readonly suppressed: boolean;
  readonly velocitiesFps: readonly number[];
}

export interface SessionSample {
  readonly sessionId: string;
  readonly userId: string;
  /** Admin-flagged accounts are excluded entirely. */
  readonly userFlagged: boolean;
  readonly contributionOptIn: boolean;
  readonly occurredOn: string;
  readonly bulletId: string | null;
  readonly factoryLoadId: string | null;
  readonly barrelLengthIn: number | null;
  readonly suppressorId: string | null;
  readonly chronoType: ChronoType;
  readonly tempF: number | null;
  /** fps per °F, when the load's powder sensitivity is known. */
  readonly tempSensitivityFpsPerF: number | null;
  readonly advertisedMvFps: number | null;
  readonly strings: readonly StringSample[];
}

export interface AggregationOptions {
  readonly sessionsPerUser?: number;
  readonly minSessionsToDisplay?: number;
  readonly minUsersToDisplay?: number;
}

export type ExclusionReason =
  | 'opted-out'
  | 'account-flagged'
  | 'no-load-identity'
  | 'no-usable-string'
  | 'implausible-velocity'
  | 'implausible-spread'
  | 'far-from-advertised'
  | 'per-user-cap'
  | 'statistical-outlier';

export interface ExcludedSession {
  readonly sessionId: string;
  readonly reason: ExclusionReason;
  /** Shown to the owner of the session, so it must read as an explanation. */
  readonly message: string;
}

export interface FieldAggregate {
  readonly groupKey: string;
  readonly bulletId: string | null;
  readonly factoryLoadId: string | null;
  readonly barrelLengthBucketIn: number | null;
  readonly suppressorId: string | null;
  readonly nShots: number;
  readonly nSessions: number;
  readonly nUsers: number;
  readonly mvMean: number;
  readonly mvSdBetweenSessions: number | null;
  readonly mvCi95Low: number | null;
  readonly mvCi95High: number | null;
  readonly sdMeanWithinSession: number | null;
  readonly esMean: number | null;
  /** The temperature velocities were normalised to, or null when they were not. */
  readonly normalizedTempF: number | null;
  /** True only when every contributing session could be normalised. */
  readonly normalized: boolean;
  /** Whether this may be shown to a non-admin. */
  readonly displayable: boolean;
}

export interface SuppressorDelta {
  readonly suppressorId: string;
  readonly bulletId: string | null;
  readonly factoryLoadId: string | null;
  readonly barrelLengthBucketIn: number | null;
  readonly nSessions: number;
  readonly nUsers: number;
  readonly mvDeltaMean: number;
  readonly mvDeltaSd: number | null;
  readonly mvDeltaCi95Low: number | null;
  readonly mvDeltaCi95High: number | null;
  readonly displayable: boolean;
}

export interface AggregationResult {
  readonly aggregates: readonly FieldAggregate[];
  readonly suppressorDeltas: readonly SuppressorDelta[];
  readonly excluded: readonly ExcludedSession[];
}

// ── Trust weighting v1 ───────────────────────────────────────────────────────
//
// Two factors, multiplied. Both are judgement calls, deliberately gentle: the
// intent is to let better evidence pull harder, not to silence anyone. Revisit
// once there is enough real data to calibrate against.

const CHRONO_WEIGHT: Readonly<Record<ChronoType, number>> = {
  garmin_xero: 1,
  labradar: 1,
  magnetospeed: 0.9,
  optical: 0.7,
  other: 0.6,
  unknown: 0.5,
};

/** A long string says more about a load than a short one. */
export function stringLengthWeight(n: number): number {
  if (n >= 10) return 1;
  if (n >= 5) return 0.85;
  if (n >= 3) return 0.7;
  return 0.5;
}

export function trustWeight(chronoType: ChronoType, shotCount: number): number {
  return (CHRONO_WEIGHT[chronoType] ?? 0.5) * stringLengthWeight(shotCount);
}

/** Barrel lengths are grouped into one-inch buckets. */
export function barrelBucket(lengthIn: number | null): number | null {
  return lengthIn === null ? null : Math.round(lengthIn);
}

export function groupKeyFor(sample: {
  bulletId: string | null;
  factoryLoadId: string | null;
  barrelLengthIn: number | null;
  suppressorId: string | null;
}): string | null {
  const load =
    sample.factoryLoadId !== null
      ? `fl:${sample.factoryLoadId}`
      : sample.bulletId !== null
        ? `b:${sample.bulletId}`
        : null;
  if (load === null) return null;
  const bucket = barrelBucket(sample.barrelLengthIn);
  return `${load}|${bucket === null ? 'any' : String(bucket)}|${sample.suppressorId ?? 'none'}`;
}

/** One session reduced to a single comparable velocity. */
interface SessionPoint {
  readonly sample: SessionSample;
  readonly groupKey: string;
  readonly meanFps: number;
  readonly sdFps: number | null;
  readonly esFps: number;
  readonly shots: number;
  readonly weight: number;
  readonly normalized: boolean;
}

export function aggregateSessions(
  sessions: readonly SessionSample[],
  options: AggregationOptions = {},
): AggregationResult {
  const sessionsPerUser = options.sessionsPerUser ?? DEFAULT_SESSIONS_PER_USER;
  const minSessions = options.minSessionsToDisplay ?? 5;
  const minUsers = options.minUsersToDisplay ?? 3;

  const excluded: ExcludedSession[] = [];
  const points: SessionPoint[] = [];

  for (const sample of sessions) {
    const point = toPoint(sample, excluded);
    if (point !== null) points.push(point);
  }

  // ── Per-user cap, applied within each group ───────────────────────────────
  const byGroup = new Map<string, SessionPoint[]>();
  for (const point of points) {
    const list = byGroup.get(point.groupKey) ?? [];
    list.push(point);
    byGroup.set(point.groupKey, list);
  }

  const aggregates: FieldAggregate[] = [];

  for (const [groupKey, groupPoints] of byGroup) {
    const capped = applyUserCap(groupPoints, sessionsPerUser, excluded);
    if (capped.length === 0) continue;

    // ── Robust outlier filter on the session means ──────────────────────────
    const filtered = filterOutliersMad(
      capped.map((point) => point.meanFps),
      MAD_THRESHOLD,
    );
    const excludedIndexes = new Set(filtered.excluded.map((entry) => entry.index));
    const kept = capped.filter((_, index) => !excludedIndexes.has(index));

    for (const entry of filtered.excluded) {
      const point = capped[entry.index];
      if (point === undefined) continue;
      excluded.push({
        sessionId: point.sample.sessionId,
        reason: 'statistical-outlier',
        message: `This session's mean of ${point.meanFps.toFixed(0)} fps sits ${entry.score.toFixed(1)} robust deviations from the rest of the group, so it is not counted in the aggregate. Your own history still shows it.`,
      });
    }

    if (kept.length === 0) continue;

    const first = kept[0];
    if (first === undefined) continue;

    const weights = kept.map((point) => point.weight);
    const values = kept.map((point) => point.meanFps);
    const mvMean = weightedMean(values, weights);
    const sdBetween = kept.length > 1 ? standardDeviation(values) : null;
    const users = new Set(kept.map((point) => point.sample.userId));

    // The t interval uses Kish's effective sample size, so a group carried by
    // one heavily weighted session does not claim the precision of many.
    const effectiveN = effectiveSampleSize(weights);
    const ci = kept.length > 1 && effectiveN > 1 ? meanConfidenceInterval(values, 0.95) : null;

    const withinSds = kept.map((point) => point.sdFps).filter((sd): sd is number => sd !== null);

    aggregates.push({
      groupKey,
      bulletId: first.sample.bulletId,
      factoryLoadId: first.sample.factoryLoadId,
      barrelLengthBucketIn: barrelBucket(first.sample.barrelLengthIn),
      suppressorId: first.sample.suppressorId,
      nShots: kept.reduce((total, point) => total + point.shots, 0),
      nSessions: kept.length,
      nUsers: users.size,
      mvMean: round(mvMean, 1),
      mvSdBetweenSessions: sdBetween === null ? null : round(sdBetween, 1),
      mvCi95Low: ci === null ? null : round(ci.low, 1),
      mvCi95High: ci === null ? null : round(ci.high, 1),
      sdMeanWithinSession: withinSds.length === 0 ? null : round(mean(withinSds), 1),
      esMean: round(mean(kept.map((point) => point.esFps)), 1),
      normalized: kept.every((point) => point.normalized),
      normalizedTempF: kept.every((point) => point.normalized) ? NORMALIZATION_TEMP_F : null,
      displayable: kept.length >= minSessions && users.size >= minUsers,
    });
  }

  return {
    aggregates: aggregates.sort((a, b) => a.groupKey.localeCompare(b.groupKey)),
    suppressorDeltas: computeSuppressorDeltas(sessions, minSessions, minUsers),
    excluded,
  };
}

function toPoint(sample: SessionSample, excluded: ExcludedSession[]): SessionPoint | null {
  const reject = (reason: ExclusionReason, message: string): null => {
    excluded.push({ sessionId: sample.sessionId, reason, message });
    return null;
  };

  if (!sample.contributionOptIn) {
    return reject(
      'opted-out',
      'You have contribution to the Field Database switched off, so this session is yours alone.',
    );
  }
  if (sample.userFlagged) {
    return reject('account-flagged', 'This account is excluded from aggregates pending review.');
  }

  const groupKey = groupKeyFor(sample);
  if (groupKey === null) {
    return reject(
      'no-load-identity',
      'This session is not linked to a library bullet or factory load, so there is no group to put it in.',
    );
  }

  // A group is defined by its suppressor, so only matching strings count.
  const wantSuppressed = sample.suppressorId !== null;
  const velocities = sample.strings
    .filter((entry) => entry.suppressed === wantSuppressed)
    .flatMap((entry) => entry.velocitiesFps);

  if (velocities.length === 0) {
    return reject(
      'no-usable-string',
      wantSuppressed
        ? 'No suppressed string was recorded for this session.'
        : 'No unsuppressed string was recorded for this session.',
    );
  }

  if (velocities.some((v) => v < PLAUSIBLE_MV_FPS[0] || v > PLAUSIBLE_MV_FPS[1])) {
    return reject(
      'implausible-velocity',
      `A shot outside ${String(PLAUSIBLE_MV_FPS[0])}-${String(PLAUSIBLE_MV_FPS[1])} fps was recorded. That is a chronograph misread rather than a load.`,
    );
  }

  const summary = summarize(velocities);
  if (summary.sd !== null && summary.sd > MAX_PLAUSIBLE_SD_FPS) {
    return reject(
      'implausible-spread',
      `A standard deviation of ${summary.sd.toFixed(0)} fps is noise rather than a measurement.`,
    );
  }

  const normalizedMean = normalizeToStandardTemp(
    summary.mean,
    sample.tempF,
    sample.tempSensitivityFpsPerF,
  );

  if (
    sample.advertisedMvFps !== null &&
    Math.abs(normalizedMean.fps - sample.advertisedMvFps) >
      sample.advertisedMvFps * ADVERTISED_TOLERANCE
  ) {
    return reject(
      'far-from-advertised',
      `A mean of ${normalizedMean.fps.toFixed(0)} fps is more than ${String(ADVERTISED_TOLERANCE * 100)}% from the advertised ${String(sample.advertisedMvFps)} fps. Check the load this session is attached to.`,
    );
  }

  return {
    sample,
    groupKey,
    meanFps: normalizedMean.fps,
    sdFps: summary.sd,
    esFps: summary.es,
    shots: summary.n,
    weight: trustWeight(sample.chronoType, summary.n),
    normalized: normalizedMean.normalized,
  };
}

/**
 * Normalise a session mean to 59 °F.
 *
 * Only possible when both the session temperature and the load's powder
 * sensitivity are known. When either is missing the raw mean is used and the
 * group is marked un-normalised, rather than pretending the correction happened.
 */
export function normalizeToStandardTemp(
  meanFps: number,
  tempF: number | null,
  sensitivityFpsPerF: number | null,
): { fps: number; normalized: boolean } {
  if (tempF === null || sensitivityFpsPerF === null || sensitivityFpsPerF === 0) {
    return { fps: meanFps, normalized: false };
  }
  return {
    fps: meanFps + sensitivityFpsPerF * (NORMALIZATION_TEMP_F - tempF),
    normalized: true,
  };
}

/**
 * Keep at most `cap` sessions per user per group, oldest first.
 *
 * Oldest rather than best: picking the sessions that agree with each other
 * would be choosing the data to fit the answer.
 */
function applyUserCap(
  points: readonly SessionPoint[],
  cap: number,
  excluded: ExcludedSession[],
): SessionPoint[] {
  const byUser = new Map<string, SessionPoint[]>();
  for (const point of points) {
    const list = byUser.get(point.sample.userId) ?? [];
    list.push(point);
    byUser.set(point.sample.userId, list);
  }

  const kept: SessionPoint[] = [];
  for (const list of byUser.values()) {
    const ordered = [...list].sort((a, b) =>
      a.sample.occurredOn.localeCompare(b.sample.occurredOn),
    );
    kept.push(...ordered.slice(0, cap));
    for (const point of ordered.slice(cap)) {
      excluded.push({
        sessionId: point.sample.sessionId,
        reason: 'per-user-cap',
        message: `Only your first ${String(cap)} sessions for this load and barrel count towards the community aggregate, so that no single shooter dominates it. This session is still part of your own history.`,
      });
    }
  }
  return kept;
}

/**
 * Suppressor velocity deltas.
 *
 * Paired within a single session only: the same rifle, the same ammunition, the
 * same conditions, minutes apart. Comparing a suppressed string from one day
 * with an unsuppressed one from another measures the weather as much as the can.
 */
function computeSuppressorDeltas(
  sessions: readonly SessionSample[],
  minSessions: number,
  minUsers: number,
): SuppressorDelta[] {
  const byGroup = new Map<
    string,
    { deltas: number[]; users: Set<string>; sample: SessionSample }
  >();

  for (const sample of sessions) {
    if (!sample.contributionOptIn || sample.userFlagged) continue;
    if (sample.suppressorId === null) continue;

    const suppressed = sample.strings
      .filter((entry) => entry.suppressed)
      .flatMap((entry) => entry.velocitiesFps);
    const unsuppressed = sample.strings
      .filter((entry) => !entry.suppressed)
      .flatMap((entry) => entry.velocitiesFps);
    if (suppressed.length === 0 || unsuppressed.length === 0) continue;

    const key = `${sample.suppressorId}|${sample.factoryLoadId ?? sample.bulletId ?? 'any'}|${String(barrelBucket(sample.barrelLengthIn) ?? 'any')}`;
    const entry = byGroup.get(key) ?? { deltas: [], users: new Set<string>(), sample };
    entry.deltas.push(mean(suppressed) - mean(unsuppressed));
    entry.users.add(sample.userId);
    byGroup.set(key, entry);
  }

  const results: SuppressorDelta[] = [];
  for (const [, entry] of byGroup) {
    const { deltas, users, sample } = entry;
    if (sample.suppressorId === null) continue;
    const ci = deltas.length > 1 ? meanConfidenceInterval(deltas, 0.95) : null;
    results.push({
      suppressorId: sample.suppressorId,
      bulletId: sample.bulletId,
      factoryLoadId: sample.factoryLoadId,
      barrelLengthBucketIn: barrelBucket(sample.barrelLengthIn),
      nSessions: deltas.length,
      nUsers: users.size,
      mvDeltaMean: round(mean(deltas), 1),
      mvDeltaSd: deltas.length > 1 ? round(standardDeviation(deltas), 1) : null,
      mvDeltaCi95Low: ci === null ? null : round(ci.low, 1),
      mvDeltaCi95High: ci === null ? null : round(ci.high, 1),
      displayable: deltas.length >= minSessions && users.size >= minUsers,
    });
  }
  return results;
}

export function weightedMean(values: readonly number[], weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return mean(values);
  return values.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0) / total;
}

/** Kish's effective sample size: (Σw)² / Σw². */
export function effectiveSampleSize(weights: readonly number[]): number {
  const sum = weights.reduce((total, w) => total + w, 0);
  const sumSquares = weights.reduce((total, w) => total + w * w, 0);
  return sumSquares === 0 ? 0 : (sum * sum) / sumSquares;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
