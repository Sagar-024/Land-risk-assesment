"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { PipelineResult, Finding, Manifest } from "@/lib/pipeline";
import FlipText from "@/components/FlipText";

// ───────── Animation variants ─────────
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.15,
    },
  },
};

const slideUpItem = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

// ───────── Constants ─────────
const PROFILE_SECTIONS: Record<string, string> = {
  location: "Location",
  terrain: "Terrain",
  environment: "Environment",
  infrastructure: "Infrastructure",
  parcel: "Parcel",
};

const USE_CASES = [
  { value: "residential", label: "Residential" },
  { value: "cabin-recreational", label: "Cabin / Recreational" },
  { value: "small-acreage-agriculture", label: "Small Acreage Agriculture" },
  { value: "investment", label: "Investment" },
] as const;

const USE_LABELS: Record<string, string> = {
  residential: "residential",
  "cabin-recreational": "cabin / recreational",
  "small-acreage-agriculture": "small-acreage agriculture",
  investment: "investment",
};

// V2 verified test addresses
const TEST_ADDRESSES = [
  {
    label: "Coastal flood zone",
    address: "1500 Gulf Blvd, Indian Rocks Beach, FL 33785",
    intendedUse: "residential",
  },
  {
    label: "Wildfire + seismic",
    address: "45500 Highway 1, Big Sur, CA 93920",
    intendedUse: "cabin-recreational",
  },
  {
    label: "Desert / seismic",
    address: "62249 Twentynine Palms Hwy, Joshua Tree, CA 92252",
    intendedUse: "residential",
  },
  {
    label: "Industrial corridor",
    address: "1000 Clinton Dr, Houston, TX 77029",
    intendedUse: "residential",
  },
];

// ───────── Helpers ─────────
function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// ───────── Main page ─────────
export default function Home() {
  const [address, setAddress] = useState("");
  const [intendedUse, setIntendedUse] = useState(""); // React state stays intendedUse; API receives land_use
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [currentDate, setCurrentDate] = useState("");
  const [loadingStage, setLoadingStage] = useState<string>('');

  useEffect(() => {
    setCurrentDate(new Date().toISOString().split("T")[0]);

    const savedAddress = sessionStorage.getItem("landRiskAddress");
    const savedUse = sessionStorage.getItem("landRiskUse");
    const savedResult = sessionStorage.getItem("landRiskResult");
    const savedCoordinates = sessionStorage.getItem("landRiskCoordinates");

    if (savedAddress) setAddress(savedAddress);
    if (savedUse) setIntendedUse(savedUse);
    if (savedResult) {
      try { setResult(JSON.parse(savedResult)); } catch {}
    }
    if (savedCoordinates) {
      try { setCoordinates(JSON.parse(savedCoordinates)); } catch {}
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("landRiskAddress", address);
    sessionStorage.setItem("landRiskUse", intendedUse);

    if (result) {
      sessionStorage.setItem("landRiskResult", JSON.stringify(result));
    } else {
      sessionStorage.removeItem("landRiskResult");
    }
    if (coordinates) {
      sessionStorage.setItem("landRiskCoordinates", JSON.stringify(coordinates));
    } else {
      sessionStorage.removeItem("landRiskCoordinates");
    }
  }, [address, intendedUse, result, coordinates]);

  async function handleSubmit(e?: React.FormEvent, overrideAddress?: string, overrideUse?: string) {
    if (e) e.preventDefault();

    const finalAddress = overrideAddress || address;
    const finalUse = overrideUse || intendedUse;

    if (!finalAddress || !finalUse) {
      setError("Please provide an address and intended use.");
      return;
    }

    if (overrideAddress) setAddress(overrideAddress);
    if (overrideUse) setIntendedUse(overrideUse);

    setLoading(true);
    setError(null);
    setResult(null);
    setCoordinates(null);
    setLoadingStage('Starting analysis...');

    const STAGE_LABELS: Record<string, string> = {
      geocode: 'Locating address',
      fetch: 'Fetching 128 data fields',
      llm: 'AI analyzing evidence',
      validate: 'Validating findings',
    };

    try {
      const res = await fetch("/api/assess/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: finalAddress, land_use: finalUse }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let pipelineError: string | null = null;

      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let event: any;
            try { event = JSON.parse(payload); } catch { continue; }

            if (event.type === 'stage') {
              const label = STAGE_LABELS[event.stage] ?? event.stage;
              setLoadingStage(event.status === 'done' ? `${label} ✓` : `${label}...`);
            } else if (event.type === 'complete') {
              const data: PipelineResult = event.result;
              if (!data.ok) { pipelineError = data.error ?? 'Pipeline failed'; break outer; }
              setResult(data);
              if (data.geocode) setCoordinates({ lat: data.geocode.lat, lng: data.geocode.lng });
              break outer;
            } else if (event.type === 'error') {
              pipelineError = event.error ?? 'Unknown pipeline error';
              break outer;
            }
          }
        }
      }
      reader.cancel().catch(() => {});
      if (pipelineError) throw new Error(pipelineError);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Results view ──
  if (result) {
    return (
      <div className="min-h-screen bg-bg p-4 sm:p-8 flex flex-col items-center overflow-x-hidden">
        <div className="w-full max-w-4xl flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl text-ink font-bold">Land Risk Assessment</h1>
          <div className="flex items-center gap-4">
            {result.timings?.total_ms ? (
              <span className="font-sans text-[11px] text-ink-secondary tabular-nums">
                Generated in {formatDuration(result.timings.total_ms)}
              </span>
            ) : null}
            <button
              onClick={() => { setResult(null); setAddress(""); setIntendedUse(""); setCoordinates(null); }}
              className="text-sm font-sans text-ink-secondary hover:text-ink underline"
            >
              Start New Search
            </button>
          </div>
        </div>
        <div className="relative w-full max-w-4xl bg-surface shadow-sm rounded-sm">
          {/* Data Verified stamp */}
          <div className="absolute bottom-6 left-6 sm:bottom-12 sm:left-12 z-40 pointer-events-none -rotate-[12deg] opacity-90 mix-blend-multiply flex items-center justify-center rounded-full border-[4px] border-critical text-critical w-28 h-28 sm:w-32 sm:h-32">
            <div className="w-[86%] h-[86%] border-[3px] border-critical rounded-full flex flex-col items-center justify-center gap-0.5 px-2">
              <span className="font-serif font-bold italic text-[11px] sm:text-xs tracking-[0.12em] leading-tight text-center">
                Data
                <br />
                Verified
              </span>
              <span className="font-sans font-bold text-[6px] sm:text-[7px] tracking-widest mt-1 text-center leading-tight">
                USGS · FEMA<br />USFWS
              </span>
            </div>
          </div>
          {/* Paper grain */}
          <div className="absolute inset-0 z-50 pointer-events-none opacity-[0.03] mix-blend-multiply rounded-sm overflow-hidden">
            <svg className="w-full h-full">
              <filter id="noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
              </filter>
              <rect width="100%" height="100%" filter="url(#noise)" />
            </svg>
          </div>
          <div className="relative z-10 p-6 sm:p-10 m-4 sm:m-10 rounded-sm">
            <ReportDisplay
              result={result}
              address={address}
              intendedUse={intendedUse}
              coordinates={coordinates}
            />
          </div>
          <p className="pb-6 pr-6 sm:pr-10 text-right font-sans text-[10px] font-bold text-ink-secondary uppercase tracking-widest relative z-10">
            Data sourced via Mireye API • USGS • FEMA • USFWS
          </p>
        </div>
      </div>
    );
  }

  // ── Landing / search view ──
  return (
    <div
      className="min-h-screen w-full relative overflow-x-hidden text-black flex flex-col items-center"
      style={{
        backgroundImage: "url('/00da0bded3a5dc65122837ae947e3dc0.png')",
        backgroundColor: "#ede7d9",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <section className="relative z-10 flex w-full max-w-[826px] flex-col items-center justify-center gap-5 text-center sm:gap-6 mt-16 sm:mt-24 px-4 pb-20">
        <h1 className="text-black text-center font-serif" style={{ fontSize: "clamp(44px, 13vw, 70px)", lineHeight: 1.1, letterSpacing: "clamp(-2.4px, -0.34vw, -1.1px)", margin: 0 }}>
          <span className="block">
            <FlipText duration={6} delay={0.2} loop={true} together={false}>
              Assess Land Risk
            </FlipText>
          </span>
        </h1>

        <div className="relative mt-2 sm:mt-4 flex w-full min-w-0 flex-col justify-between overflow-visible rounded-[8px] border border-black/20 bg-white/90 text-slate-700 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur min-h-[98px] max-w-[640px] sm:min-h-[106px]">
          <textarea
            aria-label="Address"
            className="font-sans h-[66px] max-h-[300px] w-full resize-none overflow-y-auto bg-transparent p-3.5 text-[14.5px] outline-none placeholder:text-slate-500 sm:h-[74px] sm:p-4 sm:text-[16px]"
            placeholder="Enter a US property address..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <select
                className="font-sans flex h-8 max-w-[220px] cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors sm:text-[13px] text-slate-600 bg-transparent hover:bg-slate-100 outline-none"
                value={intendedUse}
                onChange={(e) => setIntendedUse(e.target.value)}
              >
                <option value="" disabled>Select Intended Use</option>
                {USE_CASES.map(uc => <option key={uc.value} value={uc.value}>{uc.label}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={loading || !address || !intendedUse}
              aria-label="Submit"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-sky-400 bg-white text-sky-500 transition hover:bg-sky-50 active:scale-95 disabled:opacity-60 sm:h-9 sm:w-9"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up h-4 w-4" aria-hidden="true">
                  <path d="m5 12 7-7 7 7" />
                  <path d="M12 19V5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-300 font-sans font-medium bg-red-900/40 px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-3 font-sans text-[13px] text-black/60 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{loadingStage || 'Starting...'}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-[640px]">
          {TEST_ADDRESSES.map((test, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSubmit(undefined, test.address, test.intendedUse)}
              className="px-3 py-1.5 bg-black/5 hover:bg-black/10 border border-black/10 rounded-full text-xs font-sans text-black transition-colors whitespace-nowrap backdrop-blur-sm"
            >
              {test.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ───────── Report display ─────────
function ReportDisplay({
  result,
  address,
  intendedUse,
  coordinates,
}: {
  result: PipelineResult;
  address: string;
  intendedUse: string;
  coordinates: { lat: number; lng: number } | null;
}) {
  const llm = result.llm_parsed;
  const validation = result.validation;
  const manifest = result.manifest;

  const flags = validation?.flags ?? [];
  const moderate = validation?.moderate ?? [];
  const clear_checks = validation?.clear_checks ?? [];
  const profile = llm?.property_profile;
  const due_diligence = llm?.recommended_due_diligence ?? [];
  const exclusions = llm?.exclusions_and_limitations ?? [];

  return (
    <div className="mt-2 space-y-16">
      {/* ── Header: address + coords + map ── */}
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
              <div className="font-sans text-ink space-y-1 text-sm font-medium">
                <div>LAT: {coordinates.lat.toFixed(6)}</div>
                <div>LNG: {coordinates.lng.toFixed(6)}</div>
              </div>
            ) : (
              <div className="font-sans text-sm text-ink-secondary">N/A</div>
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
              <div className="absolute inset-0 flex items-center justify-center bg-bg/80 font-sans text-[10px] text-ink-secondary font-bold uppercase">
                Map Unavailable
              </div>
            )}
          </div>
        </div>

        {/* ── Executive Summary ── */}
        <div className="mb-6">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink mb-4">
            Executive Summary
          </h2>
          <div className="font-sans text-sm text-ink leading-relaxed space-y-3 whitespace-pre-line text-justify">
            {llm?.executive_summary ?? "Summary unavailable."}
          </div>
        </div>
      </div>

      {/* ── Flags & Encumbrances (critical + high) ── */}
      {flags.length > 0 && (
        <section>
          <div className="mb-6 border-b-2 border-ink/20 pb-3">
            <h2 className="font-serif text-2xl font-bold text-ink">
              Flags &amp; Encumbrances
            </h2>
            <p className="mt-1 font-sans text-[10px] text-ink-secondary uppercase tracking-widest font-bold">
              For {USE_LABELS[intendedUse] ?? intendedUse} use
            </p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-8"
          >
            {flags.map((finding, i) => (
              <FindingCard key={finding.id || i} finding={finding} index={i} manifest={manifest} />
            ))}
          </motion.div>
        </section>
      )}

      {/* ── Moderate Considerations (moderate) ── */}
      {moderate.length > 0 && (
        <section>
          <div className="mb-6 border-b-2 border-ink/20 pb-3">
            <h2 className="font-serif text-2xl font-bold text-ink">
              Moderate Considerations
            </h2>
            <p className="mt-1 font-sans text-[10px] text-ink-secondary uppercase tracking-widest font-bold">
              Worth disclosing — typically manageable
            </p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-8"
          >
            {moderate.map((finding, i) => (
              <FindingCard key={finding.id || i} finding={finding} index={i} manifest={manifest} />
            ))}
          </motion.div>
        </section>
      )}

      {/* ── Clear Checks (low severity — genuinely reassuring) ── */}
      {clear_checks.filter(c => c.severity === 'low').length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-bold text-ink">
              Clear Checks
            </h2>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {clear_checks.filter(c => c.severity === 'low').map((check, i) => (
              <motion.div
                key={check.id || i}
                variants={slideUpItem}
                className="flex items-start gap-2 bg-bg/40 border border-ink/10 rounded-sm px-4 py-3"
              >
                <span className="mt-1 h-2 w-2 shrink-0 bg-clear rounded-full" />
                <div className="min-w-0">
                  <span className="font-sans text-sm text-ink font-medium block">
                    {check.title}
                  </span>
                  {check.body && (
                    <p className="font-sans text-xs text-ink-secondary leading-snug mt-0.5 line-clamp-2">
                      {check.body}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ── Site Characteristics (info severity — neutral context) ── */}
      {clear_checks.filter(c => c.severity === 'info').length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="font-serif text-xl font-bold text-ink">
              Site Characteristics
            </h2>
            <p className="mt-1 font-sans text-[10px] text-ink-secondary uppercase tracking-widest font-bold">
              Neutral factual context
            </p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {clear_checks.filter(c => c.severity === 'info').map((check, i) => (
              <motion.div
                key={check.id || i}
                variants={slideUpItem}
                className="flex items-start gap-2 bg-bg/40 border border-ink/10 rounded-sm px-4 py-3"
              >
                <span className="mt-1 h-2 w-2 shrink-0 bg-ink/20 rounded-full" />
                <div className="min-w-0">
                  <span className="font-sans text-sm text-ink font-medium block">
                    {check.title}
                  </span>
                  {check.body && (
                    <p className="font-sans text-xs text-ink-secondary leading-snug mt-0.5 line-clamp-2">
                      {check.body}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ── Property Profile ── */}
      {profile && (
        <section>
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-bold text-ink">
              Property Profile
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 border-2 border-ink/20 bg-bg/30 rounded-sm p-6 sm:p-10">
            {Object.entries(PROFILE_SECTIONS).map(([key, label]) => {
              // V2: property_profile values are strings, not arrays
              const text = profile[key as keyof typeof profile];
              if (!text) return null;
              return (
                <div key={key}>
                  <h3 className="font-sans text-[10px] uppercase tracking-widest text-ink-secondary font-bold mb-3">
                    {label}
                  </h3>
                  {(() => {
                    const facts = text.split(' \u2022 ').map(s => s.trim()).filter(Boolean);
                    return facts.length > 1 ? (
                      <ul className="space-y-1.5">
                        {facts.map((fact, fi) => (
                          <li key={fi} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 bg-ink-secondary rounded-full" />
                            <span className="font-sans text-sm text-ink leading-relaxed">{fact}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-sans text-sm text-ink leading-relaxed">{text}</p>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recommended Due Diligence ── */}
      <section>
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-bold text-ink">
            Recommended Due Diligence
          </h2>
        </div>
        <div className="bg-bg/40 border-2 border-ink/20 rounded-sm p-5">
          {due_diligence.length > 0 ? (
            <motion.ol
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              className="space-y-4"
            >
              {due_diligence.map((item, i) => (
                <motion.li
                  key={i}
                  variants={slideUpItem}
                  className="flex items-start gap-3"
                >
                  <span className="font-sans text-[10px] font-bold text-ink-secondary shrink-0 mt-0.5 w-5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-sm text-ink leading-relaxed">
                    {item}
                  </span>
                </motion.li>
              ))}
            </motion.ol>
          ) : (
            <p className="font-sans text-sm text-ink-secondary italic">
              No specific due diligence items identified for this property.
            </p>
          )}
        </div>
      </section>

      {/* ── Exclusions & Limitations ── */}
      <section>
        <div className="mb-4">
          <h2 className="font-serif text-xl font-bold text-ink">
            Exclusions &amp; Limitations
          </h2>
        </div>
        <p className="mb-4 text-xs font-sans text-ink-secondary font-medium">
          This report is based on geospatial data only and does not cover the
          following, which must be verified by qualified professionals:
        </p>
        {exclusions.length > 0 ? (
          <ul className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
            {exclusions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-sans text-ink font-medium">
                <span className="mt-1.5 h-1 w-1 shrink-0 bg-ink-secondary rounded-full" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          // Fallback static list if LLM didn't return exclusions
          <ul className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
            {[
              "Title ownership & chain of title",
              "Liens, encumbrances, judgments",
              "HOA / POA covenants, fees, restrictions",
              "Mineral rights, water rights, timber rights",
              "Septic / well permitting & feasibility",
              "Local building codes & permit requirements",
              "Survey boundaries & encroachments",
              "Insurance availability & cost",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-sans text-ink font-medium">
                <span className="mt-1.5 h-1 w-1 shrink-0 bg-ink-secondary rounded-full" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ───────── Finding card ─────────
function FindingCard({
  finding,
  index,
  manifest,
}: {
  finding: Finding;
  index: number;
  manifest?: Manifest;
}) {
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const toggleField = (fieldId: string) => {
    setExpandedField(prev => (prev === fieldId ? null : fieldId));
  };

  const expandedEntry = expandedField && manifest ? manifest[expandedField] : null;

  return (
    <motion.div
      variants={slideUpItem}
      className="border-b-2 border-ink/20 pb-6 last:border-b-0"
    >
      <div className="flex items-start gap-4">
        <span className="font-sans text-[10px] font-bold text-ink-secondary shrink-0 mt-1 w-5">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1 space-y-3">
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-ink leading-tight">
            {finding.title}
          </h3>

          {/* Body (was why_it_matters in V1) */}
          <div>
            <span className="font-sans text-[10px] uppercase tracking-widest text-ink-secondary font-bold">
              Why It Matters
            </span>
            <p className="font-sans text-sm text-ink leading-relaxed mt-1 text-justify">
              {finding.body}
            </p>
          </div>

          {/* Recommendation (was recommended_action in V1) */}
          {finding.recommendation && (
            <div>
              <span className="font-sans text-[10px] uppercase tracking-widest text-ink-secondary font-bold">
                Recommended Action
              </span>
              <p className="font-sans text-sm text-ink font-medium leading-relaxed mt-1 text-justify">
                {finding.recommendation}
              </p>
            </div>
          )}

          {/* Evidence chips — new in V2 */}
          {finding.evidence_field_ids && finding.evidence_field_ids.length > 0 && manifest && (
            <div>
              <span className="font-sans text-[10px] uppercase tracking-widest text-ink-secondary font-bold">
                Evidence Sources
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {finding.evidence_field_ids.map((fieldId) => (
                  <button
                    key={fieldId}
                    onClick={() => toggleField(fieldId)}
                    className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      expandedField === fieldId
                        ? "bg-ink text-surface border-ink"
                        : "bg-bg/60 text-ink-secondary border-ink/20 hover:border-ink/40 hover:text-ink"
                    }`}
                  >
                    {fieldId}
                  </button>
                ))}
              </div>

              {/* Expanded field detail */}
              {expandedField && expandedEntry && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-3 bg-bg/60 border border-ink/10 rounded-sm text-xs font-sans space-y-1"
                >
                  {expandedEntry.description && (
                    <p className="text-ink font-medium">{expandedEntry.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-ink-secondary mt-1">
                    {expandedEntry.source && <span>Source: <span className="text-ink">{expandedEntry.source}</span></span>}
                    {expandedEntry.confidence && <span>Confidence: <span className="text-ink capitalize">{expandedEntry.confidence}</span></span>}
                    {expandedEntry.dataset_vintage && <span>Vintage: <span className="text-ink">{expandedEntry.dataset_vintage}</span></span>}
                  </div>
                  {expandedEntry.value !== null && expandedEntry.value !== undefined && (
                    <p className="text-ink-secondary">
                      Value: <span className="text-ink font-medium">
                        {typeof expandedEntry.value === "object"
                          ? JSON.stringify(expandedEntry.value)
                          : String(expandedEntry.value)}
                        {expandedEntry.unit ? ` ${expandedEntry.unit}` : ""}
                      </span>
                    </p>
                  )}
                  {expandedEntry.source_url && (
                    <a
                      href={expandedEntry.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline block mt-1"
                    >
                      View source ↗
                    </a>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
