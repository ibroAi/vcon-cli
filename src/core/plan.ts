import type { VconSpec } from "../spec/schema.js";
import { MINIONS_PROTOCOL, DEFAULT_NAMESPACE } from "../constants.js";
import { newArtifactId, type ArtifactRecord } from "../registry/ndjson.js";

export type ApplyPlan = {
  artifact: ArtifactRecord;
  actions: string[];
};

export function planFromSpec(spec: VconSpec, opts: { namespace?: string; owner?: string }): ApplyPlan {
  const namespace = opts.namespace ?? DEFAULT_NAMESPACE;
  const owner = opts.owner ?? "unknown";

  const now = new Date().toISOString();
  const artifact: ArtifactRecord = {
    id: newArtifactId(),
    kind: spec.kind,
    name: spec.metadata.name,
    slug: spec.metadata.slug,
    namespace,
    status: "active",
    narrative: {
      codename: MINIONS_PROTOCOL[spec.kind],
    },
    ownership: { owner, steward: null },
    links: { urls: [], refs: [] },
    meta: { tags: [], created_at: now, updated_at: now },
    spec: spec.spec ?? {},
  };

  return {
    artifact,
    actions: [
      "init-governance-if-missing",
      "write-registry-append",
      "write-report-bundle",
    ],
  };
}
