import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ulid } from "ulid";
import { ensureDir } from "../utils/fs.js";
import type { Kind } from "../constants.js";

// ─── Event envelope ───

export type Actor = {
  type: "human" | "minion" | "system";
  id: string;
};

export type EventContext = {
  run_id: string;
  action: string;
  dry_run: boolean;
  workspace: string;
  spec_ref: string | null;
};

export type Intent = {
  intent_hash: string;
  dedupe_key: string;
  reason?: string | null;
};

export type VconEvent = {
  apiVersion: "vcon.events/v0";
  event_id: string;
  event_type: string;
  occurred_at: string;
  actor: Actor;
  context: EventContext;
  intent: Intent;
  payload: Record<string, unknown>;
};

// ─── Artifact state (projected) ───

export type ArtifactState = {
  artifact_id: string;
  kind: Kind;
  namespace: string;
  name: string;
  slug: string;
  status: string;
  narrative: {
    codename: string;
    label?: string;
    description?: string;
  };
  ownership: {
    owner: string;
    steward?: string | null;
  };
  meta: {
    tags: string[];
    created_at: string;
    updated_at: string;
  };
  spec: Record<string, unknown>;
  links: { rel: string; target_id: string }[];
};

// ─── Projection state ───

export type ProjectionState = {
  byId: Map<string, ArtifactState>;
  byKey: Map<string, string>; // "kind|namespace|slug" → artifact_id
  intentsSeen: Set<string>;
};

// ─── ID generators ───

export function newEventId() {
  return `evt_${ulid()}`;
}

export function newRunId() {
  return `run_${ulid()}`;
}

export function newArtifactId() {
  return `art_${ulid()}`;
}

// ─── Intent hash ───

export function computeIntentHash(payload: Record<string, unknown>): string {
  const canonical = stableStringify(payload);
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/** Deterministic JSON stringify — sorts keys at every depth */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sorted.map((k) => JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k]));
  return "{" + pairs.join(",") + "}";
}

export function computeDedupeKey(kind: string, namespace: string, slug: string, action: string): string {
  return `${kind}|${namespace}|${slug}|${action}`;
}

// ─── Artifact key ───

export function artifactKey(kind: string, namespace: string, slug: string): string {
  return `${kind}|${namespace}|${slug}`;
}

// ─── File paths ───

export function eventsPath(rootDir: string) {
  return path.join(rootDir, "registry", "events.ndjson");
}

// ─── Read all events ───

export function readEvents(rootDir: string): VconEvent[] {
  const p = eventsPath(rootDir);
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf-8").split("\n").filter((l) => l.trim());
  return lines.map((l) => JSON.parse(l) as VconEvent);
}

// ─── Append events ───

export function appendEvents(rootDir: string, events: VconEvent[]): void {
  const p = eventsPath(rootDir);
  ensureDir(path.dirname(p));
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.appendFileSync(p, lines, "utf-8");
}

// ─── Project state from events ───

export function projectState(events: VconEvent[]): ProjectionState {
  const byId = new Map<string, ArtifactState>();
  const byKey = new Map<string, string>();
  const intentsSeen = new Set<string>();

  for (const evt of events) {
    // Track all intent hashes
    if (evt.intent?.intent_hash) {
      intentsSeen.add(evt.intent.intent_hash);
    }

    if (evt.event_type === "artifact.created") {
      const a = evt.payload.artifact as ArtifactState;
      byId.set(a.artifact_id, { ...a, links: a.links ?? [] });
      byKey.set(artifactKey(a.kind, a.namespace, a.slug), a.artifact_id);
    }

    if (evt.event_type === "artifact.updated") {
      const ref = evt.payload.artifact_ref as { artifact_id: string; kind: string; namespace: string; slug: string };
      const patch = evt.payload.patch as Record<string, unknown>;
      const existing = byId.get(ref.artifact_id);
      if (existing) {
        if (patch.name != null) existing.name = patch.name as string;
        if (patch.status != null) existing.status = patch.status as string;
        if (patch.narrative != null) existing.narrative = { ...existing.narrative, ...(patch.narrative as object) };
        if (patch.ownership != null) existing.ownership = { ...existing.ownership, ...(patch.ownership as object) };
        if (patch.meta != null) existing.meta = { ...existing.meta, ...(patch.meta as object) };
        if (patch.spec != null) existing.spec = patch.spec as Record<string, unknown>;
      }
    }

    if (evt.event_type === "artifact.linked") {
      const from = evt.payload.from as { artifact_id: string };
      const rel = evt.payload.rel as string;
      const to = evt.payload.to as { artifact_id: string };
      const existing = byId.get(from.artifact_id);
      if (existing) {
        existing.links = existing.links ?? [];
        const alreadyLinked = existing.links.some((l) => l.rel === rel && l.target_id === to.artifact_id);
        if (!alreadyLinked) {
          existing.links.push({ rel, target_id: to.artifact_id });
        }
      }
    }

    if (evt.event_type === "artifact.status_changed") {
      const ref = evt.payload.artifact_ref as { artifact_id: string };
      const to = evt.payload.to as string;
      const existing = byId.get(ref.artifact_id);
      if (existing) existing.status = to;
    }
  }

  return { byId, byKey, intentsSeen };
}

// ─── Make event helper ───

export function makeEvent(
  type: string,
  ctx: EventContext,
  actor: Actor,
  intent: Intent,
  payload: Record<string, unknown>,
): VconEvent {
  return {
    apiVersion: "vcon.events/v0",
    event_id: newEventId(),
    event_type: type,
    occurred_at: new Date().toISOString(),
    actor,
    context: ctx,
    intent,
    payload,
  };
}
