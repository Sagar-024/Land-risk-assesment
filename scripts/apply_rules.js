const fs = require('fs');

const rulesPath = 'lib/mireye/rules.json';
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

// Helper to update a field
const updateField = (name, category, dataType, newRules) => {
  const idx = rules.findIndex(r => r.field_name === name);
  if (idx !== -1) {
    rules[idx].category = category;
    rules[idx].data_type = dataType;
    rules[idx].rules = newRules;
  }
};

// --- HAZARDS ---
updateField('within_floodplain_polygon', 'Hazards', 'boolean', [
  {
    condition: { operator: 'eq', value: true },
    severity: 'Risky',
    reason: 'Inside FEMA Special Flood Hazard Area (SFHA).',
    citation: 'FEMA NFHL Guidelines (1% Annual Chance Flood).',
    source: 'FEMA NFHL',
    source_url: 'https://hazards.fema.gov'
  },
  {
    condition: { operator: 'eq', value: false },
    severity: 'Clear',
    reason: 'Outside FEMA SFHA.',
    citation: 'FEMA NFHL Guidelines.',
    source: 'FEMA NFHL',
    source_url: 'https://hazards.fema.gov'
  }
]);

updateField('seismic_design_category', 'Hazards', 'string', [
  {
    condition: { operator: 'in', value: ["C", "D", "E", "F"] },
    severity: 'Risky',
    reason: 'Moderate to extreme seismic risk; requires specific structural detailing.',
    citation: 'ASCE 7-22 (Minimum Design Loads).',
    source: 'USGS Seismic Hazard Model',
    source_url: 'https://www.usgs.gov/programs/earthquake-hazards'
  },
  {
    condition: { operator: 'in', value: ["A", "B"] },
    severity: 'Clear',
    reason: 'Low seismic risk.',
    citation: 'ASCE 7-22 (Minimum Design Loads).',
    source: 'USGS Seismic Hazard Model',
    source_url: 'https://www.usgs.gov/programs/earthquake-hazards'
  }
]);

updateField('design_wind_speed_mph', 'Hazards', 'integer', [
  {
    condition: { operator: 'gte', value: 140 },
    severity: 'Risky',
    reason: 'Hurricane-prone region; requires strict wind-borne debris protection (impact windows/shutters).',
    citation: 'ASCE 7-22 Wind-Borne Debris Region (WBDR).',
    source: 'ASCE / ATC',
    source_url: 'https://asce7hazardtool.online/'
  },
  // We handle the 130 + 1 mile coast distance logic in the code interpreter, but for JSON rules, we do >=130 as well.
  {
    condition: { operator: 'gte', value: 130 },
    severity: 'Risky',
    reason: 'Elevated wind design requirements; potential WBDR if near coast.',
    citation: 'ASCE 7-22.',
    source: 'ASCE / ATC',
    source_url: 'https://asce7hazardtool.online/'
  },
  {
    condition: { operator: 'lt', value: 130 },
    severity: 'Clear',
    reason: 'Standard wind design requirements.',
    citation: 'ASCE 7-22.',
    source: 'ASCE / ATC',
    source_url: 'https://asce7hazardtool.online/'
  }
]);

updateField('wildfire_annual_frequency', 'Hazards', 'float', [
  {
    condition: { operator: 'gt', value: 0.01 },
    severity: 'Risky',
    reason: 'Elevated wildfire hazard; insurance and defensible space implications.',
    citation: 'USFS Wildfire Hazard Potential (WHP) class mappings.',
    source: 'USFS WHP',
    source_url: 'https://www.firelab.org/project/wildfire-hazard-potential'
  },
  {
    condition: { operator: 'lte', value: 0.01 },
    severity: 'Clear',
    reason: 'Low/Moderate wildfire hazard.',
    citation: 'USFS Wildfire Hazard Potential (WHP).',
    source: 'USFS WHP',
    source_url: 'https://www.firelab.org/project/wildfire-hazard-potential'
  }
]);

// --- TERRAIN & BUILDABILITY ---
updateField('slope_degrees', 'Terrain', 'float', [
  {
    condition: { operator: 'gt', value: 15 },
    severity: 'Risky',
    reason: 'Steep grade. Requires specialized foundations, retaining walls, and elevates landslide risk.',
    citation: 'IBC Section 1808 (Foundations on Steep Slopes).',
    source: 'USGS 3DEP',
    source_url: 'https://www.usgs.gov/3d-elevation-program'
  },
  {
    condition: { operator: 'lte', value: 15 },
    severity: 'Clear',
    reason: 'Flat or gentle slope; generally ideal for conventional construction.',
    citation: 'Standard architectural thresholds.',
    source: 'USGS 3DEP',
    source_url: 'https://www.usgs.gov/3d-elevation-program'
  }
]);

updateField('soil_drainage_class', 'Terrain', 'string', [
  {
    condition: { operator: 'in', value: ["Very poorly drained", "Poorly drained", "Somewhat poorly drained"] },
    severity: 'Risky',
    reason: 'High water table or impermeable soils; challenging for septic systems and foundations.',
    citation: 'USDA NRCS Soil Survey Manual.',
    source: 'USDA SSURGO',
    source_url: 'https://websoilsurvey.nrcs.usda.gov/'
  },
  {
    condition: { operator: 'in', value: ["Well drained", "Moderately well drained", "Excessively drained"] },
    severity: 'Clear',
    reason: 'Generally favorable for drainage and conventional septic.',
    citation: 'USDA NRCS Soil Survey Manual.',
    source: 'USDA SSURGO',
    source_url: 'https://websoilsurvey.nrcs.usda.gov/'
  }
]);

// --- ENVIRONMENTAL & PROTECTED AREAS ---
updateField('intersects_wetland', 'Environmental', 'boolean', [
  {
    condition: { operator: 'eq', value: true },
    severity: 'Risky',
    reason: 'Biological wetland present. Development may require USACE §404 permitting and mitigation.',
    citation: 'Clean Water Act §404 / USFWS NWI.',
    source: 'USFWS NWI',
    source_url: 'https://www.fws.gov/program/national-wetlands-inventory'
  },
  {
    condition: { operator: 'eq', value: false },
    severity: 'Clear',
    reason: 'No mapped wetland on parcel.',
    citation: 'USFWS NWI.',
    source: 'USFWS NWI',
    source_url: 'https://www.fws.gov/program/national-wetlands-inventory'
  }
]);

updateField('intersects_protected_area', 'Environmental', 'boolean', [
  {
    condition: { operator: 'eq', value: true },
    severity: 'Risky',
    reason: 'Protected conservation area; significant development restrictions likely.',
    citation: 'USGS PAD-US Gap Analysis.',
    source: 'USGS PAD-US',
    source_url: 'https://www.usgs.gov/programs/gap-analysis-project'
  },
  {
    condition: { operator: 'eq', value: false },
    severity: 'Clear',
    reason: 'Not within a mapped protected area.',
    citation: 'USGS PAD-US.',
    source: 'USGS PAD-US',
    source_url: 'https://www.usgs.gov/programs/gap-analysis-project'
  }
]);

updateField('intersects_critical_habitat', 'Environmental', 'boolean', [
  {
    condition: { operator: 'eq', value: true },
    severity: 'Risky',
    reason: 'ESA Critical Habitat. Federal nexus triggers consultation.',
    citation: 'Endangered Species Act (ESA).',
    source: 'USFWS CRITHAB',
    source_url: 'https://www.fws.gov/project/critical-habitat'
  },
  {
    condition: { operator: 'eq', value: false },
    severity: 'Clear',
    reason: 'Outside mapped critical habitat.',
    citation: 'Endangered Species Act (ESA).',
    source: 'USFWS CRITHAB',
    source_url: 'https://www.fws.gov/project/critical-habitat'
  }
]);

// --- UTILITIES & INFRASTRUCTURE ---
updateField('nearest_hazardous_facility_distance_m', 'Utilities', 'float', [
  {
    condition: { operator: 'lt', value: 1500 },
    severity: 'Risky',
    reason: 'Proximity to hazardous site; warrants Phase I ESA for potential vapor/groundwater concerns.',
    citation: 'EPA All Appropriate Inquiries (AAI) Rule (ASTM E1527-21).',
    source: 'EPA FRS',
    source_url: 'https://www.epa.gov/enviro/facility-registry-service-frs'
  },
  {
    condition: { operator: 'gte', value: 1500 },
    severity: 'Clear',
    reason: 'Generally beyond standard environmental area of concern.',
    citation: 'EPA AAI Guidelines.',
    source: 'EPA FRS',
    source_url: 'https://www.epa.gov/enviro/facility-registry-service-frs'
  }
]);

updateField('nearest_transmission_line_distance_m', 'Utilities', 'float', [
  {
    condition: { operator: 'lt', value: 100 },
    severity: 'Risky',
    reason: 'Close proximity to high-voltage transmission; potential easement/ROW encumbrances and aesthetic concerns.',
    citation: 'Real Estate Standard Practice.',
    source: 'EIA ATLAS',
    source_url: 'https://atlas.eia.gov/'
  },
  {
    condition: { operator: 'gte', value: 100 },
    severity: 'Clear',
    reason: 'No immediate high-voltage lines encumbering site.',
    citation: 'Real Estate Standard Practice.',
    source: 'EIA ATLAS',
    source_url: 'https://atlas.eia.gov/'
  }
]);

updateField('intersects_conservation_easement', 'Environmental', 'boolean', [
  {
    condition: { operator: 'eq', value: true },
    severity: 'Risky',
    reason: 'Parcel is encumbered by a conservation easement, heavily restricting development.',
    citation: 'National Conservation Easement Database.',
    source: 'USGS PAD-US',
    source_url: 'https://www.usgs.gov/programs/gap-analysis-project'
  },
  {
    condition: { operator: 'eq', value: false },
    severity: 'Clear',
    reason: 'No federal conservation easement recorded.',
    citation: 'National Conservation Easement Database.',
    source: 'USGS PAD-US',
    source_url: 'https://www.usgs.gov/programs/gap-analysis-project'
  }
]);

updateField('tree_canopy_pct', 'Terrain', 'float', [
  {
    condition: { operator: 'gt', value: 60 },
    severity: 'Informational',
    reason: 'Dense forest canopy present; major wildfire fuel + clearing required for construction.',
    citation: 'USFS NLCD Canopy Cover.',
    source: 'USFS NLCD',
    source_url: 'https://www.mrlc.gov/'
  }
]);

fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
console.log('Successfully injected authoritative rules into rules.json');
