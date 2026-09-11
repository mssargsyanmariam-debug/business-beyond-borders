# Business Beyond Borders

Landing page for the Business Beyond Borders LinkedIn and business growth community. It's a static site (plain HTML, CSS and JS with no build step), hosted on GitHub Pages.

## Where to change things

| What | File |
| --- | --- |
| Contact email, LinkedIn URL, prices, Stripe Payment Links | `assets/js/main.js` (the `CONFIG` block at the top) |
| All wording, English and Armenian | `assets/js/i18n.js` |
| Page structure | `index.html` |
| Colours, fonts, layout | `assets/css/styles.css` |
| Founder photo | `assets/img/founder.webp`, then swap the placeholder in `index.html` |
| Legal pages | `privacy.html`, `terms.html` |

## Preview locally

Open `index.html` in a browser.

## Publish

Every push to `main` redeploys GitHub Pages automatically within a minute or two.
