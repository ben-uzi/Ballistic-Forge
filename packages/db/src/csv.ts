/**
 * A small RFC 4180 CSV reader/writer.
 *
 * Hand-rolled rather than pulled in as a dependency: the seed pipeline is the
 * only consumer, the dialect is fixed (comma, double-quote, CRLF or LF), and
 * the behaviour that matters — quoted fields containing commas, newlines and
 * escaped quotes — fits in sixty lines and is directly tested.
 */

export type CsvRow = Readonly<Record<string, string>>;

export class CsvError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`Line ${String(line)}: ${message}`);
    this.name = 'CsvError';
    this.line = line;
  }
}

/** Split CSV text into rows of raw cells. Blank trailing lines are ignored. */
export function parseCsvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  // True once anything has been seen for the current cell, so a trailing
  // newline does not produce a phantom final row.
  let started = false;

  const endCell = (): void => {
    row.push(cell);
    cell = '';
    started = false;
  };
  const endRow = (): void => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === '\n') line += 1;
        cell += char;
      }
      continue;
    }

    switch (char) {
      case '"':
        if (started && cell !== '') {
          throw new CsvError('Unexpected quote in the middle of an unquoted field', line);
        }
        quoted = true;
        started = true;
        break;
      case ',':
        endCell();
        break;
      case '\r':
        break;
      case '\n':
        line += 1;
        if (row.length > 0 || cell !== '' || started) endRow();
        break;
      default:
        cell += char;
        started = true;
    }
  }

  if (quoted) throw new CsvError('File ended inside a quoted field', line);
  if (row.length > 0 || cell !== '' || started) endRow();

  return rows;
}

/**
 * Parse CSV with a header row into objects. Values are trimmed; a cell that is
 * empty or `-` becomes an empty string, which downstream schemas read as "not
 * provided".
 */
export function parseCsv(text: string): CsvRow[] {
  const cells = parseCsvCells(text);
  const header = cells[0];
  if (header === undefined) return [];

  const columns = header.map((name) => name.trim());
  const duplicate = columns.find((name, index) => columns.indexOf(name) !== index);
  if (duplicate !== undefined) throw new CsvError(`Duplicate column "${duplicate}"`, 1);

  return cells.slice(1).map((values, index) => {
    if (values.length !== columns.length) {
      throw new CsvError(
        `Expected ${String(columns.length)} columns, found ${String(values.length)}`,
        index + 2,
      );
    }
    const row: Record<string, string> = {};
    columns.forEach((name, column) => {
      const value = (values[column] ?? '').trim();
      row[name] = value === '-' ? '' : value;
    });
    return row;
  });
}

/** Quote a value only when it needs it, so diffs on seed files stay readable. */
export function toCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(columns: readonly string[], rows: readonly CsvRow[]): string {
  const lines = [columns.map(toCsvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => toCsvCell(row[column] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}
