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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Report } from '@/lib/report';

const USE_CASES = [
  { value: 'residential', label: 'Residential' },
  { value: 'cabin-recreational', label: 'Cabin / Recreational' },
  { value: 'small-acreage-agriculture', label: 'Small Acreage Agriculture' },
  { value: 'investment', label: 'Investment' },
] as const;

export default function AssessPage() {
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
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Land Purchase Risk Assessment</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enter a US address to get a plain-English report of red flags a land buyer would miss in person.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="123 Main St, Springfield, IL 62701"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="use">Intended Use</Label>
              <Select value={intendedUse} onValueChange={(v) => v && setIntendedUse(v)} required>
                <SelectTrigger id="use">
                  <SelectValue placeholder="Select intended use" />
                </SelectTrigger>
                <SelectContent>
                  {USE_CASES.map((uc) => (
                    <SelectItem key={uc.value} value={uc.value}>
                      {uc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Running assessment...' : 'Assess Property'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Assessment Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && <ReportDisplay report={report} />}
    </main>
  );
}

function ReportDisplay({ report }: { report: Report }) {
  const { redFlags, noFlagsFound, notCovered } = report;

  const severityColor: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    info: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assessment Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {redFlags.length > 0 && (
          <section>
            <h2 className="mb-3 font-semibold">Red Flags Found</h2>
            <div className="space-y-3">
              {redFlags.map((flag, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-4 ${severityColor[flag.severity] ?? severityColor.info}`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide">{flag.severity}</span>
                    <span className="text-xs opacity-70">{flag.sourceCitation}</span>
                  </div>
                  <p className="font-medium">{flag.title}</p>
                  <p className="mt-0.5 text-xs opacity-70">Value: {flag.evidence}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {noFlagsFound.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Clear Checks</h2>
            <p className="text-muted-foreground mb-2 text-sm">
              These risk factors were evaluated and came back clean:
            </p>
            <div className="grid grid-cols-2 gap-1 text-sm">
              {noFlagsFound.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-green-700">
                  <span className="text-xs">&check;</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <SeparatorOrFallback />

        <section>
          <h2 className="mb-2 font-semibold">Not Covered by This Tool</h2>
          <p className="text-muted-foreground mb-2 text-sm">
            Always verify these with a qualified professional before purchasing:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {notCovered.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

function SeparatorOrFallback() {
  return <hr className="my-2 border-t" />;
}