# Bukmuk Book Recommendations

Curated, age-wise and genre-wise children's book recommendations.
Static site — no build step, no server.

Live: *(set after deploy)*

## What it does

- Browse curated reading lists by age and genre.
- Download the original branded PDFs (`book_recommendations/*.pdf`) per list.
- Tick books across lists to build a personalised reading list and save it as a PDF (uses the browser's native "Save as PDF").
- Optional WhatsApp opt-in — submissions land in a Google Sheet.

## Run locally

```bash
python3 -m http.server 8765
open http://127.0.0.1:8765/
```

The page **must** be served over HTTP (not opened as a `file://`) because it `fetch()`es `data/lists.json`.

## File layout

```
.
├── index.html                    # Page shell
├── styles.css                    # Design system + layout
├── app.js                        # JSON loader, filters, builder, PDF, lead capture
├── privacy.html                  # DPDPA-aware privacy policy
├── data/
│   └── lists.json                # Single source of truth for all lists + books
└── book_recommendations/         # Branded PDFs (linked from each card's Download button)
    ├── Age 7+ Early chapter fun books BUKMUK Recommendations.pdf
    └── Graphics Novels BUKMUK recommendations.pdf
```

## Adding a new list (the only common edit)

1. *(Optional)* Drop the branded PDF into `book_recommendations/`.
2. Append one object to `data/lists.json`:

   ```json
   {
     "id": "picture-books-3-plus",
     "title": "Picture Books",
     "subtitle": "Read-alouds for the early years",
     "ageBadge": "3+",
     "ageOrder": 3,
     "genre": "picture",
     "genreLabel": "Picture books",
     "accent": "#FFD93D",
     "icon": "🎨",
     "pdf": "book_recommendations/Picture Books 3+ BUKMUK Recommendations.pdf",
     "browseUrl": "https://bukmuk.com/bukmuk/browse?...",
     "books": [
       { "title": "The Gruffalo", "author": "Julia Donaldson" },
       { "title": "Where the Wild Things Are" }
     ]
   }
   ```

3. Hard-refresh the page. A new card appears, and the genre/age chips repopulate automatically.

Field notes:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Any unique slug. |
| `ageBadge` | yes | Shown on the card and used as a filter chip (e.g. `7+`). |
| `ageOrder` | yes | Numeric — controls chip sort order. |
| `genre` / `genreLabel` | yes | Slug + display label. New genres become new chips. |
| `accent` | yes | Hex colour for the card cover gradient. |
| `icon` | yes | Single emoji shown on the card cover. |
| `pdf` | optional | If omitted, the card shows a "PDF coming soon" placeholder. |
| `browseUrl` | optional | Link to the matching `bukmuk.com/library` browse page. |
| `books[].count` | optional | E.g. `"20+ books"`. |
| `books[].author` | optional | Shown as small meta under the title. |

## Lead capture (Google Form)

Configured in `app.js` near the top:

```js
const LEAD_FORM = {
  formId: '...',
  phoneEntry: 'entry.NNN',
  sourceEntry: 'entry.NNN',
};
```

Submissions land in the linked Google Sheet. To swap forms, replace these three values.

The form's settings must be:
- **Published** ✅
- Collect email addresses → **Do not collect**
- Limit to 1 response → **Off**
- Restrict to users in your org → **Off**
- Responder access → **Anyone with the link**

## Privacy contact

The privacy contact email is hardcoded in `privacy.html` Section 9. To change, edit that one line.

## Deploy

- **Cloudflare Pages**: connect this repo, leave all build fields blank, deploy.
- **GitHub Pages**: Settings → Pages → Source: branch `main` → root.

No build step.
