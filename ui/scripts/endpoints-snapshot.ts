// Regenerates src/lib/api/endpoints.paths.json from ROUTES (brief 10.5).
// Run with `npm run endpoints:snapshot`; commit the file with the ROUTES change.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contractRows, contractText } from '../src/lib/api/endpoints';

const target = fileURLToPath(new URL('../src/lib/api/endpoints.paths.json', import.meta.url));
writeFileSync(target, contractText(), 'utf8');
console.log(`Wrote ${contractRows().length} routes to ${target}`);
