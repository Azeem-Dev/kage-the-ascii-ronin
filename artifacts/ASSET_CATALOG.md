# Reusable ASCII catalog

Definitions and lookup: `src/assets/catalog.ts` (`ASSETS`, `ASSET_BY_ID`).
Shared contract: `src/assets/types.ts`. Runtime sprites contain glyphs and colors;
the source PNGs are not drawn to the gameplay canvas.

| Group | IDs | Variants / behavior |
| --- | --- | --- |
| Player | `knight` | Weathered steel, midnight steel, bronze, crimson; body/cape deformation |
| Horse | `horse` | Dapple grey, night coat; gait, mane, tail |
| Catfolk | `cat-girl`, `cat-boy` | Authored female/male ranger silhouettes; three palettes each |
| Vampires | `vampire-girl`, `vampire-boy` | Authored noble silhouettes; three palettes each; hostile placement metadata, no combat AI yet |
| Dwarves | `dwarf-guardian`, `dwarf-neutral` | Bearded guardian and neutral closed-helmet sentinel; three palettes each |
| Flying wildlife | `butterfly-blue`, `butterfly-pink`, `butterfly-purple`, `bird`, `bat`, `moth` | Wing cycles and two palettes each |
| Weapons | `sword-long`, `sword-great`, `sword-rapier`, `sword-dagger`, `sword-sabre` | Steel/moonsteel; distinct silhouettes; display assets, not equipment logic |
| Props | `tent`, `crypt-arch`, `gravestone`, `anvil`, `lantern`, `ruined-tower` | Seeded shaded shapes and two palettes |
| Nature | `pine`, `rock`, `grass`, `water` | Seeded variants; grass/water animation studies; continuous landscape uses the shared world sampler |
| Flowers | `flowers-blue`, `flowers-pink`, `flowers-purple`, `flowers-gold` | Mixed-bloom variants and multi-stem sway |

Total: **33 definitions**. No asset is marked visually approved automatically.

Placement belongs in `src/game/landmarks.ts` or `src/game/worldChunks.ts`.
Instances reference an asset ID, world position, seed, scale, palette and optional
faction. Do not copy generators into a scene to add another instance.

H cycles seven playable character definitions; V cycles the selected definition's
palettes. Keys 1-4 visit the meadow, camp, crypt and forge. Use zoom to inspect the
same assets in context. There is no in-app approval workflow.

For new authored art, preserve source artwork under `artifacts/source-art/`, add
an offline bake entry in `scripts/bake_ascii_art.py`, import its JSON through a
small definition wrapper, and register it in the catalog. Generated source-art
provenance and prompts are in `artifacts/source-art/PROMPTS.md`.
