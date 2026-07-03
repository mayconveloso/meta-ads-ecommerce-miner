#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { toCsv, buildSummary } = require('./lib/parse');

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => argv[++i];
    if (token === '--input') args.input = next();
    else if (token === '--out') args.out = next();
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function printHelp() {
  console.log(`Analyze existing ads.jsonl

Usage:
  npm run analyze -- --input output/br-30d/ads.jsonl --out output/br-30d
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.input) throw new Error('Provide --input path/to/ads.jsonl');
  const input = path.resolve(args.input);
  const outDir = path.resolve(args.out || path.dirname(input));
  fs.mkdirSync(outDir, { recursive: true });
  const records = fs.readFileSync(input, 'utf8')
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  fs.writeFileSync(path.join(outDir, 'ads.csv'), toCsv(records));
  fs.writeFileSync(path.join(outDir, 'summary.md'), buildSummary(records));
  console.log(`Records: ${records.length}`);
  console.log(`CSV: ${path.join(outDir, 'ads.csv')}`);
  console.log(`MD: ${path.join(outDir, 'summary.md')}`);
}

try {
  main();
} catch (err) {
  console.error(err.stack || err.message || err);
  process.exit(1);
}
