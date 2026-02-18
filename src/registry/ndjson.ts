import fs from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import { ensureDir } from "../utils/fs.js";
import type { Kind } from "../constants.js";

export type ArtifactRef = {
  rel: string;
  target_id: string;
};

export type ArtifactRecord = {
  id: string;
  kind: Kind;
  name: string;
  slug: string;
  namespace: string;
  status: "draft" | "active" | "paused" | "retired";
  narrative: {
    codename: string;
    label?: string;
    description?: string;
  };
  ownership: {
    owner: string;
    steward?: string | null;
  };
  links: {
    urls: { label?: string; url: string }[];
    refs: ArtifactRef[];
  };
  meta: {
    tags: string[];
    created_at: string;
    updated_at: string;
  };
  spec: Record<string, unknown>;
};

export function newArtifactId() {
  return `art_${ulid()}`;
}

export function registryPath(rootDir: string) {
  return path.join(rootDir, "registry", "artifacts.ndjson");
}

export function appendArtifact(rootDir: string, record: ArtifactRecord) {
  const p = registryPath(rootDir);
  ensureDir(path.dirname(p));
  const line = JSON.stringify(record) + "\n";
  // append-only
  fs.appendFileSync(p, line, "utf-8");
  return { path: p };
}
