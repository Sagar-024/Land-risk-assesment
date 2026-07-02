# Land Risk Assessment

A high-performance Next.js application that provides comprehensive geospatial risk assessments for land parcels. 

## Overview

The Land Risk Assessment tool aggregates data from multiple federal and state APIs (including FEMA, USGS, USFWS, and the Mireye API) to generate an authoritative, printable "Official Record" of a property's environmental, topographical, and zoning profile.

### Features
- **Dynamic Branching Assessment**: Queries baseline data (elevation, wetlands) and intelligently spawns deeper queries (e.g. Critical Habitat status) based on the initial results.
- **Geospatial Severity Engine**: Automatically categorizes findings into Critical, High, Medium, and Clear statuses based on strict, deterministic thresholds.
- **Surveyor Aesthetic**: Features a highly custom, unified design language leveraging strict 2px structural borders, responsive typographic hierarchies, and noise overlays to mimic physical official records.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Data Fetching**: Custom API Routes & Mireye Client

## Setup & Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env` and fill in your API credentials:
   ```bash
   cp .env.example .env
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Architecture

The core assessment engine is located in `lib/report.ts`.
- `SEVERITY_RULES`: Defines the deterministic thresholds that map raw geospatial data (e.g. `slope_degrees > 30`) to risk levels (`critical`).
- `FIELD_CITATIONS`: Maps internal field keys to their official data source (e.g. "USGS Protected Areas Database").

## Deployment

This project is optimized for deployment on Vercel. 
Simply connect the repository and push to the `main` branch.
