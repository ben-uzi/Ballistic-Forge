import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index';

describe('@bf/engine', () => {
  it('exposes a semver version string', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
