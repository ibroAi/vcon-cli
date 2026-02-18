import yaml from "js-yaml";
import path from "node:path";
import { readFile } from "../utils/fs.js";
import { validateSpec, type VconSpec } from "./schema.js";

export function loadSpec(specPath: string): VconSpec {
  const abs = path.resolve(specPath);
  const txt = readFile(abs);
  const raw = yaml.load(txt);
  return validateSpec(raw) as VconSpec;
}
