'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { Report, RedFlag, Severity } from '@/lib/report';

const USE_CASES = [
  { value: 'residential', label: 'Residential' },
  { value: 'cabin-recreational', label: 'Cabin / Recreational' },
  { value: 'small-acreage-agriculture', label: 'Small Acreage Agriculture' },
  { value: 'investment', label: 'Investment' },
] as const;

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'severity-critical' },
  high: { label: 'High', className: 'severity-high' },
  medium: { label: 'Medium', className: 'severity-medium' },
  low: { label: 'Low', className: 'severity-low' },
  info: { label: 'Info', className: 'severity-info' },
};

export default function Home() {
  const [address, setAddress] = useState('');
  const [intendedUse, setIntendedUse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, intendedUse }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/Backgroundimage.png')" }}
        />
        <div className="absolute inset-0 bg-slate-900/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Land Risk Assessment
          </h1>
          <p className="mt-2 text-sm text-slate-300/80">
            Enter a US address to uncover hidden red flags before you buy.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium text-slate-700">
                Property Address
              </Label>
              <Input
                id="address"
                placeholder="123 Main St, Springfield, IL 62701"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-11 rounded-lg border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-slate-400/20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="use" className="text-sm font-medium text-slate-700">
                Intended Use
              </Label>
              <Select value={intendedUse} onValueChange={(v) => v && setIntendedUse(v)} required>
                <SelectTrigger id="use" className="h-11 rounded-lg border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-slate-400/20">
                  <SelectValue placeholder="Select intended use" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-slate-200 bg-white">
                  {USE_CASES.map((uc) => (
                    <SelectItem key={uc.value} value={uc.value} className="text-slate-900">
                      {uc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-slate-900 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Assessing...' : 'Assess Property'}
            </Button>
          </form>

          {/* Error */}
          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Report */}
          {report && <ReportDisplay report={report} />}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400/60">
          Data sourced from FEMA, USGS, NWI, and other public datasets via Mireye API.
        </p>
      </div>
    </div>
  );
}

function ReportDisplay({ report }: { report: Report }) {
  const { redFlags, noFlagsFound, notCovered } = report;

  return (
    <div className="mt-8 space-y-6 border-t border-slate-100 pt-8">
      {/* Red Flags */}
      {redFlags.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-base font-semibold text-slate-900">
            Red Flags
          </h2>
          <div className="space-y-3">
            {redFlags.map((flag, i) => (
              <RedFlagCard key={i} flag={flag} />
            ))}
          </div>
        </section>
      )}

      {/* Clear Checks */}
      {noFlagsFound.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-base font-semibold text-slate-900">
            Clear Checks
          </h2>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {noFlagsFound.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-600">
                  ✓
                </span>
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Separator */}
      <div className="border-t border-slate-100" />

      {/* Not Covered */}
      <section>
        <h2 className="mb-2 font-heading text-base font-semibold text-slate-900">
          Not Covered
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Always verify these with a qualified professional:
        </p>
        <ul className="space-y-1.5">
          {notCovered.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RedFlagCard({ flag }: { flag: RedFlag }) {
  const config = SEVERITY_CONFIG[flag.severity];

  return (
    <div className={`rounded-lg px-4 py-3 ${config.className}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {config.label}
        </span>
        <span className="text-[11px] text-slate-400">
          {flag.sourceCitation}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-800">{flag.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Value: {flag.evidence}
      </p>
    </div>
  );
}
