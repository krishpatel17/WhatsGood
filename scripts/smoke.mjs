// Usage: node scripts/smoke.mjs https://whats-good-api.<account>.workers.dev
const base = process.argv[2];
if (!base) {
  console.error("Usage: node scripts/smoke.mjs <deployed worker URL>");
  process.exit(2);
}
const res = await fetch(new URL("/health", base));
console.log(`GET /health -> ${res.status}`);
process.exit(res.status === 200 ? 0 : 1);
