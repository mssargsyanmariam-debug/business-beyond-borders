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
| Wording | `assets/js/lang/*.js`: en, hy, de, ru, es, fr, zh, vi, ar (same keys in each) |
| Page structure and structured data (JSON-LD) | `index.html` (home). Sub-pages are generated: edit `.claude/build-pages.py`, then run `python .claude/build-pages.py` |
| Header, footer and dialogs on every page | Edit them in `index.html`, then re-run `python .claude/build-pages.py` |
| Icons | `assets/js/sprite.js`, injected into every page |
| Colours, fonts, layout | `assets/css/styles.css` |
| Founder photo | `assets/img/founder.jpg` |
| Legal pages | `privacy.html`, `terms.html` (refund guarantee under `#refunds`) |
| Keyword research | `research/keywords.md` |
| Members area: Supabase URL and anon key | `assets/js/members-config.js`. Setup: `integrations/MEMBERS-SETUP.md` |
| Members area behaviour (login, library, 1-year access) | `assets/js/members.js`, `assets/js/members-admin.js` |
| Member database and security rules | `integrations/members-schema.sql` (run once in Supabase) |
| Directory, introductions and pod | `assets/js/members-network.js`; how many intros a member gets: `intro_quota_ok()` in the schema |

## Pages

`index.html` (short home: about, proof, packages, testimonials), `membership.html`, `speaking.html`, `resources.html`, plus `admin/`, `members/`, `privacy.html`, `terms.html`.

## Members area

`members/login.html` (log in / create account), `members/` (the member hub: access, library, account),
`members/view.html` (the protected reader), `members/directory.html` (Beyond only: member cards and
introduction requests), `members/pod.html` (LinkedIn pod), `members/reset.html` (new password) and
`members/admin.html` (owner only: access, intro requests, materials, courses).

Accounts, passwords and who-paid-for-what live in Supabase; the pages stay on this site. Supabase decides
what each person may read, so the gating cannot be bypassed from the browser. A course is just another
"product": add it, add its materials, then give each buyer 1 year of access.

Uploaded files are never handed to the browser as files. `members/view.html` fetches them with a
two-minute private link, draws PDFs and images onto a canvas and stamps the member's email across
every page; selection, dragging and right-click are off. Per material you choose the lowest plan
that may see it (`min_tier`) and whether a download is allowed at all (`allow_download`, off by
default).

While `members-config.js` is empty, every member page shows a polite "opens soon" message, so it is safe
to have live before the set-up is done.

## How location-based pricing works

On load, the site guesses the currency from the visitor's time zone, then asks `https://api.country.is/` for their country. US visitors see USD, Armenia sees AMD (paid via ACBA Bank), and everyone else sees EUR. If visitors pick a currency themselves, their choice is remembered.

## Forms before the Google Sheet is connected

The contact and feedback forms open a pre-filled email to the owner. The toolkit and newsletter forms say sign-up opens soon.

## Preview locally

Run `.claude/serve.ps1` (PowerShell, port 8099) and open http://localhost:8099.

## Publish

Every push to `main` redeploys GitHub Pages automatically within a minute or two. Bump the `?v=` number on the CSS and JS links in `index.html` so browsers load fresh files.
