// @vitest-environment node
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { DopeDocument } from '@/components/dope/dope-document';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import { buildDopeCard, type DopeFormat } from '@/lib/dope/build';
import { formFromProfile } from '@/lib/profiles/to-form';
import { newLoad, newRifle, type Clock } from '@/lib/store/factories';

/**
 * Render the card to a real PDF.
 *
 * The preview table and the printed document are built from different code, so
 * a passing builder test says nothing about whether the PDF itself renders.
 * This actually produces the bytes.
 */

const clock: Clock = { now: () => '2026-01-01T00:00:00.000Z', id: () => 'fixed-id' };
const rifle = newRifle({ name: 'Tikka T3x', cartridge: '6.5 Creedmoor', twistIn: 8 }, clock);
const load = newLoad('r1', { name: '140 ELD-M' }, clock);

const card = buildDopeCard(
  rifle,
  load,
  formFromProfile(rifle, load, {
    ...DEFAULT_FORM,
    rangeStart: 100,
    rangeEnd: 1000,
    rangeStep: 100,
  }),
  { now: new Date('2026-06-01T12:00:00Z') },
);

async function render(format: DopeFormat): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  // renderToBuffer is typed against the <Document> element's own props, which a
  // component wrapping it can never structurally match.
  const element = createElement(DopeDocument, { card, format }) as unknown as Parameters<
    typeof renderToBuffer
  >[0];
  return renderToBuffer(element);
}

describe('DOPE PDF', () => {
  it.each<DopeFormat>(['letter', 'half', 'band'])(
    'renders the %s format',
    async (format) => {
      const buffer = await render(format);
      // A PDF always starts with %PDF- and ends with an EOF marker.
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(buffer.subarray(-1024).toString('latin1')).toContain('%%EOF');
      expect(buffer.byteLength).toBeGreaterThan(1000);
    },
    60_000,
  );

  it('puts the rifle and load in the document metadata', async () => {
    const buffer = await render('letter');
    const text = buffer.toString('latin1');
    expect(text).toContain('Ballistic Forge');
  }, 60_000);

  it('gets smaller as the paper does', async () => {
    const [letter, band] = await Promise.all([render('letter'), render('band')]);
    expect(band.byteLength).toBeLessThan(letter.byteLength);
  }, 90_000);
});
