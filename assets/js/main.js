/*
 * Business Beyond Borders: site behaviour.
 * The CONFIG block below is the only thing you normally need to edit.
 */
const CONFIG = {
  // TODO: replace with your real contact email and LinkedIn profile URL.
  email: "hello@example.com",
  linkedin: "https://www.linkedin.com/",

  // Prices in EUR. "month" = billed monthly, "quarter" = billed every 3 months.
  prices: {
    mastermind: { month: 19.99, quarter: 49.99 },
    beyond: { month: 49.99, quarter: 124.99 },
  },

  // TODO: paste your 4 Stripe Payment Links here (https://buy.stripe.com/...).
  // While a link is empty, the button shows a "sign-up opens soon" message.
  stripe: {
    mastermind: { month: "", quarter: "" },
    beyond: { month: "", quarter: "" },
  },
};

const PLAN_NAMES = { mastermind: "The Mastermind", beyond: "Beyond Mastermind" };
const LANGS = ["en", "hy"];
const STORAGE_KEY = "bbb-lang";

let lang = "en";
let billing = "month";

const t = (key) => (window.I18N[lang] && window.I18N[lang][key]) || window.I18N.en[key] || "";

function storedLang() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function saveLang(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (e) {
    /* storage unavailable: language just won't be remembered */
  }
}

function initialLang() {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(fromUrl)) return fromUrl;
  const saved = storedLang();
  if (LANGS.includes(saved)) return saved;
  return (navigator.language || "").toLowerCase().startsWith("hy") ? "hy" : "en";
}

function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').setAttribute("content", t("meta.description"));

  // Strings come only from our own i18n.js, so innerHTML (for <em>) is safe here.
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

const euro = (n) => "€" + n.toFixed(2);

function checkoutHref(plan) {
  return CONFIG.stripe[plan][billing] || "#plans";
}

// Until a Stripe link is set, the button explains that sign-up opens soon.
function initCheckout() {
  const dialog = document.getElementById("checkout-soon");
  document.querySelectorAll("[data-checkout]").forEach((cta) => {
    cta.addEventListener("click", (e) => {
      const plan = cta.closest("[data-plan]").dataset.plan;
      if (CONFIG.stripe[plan][billing]) return;
      e.preventDefault();
      const period = t(billing === "month" ? "plans.monthly" : "plans.quarterly");
      dialog.querySelector("[data-soon-text]").textContent = t("soon.text").replace("{plan}", `${PLAN_NAMES[plan]} (${period})`);
      dialog.showModal();
    });
  });
}

function renderPrices() {
  document.querySelectorAll("[data-plan]").forEach((card) => {
    const plan = card.dataset.plan;
    const price = CONFIG.prices[plan][billing];
    const days = billing === "month" ? 30 : 90;

    card.querySelector("[data-amount]").textContent = euro(price);
    card.querySelector("[data-period]").textContent = t(billing === "month" ? "plans.per.month" : "plans.per.quarter");
    card.querySelector("[data-perday]").textContent = t("plans.perday").replace("{x}", (price / days).toFixed(2));

    const saving = card.querySelector("[data-saving]");
    saving.hidden = billing === "month";
    saving.textContent = t("plans.saving").replace("{x}", euro(CONFIG.prices[plan].month * 3 - price));

    const cta = card.querySelector("[data-checkout]");
    cta.href = checkoutHref(plan);
    const external = cta.href.startsWith("http");
    cta.target = external ? "_blank" : "";
    cta.rel = external ? "noopener" : "";
  });

  document.querySelectorAll("[data-billing]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.billing === billing));
  });
}

function initBilling() {
  document.querySelectorAll("[data-billing]").forEach((btn) => {
    btn.addEventListener("click", () => {
      billing = btn.dataset.billing;
      renderPrices();
    });
  });
}

function initLangSwitch() {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveLang(btn.dataset.lang);
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

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  items.forEach((el) => io.observe(el));
}

function initLinks() {
  document.querySelectorAll("[data-email]").forEach((a) => {
    const subject = a.dataset.email ? `?subject=${encodeURIComponent(a.dataset.email)}` : "";
    a.href = `mailto:${CONFIG.email}${subject}`;
  });
  document.querySelectorAll("[data-linkedin]").forEach((a) => (a.href = CONFIG.linkedin));
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
}

document.documentElement.classList.add("js");
initLinks();
initBilling();
initCheckout();
initLangSwitch();
initMenu();
applyLang(initialLang());
initReveal();
