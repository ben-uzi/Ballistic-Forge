import type { CalcForm, FormUnits } from './types';

export const US_UNITS: FormUnits = {
  range: 'yd',
  velocity: 'fps',
  temperature: 'F',
  pressure: 'inHg',
  altitude: 'ft',
  smallLength: 'in',
  mass: 'gr',
  windSpeed: 'mph',
  energy: 'ftlbf',
  angular: 'mil',
};

export const METRIC_UNITS: FormUnits = {
  range: 'm',
  velocity: 'mps',
  temperature: 'C',
  pressure: 'hPa',
  altitude: 'm',
  smallLength: 'mm',
  mass: 'g',
  windSpeed: 'mps',
  energy: 'J',
  angular: 'mil',
};

/**
 * Opening state: a 6.5 Creedmoor 140 gr ELD-M at ICAO standard conditions
 * (59 °F, 29.92 inHg sea level, 50% RH). The BC is the published Hornady G7
 * figure and ships flagged unverified until someone checks the spec sheet
 * (BUILD_BRIEF §7.4).
 */
export const DEFAULT_FORM: CalcForm = {
  units: US_UNITS,

  bulletName: '6.5 mm 140 gr ELD-M',
  diameter: 0.264,
  weight: 140,
  bcType: 'G7',
  bcValue: 0.326,
  bulletLength: 1.345,
  muzzleVelocity: 2690,
  dataUnverified: true,

  sightHeight: 1.9,
  twist: 8,
  twistDirection: 'right',
  zeroRange: 100,
  zeroOffset: 0,
  elevationClickKey: 'mil_0_1',
  windageClickKey: 'mil_0_1',
  rounding: 'nearest',

  temperature: 59,
  pressure: 29.92,
  pressureType: 'baro',
  altitude: 0,
  humidity: 50,
  windSpeed: 0,
  windFromClock: 3,
  inclineDeg: 0,

  useZeroAtmosphere: false,
  zeroTemperature: 59,
  zeroAltitude: 0,

  spinDriftEnabled: true,
  aerodynamicJumpEnabled: false,
  coriolisEnabled: false,
  latitudeDeg: 40,
  azimuthDeg: 0,

  rangeStart: 0,
  rangeEnd: 1000,
  rangeStep: 100,
  windHoldSpeeds: [5, 10],
};

/** Caps so a typo cannot ask for a hundred thousand rows. */
export const MAX_ROWS = 400;
export const MAX_RANGE_YD = 3000;
