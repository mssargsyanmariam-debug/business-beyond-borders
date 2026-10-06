"""Generates membership.html, speaking.html and resources.html from the shared
header, footer and dialogs in index.html, so every page stays identical in chrome.
Run after changing the header or footer:  python .claude/build-pages.py
"""
import io
import re

src = io.open("index.html", encoding="utf-8").read()

head = src[: src.index("</head>") + len("</head>")]
header = re.search(r'  <header class="site-header">.*?</header>\n', src, re.S).group(0)
footer = re.search(r'  <footer class="site-footer">.*?</footer>\n', src, re.S).group(0)
dialogs = src[src.index('  <dialog class="modal" id="checkout-soon"') : src.index('  <script src="assets/js/sprite.js')]
scripts = src[src.index('  <script src="assets/js/sprite.js') :]


def page_head(title, desc, slug):
    h = re.sub(r"<title>.*?</title>", "<title>%s</title>" % title, head, flags=re.S)
    h = re.sub(r'<meta name="description" content=".*?">', '<meta name="description" content="%s">' % desc, h, flags=re.S)
    h = h.replace(
        '<link rel="canonical" href="https://mssargsyanmariam-debug.github.io/business-beyond-borders/">',
        '<link rel="canonical" href="https://mssargsyanmariam-debug.github.io/business-beyond-borders/%s">' % slug,
    )
    return re.sub(r'\n  <script type="application/ld\+json">.*?</script>', "", h, flags=re.S)


CONTROLS = """
        <div class="plan-controls plan-controls--row">
          <div class="billing" role="group" data-i18n-aria="plans.billing" aria-label="Billing period">
            <button type="button" data-billing="month" aria-pressed="true" data-i18n="plans.monthly">Monthly</button>
            <button type="button" data-billing="quarter" aria-pressed="false">
              <span data-i18n="plans.quarterly">3 months</span>
              <span class="save-badge" data-i18n="plans.save">Save 16%</span>
            </button>
          </div>
          <div class="currency-picker">
            <p class="currency-picker__note" data-location-note hidden>
              <svg class="icon" aria-hidden="true"><use href="#i-pin"/></svg>
              <span></span>
            </p>
            <label for="currency-select" data-i18n="plans.change">Change currency</label>
            <select id="currency-select" data-currency-select>
              <option value="EUR">&#8364; EUR</option>
              <option value="USD">$ USD</option>
              <option value="AMD">&#1423; AMD</option>
            </select>
          </div>
        </div>
"""

PLANS_FULL = """
        <div class="plans">
          <article class="plan" data-plan="mastermind" aria-labelledby="plan1-name">
            <header class="plan__head">
              <span class="plan__badge" data-i18n="plan1.badge">Smart choice</span>
              <h3 class="plan__name" id="plan1-name">The Mastermind</h3>
              <p class="plan__tagline" data-i18n="plan1.tagline"></p>
            </header>
            <ul class="plan__list">
              <li><svg class="icon" aria-hidden="true"><use href="#i-linkedin"/></svg><div><strong data-i18n="plan1.i1.t"></strong><span data-i18n="plan1.i1.d"></span></div></li>
              <li><svg class="icon" aria-hidden="true"><use href="#i-bulb"/></svg><div><strong data-i18n="plan1.i2.t"></strong><span data-i18n="plan1.i2.d"></span></div></li>
              <li><svg class="icon" aria-hidden="true"><use href="#i-users"/></svg><div><strong data-i18n="plan1.i3.t"></strong><span data-i18n="plan1.i3.d"></span></div></li>
              <li><svg class="icon" aria-hidden="true"><use href="#i-chat"/></svg><div><strong data-i18n="plan1.i4.t"></strong><span data-i18n="plan1.i4.d"></span></div></li>
            </ul>
            <div class="plan__foot">
              <p class="plan__perday"><span class="plan__perday-amount" data-perday-amount>&#8364;0.67</span><span class="plan__perday-label" data-i18n="plans.perdayLabel">a day</span></p>
              <p class="plan__price"><span class="plan__amount" data-amount>&#8364;19.99</span> <span class="plan__period" data-period>/ month</span></p>
              <p class="plan__saving" data-saving hidden></p>
              <a class="btn btn--primary btn--block" data-checkout href="#plans" data-i18n="plan1.cta">Join The Mastermind</a>
            </div>
          </article>

          <article class="plan plan--beyond plan--featured" data-plan="beyond" aria-labelledby="plan2-name">
            <header class="plan__head">
              <span class="plan__badge" data-i18n="plan2.badge">Best value</span>
              <h3 class="plan__name" id="plan2-name">Beyond Mastermind</h3>
              <p class="plan__tagline" data-i18n="plan2.tagline"></p>
            </header>
            <ul class="plan__list">
              <li><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg><div><strong data-i18n="plan2.i1.t"></strong><span data-i18n="plan2.i1.d"></span></div></li>
              <li><svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg><div><strong data-i18n="plan2.i2.t"></strong><span data-i18n="plan2.i2.d"></span></div></li>
              <li><svg class="icon" aria-hidden="true"><use href="#i-handshake"/></svg><div><strong data-i18n="plan2.i3.t"></strong><span data-i18n="plan2.i3.d"></span></div></li>
            </ul>
            <div class="plan__foot">
              <p class="plan__perday"><span class="plan__perday-amount" data-perday-amount>&#8364;1.67</span><span class="plan__perday-label" data-i18n="plans.perdayLabel">a day</span></p>
              <p class="plan__price"><span class="plan__amount" data-amount>&#8364;49.99</span> <span class="plan__period" data-period>/ month</span></p>
              <p class="plan__saving" data-saving hidden></p>
              <a class="btn btn--light btn--block" data-checkout href="#plans" data-i18n="plan2.cta">Go Beyond</a>
            </div>
          </article>
        </div>
"""

TILES = """
        <div class="bento">
          <article class="tile tile--hero">
            <div class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-linkedin"/></svg></div>
            <h3 data-i18n="f1.title"></h3>
            <p data-i18n="f1.text"></p>
          </article>
          <article class="tile tile--side">
            <div class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-bulb"/></svg></div>
            <h3 data-i18n="f2.title"></h3>
            <p data-i18n="f2.text"></p>
          </article>
          <article class="tile tile--side">
            <div class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-chat"/></svg></div>
            <h3 data-i18n="f3.title"></h3>
            <p data-i18n="f3.text"></p>
          </article>
          <article class="tile tile--side">
            <div class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-video"/></svg></div>
            <h3 data-i18n="f4.title"></h3>
            <p data-i18n="f4.text"></p>
          </article>
          <article class="tile tile--wide">
            <div class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-globe"/></svg></div>
            <h3 data-i18n="f5.title"></h3>
            <p data-i18n="f5.text"></p>
            <ul class="chips chips--tile">
              <li class="chip--new" data-i18n="f5.t1"></li><li class="chip--new" data-i18n="f5.t2"></li><li class="chip--new" data-i18n="f5.t3"></li>
              <li class="chip--new" data-i18n="f5.t4"></li><li class="chip--new" data-i18n="f5.t5"></li><li data-i18n="f5.t6"></li>
            </ul>
          </article>
        </div>
"""

FAQ = "".join(
    '          <details><summary><span data-i18n="faq.q%s"></span><svg class="icon" aria-hidden="true">'
    '<use href="#i-chevron"/></svg></summary><p data-i18n="faq.a%s"></p></details>\n' % (n, n)
    for n in [1, 2, 3, 7, 4, 5, 6]
)

TRAININGS = "".join(
    '          <li class="training%s">\n'
    '            <span class="training__icon"><svg class="icon" aria-hidden="true"><use href="#i-%s"/></svg></span>\n'
    '            <div><h3 data-i18n="tr.%s.name"></h3><p data-i18n="tr.%s.detail"></p></div>\n'
    "          </li>\n" % (" training--lead" if n == 1 else "", icon, n, n)
    for n, icon in enumerate(
        ["award", "cap", "users", "users", "sparkles", "cap", "cap", "linkedin", "linkedin"], start=1
    )
)

TESTIMONIALS = """
    <section class="section section--deep" id="testimonials" aria-labelledby="testimonials-title">
      <div class="container">
        <header class="section-head section-head--split section-head--tight">
          <div><h2 id="testimonials-title" data-i18n="testimonials.title"></h2></div>
          <button type="button" class="btn btn--ghost btn--sm" data-open-feedback>
            <svg class="icon" aria-hidden="true"><use href="#i-star"/></svg>
            <span data-i18n="testimonials.button">Leave feedback</span>
          </button>
        </header>
        <div class="testimonials" data-testimonials></div>
        <div class="testimonial-empty" data-testimonials-empty>
          <div class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-quote"/></svg></div>
          <h3 data-i18n="testimonials.empty.title"></h3>
          <p data-i18n="testimonials.empty.text"></p>
          <button type="button" class="btn btn--primary btn--sm" data-open-feedback><span data-i18n="testimonials.button">Leave feedback</span></button>
        </div>
      </div>
    </section>
"""

MEMBERSHIP_MAIN = """
  <main id="main">
    <section class="page-hero">
      <div class="page-hero__glow" aria-hidden="true"></div>
      <div class="container">
        <h1 data-i18n="plans.title">Choose your plan</h1>
        <p class="section-lead" data-i18n="plans.lead"></p>
      </div>
    </section>

    <section class="section section--plans section--tight" id="plans" aria-labelledby="plans-title">
      <div class="container">
        <h2 class="sr-only" id="plans-title" data-i18n="plans.title">Choose your plan</h2>
{controls}{plans}
        <div class="plans-notes">
          <p class="plans-note">
            <svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg>
            <span data-price-note>Secure card checkout. Prices in EUR.</span>
          </p>
          <p class="plans-note">
            <svg class="icon" aria-hidden="true"><use href="#i-shield"/></svg>
            <span data-i18n="plans.refund">14-day full refund guarantee.</span>
          </p>
        </div>
      </div>
    </section>

    <section class="section section--deep" aria-labelledby="features-title">
      <div class="container">
        <header class="section-head section-head--tight">
          <h2 id="features-title" data-i18n="features.title"></h2>
          <p class="section-lead" data-i18n="features.lead"></p>
        </header>
{tiles}      </div>
    </section>

    <section class="section section--tight" aria-labelledby="how-title">
      <div class="container">
        <header class="section-head section-head--tight">
          <h2 id="how-title" data-i18n="how.title"></h2>
        </header>
        <ol class="steps">
          <li class="step"><span class="step__num">1</span><h3 data-i18n="s1.title"></h3><p data-i18n="s1.text"></p></li>
          <li class="step"><span class="step__num">2</span><h3 data-i18n="s2.title"></h3><p data-i18n="s2.text"></p></li>
          <li class="step"><span class="step__num">3</span><h3 data-i18n="s3.title"></h3><p data-i18n="s3.text"></p></li>
        </ol>
      </div>
    </section>

    <section class="section section--tight" aria-labelledby="events-title">
      <div class="container">
        <div class="events">
          <div class="events__icon"><svg class="icon" aria-hidden="true"><use href="#i-ticket"/></svg></div>
          <div class="events__copy">
            <h2 id="events-title" data-i18n="events.title"></h2>
            <p data-i18n="events.text"></p>
          </div>
          <a class="btn btn--light" href="speaking.html#contact">
            <svg class="icon" aria-hidden="true"><use href="#i-mail"/></svg>
            <span data-i18n="events.cta">Ask about upcoming events</span>
          </a>
        </div>
      </div>
    </section>

    <section class="section section--deep" id="faq" aria-labelledby="faq-title">
      <div class="container container--narrow">
        <header class="section-head section-head--tight">
          <h2 id="faq-title" data-i18n="faq.title">Frequently asked questions</h2>
        </header>
        <div class="faq">
{faq}        </div>
      </div>
    </section>

    <section class="final-cta">
      <div class="final-cta__glow" aria-hidden="true"></div>
      <div class="container final-cta__inner">
        <h2 data-i18n="cta.title"></h2>
        <p data-i18n="cta.text"></p>
        <a class="btn btn--primary btn--lg" href="#plans" data-i18n="cta.button">Choose your plan</a>
      </div>
    </section>
  </main>
""".format(controls=CONTROLS, plans=PLANS_FULL, tiles=TILES, faq=FAQ)

SPEAKING_MAIN = """
  <main id="main">
    <section class="page-hero">
      <div class="page-hero__glow" aria-hidden="true"></div>
      <div class="container">
        <h1 data-i18n="page.speaking.title">Speaking &amp; training</h1>
        <p class="section-lead" data-i18n="page.speaking.lead"></p>
        <div class="intro__actions">
          <a class="btn btn--primary btn--lg" href="#contact" data-i18n="trainings.cta">Book a training for your team</a>
        </div>
      </div>
    </section>

    <section class="section section--tight" aria-labelledby="services-title">
      <div class="container">
        <h2 class="sr-only" id="services-title" data-i18n="page.speaking.title">Speaking &amp; training</h2>
        <ul class="services">
          <li class="service">
            <span class="service__icon"><svg class="icon" aria-hidden="true"><use href="#i-users"/></svg></span>
            <h3 data-i18n="contact.subject.training">Team training</h3>
            <p data-i18n="svc.1.text"></p>
          </li>
          <li class="service">
            <span class="service__icon"><svg class="icon" aria-hidden="true"><use href="#i-award"/></svg></span>
            <h3 data-i18n="contact.subject.keynote">Keynote or event speaking</h3>
            <p data-i18n="svc.2.text"></p>
          </li>
          <li class="service">
            <span class="service__icon"><svg class="icon" aria-hidden="true"><use href="#i-linkedin"/></svg></span>
            <h3 data-i18n="contact.subject.branding">Personal LinkedIn branding</h3>
            <p data-i18n="svc.3.text"></p>
          </li>
        </ul>
      </div>
    </section>

    <section class="section section--deep" id="trainings" aria-labelledby="trainings-title">
      <div class="container">
        <header class="section-head section-head--tight">
          <h2 id="trainings-title" data-i18n="trainings.title">Trainings &amp; talks</h2>
          <p class="section-lead" data-i18n="trainings.lead"></p>
        </header>
        <ul class="trainings">
{trainings}        </ul>
        <!-- Photos uploaded in /admin -->
        <ul class="gallery" data-gallery hidden></ul>
      </div>
    </section>

    <section class="section section--tight" id="videos" aria-labelledby="videos-title" data-videos-section hidden>
      <div class="container">
        <header class="section-head section-head--tight">
          <h2 id="videos-title" data-i18n="videos.title">Watch</h2>
          <p class="section-lead" data-i18n="videos.lead"></p>
        </header>
        <div class="videos" data-videos></div>
      </div>
    </section>
{testimonials}
    <section class="section" id="contact" aria-labelledby="contact-title">
      <div class="container contact">
        <div class="contact__intro">
          <h2 id="contact-title" data-i18n="contact.title">Contact us</h2>
          <p class="section-lead" data-i18n="contact.lead"></p>
          <h3 class="founder__subtitle" data-i18n="contact.or">Or reach out directly</h3>
          <ul class="contact-links">
            <li><a class="contact-link" data-whatsapp href="#" target="_blank" rel="noopener">
              <span class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-whatsapp"/></svg></span>
              <span><strong>WhatsApp</strong><span>+1 347 992 0079</span></span></a></li>
            <li><a class="contact-link" data-email href="#">
              <span class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-mail"/></svg></span>
              <span><strong>Email</strong><span>ms.sargsyanmariam@gmail.com</span></span></a></li>
            <li><a class="contact-link" data-linkedin href="#" target="_blank" rel="noopener">
              <span class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-linkedin"/></svg></span>
              <span><strong>LinkedIn</strong><span>Mariam Sargsyan</span></span></a></li>
            <li><a class="contact-link" data-instagram href="#" target="_blank" rel="noopener">
              <span class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-instagram"/></svg></span>
              <span><strong>Instagram</strong><span>@manch_sargsyan_</span></span></a></li>
          </ul>
        </div>

        <form class="panel-form" data-form="contact" novalidate>
          <div class="field-row">
            <div class="field">
              <label for="contact-name" data-i18n="contact.name">Your name</label>
              <input id="contact-name" name="name" type="text" autocomplete="name" required aria-describedby="contact-name-error">
              <p class="field__error" id="contact-name-error" data-error-for="contact-name" hidden></p>
            </div>
            <div class="field">
              <label for="contact-email" data-i18n="contact.email">Email</label>
              <input id="contact-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-describedby="contact-email-error">
              <p class="field__error" id="contact-email-error" data-error-for="contact-email" hidden></p>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="contact-phone" data-i18n="contact.phone">Phone or WhatsApp (optional)</label>
              <input id="contact-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" data-validate="phone" placeholder="+1 347 000 0000" aria-describedby="contact-phone-error">
              <p class="field__error" id="contact-phone-error" data-error-for="contact-phone" hidden></p>
            </div>
            <div class="field">
              <label for="contact-company" data-i18n="contact.company">Company or organisation (optional)</label>
              <input id="contact-company" name="company" type="text" autocomplete="organization">
            </div>
          </div>
          <div class="field">
            <label for="contact-subject" data-i18n="contact.subject">What is this about?</label>
            <select id="contact-subject" name="topic" required aria-describedby="contact-subject-error">
              <option value="" selected disabled data-i18n="contact.subject.choose">Choose an option</option>
              <option value="training" data-i18n="contact.subject.training">Team training</option>
              <option value="keynote" data-i18n="contact.subject.keynote">Keynote or event speaking</option>
              <option value="branding" data-i18n="contact.subject.branding">Personal LinkedIn branding</option>
              <option value="membership" data-i18n="contact.subject.membership">Community membership</option>
              <option value="partnership" data-i18n="contact.subject.partnership">Partnership or collaboration</option>
              <option value="media" data-i18n="contact.subject.media">Media, podcast or interview</option>
              <option value="other" data-i18n="contact.subject.other">Something else</option>
            </select>
            <p class="field__error" id="contact-subject-error" data-error-for="contact-subject" hidden></p>
          </div>
          <div class="field">
            <label for="contact-message" data-i18n="contact.message">How can we help?</label>
            <textarea id="contact-message" name="message" rows="5" required aria-describedby="contact-message-error"></textarea>
            <p class="field__error" id="contact-message-error" data-error-for="contact-message" hidden></p>
          </div>
          <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button type="submit" class="btn btn--primary btn--block"><svg class="icon" aria-hidden="true"><use href="#i-send"/></svg><span data-i18n="contact.submit">Send message</span></button>
          <p class="form-status" data-status role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>
  </main>
""".format(trainings=TRAININGS, testimonials=TESTIMONIALS)

RESOURCES_MAIN = """
  <main id="main">
    <section class="page-hero">
      <div class="page-hero__glow" aria-hidden="true"></div>
      <div class="container">
        <h1 data-i18n="page.resources.title">Free resources</h1>
        <p class="section-lead" data-i18n="page.resources.lead"></p>
      </div>
    </section>

    <section class="section section--tight" id="materials" aria-labelledby="materials-title">
      <div class="container">
        <header class="section-head section-head--tight">
          <h2 id="materials-title" data-i18n="materials.title"></h2>
          <p class="section-lead" data-i18n="materials.lead"></p>
        </header>
        <div class="materials" data-materials-root>
          <ul class="materials__grid" data-materials></ul>
          <form class="panel-form" data-form="toolkit" novalidate>
            <h3 data-i18n="materials.formTitle">Get instant access</h3>
            <div class="field">
              <label for="toolkit-email" data-i18n="materials.label">Your email address</label>
              <input id="toolkit-email" name="email" type="email" autocomplete="email" inputmode="email" required data-i18n-placeholder="news.placeholder" placeholder="you@company.com" aria-describedby="toolkit-email-error">
              <p class="field__error" id="toolkit-email-error" data-error-for="toolkit-email" hidden></p>
            </div>
            <label class="check"><input type="checkbox" name="optin" checked> <span data-i18n="materials.optin"></span></label>
            <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
            <button type="submit" class="btn btn--primary btn--block"><svg class="icon" aria-hidden="true"><use href="#i-download"/></svg><span data-i18n="materials.button">Unlock free downloads</span></button>
            <p class="form-status" data-status role="status" aria-live="polite"></p>
            <p class="form-fine" data-i18n="materials.fine"></p>
          </form>
        </div>
      </div>
    </section>

    <section class="section section--deep" id="newsletter" aria-labelledby="news-title">
      <div class="container">
        <div class="newsletter">
          <div class="newsletter__copy">
            <div class="tile__icon"><svg class="icon" aria-hidden="true"><use href="#i-send"/></svg></div>
            <h2 id="news-title" data-i18n="news.title">The Beyond Borders Brief</h2>
            <p data-i18n="news.text"></p>
          </div>
          <form class="news-form" data-newsletter novalidate>
            <label class="news-form__label" for="news-email" data-i18n="news.label">Your email address</label>
            <div class="news-form__row">
              <input id="news-email" name="email" type="email" autocomplete="email" inputmode="email" required
                     data-i18n-placeholder="news.placeholder" placeholder="you@company.com" aria-describedby="news-error news-fine">
              <button type="submit" class="btn btn--primary"><span data-i18n="news.button">Subscribe free</span></button>
            </div>
            <p class="news-form__error" id="news-error" data-news-error hidden></p>
            <p class="news-form__status" data-news-status role="status" aria-live="polite"></p>
            <p class="news-form__fine" id="news-fine" data-i18n="news.fine"></p>
          </form>
        </div>
      </div>
    </section>

    <section class="final-cta">
      <div class="final-cta__glow" aria-hidden="true"></div>
      <div class="container final-cta__inner">
        <h2 data-i18n="cta.title"></h2>
        <p data-i18n="cta.text"></p>
        <a class="btn btn--primary btn--lg" href="membership.html#plans" data-i18n="cta.button">Choose your plan</a>
      </div>
    </section>
  </main>
"""

PAGES = {
    "membership.html": (
        "Membership &amp; prices | Business Beyond Borders",
        "The Mastermind and Beyond Mastermind: what is included, prices in EUR, USD and AMD, and how the membership works.",
        MEMBERSHIP_MAIN,
    ),
    "speaking.html": (
        "Speaking &amp; training | Mariam Sargsyan",
        "Book Mariam Sargsyan for keynotes, team training on LinkedIn sales and marketing, and personal LinkedIn branding.",
        SPEAKING_MAIN,
    ),
    "resources.html": (
        "Free resources | Business Beyond Borders",
        "Free guides, checklists and templates for LinkedIn growth, international business and sales, plus the newsletter.",
        RESOURCES_MAIN,
    ),
}

for name, (title, desc, main) in PAGES.items():
    html = (
        page_head(title, desc, name)
        + '\n<body data-fixed-meta>\n'
        + '  <div class="scroll-progress" aria-hidden="true"><span data-scroll-progress></span></div>\n'
        + '  <a class="skip-link" href="#main">Skip to content</a>\n\n'
        + header
        + main
        + "\n"
        + footer
        + "\n"
        + dialogs
        + scripts
    )
    io.open(name, "w", encoding="utf-8", newline="\n").write(html)
    print(name, len(html), "bytes")
