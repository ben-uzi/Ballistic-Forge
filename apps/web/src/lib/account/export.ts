import { toCsv } from '@bf/db/csv';
import type { StoreSnapshot } from '@/lib/store/types';

/**
 * Data export.
 *
 * Two formats, for two uses: JSON round-trips back into the app (and is the
 * migration path into an account later), while CSV opens in a spreadsheet,
 * which is what people actually want when they ask for their data.
 *
 * Both are produced in the browser from data already in memory — nothing is
 * uploaded to generate them.
 */

export function exportJson(snapshot: StoreSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/**
 * A single CSV file with one section per table.
 *
 * Several related tables cannot be one flat sheet without either losing
 * structure or repeating every rifle on every row, so each gets its own block
 * with its own header. Spreadsheets handle this fine and a human can read it.
 */
export function exportCsvBundle(snapshot: StoreSnapshot): string {
  const blocks: string[] = [];

  blocks.push(
    section(
      'rifles',
      [
        'id',
        'name',
        'cartridge',
        'barrel_length_in',
        'twist_in',
        'twist_direction',
        'thread_pitch',
        'sight_height_in',
        'zero_range_yd',
        'angular_unit',
        'archived',
      ],
      snapshot.rifles.map((rifle) => ({
        id: rifle.id,
        name: rifle.name,
        cartridge: rifle.cartridge,
        barrel_length_in: str(rifle.barrelLengthIn),
        twist_in: str(rifle.twistIn),
        twist_direction: rifle.twistDirection,
        thread_pitch: rifle.threadPitch ?? '',
        sight_height_in: String(rifle.sightHeightIn),
        zero_range_yd: String(rifle.zeroRangeYd),
        angular_unit: rifle.angularUnit,
        archived: rifle.archived === true ? 'yes' : 'no',
      })),
    ),
  );

  blocks.push(
    section(
      'loads',
      [
        'id',
        'rifle_id',
        'name',
        'bullet',
        'weight_gr',
        'diameter_in',
        'bc_type',
        'bc_value',
        'mv_fps',
        'mv_source',
        'mv_at_temp_f',
        'temp_sensitivity_fps_per_f',
        'trued_mv_fps',
        'archived',
      ],
      snapshot.loads.map((load) => ({
        id: load.id,
        rifle_id: load.rifleId,
        name: load.name,
        bullet: load.bullet.name,
        weight_gr: String(load.bullet.weightGr),
        diameter_in: String(load.bullet.diameterIn),
        bc_type: load.bullet.bcType,
        bc_value: String(load.bullet.bcValue),
        mv_fps: String(load.muzzleVelocityFps),
        mv_source: load.muzzleVelocitySource,
        mv_at_temp_f: str(load.muzzleVelocityAtTempF),
        temp_sensitivity_fps_per_f: str(load.temperatureSensitivityFpsPerF),
        trued_mv_fps: str(load.truedMuzzleVelocityFps?.value),
        archived: load.archived === true ? 'yes' : 'no',
      })),
    ),
  );

  blocks.push(
    section(
      'suppressors',
      [
        'id',
        'manufacturer',
        'name',
        'mount_type',
        'thread_pitch',
        'bore_diameter_in',
        'max_rated_cartridge',
        'rated_cartridges',
        'source_url',
      ],
      snapshot.suppressors.map((can) => ({
        id: can.id,
        manufacturer: can.manufacturer ?? '',
        name: can.name,
        mount_type: can.mountType,
        thread_pitch: can.threadPitch ?? '',
        bore_diameter_in: str(can.boreDiameterIn),
        max_rated_cartridge: can.maxRatedCartridge ?? '',
        rated_cartridges: can.ratedCartridges.join('; '),
        source_url: can.sourceUrl ?? '',
      })),
    ),
  );

  // One row per string, not per session: a spreadsheet of velocities is the
  // thing people want to pivot on.
  blocks.push(
    section(
      'shot_strings',
      [
        'session_id',
        'date',
        'rifle_id',
        'load_id',
        'suppressed',
        'cold_bore',
        'chrono',
        'temp_f',
        'shots',
        'velocities_fps',
      ],
      snapshot.sessions.flatMap((session) =>
        session.strings.map((string) => ({
          session_id: session.id,
          date: session.occurredOn,
          rifle_id: session.rifleId,
          load_id: session.loadId,
          suppressed: string.suppressed ? 'yes' : 'no',
          cold_bore: string.firstRoundCold ? 'yes' : 'no',
          chrono: session.chronoType,
          temp_f: str(session.tempF),
          shots: String(string.velocitiesFps.length),
          velocities_fps: string.velocitiesFps.join(' '),
        })),
      ),
    ),
  );

  return `# Ballistic Forge export, ${snapshot.exportedAt}\n\n${blocks.join('\n')}`;
}

function section(
  name: string,
  columns: readonly string[],
  rows: readonly Record<string, string>[],
): string {
  if (rows.length === 0) return `# ${name}: none\n`;
  return `# ${name}\n${toCsv(columns, rows)}\n`;
}

function str(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}
