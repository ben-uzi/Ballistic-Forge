'use client';

import { Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState, type ReactElement } from 'react';
import { DopeDocument } from '@/components/dope/dope-document';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { NumberField } from '@/components/ui/field';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { DEFAULT_FORM } from '@/lib/calc/defaults';
import { UNIT_LABEL } from '@/lib/calc/format';
import { DOPE_FORMATS, buildDopeCard, type DopeFormat } from '@/lib/dope/build';
import { formFromProfile } from '@/lib/profiles/to-form';
import { useProfile } from '@/lib/store/hooks';

/**
 * `@react-pdf/renderer` reaches for browser APIs at import time, so the
 * download link is loaded on the client only and never during prerender.
 */
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((module) => module.PDFDownloadLink),
  {
    ssr: false,
    loading: () => <span className="text-sm text-ink-500">Preparing…</span>,
  },
);

export default function DopePage(): ReactElement {
  const params = useParams<{ loadId: string }>();
  const { data, loading } = useProfile(params.loadId);

  const [format, setFormat] = useState<DopeFormat>('letter');
  const [start, setStart] = useState(100);
  const [end, setEnd] = useState(1000);
  const [step, setStep] = useState(50);
  const [wind1, setWind1] = useState(5);
  const [wind2, setWind2] = useState(10);

  const { load, rifle } = data;

  const card = useMemo(() => {
    if (load === null || rifle === null) return null;
    const form = formFromProfile(rifle, load, {
      ...DEFAULT_FORM,
      rangeStart: start,
      rangeEnd: end,
      rangeStep: step,
    });
    try {
      return buildDopeCard(rifle, load, form, { windSpeeds: [wind1, wind2] });
    } catch {
      return null;
    }
  }, [load, rifle, start, end, step, wind1, wind2]);

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-sm text-ink-500">Loading…</p>;
  }

  if (load === null || rifle === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <EmptyState
          title="No such load"
          body="A DOPE card is built from a saved rifle and load."
          action={
            <Button asChild variant="primary">
              <Link href="/rifles">Back to rifles</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const fileName = `${slug(rifle.name)}-${slug(load.name)}-dope.pdf`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <nav className="text-xs text-ink-500">
        <Link href={`/loads/${load.id}`} className="hover:text-ink-300">
          {load.name}
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-300">DOPE card</span>
      </nav>

      <PageHeader title="DOPE card" subtitle={`${rifle.name} · ${load.name}`} />

      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <Label>Format</Label>
            <Segmented
              ariaLabel="Card format"
              className="w-full [&>button]:flex-1"
              value={format}
              onChange={setFormat}
              options={Object.values(DOPE_FORMATS).map((spec) => ({
                value: spec.id,
                label: spec.label,
                title: spec.description,
              }))}
            />
            <p className="text-xs text-ink-500">{DOPE_FORMATS[format].description}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="From"
              suffix={UNIT_LABEL[DEFAULT_FORM.units.range]}
              value={start}
              onChange={setStart}
            />
            <NumberField
              label="To"
              suffix={UNIT_LABEL[DEFAULT_FORM.units.range]}
              value={end}
              onChange={setEnd}
            />
            <NumberField
              label="Step"
              suffix={UNIT_LABEL[DEFAULT_FORM.units.range]}
              value={step}
              onChange={setStep}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Wind column 1"
              suffix={UNIT_LABEL[DEFAULT_FORM.units.windSpeed]}
              value={wind1}
              onChange={setWind1}
              help="Full-value crosswind. Mirror it for the other side."
            />
            <NumberField
              label="Wind column 2"
              suffix={UNIT_LABEL[DEFAULT_FORM.units.windSpeed]}
              value={wind2}
              onChange={setWind2}
            />
          </div>

          <div>
            {card === null ? (
              <p className="text-sm text-fail-500">
                Those ranges do not produce a card. Check the start, end and step.
              </p>
            ) : (
              <Button asChild variant="primary">
                <PDFDownloadLink
                  document={<DopeDocument card={card} format={format} />}
                  fileName={fileName}
                >
                  <Download aria-hidden="true" />
                  Download PDF
                </PDFDownloadLink>
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {card === null ? null : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-300">Preview</h2>
          <div className="scroll-slim overflow-x-auto rounded-card border border-gunmetal-700">
            <table className="w-full border-collapse text-right text-sm">
              <thead className="bg-gunmetal-850 text-[0.6875rem] uppercase tracking-wide text-ink-500">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Range
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Elev
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Clicks
                  </th>
                  {card.windLabels.map((label) => (
                    <th key={label} scope="col" className="px-3 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-medium">
                    Vel
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    TOF
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {card.rows.map((row) => (
                  <tr
                    key={row.range}
                    className={
                      row.subsonic
                        ? 'border-t border-gunmetal-800 bg-fail-500/5'
                        : row.transonic
                          ? 'border-t border-gunmetal-800 bg-warn-500/5'
                          : 'border-t border-gunmetal-800'
                    }
                  >
                    <td className="px-3 py-1.5 text-left font-semibold text-ink-100">
                      {row.range}
                    </td>
                    <td className="px-3 py-1.5 text-forge-500">{row.elevation}</td>
                    <td className="px-3 py-1.5 text-ink-500">{row.clicks}</td>
                    {row.winds.map((hold, index) => (
                      <td
                        key={card.windLabels[index] ?? String(index)}
                        className="px-3 py-1.5 text-ink-300"
                      >
                        {hold}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-ink-300">{row.velocity}</td>
                    <td className="px-3 py-1.5 text-ink-300">{row.tof}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-500">
            The printed card carries the full disclaimer, the conditions above, and a timestamp.
          </p>
        </section>
      )}
    </div>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'card'
  );
}
