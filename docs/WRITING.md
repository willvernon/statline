# Writing: Glance docs

**The reader scans, they don't read.** Every block answers one question. Depth is one link away.

## Rules

| # | Rule | In practice |
| --- | --- | --- |
| 1 | Visual first | A diagram or table opens each section. Prose comes after, if at all |
| 2 | Headings are tasks | "Update data", "Troubleshoot" — not "Overview", "Notes" |
| 3 | One line of prose, max | under any heading. More than that belongs in `docs/` |
| 4 | Tables for 3+ parallel items | commands, layers, keys, symptoms |
| 5 | Copy-paste commands | one block per task, from the repo root, `# why` as an inline comment |
| 6 | One source of truth | status, model, commands live in one place; everything else links |
| 7 | Length budget | README ≤ 2 screens (~120 lines). The rest goes in `docs/*.md` |
| 8 | Layered depth | README (orient) → `docs/` (operate) → code comments (why) |

## README order

| Part | Sections |
| --- | --- |
| **What it is** | How it flows · Stack · The model · Where things live · Status |
| **How to use it** | First-time setup · Run Prefect · Update data · Troubleshoot |

## Same shape elsewhere

| Artifact | Shape |
| --- | --- |
| Linear issue | **Problem** · **Where** · **Fix** (checklist) · **Done when** · **Plan** |
| PR | Summary · Layer check · Verified · Notes · `Fixes STAT-NN` |
| `docs/*.md` | Opens with a table or diagram; ends with a symptom → fix table if it can fail |

## Red flags

| If you see… | Do this |
| --- | --- |
| A paragraph explaining a list of things | make it a table |
| The same command in two files | keep one, link to it |
| "Note:", "Basically", "In order to" | delete the phrase |
| Shell variants in the README | move them to `docs/setup.md` |
| Status that disagrees with Linear | update the doc, or link to the milestone instead |
