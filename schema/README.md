# Bundled CFB27 save schemas

These are **copies**, not originals. The source of truth is the shared knowledge
repo's `schemas/` folder (`CFB27-Modding-Knowledge/schemas/`), which documents
what each file is, how it was extracted, and the measurement gate a new one has
to pass. Never extract or edit a schema here — copy the file from there.

| File | Covers |
|---|---|
| `CFB27_472_0.gz` | Saves declaring **809 / 814** (pre-2026-08-06 game patch) |
| `CFB27_833_0.gz` | Saves declaring **833 and up** (the 2026-08-06 patch onward) |

`src/franchise/franchiseLoader.js` picks between them from the version the save's
own header declares: exact `CFB27_<major>_<minor>.gz` match first, else the
newest one whose major is **≤** the declared version. Both eras have to stay
bundled because their `Coach` table layouts are mutually incompatible — the
patched schema reads zero named `Coach` fields on a pre-patch save and vice
versa, and `Coach` is the table this tool is built on.

**When a game update ships a new schema:** copy the new
`CFB27_<major>_<minor>.gz` in here and rebuild. No code change — the picker
resolves it by version arithmetic. Files tagged `CFB27_FTC_*` are mod-build
schemas and must never be copied here; the picker's pattern deliberately can't
see them.
