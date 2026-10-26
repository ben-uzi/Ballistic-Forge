import { describe, expect, it } from 'vitest';
import {
  ARMY_STANDARD_METRO,
  ICAO_STANDARD_ATMOSPHERE,
  airDensity,
  baroPressureFromStation,
  computeAtmosphere,
  densityAltitude,
  saturationVaporPressure,
  speedOfSound,
  stationPressureFromBaro,
  stationPressureInHg,
} from '../src/atmosphere';

const relErr = (a: number, b: number) => Math.abs(a / b - 1);

describe('atmosphere', () => {
  it('ICAO standard conditions give standard density within 0.1%', () => {
    const atm = computeAtmosphere(ICAO_STANDARD_ATMOSPHERE);
    expect(relErr(atm.densityKgM3, 1.225)).toBeLessThan(1e-3);
    expect(atm.densityAltitudeM).toBeCloseTo(0, 6);
    expect(stationPressureInHg(atm)).toBeCloseTo(29.92, 2);
  });

  it('Army Standard Metro gives its published density (0.0751265 lb/ft³) within 0.1%', () => {
    const atm = computeAtmosphere(ARMY_STANDARD_METRO);
    const published = 0.0751265 * 16.01846337; // lb/ft³ → kg/m³
    expect(relErr(atm.densityKgM3, published)).toBeLessThan(1e-3);
  });

  it('speed of sound at 15 °C is ≈340.3 m/s', () => {
    expect(speedOfSound(288.15)).toBeCloseTo(340.29, 1);
  });

  it('Buck saturation vapor pressure matches the known 2.339 kPa at 20 °C within 0.5%', () => {
    expect(relErr(saturationVaporPressure(293.15), 2339)).toBeLessThan(5e-3);
    expect(relErr(saturationVaporPressure(373.15), 101_325)).toBeLessThan(1e-2);
  });

  it('humid air is less dense than dry air', () => {
    expect(airDensity(303.15, 101_325, 1)).toBeLessThan(airDensity(303.15, 101_325, 0));
  });

  it('baro and station pressure agree at sea level and round-trip at altitude', () => {
    expect(stationPressureFromBaro(101_325, 0)).toBe(101_325);
    const station = stationPressureFromBaro(101_325, 1500);
    expect(station).toBeLessThan(86_000);
    expect(station).toBeGreaterThan(84_000);
    expect(baroPressureFromStation(station, 1500)).toBeCloseTo(101_325, 6);
  });

  it('baro input at altitude is converted to station pressure', () => {
    const atm = computeAtmosphere({
      temperatureK: 288.15,
      pressurePa: 101_325,
      pressureType: 'baro',
      altitudeM: 1500,
      relativeHumidity: 0,
    });
    expect(atm.stationPressurePa).toBeCloseTo(stationPressureFromBaro(101_325, 1500), 6);
    expect(atm.densityKgM3).toBeLessThan(1.225);
  });

  it('density altitude of the ISA profile at 1500 m is ≈1500 m', () => {
    const t = 288.15 - 0.0065 * 1500;
    const p = stationPressureFromBaro(101_325, 1500);
    expect(densityAltitude(airDensity(t, p, 0))).toBeCloseTo(1500, -1);
  });

  it('hot days raise density altitude', () => {
    const hot = computeAtmosphere({ ...ICAO_STANDARD_ATMOSPHERE, temperatureK: 308.15 });
    expect(hot.densityAltitudeM).toBeGreaterThan(500);
  });
});
