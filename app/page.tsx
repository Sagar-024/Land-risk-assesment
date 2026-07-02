"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Minus } from "lucide-react";
import type {
  Report,
  RedFlag,
  Severity,
  ClearCheck,
  CheckCategory,
} from "@/lib/report";

const CATEGORY_LABELS: Record<CheckCategory, string> = {
  buildability: "Buildability & Zoning",
  environmental: "Environmental & Water",
  habitat: "Protected Areas & Habitat",
  terrain: "Terrain",
  hazards: "Hazards",
  access: "Utilities & Access",
};

const USE_CASES = [
  { value: "residential", label: "Residential" },
  { value: "cabin-recreational", label: "Cabin / Recreational" },
  { value: "small-acreage-agriculture", label: "Small Acreage Agriculture" },
  { value: "investment", label: "Investment" },
] as const;

export default function Home() {
  const [address, setAddress] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setCurrentDate(new Date().toISOString().split("T")[0]);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, intendedUse }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setReport(data.report);
      setCoordinates(data.coordinates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8 flex items-start justify-center overflow-x-hidden">
      <div className="relative w-full max-w-4xl mt-8 mb-16 bg-surface shadow-sm rounded-sm">
        {report && (
          <div className="absolute top-6 right-6 sm:top-14 sm:right-14 z-40 pointer-events-none rotate-[12deg] opacity-90 mix-blend-multiply flex items-center justify-center rounded-full border-[4px] border-critical text-critical w-28 h-28 sm:w-32 sm:h-32">
            <div className="w-[86%] h-[86%] border-[3px] border-critical rounded-full flex flex-col items-center justify-center">
              <span className="font-serif font-bold italic text-sm sm:text-base tracking-[0.2em] leading-tight text-center">
                Official
                <br />
                Record
              </span>
              <span className="font-mono font-bold text-[7px] sm:text-[8px] tracking-widest mt-1.5">
                {currentDate}
              </span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 z-50 pointer-events-none opacity-[0.03] mix-blend-multiply rounded-sm overflow-hidden">
          <svg className="w-full h-full">
            <filter id="noise">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8"
                numOctaves="4"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#noise)" />
          </svg>
        </div>

        <div className="relative z-10 p-6 sm:p-10 border-2 border-ink/20 m-4 sm:m-10 rounded-sm bg-surface shadow-sm">
          <div className="border-2 border-ink/20 flex flex-col rounded-sm overflow-visible relative bg-surface">
            <div className="p-6 bg-bg/60 text-center border-b-2 border-ink/20">
              <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-ink uppercase">
                Land Risk Assessment
              </h1>
              <p className="mt-2 font-mono text-xs text-ink-secondary tracking-widest uppercase font-bold">
                Official Hazard & Zoning Record
              </p>
            </div>
            <div className="p-6">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row items-end gap-4"
              >
                <div className="w-full space-y-1.5">
                  <label
                    htmlFor="address"
                    className="text-[10px] font-sans text-ink uppercase tracking-wider font-bold"
                  >
                    Property Address
                  </label>
                  <Input
                    id="address"
                    placeholder="Enter a US address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-10 rounded-sm border-2 border-ink/30 bg-bg text-ink font-mono text-sm placeholder:text-ink-secondary/50 placeholder:font-sans focus-visible:ring-0 focus-visible:border-ink"
                    required
                  />
                </div>
                <div className="w-full sm:w-64 space-y-1.5">
                  <label
                    htmlFor="use"
                    className="text-[10px] font-sans text-ink uppercase tracking-wider font-bold"
                  >
                    Intended Use
                  </label>
                  <Select
                    value={intendedUse}
                    onValueChange={(v) => v && setIntendedUse(v)}
                    required
                  >
                    <SelectTrigger
                      id="use"
                      className="h-10 rounded-sm border-2 border-ink/30 bg-bg text-ink font-mono text-sm focus:ring-0 focus:border-ink"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm border-2 border-ink bg-surface">
                      {USE_CASES.map((uc) => (
                        <SelectItem
                          key={uc.value}
                          value={uc.value}
                          className="text-ink font-mono text-sm focus:bg-bg"
                        >
                          {uc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full sm:w-auto px-8 rounded-sm border-2 border-ink bg-ink text-bg font-sans font-bold uppercase tracking-wider text-xs hover:bg-ink/90 transition-none disabled:opacity-50"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Assessing" : "Run Assessment"}
                </Button>
              </form>
              {error && (
                <div className="mt-4 rounded-sm border-2 border-critical bg-critical/10 px-4 py-3 text-sm text-critical font-mono font-bold">
                  ERROR: {error}
                </div>
              )}
            </div>
          </div>

          {report && (
            <ReportDisplay
              report={report}
              address={address}
              coordinates={coordinates}
            />
          )}
        </div>

        <p className="pb-6 pr-6 sm:pr-10 text-right font-mono text-[10px] font-bold text-ink-secondary uppercase tracking-widest relative z-10">
          Data sourced via Mireye API • USGS • FEMA • USFWS
        </p>
      </div>
    </div>
  );
}

function ReportDisplay({
  report,
  address,
  coordinates,
}: {
  report: Report;
  address: string;
  coordinates: { lat: number; lng: number } | null;
}) {
  const { redFlags, clearChecks, notCovered, summary } = report;

  const groupedChecks = clearChecks.reduce(
    (acc, check) => {
      if (!acc[check.category]) acc[check.category] = [];
      acc[check.category].push(check);
      return acc;
    },
    {} as Record<CheckCategory, ClearCheck[]>,
  );

  const flagCategories = new Set(redFlags.map((f) => f.category));

  return (
    <div className="mt-16 space-y-16">
      <div className="space-y-6">
        <div className="border-2 border-ink/20 grid grid-cols-1 md:grid-cols-4 divide-y-2 md:divide-y-0 md:divide-x-2 divide-ink/20 bg-surface rounded-sm overflow-hidden">
          <div className="col-span-2 p-5 flex flex-col justify-between min-h-[120px]">
            <div className="text-[10px] uppercase tracking-widest text-ink font-bold font-sans mb-2">
              Subject Property
            </div>
            <div className="font-serif text-xl sm:text-2xl text-ink leading-tight">
              {address}
            </div>
          </div>
          <div className="col-span-1 p-5 flex flex-col justify-between min-h-[120px] bg-bg/80">
            <div className="text-[10px] uppercase tracking-widest text-ink font-bold font-sans mb-2">
              Coordinates
            </div>
            {coordinates ? (
              <div className="font-mono text-ink space-y-1 text-sm font-medium">
                <div>LAT: {coordinates.lat.toFixed(6)}</div>
                <div>LNG: {coordinates.lng.toFixed(6)}</div>
              </div>
            ) : (
              <div className="font-mono text-sm text-ink-secondary">N/A</div>
            )}
          </div>
          <div className="col-span-1 relative min-h-[120px]">
            {coordinates ? (
              <div className="absolute inset-0 overflow-hidden bg-surface">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - 0.01},${coordinates.lat - 0.01},${coordinates.lng + 0.01},${coordinates.lat + 0.01}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`}
                  className="absolute top-0 left-0 w-full h-[calc(100%+32px)] border-0 grayscale-[0.5] mix-blend-multiply opacity-90"
                  title="Property location map"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/80 font-mono text-[10px] text-ink-secondary font-bold uppercase">
                Map Unavailable
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap border-2 border-ink/20 bg-ink/5 rounded-sm overflow-hidden divide-y-2 md:divide-y-0 md:divide-x-2 divide-ink/20">
          <div className="flex-1 bg-surface px-5 py-4 flex flex-col justify-center min-w-[120px]">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1">
              Total Checks
            </span>
            <span className="font-mono text-3xl text-ink font-bold">
              {summary.totalChecks}
            </span>
          </div>
          <div className="flex-1 bg-surface px-5 py-4 flex flex-col justify-center min-w-[120px]">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1">
              Critical
            </span>
            <span
              className={`font-mono text-3xl font-bold ${summary.flagsBySeverity.critical > 0 ? "text-critical" : "text-ink"}`}
            >
              {summary.flagsBySeverity.critical}
            </span>
          </div>
          <div className="flex-1 bg-surface px-5 py-4 flex flex-col justify-center min-w-[120px]">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1">
              High
            </span>
            <span
              className={`font-mono text-3xl font-bold ${summary.flagsBySeverity.high > 0 ? "text-high" : "text-ink"}`}
            >
              {summary.flagsBySeverity.high}
            </span>
          </div>
          <div className="flex-1 bg-surface px-5 py-4 flex flex-col justify-center min-w-[120px]">
            <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1">
              Clear
            </span>
            <span className="font-mono text-3xl text-clear font-bold">
              {summary.clearCount}
            </span>
          </div>
        </div>
      </div>

      {redFlags.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-bold text-ink">
              Flags & Encumbrances
            </h2>
          </div>
          <div className="space-y-4">
            {redFlags.map((flag, i) => (
              <RedFlagCard key={i} flag={flag} />
            ))}
          </div>
        </section>
      )}

      {clearChecks.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-bold text-ink">
              Clear Checks
            </h2>
          </div>
          <div className="border-2 border-ink/20 bg-bg/30 rounded-sm">
            {(
              Object.entries(groupedChecks) as [CheckCategory, ClearCheck[]][]
            ).map(([category, checks]) => (
              <CollapsibleCategory
                key={category}
                category={category}
                checks={checks}
                defaultOpen={flagCategories.has(category)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4">
          <h2 className="font-serif text-xl font-bold text-ink">
            Exclusions & Limitations
          </h2>
        </div>
        <p className="mb-4 text-xs font-sans text-ink-secondary font-medium">
          The following standard title and physical survey elements are excluded
          from this report and must be verified by a qualified professional:
        </p>
        <ul className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
          {notCovered.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs font-sans text-ink font-medium"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 bg-ink-secondary rounded-full" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CollapsibleCategory({
  category,
  checks,
  defaultOpen,
}: {
  category: CheckCategory;
  checks: ClearCheck[];
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="group">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-ink/5 transition-none"
      >
        <span className="font-sans font-bold text-ink tracking-wide text-sm">
          {CATEGORY_LABELS[category]}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-ink-secondary font-bold">
            {checks.length} RECORDS
          </span>
          {isOpen ? (
            <Minus className="h-3 w-3 text-ink-secondary" />
          ) : (
            <Plus className="h-3 w-3 text-ink-secondary" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="grid grid-cols-1 gap-y-1 bg-bg/50 py-2">
          {checks.map((check, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between px-5 py-1.5 hover:bg-surface/50"
            >
              <span className="font-sans text-xs text-ink-secondary w-full sm:w-1/2 pr-4 font-bold">
                {check.label}
              </span>
              <span className="font-mono text-xs text-ink font-bold w-full sm:w-1/2 text-left sm:text-right">
                {check.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RedFlagCard({ flag }: { flag: RedFlag }) {
  const isCritical = flag.severity === "critical";
  const hideEvidence = flag.evidence === "Yes" || flag.evidence === "No";

  return (
    <div className="flex flex-col gap-1 pb-5 border-b-2 border-ink/20 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full animate-blink ${isCritical ? "bg-critical" : "bg-high"}`}
          ></span>
          <span
            className={`text-[10px] font-mono uppercase tracking-widest font-bold ${isCritical ? "text-critical" : "text-high"}`}
          >
            {flag.severity} RISK
          </span>
        </div>
        <span className="font-mono text-[10px] text-ink-secondary uppercase tracking-widest text-right font-bold">
          SOURCE: {flag.sourceCitation}
        </span>
      </div>
      <p className="font-serif text-xl sm:text-2xl font-bold text-ink leading-tight">
        {flag.title}
      </p>
      {!hideEvidence && (
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 mt-1">
          <span className="font-sans text-[10px] uppercase tracking-wider text-ink-secondary font-bold">
            Measured Value:
          </span>
          <span className="font-mono text-sm text-ink font-bold">
            {flag.evidence}
          </span>
        </div>
      )}
    </div>
  );
}
