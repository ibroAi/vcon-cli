export const VCON_API_VERSION = "vcon/v1" as const;

export const KINDS = ["agent", "project", "repo", "server", "container"] as const;
export type Kind = (typeof KINDS)[number];

export const MINIONS_PROTOCOL: Record<Kind, string> = {
  agent: "Minion",
  project: "Master Plan",
  repo: "Blueprint",
  server: "Lair",
  container: "Capsule",
};

export const DEFAULT_NAMESPACE = "global";
