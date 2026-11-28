// Writes public/js/plans.js, the browser copy of src/lib/plans.js (the same rules on the site and on the server).
// Run: node scripts/browser-plans.mjs (after every change to src/lib/plans.js)
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/lib/plans.js', import.meta.url), 'utf8');
const names = [...src.matchAll(/export (?:function|const) (\w+)/g)].map(m => m[1]);
const body = src.replace(/export (function|const) /g, '$1 ');
writeFileSync(new URL('../public/js/plans.js', import.meta.url),
  `/* Browser copy of src/lib/plans.js, written by scripts/browser-plans.mjs. Do not edit here. */\n(() => {\n${body}\nwindow.V2PLANS = { ${names.join(', ')} };\n})();\n`);
console.log('public/js/plans.js:', names.join(', '));
