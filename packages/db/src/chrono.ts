import { parseCsvCells, type CsvRow } from './csv.ts';

/**
 * Importing a chronograph export.
 *
 * Deliberately generic. The brief asked for Garmin Xero and LabRadar parsers
 * "if the formats are confirmable" — they were not, because no real export file
 * was available during the build (NEEDS_CHAD 7). Writing a parser against a
 * remembered layout would fail silently on the first real file, which is worse
 * than not having one.
 *
 * So instead: find the velocity column by header, cope with the preamble rows
 * these devices put above the table, and let the user override the column when
 * the guess is wrong. That handles both devices today without claiming verified
 * support for either.
 */

export type ChronoUnit = 'fps' | 'mps';

export interface ChronoImport {
  readonly velocitiesFps: readonly number[];
  /** The header the velocities were read from. */
  readonly column: string;
  readonly unit: ChronoUnit;
  /** Every column that held usable numbers, for the override picker. */
  readonly candidates: readonly string[];
  /** Rows skipped because the cell was blank or not a number. */
  readonly skipped: number;
  /** What the file looked like, for the UI to report honestly. */
  readonly note: string;
}

export class ChronoImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChronoImportError';
  }
}

/** Header names, lowercased, that mean "this is the velocity". */
const VELOCITY_HEADERS: readonly string[] = [
  'velocity',
  'speed',
  'muzzle velocity',
  'v0',
  'vel',
  'fps',
  'm/s',
  'velocity (fps)',
  'velocity (m/s)',
  'speed (fps)',
  'speed (m/s)',
];

const MPS_MARKERS: readonly string[] = ['m/s', 'mps', 'meters', 'metres'];

const FPS_PER_MPS = 3.280839895013123;

/** Velocities outside this are a header, an index column, or a misread. */
const PLAUSIBLE_FPS: readonly [number, number] = [300, 5000];
const PLAUSIBLE_MPS: readonly [number, number] = [90, 1525];

/**
 * Find the table inside an export file.
 *
 * Chronographs prepend session metadata, so the header row is rarely the first
 * line — and that metadata is itself comma-separated, which defeats a naive
 * "first row with several columns" rule. Instead every candidate header is
 * scored by how many same-shaped, numeric rows follow it unbroken, and the
 * longest run wins.
 */
export function findTable(text: string): { header: string[]; rows: CsvRow[] } {
  const cells = parseCsvCells(text);
  if (cells.length === 0) throw new ChronoImportError('That file is empty.');

  const hasNumber = (row: readonly string[]): boolean =>
    row.some((cell) => cell.trim() !== '' && Number.isFinite(Number(cell.replace(/,/g, ''))));

  // Score each candidate header by how many data rows follow it unbroken. Two
  // columns of session metadata ("Session,12") score zero, because the row
  // after them is not numeric; the real table scores one per shot.
  let best: { index: number; run: number; width: number } | null = null;

  for (let index = 0; index < cells.length - 1; index += 1) {
    const candidate = cells[index];
    if (candidate === undefined || candidate.length < 2) continue;
    // A header is labels, not readings.
    if (candidate.every((cell) => cell.trim() === '' || Number.isFinite(Number(cell)))) continue;

    let run = 0;
    for (let next = index + 1; next < cells.length; next += 1) {
      const row = cells[next];
      if (row === undefined || row.length !== candidate.length || !hasNumber(row)) break;
      run += 1;
    }
    if (run === 0) continue;
    if (best === null || run > best.run || (run === best.run && candidate.length > best.width)) {
      best = { index, run, width: candidate.length };
    }
  }

  if (best === null) {
    throw new ChronoImportError(
      'No table was found in that file. It should have a header row and one row per shot.',
    );
  }

  const headerCells = cells[best.index] ?? [];
  const header = headerCells.map((name) => name.trim());
  // Built directly from the parsed cells: re-joining them with commas would
  // corrupt any quoted value that itself contains one.
  const rows: CsvRow[] = cells.slice(best.index + 1, best.index + 1 + best.run).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((name, column) => {
      record[name] = (row[column] ?? '').trim();
    });
    return record;
  });

  return { header, rows };
}

function looksLikeVelocityHeader(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return VELOCITY_HEADERS.some((candidate) => lower === candidate || lower.startsWith(candidate));
}

function unitFor(header: string, values: readonly number[]): ChronoUnit {
  const lower = header.toLowerCase();
  if (MPS_MARKERS.some((marker) => lower.includes(marker))) return 'mps';
  if (lower.includes('fps') || lower.includes('ft/s')) return 'fps';

  // No unit in the header: let the magnitudes decide. A rifle in m/s is a
  // three-digit number; in fps it is four.
  const average = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  return average < PLAUSIBLE_MPS[1] ? 'mps' : 'fps';
}

function numbersIn(rows: readonly CsvRow[], column: string): { values: number[]; skipped: number } {
  const values: number[] = [];
  let skipped = 0;
  for (const row of rows) {
    const raw = (row[column] ?? '').replace(/,/g, '').trim();
    if (raw === '') {
      skipped += 1;
      continue;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) values.push(parsed);
    else skipped += 1;
  }
  return { values, skipped };
}

function plausible(values: readonly number[], unit: ChronoUnit): number[] {
  const [min, max] = unit === 'mps' ? PLAUSIBLE_MPS : PLAUSIBLE_FPS;
  return values.filter((value) => value >= min && value <= max);
}

/**
 * Read velocities out of a chronograph CSV.
 *
 * `column` forces a particular header when the automatic choice is wrong.
 */
export function importChronoCsv(text: string, column?: string): ChronoImport {
  const { header, rows } = findTable(text);
  if (rows.length === 0) throw new ChronoImportError('That file has a header but no shots.');

  // Any column that yields several plausible velocities is a candidate.
  const candidates = header.filter((name) => {
    if (name === '') return false;
    const { values } = numbersIn(rows, name);
    if (values.length === 0) return false;
    return plausible(values, unitFor(name, values)).length >= Math.min(2, rows.length);
  });

  const chosen = column ?? header.find(looksLikeVelocityHeader) ?? candidates[0] ?? undefined;

  if (chosen === undefined) {
    throw new ChronoImportError(
      `No velocity column was found. The file has: ${header.filter((name) => name !== '').join(', ')}.`,
    );
  }
  if (!header.includes(chosen)) {
    throw new ChronoImportError(`That file has no column called "${chosen}".`);
  }

  const { values, skipped } = numbersIn(rows, chosen);
  const unit = unitFor(chosen, values);
  const usable = plausible(values, unit);

  if (usable.length === 0) {
    throw new ChronoImportError(
      `The "${chosen}" column has no readings that look like muzzle velocities.`,
    );
  }

  const velocitiesFps =
    unit === 'mps' ? usable.map((value) => round(value * FPS_PER_MPS, 1)) : usable;

  const dropped = values.length - usable.length;
  return {
    velocitiesFps,
    column: chosen,
    unit,
    candidates,
    skipped: skipped + dropped,
    note: buildNote(usable.length, unit, skipped + dropped, candidates.length),
  };
}

function buildNote(kept: number, unit: ChronoUnit, skipped: number, candidates: number): string {
  const parts = [`${String(kept)} shots read`];
  if (unit === 'mps') parts.push('converted from m/s');
  if (skipped > 0) parts.push(`${String(skipped)} rows skipped`);
  if (candidates > 1) parts.push('check the column if that looks wrong');
  return `${parts.join(', ')}.`;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Read velocities out of pasted text.
 *
 * At the range people paste a column of numbers out of a notes app, not a CSV.
 * Anything that is not a plausible velocity is ignored.
 */
export function importPastedVelocities(text: string, unit: ChronoUnit = 'fps'): number[] {
  const numbers = text
    .split(/[\s,;]+/)
    .map((token) => Number.parseFloat(token.replace(/,/g, '')))
    .filter((value) => Number.isFinite(value));
  const usable = plausible(numbers, unit);
  return unit === 'mps' ? usable.map((value) => round(value * FPS_PER_MPS, 1)) : usable;
}
