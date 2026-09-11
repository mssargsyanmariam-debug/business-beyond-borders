/*
 * Business Beyond Borders: site behaviour.
 * The CONFIG block below is the only thing you normally need to edit.
 */
const CONFIG = {
  // TODO: replace with your real contact email.
  email: "hello@example.com",
  linkedin: "https://www.linkedin.com/in/mariamsargsyan-business-enthusiast/",

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

  // Visitor country lookup (returns {"country":"US"}); falls back to the time zone.
  geoEndpoint: "https://api.country.is/",
};

const CURRENCIES = {
  EUR: { symbol: "€", decimals: 2 },
  USD: { symbol: "$", decimals: 2 },
  AMD: { symbol: "֏", decimals: 0 },
};
const PLAN_NAMES = { mastermind: "The Mastermind", beyond: "Beyond Mastermind" };
const LANGS = ["en", "hy"];
const LANG_KEY = "bbb-lang";
const CURRENCY_KEY = "bbb-currency";
const COUNTRY_KEY = "bbb-country";

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
  return (navigator.language || "").toLowerCase().startsWith("hy") ? "hy" : "en";
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

  // Strings come only from our own i18n.js, so innerHTML (for links) is safe here.
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "news.error.invalid";
    return "";
  };
  const showError = (key) => {
    error.textContent = key ? t(key) : "";
    error.hidden = !key;
    input.setAttribute("aria-invalid", String(Boolean(key)));
  };
  const setStatus = (key, state) => {
    status.textContent = key ? t(key) : "";
    status.dataset.state = state || "";
  };

  input.addEventListener("blur", () => {
    if (input.value.trim()) showError(validate());
  });
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") showError(validate());
    setStatus("");
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
      setStatus("news.soon", "info");
      return;
    }
    button.disabled = true;
    label.textContent = t("news.sending");
    try {
      const body = new FormData();
      body.append(CONFIG.newsletter.emailField, input.value.trim());
      await fetch(CONFIG.newsletter.action, { method: "POST", body, mode: "no-cors" });
      setStatus("news.success", "success");
      form.reset();
    } catch (err) {
      setStatus("news.error.network", "error");
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
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
}

initCurrency();
initLinks();
initPlanControls();
initCheckout();
initNewsletter();
initTiles();
initLangSwitch();
initMenu();
applyLang(initialLang());
