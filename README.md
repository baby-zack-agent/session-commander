# session-commander

Search, cost-track, and govern your coding-agent sessions — one command.

Claude Code and Codex keep every session as a transcript on your disk, but
give you no way to search them, no idea what they cost, and no way to carry
your rules and working state between machines. This fixes that.

Local-only. Node stdlib only — **zero dependencies, no telemetry**. The free
core never touches the network. Pro commands unlock with a license key; only
activation/validation talks to the license server.

## Install (30 seconds)

Node 18+ required. No build step, no install step:

```sh
curl -O https://raw.githubusercontent.com/baby-zack-agent/session-commander/main/bin/session-commander
chmod +x session-commander
./session-commander --help
```

Or clone and `npm test` to verify.

## Free core

```sh
# list recent sessions with token + cost estimates
$ session-commander sessions
date        project                       msgs   tokens          cost  model     id
2026-09-28  my-project                   msgs     3  tok      7,180     $0.03  claude-sonnet-4-5  aaa11111

2 sessions, $0.18 estimated total (rates as of 2026-09-29)

# full-text search across every transcript
$ session-commander search "billing webhook"
=== my-project / bbb22222 (2026-09-27) — 1 hit(s) ===
>> debug the billing webhook handler
---
>> Looking at the billing webhook now.
---

# token/cost breakdowns
$ session-commander cost --days 30
cost breakdown — last 30 days (42 sessions)
total: $18.44  input 812,300  output 96,100  (rates as of 2026-09-29, estimates)

by project:
    $11.02     602,400 tok  31 sess  my-project
     $7.42     306,000 tok  11 sess  side-hustle

by model:
    $14.90     700,200 tok  claude-sonnet-4-5
     $3.54     208,200 tok  claude-opus-4-1

by day:
  2026-09-28     $2.10  6 sess
  2026-09-29     $1.84  5 sess
```

`sessions` reads Claude Code's `~/.claude/projects/**/*.jsonl` (primary).
Codex's `~/.codex/sessions` is parsed best-effort — if the format isn't
recognized it's skipped with a note, not a crash. Missing directories are
fine: you get a one-line notice, exit 0.

## snapshot — never lose working state to compaction

Port of [compaction-snapshotter](https://github.com/baby-zack-agent/compaction-snapshotter):

```sh
# wire to Claude Code's PreCompact hook, or run by hand:
session-commander snapshot --plan "migrate auth" --doing "writing migration" --next "backfill tokens"
session-commander snapshot --latest   # print newest after compaction
```

Snapshots land in `<project>/.claude/snapshots/`. Empty snapshots are
skipped, identical ones deduped, oldest pruned beyond `--keep 20`.

## lint-rules — stop rules rot

Port of [rules-linter](https://github.com/baby-zack-agent/rules-linter):

```sh
$ session-commander lint-rules .
ERRORS (1)
  [MUSE.md:1] says "use npm" but repo uses pnpm (pnpm-lock.yaml present)
```

## Pro

Free covers everything local. Pro adds the workflows that move data:

| | Free | Pro |
|---|---|---|
| sessions / search / cost / snapshot / lint-rules | ✓ | ✓ |
| `export` full history (csv/json/md) | | ✓ |
| `report` weekly/monthly spend analytics | | ✓ |
| `sync-rules` bundle rules across machines | | ✓ |

```sh
session-commander activate <license-key>   # one-time per machine
session-commander status                   # show license state
session-commander report --days 30 --out report.md
session-commander export --format csv --project my-project --out history.csv
session-commander sync-rules export --out rules-bundle.json   # on machine A
session-commander sync-rules import rules-bundle.json         # on machine B
```

**Pricing:** Pro is a one-time purchase (launch price announced with the
store). No subscription, no per-seat metering on solo use.

**Privacy on activation:** the only network call the tool ever makes is to
the license server (`/activate`, then revalidation at most every 14 days).
It sends your key and a machine name. If the server is unreachable you keep
working under a 14-day offline grace. Run `deactivate` to remove the local
activation.

## Cost rates

Costs are estimates from a baked-in per-model table (USD per 1M tokens, as of
**2026-09-29**): e.g. claude-sonnet-4-5 $3 in / $15 out, claude-opus-4-1 $15
/ $75, claude-haiku-4-5 $1 / $5, gpt-5 $1.25 / $10, gemini-2.5-pro $1.25 / $10.
Unknown models fall back to the sonnet band and are marked estimated.
Vendors change prices — treat dollar figures as directional.

## FAQ

**Does it phone home?** The free core has no network code at all. Pro only
contacts the license server to activate/validate. No telemetry, ever.

**Does it modify my repos?** Read-only, except: `snapshot` writes markdown
under `.claude/snapshots/`, and `sync-rules import` writes rules files
(backing up conflicts to `.bak` first).

**My sessions aren't found?** Point the scanner: `SC_CLAUDE_DIR` and
`SC_CODEX_DIR` env vars override the default transcript locations.

**Windows?** Works anywhere Node 18+ runs.

## License

MIT — see LICENSE.

## Support

Free and open source (MIT). If it saves you money, tips are welcome:

- Lightning: `dawnlake416275@getalby.com`
- Base (EVM): `0xf27a01b3e5a4fe823ea771a4815d0974bf216717`

## Disclaimer

Provided as-is, no warranty of any kind (see LICENSE). Cost figures are
estimates from public rate tables and may be wrong; session parsing is
best-effort against transcript formats that vendors can change. Never put
secrets in snapshots or rules bundles — both are plain files on disk. Use at
your own risk.
