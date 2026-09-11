# Business Beyond Borders

Landing page for the Business Beyond Borders LinkedIn growth and global business networking community. It's a static site (plain HTML, CSS and JS with no build step), hosted on GitHub Pages.

Live: https://mssargsyanmariam-debug.github.io/business-beyond-borders/

## Where to change things

| What | File |
| --- | --- |
| Contact email, LinkedIn URL, prices, checkout links per currency, payment provider names, newsletter endpoint | `assets/js/main.js` (the `CONFIG` block at the top) |
| All wording, English and Armenian | `assets/js/i18n.js` |
| Page structure and search-engine structured data (JSON-LD) | `index.html` |
| Colours, fonts, layout | `assets/css/styles.css` |
| Founder photo | `assets/img/founder.webp`, then swap the placeholder in `index.html` |
| Legal pages | `privacy.html`, `terms.html` |
| Keyword research | `research/keywords.md` |

## How location-based pricing works

On load, the site guesses the currency from the visitor's time zone, then asks `https://api.country.is/` for their country. US visitors see USD, Armenia sees AMD (paid via ACBA Bank), and everyone else sees EUR. If visitors pick a currency themselves, their choice is remembered.

## Preview locally

Run `.claude/serve.ps1` (PowerShell, port 8080) and open http://localhost:8080.

## Publish

Every push to `main` redeploys GitHub Pages automatically within a minute or two. Bump the `?v=` number on the CSS and JS links in `index.html` so browsers load fresh files.
