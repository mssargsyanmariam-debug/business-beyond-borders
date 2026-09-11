/*
 * Business Beyond Borders: site behaviour.
 * The CONFIG block below is the only thing you normally need to edit.
 */
const CONFIG = {
  // TODO: replace with your real contact email and LinkedIn profile URL.
  email: "hello@example.com",
  linkedin: "https://www.linkedin.com/",

  // Prices per currency. "month" = billed monthly, "quarter" = billed every 3 months.
  prices: {
    EUR: { mastermind: { month: 19.99, quarter: 49.99 }, beyond: { month: 49.99, quarter: 124.99 } },
    USD: { mastermind: { month: 19.99, quarter: 49.99 }, beyond: { month: 49.99, quarter: 124.99 } },
    AMD: { mastermind: { month: 7900, quarter: 19900 }, beyond: { month: 19900, quarter: 49900 } },
  },

  // TODO: paste checkout links from your payment provider here, per currency.
  // While a link is empty, the button shows a "sign-up opens soon" message.
  checkout: {
    EUR: { mastermind: { month: "", quarter: "" }, beyond: { month: "", quarter: "" } },
    USD: { mastermind: { month: "", quarter: "" }, beyond: { month: "", quarter: "" } },
    AMD: { mastermind: { month: "", quarter: "" }, beyond: { month: "", quarter: "" } },
  },
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

let lang = "en";
let billing = "month";
let currency = "EUR";

const t = (key) => (window.I18N[lang] && window.I18N[lang][key]) || window.I18N.en[key] || "";

function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
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

// Default currency: saved choice, else a guess from the visitor's time zone.
function initialCurrency() {
  const fromUrl = (new URLSearchParams(location.search).get("currency") || "").toUpperCase();
  if (CURRENCIES[fromUrl]) return fromUrl;
  const saved = stored(CURRENCY_KEY);
  if (CURRENCIES[saved]) return saved;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz === "Asia/Yerevan") return "AMD";
    if (tz.startsWith("America/")) return "USD";
  } catch (e) {
    /* fall through */
  }
  return "EUR";
}

function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').setAttribute("content", t("meta.description"));

  // Strings come only from our own i18n.js, so innerHTML is safe here.
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  });

  renderPrices();
}

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
  document.querySelector("[data-price-note]").textContent = t("plans.note").replace("{x}", currency);

  document.querySelectorAll("[data-billing]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.billing === billing));
  });
  document.querySelectorAll("[data-currency]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.currency === currency));
  });
}

function initPlanControls() {
  document.querySelectorAll("[data-billing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      billing = btn.dataset.billing;
      renderPrices();
    });
  });
  document.querySelectorAll("[data-currency]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currency = btn.dataset.currency;
      save(CURRENCY_KEY, currency);
      renderPrices();
    });
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

currency = initialCurrency();
initLinks();
initPlanControls();
initCheckout();
initLangSwitch();
initMenu();
applyLang(initialLang());
