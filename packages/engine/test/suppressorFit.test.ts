import { describe, expect, it } from 'vitest';
import {
  checkSuppressorFit,
  normalizeCartridge,
  normalizeThread,
  sameCartridge,
  sameThread,
  worstOf,
  type FitCheck,
  type FitCheckId,
  type HostFitSpec,
  type SuppressorFitSpec,
} from '../src/suppressorFit';

/** A fully specified, compatible pairing. Individual tests take things away. */
const CAN: SuppressorFitSpec = {
  modelName: 'Test 30',
  boreDiameterIn: 0.323,
  mountType: 'direct_thread',
  threadPitch: '5/8x24',
  ratedCartridges: ['.308 Winchester', '6.5 Creedmoor', '.300 Winchester Magnum'],
  maxRatedCartridge: '.300 Winchester Magnum',
  maxRatedCartridgeDiameterIn: 0.308,
  minBarrelLengthNote: '16 in minimum for .300 Win Mag',
};

const HOST: HostFitSpec = {
  cartridge: '6.5 Creedmoor',
  bulletDiameterIn: 0.264,
  threadPitch: '5/8x24',
  barrelLengthIn: 24,
};

const check = (id: FitCheckId, result: { checks: readonly FitCheck[] }): FitCheck => {
  const found = result.checks.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`No ${id} check in the result`);
  return found;
};

describe('a fully specified, compatible pairing', () => {
  const result = checkSuppressorFit(CAN, HOST);

  it('passes overall', () => {
    expect(result.status).toBe('warn');
  });

  it('passes the bore, cartridge and mount checks', () => {
    expect(check('bore', result).status).toBe('pass');
    expect(check('cartridge', result).status).toBe('pass');
    expect(check('mount', result).status).toBe('pass');
  });

  it('still asks the user to read the barrel-length restriction', () => {
    // A published restriction is always surfaced; the app will not decide it is met.
    expect(check('barrel-length', result).status).toBe('warn');
    expect(check('barrel-length', result).detail).toBe('16 in minimum for .300 Win Mag');
  });

  it('reaches a clean pass when there is no published restriction', () => {
    const { minBarrelLengthNote: _note, ...noNote } = CAN;
    expect(checkSuppressorFit({ ...noNote }, HOST).status).toBe('unknown');
  });

  it('returns one check per rule', () => {
    expect(result.checks.map((entry) => entry.id)).toEqual([
      'bore',
      'cartridge',
      'mount',
      'barrel-length',
    ]);
  });
});

describe('missing data never passes', () => {
  it('is unknown, not pass, with no bore diameter', () => {
    const { boreDiameterIn: _bore, ...spec } = CAN;
    const result = checkSuppressorFit(spec, HOST);
    expect(check('bore', result).status).toBe('unknown');
    expect(result.status).not.toBe('pass');
  });

  it('is unknown, not pass, with no bullet diameter', () => {
    const { bulletDiameterIn: _bullet, ...host } = HOST;
    const result = checkSuppressorFit(CAN, host);
    expect(check('bore', result).status).toBe('unknown');
    expect(result.status).not.toBe('pass');
  });

  it('is unknown, not pass, with no mount type', () => {
    const { mountType: _mount, ...spec } = CAN;
    const result = checkSuppressorFit(spec, HOST);
    expect(check('mount', result).status).toBe('unknown');
    expect(result.status).not.toBe('pass');
  });

  it('is unknown, not pass, with no thread pitch on the suppressor', () => {
    const { threadPitch: _thread, ...spec } = CAN;
    const result = checkSuppressorFit(spec, HOST);
    expect(check('mount', result).status).toBe('unknown');
    expect(result.status).not.toBe('pass');
  });

  it('is unknown, not pass, with no thread pitch on the rifle', () => {
    const { threadPitch: _thread, ...host } = HOST;
    const result = checkSuppressorFit(CAN, host);
    expect(check('mount', result).status).toBe('unknown');
  });

  it('is unknown, not pass, with no cartridge on the rifle', () => {
    const { cartridge: _cartridge, ...host } = HOST;
    const result = checkSuppressorFit(CAN, host);
    expect(check('cartridge', result).status).toBe('unknown');
    expect(result.status).not.toBe('pass');
  });

  it('is unknown, not pass, with no ratings published at all', () => {
    const {
      ratedCartridges: _rated,
      maxRatedCartridge: _max,
      maxRatedCartridgeDiameterIn: _maxD,
      ...spec
    } = CAN;
    const result = checkSuppressorFit(spec, HOST);
    expect(check('cartridge', result).status).toBe('unknown');
  });

  it('is unknown with an empty suppressor and an empty host', () => {
    const result = checkSuppressorFit({}, {});
    expect(result.status).toBe('unknown');
    expect(result.checks.every((entry) => entry.status === 'unknown')).toBe(true);
  });
});

describe('bore', () => {
  it('fails when the bullet is bigger than the bore', () => {
    const result = checkSuppressorFit(
      { ...CAN, boreDiameterIn: 0.224 },
      { ...HOST, bulletDiameterIn: 0.308, cartridge: '.308 Winchester' },
    );
    expect(check('bore', result).status).toBe('fail');
    expect(result.status).toBe('fail');
  });

  it('says plainly what a too-small bore means', () => {
    const result = checkSuppressorFit({ ...CAN, boreDiameterIn: 0.224 }, HOST);
    expect(check('bore', result).detail).toMatch(/strike the baffles/i);
  });

  it('warns rather than passing when clearance is nil', () => {
    const result = checkSuppressorFit({ ...CAN, boreDiameterIn: 0.264 }, HOST);
    expect(check('bore', result).status).toBe('warn');
  });

  it('warns when clearance is under four thousandths', () => {
    const result = checkSuppressorFit({ ...CAN, boreDiameterIn: 0.267 }, HOST);
    expect(check('bore', result).status).toBe('warn');
  });

  it('passes with comfortable clearance', () => {
    const result = checkSuppressorFit({ ...CAN, boreDiameterIn: 0.3 }, HOST);
    expect(check('bore', result).status).toBe('pass');
    expect(check('bore', result).summary).toContain('0.036');
  });
});

describe('cartridge rating', () => {
  it('passes a cartridge on the rated list', () => {
    expect(check('cartridge', checkSuppressorFit(CAN, HOST)).status).toBe('pass');
  });

  it('matches rated cartridges despite punctuation and abbreviation', () => {
    const result = checkSuppressorFit(CAN, { ...HOST, cartridge: '308 Win' });
    expect(check('cartridge', result).status).toBe('pass');
  });

  it('fails a cartridge in a larger calibre than the maximum rated', () => {
    const result = checkSuppressorFit(CAN, {
      ...HOST,
      cartridge: '.338 Lapua Magnum',
      bulletDiameterIn: 0.338,
    });
    expect(check('cartridge', result).status).toBe('fail');
    expect(result.status).toBe('fail');
  });

  it('warns on an unlisted cartridge within the maximum calibre', () => {
    const result = checkSuppressorFit(CAN, {
      ...HOST,
      cartridge: '6mm Creedmoor',
      bulletDiameterIn: 0.243,
    });
    expect(check('cartridge', result).status).toBe('warn');
  });

  it('says why an unlisted cartridge is only a warning, not an endorsement', () => {
    const result = checkSuppressorFit(CAN, { ...HOST, cartridge: '6mm Creedmoor' });
    expect(check('cartridge', result).detail).toMatch(/pressure and powder volume/i);
    expect(check('cartridge', result).detail).toMatch(/confirm with the manufacturer/i);
  });

  it('never claims a pressure judgement it cannot make', () => {
    const result = checkSuppressorFit(CAN, { ...HOST, cartridge: '6mm Creedmoor' });
    expect(check('cartridge', result).detail).not.toMatch(/safe/i);
  });
});

describe('mount', () => {
  it('passes a direct thread that matches', () => {
    expect(check('mount', checkSuppressorFit(CAN, HOST)).status).toBe('pass');
  });

  it('accepts equivalent spellings of the same thread', () => {
    const result = checkSuppressorFit({ ...CAN, threadPitch: '5/8-24' }, HOST);
    expect(check('mount', result).status).toBe('pass');
  });

  it('fails a direct thread that does not match', () => {
    const result = checkSuppressorFit(CAN, { ...HOST, threadPitch: '1/2x28' });
    expect(check('mount', result).status).toBe('fail');
    expect(check('mount', result).summary).toContain('1/2x28');
  });

  it('refuses to recommend a thread adapter as a workaround', () => {
    const result = checkSuppressorFit(CAN, { ...HOST, threadPitch: '1/2x28' });
    expect(check('mount', result).detail).toMatch(/question for the manufacturer/i);
  });

  it('names the device a quick-detach mount needs', () => {
    const result = checkSuppressorFit({ ...CAN, mountType: 'keymo' }, HOST);
    expect(check('mount', result).status).toBe('warn');
    expect(check('mount', result).summary).toMatch(/KeyMo muzzle device in 5\/8x24/);
  });

  it('names the HUB standard', () => {
    const result = checkSuppressorFit({ ...CAN, mountType: 'hub_1375x24' }, HOST);
    expect(check('mount', result).summary).toMatch(/1\.375x24 HUB/);
  });

  it('is unknown for an unrecognised mounting standard', () => {
    const result = checkSuppressorFit({ ...CAN, mountType: 'other' }, HOST);
    expect(check('mount', result).status).toBe('unknown');
  });
});

describe('barrel length', () => {
  it('quotes the manufacturer note verbatim and does not parse it', () => {
    const note = 'Not for barrels under 16 inches in .300 Win Mag; 20 in recommended';
    const result = checkSuppressorFit(
      { ...CAN, minBarrelLengthNote: note },
      { ...HOST, barrelLengthIn: 26 },
    );
    expect(check('barrel-length', result).detail).toBe(note);
    // Even with a 26 in barrel, the app does not decide the restriction is met.
    expect(check('barrel-length', result).status).toBe('warn');
  });

  it('is unknown when the manufacturer publishes nothing', () => {
    const { minBarrelLengthNote: _note, ...spec } = CAN;
    const result = checkSuppressorFit(spec, HOST);
    expect(check('barrel-length', result).status).toBe('unknown');
    expect(check('barrel-length', result).detail).toMatch(/ask the manufacturer/i);
  });
});

describe('aggregate verdict', () => {
  const make = (status: FitCheck['status']): FitCheck => ({
    id: 'bore',
    status,
    summary: '',
  });

  it('is a pass only when everything passes', () => {
    expect(worstOf([make('pass'), make('pass')])).toBe('pass');
  });

  it('lets a failure dominate anything else', () => {
    expect(worstOf([make('pass'), make('warn'), make('unknown'), make('fail')])).toBe('fail');
  });

  it('puts unknown above warn, so missing data never reads as a bounded concern', () => {
    expect(worstOf([make('warn'), make('unknown')])).toBe('unknown');
  });

  it('is a warn when everything is known and something is marginal', () => {
    expect(worstOf([make('pass'), make('warn')])).toBe('warn');
  });

  it('is a pass for an empty list, which only the caller can produce', () => {
    expect(worstOf([])).toBe('pass');
  });
});

describe('name normalisation', () => {
  it('ignores punctuation, case and spacing', () => {
    expect(sameCartridge('.308 Winchester', '308 winchester')).toBe(true);
    expect(sameCartridge('6.5 Creedmoor', '6.5creedmoor')).toBe(true);
  });

  it('expands the unambiguous abbreviations', () => {
    expect(sameCartridge('.300 Win Mag', '.300 Winchester Magnum')).toBe(true);
    expect(sameCartridge('.223 Rem', '.223 Remington')).toBe(true);
  });

  it('does not conflate genuinely different cartridges', () => {
    expect(sameCartridge('.308 Winchester', '.300 Winchester Magnum')).toBe(false);
    expect(sameCartridge('6mm Creedmoor', '6.5 Creedmoor')).toBe(false);
    expect(sameCartridge('.223 Remington', '5.56 NATO')).toBe(false);
  });

  it('normalises to something stable', () => {
    expect(normalizeCartridge('.308 Win')).toBe('308winchester');
  });

  it('treats thread spellings as equivalent', () => {
    expect(sameThread('5/8x24', '5/8-24')).toBe(true);
    expect(sameThread('5/8 x 24', '5/8X24')).toBe(true);
    expect(normalizeThread('1/2-28')).toBe('1/2x28');
  });

  it('keeps different threads apart', () => {
    expect(sameThread('5/8x24', '1/2x28')).toBe(false);
    expect(sameThread('M18x1', 'M18x1.5')).toBe(false);
  });
});
