# Villain-Con (VCON) — CLI v0

Spec in → Canon out → (optioneel) Apply → Altijd report.

## Install (dev)
```bash
npm i
npm run dev -- --help
```

## Build
```bash
npm run build
node dist/cli.js --help
```

## Commands
- `vcon init` — create minimal VCON workspace scaffolding
- `vcon new <kind> <name> [--namespace <ns>] [--apply]` — generate a spec + scaffold
- `vcon apply <spec.yaml> [--dry-run]` — generate/apply from spec
- `vcon validate <spec.yaml>` — validate spec (schema + Minions Protocol mapping)

## Outputs
- Governance scaffold: `/ai/governance/*` (if missing)
- Registry: `/registry/artifacts.ndjson`
- Reports: `/reports/YYYY-MM-DD/<action>/prompt.md` + `report.md`

## Minions Protocol mapping
- agent → Minion
- project → Master Plan
- repo → Blueprint
- server → Lair
- container → Capsule
