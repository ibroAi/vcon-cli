import path from "node:path";
import process from "node:process";
import { exists, readFile, writeFile } from "../utils/fs.js";
import { renderTemplate, slugify } from "../utils/strings.js";
import type { Kind } from "../constants.js";

export function scaffoldSpec(kind: Kind, name: string, opts: { templatesDir: string; outDir: string }) {
  const slug = slugify(name);
  const tplPath = path.join(opts.templatesDir, "specs", `${kind}.yaml`);

  if (!exists(tplPath)) {
    console.error(`❌ Template not found for kind "${kind}"`);
    console.error(`   Expected: ${tplPath}`);
    process.exit(1);
  }

  const tpl = readFile(tplPath);
  const rendered = renderTemplate(tpl, { name, slug });

  const outPath = path.join(opts.outDir, `${kind}.${slug}.vcon.yaml`);
  writeFile(outPath, rendered);
  return { outPath, slug };
}
