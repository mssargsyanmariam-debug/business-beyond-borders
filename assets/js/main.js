/*
 * Business Beyond Borders: site behaviour.
 * The CONFIG block below is the only thing you normally need to edit.
 */
const CONFIG = {
  email: "ms.sargsyanmariam@gmail.com",
  linkedin: "https://www.linkedin.com/in/mariamsargsyan-business-enthusiast/",
  instagram: "https://www.instagram.com/manch_sargsyan_/",
  whatsapp: "13479920079", // international format, digits only

  // Prices per currency. "month" = billed monthly, "quarter" = billed every 3 months.
  prices: {
    EUR: { mastermind: { month: 19.99, quarter: 49.99 }, beyond: { month: 49.99, quarter: 124.99 } },
    USD: { mastermind: { month: 19.99, quarter: 49.99 }, beyond: { month: 49.99, quarter: 124.99 } },
    AMD: { mastermind: { month: 7900, quarter: 19900 }, beyond: { month: 19900, quarter: 49900 } },
  },

  // Who processes payments in each currency (shown under the plans). Empty = generic text.
  providers: { EUR: "", USD: "", AMD: "ACBA Bank" },

  // TODO: paste checkout links per currency (AMD = ACBA Bank, USD/EUR = Stripe).
  // While a link is empty, the button shows a "sign-up opens soon" message.
  checkout: {
    EUR: { mastermind: { month: "", quarter: "" }, beyond: { month: "", quarter: "" } },
    USD: { mastermind: { month: "", quarter: "" }, beyond: { month: "", quarter: "" } },
    AMD: { mastermind: { month: "", quarter: "" }, beyond: { month: "", quarter: "" } },
  },

  // TODO: newsletter form endpoint, e.g. Kit: "https://app.kit.com/forms/<FORM_ID>/subscriptions"
  // (field "email_address"). While empty, the form explains that sign-up opens soon.
  newsletter: { action: "", emailField: "email_address" },

  // TODO: free access key from https://web3forms.com (sent to your email). Contact, feedback
  // and toolkit forms deliver to your inbox with it. While empty, contact/feedback open a
  // pre-filled email instead.
  forms: { web3formsKey: "" },

  // Free toolkit (lead magnet). Put PDFs in assets/materials/ and set "file" to the path.
  // Items without a file show "Coming soon".
  materials: [
    { title: "materials.m1.title", text: "materials.m1.text", file: "" },
    { title: "materials.m2.title", text: "materials.m2.text", file: "" },
    { title: "materials.m3.title", text: "materials.m3.text", file: "" },
  ],

  // Published testimonials (only with the person's permission).
  // Example: { name: "Anna K.", role: "Founder, Studio X", text: "…", rating: 5 }
  testimonials: [],

  // Visitor country lookup (returns {"country":"US"}); falls back to the time zone.
  geoEndpoint: "https://api.country.is/",
};

const CURRENCIES = {
  EUR: { symbol: "€", decimals: 2 },
  USD: { symbol: "$", decimals: 2 },
  AMD: { symbol: "֏", decimals: 0 },
};
const PLAN_NAMES = { mastermind: "The Mastermind", beyond: "Beyond Mastermind" };
const LANGS = ["en", "hy", "de", "ru"];
const LANG_KEY = "bbb-lang";
const CURRENCY_KEY = "bbb-currency";
const COUNTRY_KEY = "bbb-country";
const TOOLKIT_KEY = "bbb-toolkit";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s().-]{7,20}$/;

let lang = "en";
let billing = "month";
let currency = "EUR";
let currencySource = "location"; // "location" | "manual" | "url"

const t = (key) => (window.I18N[lang] && window.I18N[lang][key]) || window.I18N.en[key] || "";

function stored(key, store = localStorage) {
  try {
    return store.getItem(key);
  } catch (e) {
    return null;
  }
}

function save(key, value, store = localStorage) {
  try {
    store.setItem(key, value);
  } catch (e) {
    /* storage unavailable: the choice just won't be remembered */
  }
}

function initialLang() {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(fromUrl)) return fromUrl;
  const saved = stored(LANG_KEY);
  if (LANGS.includes(saved)) return saved;
  const browser = (navigator.language || "").slice(0, 2).toLowerCase();
  return LANGS.includes(browser) ? browser : "en";
}

/* ---------- Location-based currency ---------- */
// US -> USD, Armenia -> AMD (ACBA Bank), everywhere else -> EUR.
const currencyForCountry = (code) => (code === "US" ? "USD" : code === "AM" ? "AMD" : "EUR");

function currencyFromTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz === "Asia/Yerevan") return "AMD";
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky|North_Dakota|Menominee|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak)/.test(tz) || tz === "Pacific/Honolulu") return "USD";
  } catch (e) {
    /* fall through */
  }
  return "EUR";
}

async function lookupCountry() {
  const cached = stored(COUNTRY_KEY, sessionStorage);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(CONFIG.geoEndpoint, { signal: controller.signal });
    const data = await res.json();
    const code = String(data.country || data.country_code || "").toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) {
      save(COUNTRY_KEY, code, sessionStorage);
      return code;
    }
  } catch (e) {
    /* network error or blocked: keep the time-zone guess */
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function initCurrency() {
  const fromUrl = (new URLSearchParams(location.search).get("currency") || "").toUpperCase();
  const saved = stored(CURRENCY_KEY);
  if (CURRENCIES[fromUrl]) {
    currency = fromUrl;
    currencySource = "url";
  } else if (CURRENCIES[saved]) {
    currency = saved;
    currencySource = "manual";
  } else {
    currency = currencyFromTimeZone();
    currencySource = "location";
    lookupCountry().then((code) => {
      if (code && currencySource === "location") {
        currency = currencyForCountry(code);
        renderPrices();
      }
    });
  }
}

/* ---------- Language ---------- */
function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').setAttribute("content", t("meta.description"));

  // Strings come only from our own language files, so innerHTML (for links/highlights) is safe.
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-star]").forEach((el) => {
    el.textContent = t("feedback.star").replace("{n}", el.dataset.star);
  });
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  });

  renderPrices();
}

/* ---------- Prices ---------- */
function money(n) {
  const { symbol, decimals } = CURRENCIES[currency];
  return symbol + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const checkoutLink = (plan) => CONFIG.checkout[currency][plan][billing];

function renderPrices() {
  const prices = CONFIG.prices[currency];

  document.querySelectorAll("[data-plan]").forEach((card) => {
    const plan = card.dataset.plan;
    const price = prices[plan][billing];
    const days = billing === "month" ? 30 : 90;

    card.querySelector("[data-amount]").textContent = money(price);
    card.querySelector("[data-period]").textContent = t(billing === "month" ? "plans.per.month" : "plans.per.quarter");
    card.querySelector("[data-perday]").textContent = t("plans.perday").replace("{x}", money(price / days));

    const saving = card.querySelector("[data-saving]");
    saving.hidden = billing === "month";
    saving.textContent = t("plans.saving").replace("{x}", money(prices[plan].month * 3 - price));

    const cta = card.querySelector("[data-checkout]");
    const link = checkoutLink(plan);
    cta.href = link || "#plans";
    cta.target = link ? "_blank" : "";
    cta.rel = link ? "noopener" : "";
  });

  document.querySelector("[data-hero-note]").textContent = t("hero.note").replace("{x}", money(prices.mastermind.month / 30));

  const provider = CONFIG.providers[currency];
  document.querySelector("[data-price-note]").textContent = (provider ? t("plans.noteProvider").replace("{provider}", provider) : t("plans.note")).replace("{x}", currency);

  const locationNote = document.querySelector("[data-location-note]");
  locationNote.hidden = currencySource !== "location";
  locationNote.querySelector("span").textContent = t("plans.location").replace("{x}", currency);

  document.querySelector("[data-currency-select]").value = currency;
  document.querySelectorAll("[data-billing]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.billing === billing));
  });
}

function initPlanControls() {
  document.querySelectorAll("[data-billing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      billing = btn.dataset.billing;
      renderPrices();
    });
  });
  document.querySelector("[data-currency-select]").addEventListener("change", (e) => {
    currency = e.target.value;
    currencySource = "manual";
    save(CURRENCY_KEY, currency);
    renderPrices();
  });
}

// Until a checkout link is set, the button explains that sign-up opens soon.
function initCheckout() {
  const dialog = document.getElementById("checkout-soon");
  document.querySelectorAll("[data-checkout]").forEach((cta) => {
    cta.addEventListener("click", (e) => {
      const plan = cta.closest("[data-plan]").dataset.plan;
      if (checkoutLink(plan)) return;
      e.preventDefault();
      const period = t(billing === "month" ? "plans.monthly" : "plans.quarterly");
      dialog.querySelector("[data-soon-text]").textContent = t("soon.text").replace("{plan}", `${PLAN_NAMES[plan]} (${period})`);
      dialog.showModal();
    });
  });
}

/* ---------- Form helpers ---------- */
function fieldProblem(el) {
  const value = el.value.trim();
  if (el.required && !value) return "form.required";
  if (el.type === "email" && value && !EMAIL_RE.test(value)) return "news.error.invalid";
  if (el.dataset.validate === "phone" && value && !PHONE_RE.test(value)) return "form.phone";
  return "";
}

function showFieldProblem(el, key) {
  const error = document.querySelector(`[data-error-for="${el.id}"]`);
  if (error) {
    error.textContent = key ? t(key) : "";
    error.hidden = !key;
  }
  el.setAttribute("aria-invalid", String(Boolean(key)));
}

function validateForm(form) {
  let first = null;
  form.querySelectorAll(".field input:not([type=radio]):not([type=checkbox]), .field textarea").forEach((el) => {
    const key = fieldProblem(el);
    showFieldProblem(el, key);
    if (key && !first) first = el;
  });
  if (first) first.focus();
  return !first;
}

function wireLiveValidation(form) {
  form.querySelectorAll(".field input, .field textarea").forEach((el) => {
    el.addEventListener("blur", () => {
      if (el.value.trim()) showFieldProblem(el, fieldProblem(el));
    });
    el.addEventListener("input", () => {
      if (el.getAttribute("aria-invalid") === "true") showFieldProblem(el, fieldProblem(el));
    });
  });
}

function setStatus(form, key, state) {
  const status = form.querySelector("[data-status]");
  status.textContent = key ? t(key) : "";
  status.dataset.state = state || "";
}

async function withLoading(form, task) {
  const button = form.querySelector('button[type="submit"]');
  const label = button.querySelector("[data-i18n]");
  button.disabled = true;
  if (label) label.textContent = t("form.sending");
  try {
    return await task();
  } finally {
    button.disabled = false;
    if (label) label.innerHTML = t(label.dataset.i18n);
  }
}

async function sendToWeb3Forms(data) {
  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ access_key: CONFIG.forms.web3formsKey, ...data }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Form service error");
}

function openMailDraft(subject, fields) {
  const body = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Sends via Web3Forms when a key is set, otherwise opens a pre-filled email.
async function deliver(form, subject, fields, successKey) {
  if (form.botcheck && form.botcheck.checked) return;
  if (!CONFIG.forms.web3formsKey) {
    openMailDraft(subject, fields);
    setStatus(form, "form.fallback", "info");
    return;
  }
  try {
    await withLoading(form, () => sendToWeb3Forms({ subject, from_name: fields.Name || "Website visitor", ...fields }));
    setStatus(form, successKey, "success");
    form.reset();
  } catch (err) {
    setStatus(form, "news.error.network", "error");
  }
}

/* ---------- Contact form ---------- */
function initContact() {
  const form = document.querySelector('[data-form="contact"]');
  wireLiveValidation(form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setStatus(form, "");
    if (!validateForm(form)) return;
    const fields = {
      Name: form.name.value.trim(),
      Email: form.email.value.trim(),
      Phone: form.phone.value.trim(),
      Message: form.message.value.trim(),
    };
    deliver(form, "New contact request: Business Beyond Borders", { ...fields, email: fields.Email }, "contact.success");
  });
}

/* ---------- Feedback / testimonials ---------- */
function renderTestimonials() {
  const list = document.querySelector("[data-testimonials]");
  const empty = document.querySelector("[data-testimonials-empty]");
  list.replaceChildren();
  CONFIG.testimonials.forEach((item) => {
    const card = document.createElement("figure");
    card.className = "testimonial";
    const stars = "★".repeat(Math.max(0, Math.min(5, item.rating || 0)));
    card.innerHTML = '<svg class="icon testimonial__quote" aria-hidden="true"><use href="#i-quote"/></svg><blockquote></blockquote><figcaption><strong></strong><span></span></figcaption>';
    card.querySelector("blockquote").textContent = item.text;
    card.querySelector("strong").textContent = item.name;
    card.querySelector("figcaption span").textContent = [item.role, stars].filter(Boolean).join("  ");
    list.appendChild(card);
  });
  list.hidden = CONFIG.testimonials.length === 0;
  empty.hidden = CONFIG.testimonials.length > 0;
}

function initFeedback() {
  const dialog = document.getElementById("feedback-dialog");
  const form = dialog.querySelector('[data-form="feedback"]');
  document.querySelectorAll("[data-open-feedback]").forEach((btn) =>
    btn.addEventListener("click", () => {
      setStatus(form, "");
      dialog.showModal();
    })
  );
  dialog.querySelector("[data-close-feedback]").addEventListener("click", () => dialog.close());
  wireLiveValidation(form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setStatus(form, "");
    if (!validateForm(form)) return;
    const rating = form.querySelector('input[name="rating"]:checked');
    const fields = {
      Name: form.name.value.trim(),
      Role: form.role.value.trim(),
      Rating: rating ? `${rating.value}/5` : "",
      Feedback: form.message.value.trim(),
      "May publish": form.consent.checked ? "Yes" : "No",
    };
    deliver(form, "New feedback: Business Beyond Borders", fields, "feedback.success");
  });
}

/* ---------- Free toolkit (lead magnet) ---------- */
function renderMaterials() {
  const list = document.querySelector("[data-materials]");
  list.replaceChildren();
  CONFIG.materials.forEach((item) => {
    const li = document.createElement("li");
    li.className = "material";
    li.innerHTML =
      '<span class="material__icon"><svg class="icon" aria-hidden="true"><use href="#i-file"/></svg></span>' +
      `<div><h3 data-i18n="${item.title}"></h3><p data-i18n="${item.text}"></p></div>`;
    if (item.file) {
      const a = document.createElement("a");
      a.className = "btn btn--light btn--sm material__download";
      a.href = item.file;
      a.setAttribute("download", "");
      a.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-download"/></svg><span data-i18n="materials.download"></span>';
      li.appendChild(a);
    } else {
      const badge = document.createElement("span");
      badge.className = "material__badge";
      badge.dataset.i18n = "materials.soon";
      li.appendChild(badge);
    }
    list.appendChild(li);
  });
  const unlocked = stored(TOOLKIT_KEY) === "1";
  document.querySelector("[data-materials-root]").classList.toggle("is-unlocked", unlocked);
}

function initToolkit() {
  const form = document.querySelector('[data-form="toolkit"]');
  wireLiveValidation(form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(form, "");
    if (!validateForm(form) || form.botcheck.checked) return;
    if (!CONFIG.forms.web3formsKey) {
      setStatus(form, "materials.soonForm", "info");
      return;
    }
    const email = form.email.value.trim();
    const optin = form.optin.checked;
    try {
      await withLoading(form, async () => {
        await sendToWeb3Forms({ subject: "Toolkit download: Business Beyond Borders", from_name: "Toolkit sign-up", email, "Newsletter opt-in": optin ? "Yes" : "No" });
        if (optin && CONFIG.newsletter.action) {
          const body = new FormData();
          body.append(CONFIG.newsletter.emailField, email);
          await fetch(CONFIG.newsletter.action, { method: "POST", body, mode: "no-cors" }).catch(() => {});
        }
      });
      save(TOOLKIT_KEY, "1");
      document.querySelector("[data-materials-root]").classList.add("is-unlocked");
      const hasFiles = CONFIG.materials.some((m) => m.file);
      setStatus(form, hasFiles ? "materials.unlocked" : "materials.none", "success");
    } catch (err) {
      setStatus(form, "news.error.network", "error");
    }
  });
}

/* ---------- Newsletter ---------- */
function initNewsletter() {
  const form = document.querySelector("[data-newsletter]");
  const input = form.querySelector('input[type="email"]');
  const error = form.querySelector("[data-news-error]");
  const status = form.querySelector("[data-news-status]");
  const button = form.querySelector('button[type="submit"]');
  const label = button.querySelector("span");

  const validate = () => {
    const value = input.value.trim();
    if (!value) return "news.error.empty";
    if (!EMAIL_RE.test(value)) return "news.error.invalid";
    return "";
  };
  const showError = (key) => {
    error.textContent = key ? t(key) : "";
    error.hidden = !key;
    input.setAttribute("aria-invalid", String(Boolean(key)));
  };
  const setNewsStatus = (key, state) => {
    status.textContent = key ? t(key) : "";
    status.dataset.state = state || "";
  };

  input.addEventListener("blur", () => {
    if (input.value.trim()) showError(validate());
  });
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") showError(validate());
    setNewsStatus("");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const problem = validate();
    showError(problem);
    if (problem) {
      input.focus();
      return;
    }
    if (!CONFIG.newsletter.action) {
      setNewsStatus("news.soon", "info");
      return;
    }
    button.disabled = true;
    label.textContent = t("news.sending");
    try {
      const body = new FormData();
      body.append(CONFIG.newsletter.emailField, input.value.trim());
      await fetch(CONFIG.newsletter.action, { method: "POST", body, mode: "no-cors" });
      setNewsStatus("news.success", "success");
      form.reset();
    } catch (err) {
      setNewsStatus("news.error.network", "error");
    } finally {
      button.disabled = false;
      label.textContent = t("news.button");
    }
  });
}

/* ---------- Small interactions ---------- */
function initTiles() {
  document.querySelectorAll(".tile").forEach((tile) => {
    tile.addEventListener("pointermove", (e) => {
      const r = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", `${e.clientX - r.left}px`);
      tile.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

function initLangSwitch() {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      save(LANG_KEY, btn.dataset.lang);
      applyLang(btn.dataset.lang);
    });
  });
}

function initMenu() {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".menu-toggle");
  const setOpen = (open) => {
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
  header.querySelectorAll(".site-nav a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initLinks() {
  document.querySelectorAll("[data-email]").forEach((a) => {
    const subject = a.dataset.email ? `?subject=${encodeURIComponent(a.dataset.email)}` : "";
    a.href = `mailto:${CONFIG.email}${subject}`;
  });
  document.querySelectorAll("[data-linkedin]").forEach((a) => (a.href = CONFIG.linkedin));
  document.querySelectorAll("[data-instagram]").forEach((a) => (a.href = CONFIG.instagram));
  document.querySelectorAll("[data-whatsapp]").forEach((a) => (a.href = `https://wa.me/${CONFIG.whatsapp}`));
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
}

initCurrency();
initLinks();
renderMaterials();
renderTestimonials();
initPlanControls();
initCheckout();
initContact();
initFeedback();
initToolkit();
initNewsletter();
initTiles();
initLangSwitch();
initMenu();
applyLang(initialLang());
