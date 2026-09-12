import { normalizeArabicPdfText, looksScrambled } from "./src/lib/ejar-parser.ts";
import fs from "fs";
const raw = fs.readFileSync(process.argv[2], "utf8");
const text = looksScrambled(raw) ? normalizeArabicPdfText(raw) : raw.normalize("NFKC");
const parts = text.replace(/\n/g,"  ").split(/ {2,}/).map(p=>p.trim()).filter(Boolean);
for (const p of parts.slice(0,20)) console.log(JSON.stringify(p));
console.log('---search Data---');
console.log(parts.filter(p=>p.includes("Data")));
