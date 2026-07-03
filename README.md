# Land Risk Assessment

A high-performance Next.js application that provides comprehensive geospatial risk assessments for land parcels.

> [!NOTE]
> This system aggregates data from multiple federal and state APIs (including FEMA, USGS, USFWS, and the Mireye API) to generate an authoritative, printable "Official Record" of a property's environmental, topographical, and zoning profile.

## Features

- **Dynamic Branching Assessment**  
  Queries baseline data (elevation, wetlands) and intelligently spawns deeper queries (e.g., Critical Habitat status) based on the initial results.

- **Geospatial Severity Engine**  
  Automatically categorizes findings into Critical, High, Medium, and Clear statuses based on strict, deterministic thresholds.

- **Two-Layer Plain English Interpretation**  
  - *Layer 1 (Deterministic)*: A pure, rules-based engine maps complex geospatial flags into precise, safe, non-prescriptive prose.
  - *Layer 2 (LLM Polish)*: An optional DeepSeek-powered readability pass that smooths the flow of the deterministic strings, designed with strict guardrails to never hallucinate facts, falling back to Layer 1 safely on any failure.

- **Atmospheric UI**  
  Features a custom, unified design language leveraging strict structural borders, ambient leaf and cloud simulations, and subtle staggered animations to mimic physical official records.

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Data Fetching**: Custom API Routes & Mireye Client

## Setup & Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**  
   Copy `.env.example` to `.env` and configure your API credentials.
   ```bash
   cp .env.example .env
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

## Architecture

> [!IMPORTANT]
> The core assessment engine is located in `lib/report.ts`.

- `SEVERITY_RULES`: Defines the deterministic thresholds that map raw geospatial data (e.g., `slope_degrees > 30`) to actionable risk levels (`critical`).
- `FIELD_CITATIONS`: Maps internal field keys to their official data source (e.g., "USGS Protected Areas Database").

## Deployment

This project is optimized for zero-config deployment on Vercel. Connect the repository to your Vercel account and push to the `main` branch.

