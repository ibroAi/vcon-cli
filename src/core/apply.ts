import path from "node:path";
import { initGovernance } from "../governance/init.js";
import { writeReport } from "../reports/reporter.js";
import { MINIONS_PROTOCOL } from "../constants.js";
import type { VconSpec } from "../spec/schema.js";
import {
  readEvents,
  projectState,
  appendEvents,
  makeEvent,
  newRunId,
  newArtifactId,
  computeIntentHash,
  computeDedupeKey,
  artifactKey,
  eventsPath,
  type Actor,
  type EventContext,
  type Intent,
  type VconEvent,
} from "../registry/events.js";

export type ApplyResult = {
  outcome: "created" | "updated" | "noop";
  runId: string;
  events: VconEvent[];
  report: { reportDir: string };
  dryRun: boolean;
};

export async function applySpec(
  spec: VconSpec,
  opts: {
    rootDir: string;
    templatesDir: string;
    dryRun: boolean;
    namespace: string;
    owner: string;
    reason?: string;
  },
): Promise<ApplyResult> {
  const { rootDir, templatesDir, dryRun, namespace, owner } = opts;
  const now = new Date().toISOString();
  const runId = newRunId();

  const actor: Actor = { type: "human", id: owner };
  const actionLabel = `apply-${spec.kind}-${spec.metadata.slug}`;

  const ctx: EventContext = {
    run_id: runId,
    action: actionLabel,
    dry_run: dryRun,
    workspace: rootDir,
    spec_ref: null,
  };

  // Intent hash for dedupe
  const intentPayload = {
    kind: spec.kind,
    namespace,
    slug: spec.metadata.slug,
    spec: spec.spec ?? {},
  };
  const intentHash = computeIntentHash(intentPayload);
  const dedupeKey = computeDedupeKey(spec.kind, namespace, spec.metadata.slug, "apply");

  const intent: Intent = {
    intent_hash: intentHash,
    dedupe_key: dedupeKey,
    reason: opts.reason ?? null,
  };

  // Governance (always, even dry-run)
  initGovernance({ rootDir, templatesDir });

  // Read current state
  const allEvents = readEvents(rootDir);
  const state = projectState(allEvents);

  // Collect events for this run
  const runEvents: VconEvent[] = [];

  // run.started
  runEvents.push(
    makeEvent("run.started", ctx, actor, intent, {
      command: "apply",
      args: [spec.metadata.slug, dryRun ? "--dry-run" : "--apply"],
    }),
  );

  // Dedupe check
  let outcome: "created" | "updated" | "noop";

  if (state.intentsSeen.has(intentHash)) {
    // Exact same intent already processed
    outcome = "noop";
  } else {
    // Check if artifact exists by key
    const key = artifactKey(spec.kind, namespace, spec.metadata.slug);
    const existingId = state.byKey.get(key);

    if (!existingId) {
      // CREATE
      outcome = "created";
      const artifactId = newArtifactId();

      runEvents.push(
        makeEvent("artifact.created", ctx, actor, intent, {
          artifact: {
            artifact_id: artifactId,
            kind: spec.kind,
            namespace,
            name: spec.metadata.name,
            slug: spec.metadata.slug,
            status: "active",
            narrative: {
              codename: MINIONS_PROTOCOL[spec.kind],
            },
            ownership: { owner, steward: null },
            meta: {
              tags: [],
              created_at: now,
              updated_at: now,
            },
            spec: spec.spec ?? {},
            links: [],
          },
        }),
      );
    } else {
      // Existing artifact — check if spec changed
      const existing = state.byId.get(existingId);
      const existingSpec = JSON.stringify(existing?.spec ?? {});
      const newSpec = JSON.stringify(spec.spec ?? {});

      if (existingSpec === newSpec) {
        outcome = "noop";
      } else {
        outcome = "updated";
        runEvents.push(
          makeEvent("artifact.updated", ctx, actor, intent, {
            artifact_ref: {
              artifact_id: existingId,
              kind: spec.kind,
              namespace,
              slug: spec.metadata.slug,
            },
            patch: {
              name: spec.metadata.name,
              spec: spec.spec ?? {},
              meta: { updated_at: now },
            },
          }),
        );
      }
    }
  }

  // run.completed
  runEvents.push(
    makeEvent("run.completed", ctx, actor, intent, {
      outcome,
      noop: outcome === "noop",
    }),
  );

  // Write events (unless dry-run)
  if (!dryRun) {
    appendEvents(rootDir, runEvents);
  }

  // Write report
  const codename = MINIONS_PROTOCOL[spec.kind];
  const eventTypes = runEvents.map((e) => e.event_type).join(", ");

  const report = writeReport({
    rootDir,
    templatesDir,
    action: actionLabel,
    prompt: `Apply spec (kind=${spec.kind}, name=${spec.metadata.name})`,
    what: `${outcome === "created" ? "Created" : outcome === "updated" ? "Updated" : "Noop"} ${codename} (${spec.kind}): ${spec.metadata.name}`,
    why: "Bootstrap artifact according to canonical VCON + Minions Protocol standards.",
    how: [
      `run_id: ${runId}`,
      `outcome: ${outcome}`,
      `dry_run: ${dryRun}`,
      `events: ${eventTypes}`,
      `registry: ${dryRun ? "not written" : path.relative(rootDir, eventsPath(rootDir))}`,
    ].join("\n"),
    result: dryRun
      ? `DRY-RUN: ${outcome} planned but registry not written.`
      : `${outcome} — ${runEvents.length} events appended to registry.`,
  });

  return { outcome, runId, events: runEvents, report, dryRun };
}
