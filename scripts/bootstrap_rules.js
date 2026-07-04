const fs = require('fs');

const tsCode = fs.readFileSync('lib/mireye/fields.ts', 'utf8');

// Extract ALL_RELEVANT_FIELDS manually by regex
const directMatch = tsCode.match(/export const DIRECT_FIELDS = \[([\s\S]*?)\] as const;/);
const indirectMatch = tsCode.match(/export const INDIRECT_FIELDS = \[([\s\S]*?)\] as const;/);

const extractFields = (str) => {
  return str.split('\n')
    .map(line => line.trim().replace(/[\",]/g, ''))
    .filter(line => line.length > 0);
};

const directFields = extractFields(directMatch[1]);
const indirectFields = extractFields(indirectMatch[1]);

const allFields = [...directFields, ...indirectFields];

const rules = allFields.map(f => ({
  field_name: f,
  category: 'General',
  data_type: 'string',
  is_direct: directFields.includes(f),
  rules: [
    {
      condition: { operator: 'neq', value: null },
      severity: 'Informational',
      reason: 'No specific risk thresholds identified for this metric.',
      citation: 'General Context',
      source: 'Mireye Field Defaults',
      source_url: 'https://api.mireye.com/v1/meta/fields'
    }
  ]
}));

fs.writeFileSync('lib/mireye/rules.json', JSON.stringify(rules, null, 2));
console.log('Created lib/mireye/rules.json with ' + rules.length + ' fields.');
