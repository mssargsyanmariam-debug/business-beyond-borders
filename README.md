# Business Beyond Borders

Landing page for Business Beyond Borders, a global business network and LinkedIn growth community. It's a static site (plain HTML, CSS and JS with no build step), hosted on GitHub Pages, in English, Armenian, German and Russian.

Live: https://mssargsyanmariam-debug.github.io/business-beyond-borders/

## Where to change things

| What | File |
| --- | --- |
| Email, WhatsApp, LinkedIn, Instagram, prices, checkout links per currency, payment providers | `assets/js/main.js` (the `CONFIG` block at the top) |
| Where form submissions go (Google Sheet + email alert) | `CONFIG.leads.endpoint`. Setup: `integrations/LEADS-SETUP.md` |
| Newsletter endpoint (e.g. Kit) | `CONFIG.newsletter.action` |
| Free toolkit PDFs (lead magnet) | Put files in `assets/materials/`, then set `file` in `CONFIG.materials` |
| Published testimonials | `CONFIG.testimonials` (only with the person's permission) |
| Wording | `assets/js/lang/en.js`, `hy.js`, `de.js`, `ru.js` (same keys in each) |
| Page structure and structured data (JSON-LD) | `index.html` |
| Colours, fonts, layout | `assets/css/styles.css` |
| Founder photo | `assets/img/founder.jpg` |
| Legal pages | `privacy.html`, `terms.html` (refund guarantee under `#refunds`) |
| Keyword research | `research/keywords.md` |

## How location-based pricing works

On load, the site guesses the currency from the visitor's time zone, then asks `https://api.country.is/` for their country. US visitors see USD, Armenia sees AMD (paid via ACBA Bank), and everyone else sees EUR. If visitors pick a currency themselves, their choice is remembered.

## Forms before the Google Sheet is connected

The contact and feedback forms open a pre-filled email to the owner. The toolkit and newsletter forms say sign-up opens soon.

## Preview locally

Run `.claude/serve.ps1` (PowerShell, port 8080) and open http://localhost:8080.

## Publish

Every push to `main` redeploys GitHub Pages automatically within a minute or two. Bump the `?v=` number on the CSS and JS links in `index.html` so browsers load fresh files.
