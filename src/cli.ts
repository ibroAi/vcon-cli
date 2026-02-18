#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { KINDS, type Kind, MINIONS_PROTOCOL } from "./constants.js";
import { ensureDir, exists } from "./utils/fs.js";
import { initGovernance } from "./governance/init.js";
import { scaffoldSpec } from "./core/scaffold_spec.js";
import { loadSpec } from "./spec/load.js";
import { applySpec } from "./core/apply.js";

const program = new Command();

function templatesDir() {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), "..", "templates");
}

function rootDir() {
  return process.cwd();
}

program
  .name("vcon")
  .description("Villain-Con (VCON) — Minions Protocol bootstrapper")
  .version("0.2.0");

program
  .command("init")
  .description("Create minimal VCON workspace scaffolding (non-destructive)")
  .action(() => {
    const tdir = templatesDir();
    const rdir = rootDir();
    initGovernance({ rootDir: rdir, templatesDir: tdir });
    ensureDir(path.join(rdir, "registry"));
    ensureDir(path.join(rdir, "reports"));
    console.log("✅ VCON initialized");
    console.log(`   governance: ai/governance`);
    console.log(`   registry:   registry/`);
    console.log(`   reports:    reports/`);
  });

program
  .command("new")
  .description("Generate a VCON spec for a kind + name")
  .argument("<kind>", `One of: ${KINDS.join(", ")}`)
  .argument("<n>", "Human name")
  .option("--out <dir>", "Output directory", ".")
  .action((kindRaw: string, name: string, options: { out: string }) => {
    if (!KINDS.includes(kindRaw as any)) {
      console.error(`❌ Invalid kind: ${kindRaw}`);
      process.exit(1);
    }
    const kind = kindRaw as Kind;
    const { outPath } = scaffoldSpec(kind, name, { templatesDir: templatesDir(), outDir: path.resolve(options.out) });
    console.log(`✅ Spec generated`);
    console.log(`   kind: ${kind} (${MINIONS_PROTOCOL[kind]})`);
    console.log(`   path: ${outPath}`);
  });

program
  .command("validate")
  .description("Validate a VCON spec (schema + Minions Protocol mapping)")
  .argument("<spec>", "Path to spec.yaml")
  .action((specPath: string) => {
    const spec = loadSpec(specPath);
    const codename = MINIONS_PROTOCOL[spec.kind];
    console.log("✅ Spec valid");
    console.log(`   kind: ${spec.kind} (${codename})`);
    console.log(`   name: ${spec.metadata.name}`);
    console.log(`   slug: ${spec.metadata.slug}`);
  });

program
  .command("apply")
  .description("Apply a VCON spec: event-sourced registry write + report")
  .argument("<spec>", "Path to spec.yaml")
  .option("--dry-run", "Do not write registry events", false)
  .option("--namespace <ns>", "Namespace", "global")
  .option("--owner <owner>", "Owner id", "unknown")
  .option("--reason <text>", "Reason for this apply (audit)")
  .action(async (specPath: string, options: { dryRun: boolean; namespace: string; owner: string; reason?: string }) => {
    try {
      const spec = loadSpec(specPath);

      const result = await applySpec(spec, {
        rootDir: rootDir(),
        templatesDir: templatesDir(),
        dryRun: Boolean(options.dryRun),
        namespace: options.namespace,
        owner: options.owner,
        reason: options.reason,
      });

      const codename = MINIONS_PROTOCOL[spec.kind];
      const mode = result.dryRun ? "🧪 DRY-RUN" : "🚀 APPLY";
      const outcomeEmoji = result.outcome === "created" ? "✨" : result.outcome === "updated" ? "🔄" : "⏭️";

      console.log(`${mode} ${outcomeEmoji} ${result.outcome}`);
      console.log(`   ${codename} (${spec.kind}): ${spec.metadata.name}`);
      console.log(`   run_id:   ${result.runId}`);
      console.log(`   events:   ${result.events.map((e) => e.event_type).join(", ")}`);
      console.log(`   report:   ${result.report.reportDir}`);
      if (result.dryRun) {
        console.log("   registry: not written (dry-run)");
      } else {
        console.log("   registry: registry/events.ndjson");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Apply failed: ${msg}`);
      process.exit(1);
    }
  });

program
  .command("report")
  .description("Show a Debrief from a previous action")
  .argument("<dir>", "Path to report directory (e.g. reports/2026-02-18/apply-agent-kevin)")
  .action((dir: string) => {
    const absDir = path.resolve(dir);
    const promptPath = path.join(absDir, "prompt.md");
    const reportPath = path.join(absDir, "report.md");

    if (!exists(absDir)) {
      console.error(`❌ Report directory not found: ${absDir}`);
      process.exit(1);
    }

    console.log(`📋 Debrief: ${absDir}`);
    if (exists(promptPath)) console.log(`   prompt: ${promptPath}`);
    else console.log(`   prompt: not found`);
    if (exists(reportPath)) console.log(`   report: ${reportPath}`);
    else console.log(`   report: not found`);
  });

program.parse(process.argv);
