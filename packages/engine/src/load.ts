/**
 * Linear powder-temperature sensitivity: MV changes by `sensitivityMpsPerK` for every kelvin of
 * difference from the temperature the MV was measured at.
 */
export function temperatureAdjustedMuzzleVelocity(
  muzzleVelocityMps: number,
  measuredAtK: number,
  currentK: number,
  sensitivityMpsPerK: number,
): number {
  return muzzleVelocityMps + sensitivityMpsPerK * (currentK - measuredAtK);
}
