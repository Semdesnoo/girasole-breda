# Girasole Breda

Static site (single `index.html` + `media/`), served by GitHub Pages from `main`:
https://semdesnoo.github.io/girasole-breda/

## Seasonal popup (`popup.json`)

The site fetches `popup.json` on every page load. Edit this file (by hand or from a dashboard via the GitHub Contents API) to change the popup; no code changes needed. Pages republishes about a minute after the commit.

| Field | Type | Meaning |
|---|---|---|
| `actief` | bool | Master switch. `false` = never show. |
| `id` | string | Unique per campaign (`kerst-2026`, `voorjaar-2027`). Visitors who closed the popup won't see the same `id` again, so a new `id` shows it to everyone again. |
| `van` / `tot` | `yyyy-mm-dd` | Show only within this period (Amsterdam date, inclusive). Optional. |
| `titel` | string[] | Script headline, one line per item (2 lines looks best). |
| `tekst` | string | Short line under the headline. |
| `knop` | string | Button label. |
| `link` | string | Button target: `#reserveren`, `#kaart`, `#menus` (mobile variant is picked automatically) or a full URL. |
| `afbeelding` | string | Background image path/URL (dark, landscape photo works best). |
| `vertraging_ms` | number | Delay before the popup opens. Default 1500. |

Dashboard write example (GitHub API): `PUT /repos/Semdesnoo/girasole-breda/contents/popup.json` with the base64 content and the current file `sha`.
