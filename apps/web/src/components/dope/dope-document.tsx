import { Document, Page, StyleSheet, Text, View, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { DOPE_FORMATS, type DopeCard, type DopeColumn, type DopeFormat } from '@/lib/dope/build';

/**
 * The printed DOPE card.
 *
 * Printed on paper, so this is the one place in the product that is not dark:
 * black on white survives a photocopier, a wet range bag and direct sun.
 * Transonic rows are shaded rather than coloured, for the same reason.
 */

const colors = {
  ink: '#111111',
  muted: '#555555',
  line: '#BBBBBB',
  headerFill: '#EEEEEE',
  transonicFill: '#E6E6E6',
  subsonicFill: '#D2D2D2',
};

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 26, paddingHorizontal: 18, color: colors.ink },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 9, color: colors.muted, marginTop: 2 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 8 },
  metaItem: { width: '25%', marginBottom: 4, paddingRight: 6 },
  metaLabel: { fontSize: 6, color: colors.muted, textTransform: 'uppercase' },
  metaValue: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.line },
  headerRow: { backgroundColor: colors.headerFill, borderBottomWidth: 1 },
  cell: { paddingVertical: 2.5, paddingHorizontal: 3, textAlign: 'right' },
  cellLeft: { textAlign: 'left' },
  headerCell: { fontFamily: 'Helvetica-Bold', fontSize: 6, textTransform: 'uppercase' },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 18,
    right: 18,
    fontSize: 6,
    color: colors.muted,
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
    paddingTop: 4,
  },
  suppressedTag: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
});

/** Column widths as flex weights, so a narrower format still fills its width. */
const WIDTHS: Readonly<Record<DopeColumn, number>> = {
  range: 1.1,
  elevation: 1.2,
  clicks: 1,
  wind: 1.1,
  velocity: 1.1,
  energy: 1.1,
  tof: 0.9,
};

export function DopeDocument({
  card,
  format,
}: {
  readonly card: DopeCard;
  readonly format: DopeFormat;
  // Declared as a Document element so renderToBuffer and PDFDownloadLink accept it.
}): ReactElement<DocumentProps> {
  const spec = DOPE_FORMATS[format];
  const columns = spec.columns;
  const size = spec.size;
  const fs = spec.fontSize;

  const headers: { key: DopeColumn; label: string; unit: string }[] = [];
  for (const column of columns) {
    if (column === 'wind') {
      // One column per configured wind speed.
      continue;
    }
    headers.push({
      key: column,
      label: COLUMN_LABEL[column],
      unit: columnUnit(column, card),
    });
  }

  const showWind = columns.includes('wind');

  return (
    <Document
      title={`${card.rifleName} — ${card.loadName} DOPE`}
      author="Ballistic Forge"
      subject="Ballistic data card"
    >
      <Page size={[size[0], size[1]]} style={styles.page}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.title}>{card.rifleName}</Text>
            {card.suppressed ? <Text style={styles.suppressedTag}>SUPPRESSED</Text> : null}
          </View>
          <Text style={styles.subtitle}>
            {card.loadName} · {card.bullet} · {card.bc}
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <Meta
            label="Muzzle velocity"
            value={card.muzzleVelocity}
            note={card.muzzleVelocityNote}
          />
          <Meta label="Zero" value={card.zero} />
          <Meta label="Sight height" value={card.sightHeight} />
          <Meta label="Click value" value={card.clicks} />
          <View style={{ width: '100%', marginTop: 2 }}>
            <Text style={styles.metaLabel}>Conditions</Text>
            <Text style={{ fontSize: 7 }}>{card.atmosphere}</Text>
          </View>
        </View>

        {/* Header */}
        <View style={[styles.row, styles.headerRow]}>
          {headers.map((header) => (
            <View key={header.key} style={{ flex: WIDTHS[header.key] }}>
              <Text
                style={[
                  styles.cell,
                  styles.headerCell,
                  header.key === 'range' ? styles.cellLeft : {},
                ]}
              >
                {header.label}
                {header.unit === '' ? '' : ` (${header.unit})`}
              </Text>
            </View>
          ))}
          {showWind
            ? card.windLabels.map((label) => (
                <View key={label} style={{ flex: WIDTHS.wind }}>
                  <Text style={[styles.cell, styles.headerCell]}>{label}</Text>
                </View>
              ))
            : null}
        </View>

        {/* Rows */}
        {card.rows.map((row) => {
          const fill = row.subsonic
            ? colors.subsonicFill
            : row.transonic
              ? colors.transonicFill
              : undefined;
          return (
            <View
              key={row.range}
              style={[styles.row, fill === undefined ? {} : { backgroundColor: fill }]}
              wrap={false}
            >
              {headers.map((header) => (
                <View key={header.key} style={{ flex: WIDTHS[header.key] }}>
                  <Text
                    style={[
                      styles.cell,
                      { fontSize: fs },
                      header.key === 'range'
                        ? { ...styles.cellLeft, fontFamily: 'Helvetica-Bold' }
                        : {},
                    ]}
                  >
                    {valueFor(header.key, row)}
                  </Text>
                </View>
              ))}
              {showWind
                ? row.winds.map((hold, index) => (
                    <View
                      key={card.windLabels[index] ?? String(index)}
                      style={{ flex: WIDTHS.wind }}
                    >
                      <Text style={[styles.cell, { fontSize: fs }]}>{hold}</Text>
                    </View>
                  ))
                : null}
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          Ballistic Forge — verify with live fire. These are estimates from a point-mass model and
          the inputs above; shaded rows are transonic or subsonic, where accuracy degrades. You are
          responsible for the safe and lawful use of your firearm. Generated {card.generatedAt}.
        </Text>
      </Page>
    </Document>
  );
}

const COLUMN_LABEL: Readonly<Record<DopeColumn, string>> = {
  range: 'Range',
  elevation: 'Elev',
  clicks: 'Clicks',
  wind: 'Wind',
  velocity: 'Vel',
  energy: 'Energy',
  tof: 'TOF',
};

function columnUnit(column: DopeColumn, card: DopeCard): string {
  switch (column) {
    case 'range':
      return card.units.range;
    case 'elevation':
      return card.units.angular;
    case 'velocity':
      return card.units.velocity;
    case 'energy':
      return card.units.energy;
    case 'tof':
      return 's';
    default:
      return '';
  }
}

function valueFor(column: DopeColumn, row: DopeCard['rows'][number]): string {
  switch (column) {
    case 'range':
      return row.range;
    case 'elevation':
      return row.elevation;
    case 'clicks':
      return row.clicks;
    case 'velocity':
      return row.velocity;
    case 'energy':
      return row.energy;
    case 'tof':
      return row.tof;
    default:
      return '';
  }
}

function Meta({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string | null;
}): ReactElement {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
      {note === null || note === undefined ? null : (
        <Text style={{ fontSize: 6, color: colors.muted }}>{note}</Text>
      )}
    </View>
  );
}
