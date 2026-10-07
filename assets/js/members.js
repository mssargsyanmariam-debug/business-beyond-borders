/*
 * Business Beyond Borders: members area.
 *
 * Everything here runs in the visitor's browser and talks to Supabase.
 * Who may read what is decided by Supabase itself (the rules in
 * integrations/members-schema.sql), not by this file, so nobody can reach
 * other people's materials by editing the page.
 *
 * Settings live in assets/js/members-config.js.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const CFG = window.BBB_SUPABASE || {};
export const configured = Boolean(CFG.url && CFG.anonKey);

export const sb = configured
  ? createClient(CFG.url, CFG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/* ---------- small helpers ---------- */

// Translations come from the site's own language files (window.BBB.t).
export function t(key, vars) {
  let text = (window.BBB && window.BBB.t(key)) || "";
  if (!text) text = key;
  if (vars) Object.entries(vars).forEach(([k, v]) => (text = text.replace(`{${k}}`, v)));
  return text;
}

const currentLang = () => (window.BBB && window.BBB.lang()) || document.documentElement.lang || "en";

export function fmtDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(currentLang(), { year: "numeric", month: "long", day: "numeric" });
  } catch (e) {
    return String(value).slice(0, 10);
  }
}

export function setStatus(el, message, state = "") {
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state;
}

// Supabase answers in English. Show our own wording where we recognise it.
function friendlyError(error) {
  const raw = (error && error.message) || "";
  const low = raw.toLowerCase();
  if (low.includes("invalid login credentials")) return t("login.error.credentials");
  if (low.includes("already registered") || low.includes("already been registered")) return t("login.error.exists");
  if (low.includes("password should be")) return t("login.error.weak");
  if (low.includes("email not confirmed")) return t("login.error.unconfirmed");
  if (low.includes("rate limit") || low.includes("too many")) return t("login.error.rate");
  return `${t("login.error.generic")} (${raw})`;
}

const absolute = (path) => new URL(path, window.location.href).href;

/* ---------- pages ---------- */

const mode = document.body.dataset.member || "";

// Nothing is configured yet: show the "opens soon" panel instead of a broken form.
function showSoon() {
  document.querySelectorAll("[data-needs-supabase]").forEach((el) => (el.hidden = true));
  document.querySelectorAll("[data-members-soon]").forEach((el) => (el.hidden = false));
}

/* ---------- 1. Login / sign-up ---------- */
async function initLogin() {
  const panels = document.querySelectorAll("[data-auth-panel]");
  const tabs = document.querySelectorAll("[data-auth-tab]");
  const status = document.querySelector("[data-auth-status]");

  const showPanel = (name) => {
    tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.authTab === name)));
    panels.forEach((p) => (p.hidden = p.dataset.authPanel !== name));
    setStatus(status, "");
  };
  tabs.forEach((b) => b.addEventListener("click", () => showPanel(b.dataset.authTab)));

  // Already logged in? Go straight through.
  const { data } = await sb.auth.getSession();
  if (data.session) {
    window.location.replace("./");
    return;
  }

  const busy = (form, on) => {
    const button = form.querySelector("button[type=submit]");
    if (button) button.disabled = on;
  };

  /* log in with a password */
  const signin = document.querySelector("[data-form=signin]");
  signin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = signin.email.value.trim();
    const password = signin.password.value;
    if (!email || !password) return setStatus(status, t("login.error.fields"), "error");
    busy(signin, true);
    setStatus(status, t("login.working"));
    const { error } = await sb.auth.signInWithPassword({ email, password });
    busy(signin, false);
    if (error) return setStatus(status, friendlyError(error), "error");
    window.location.assign("./");
  });

  /* create an account */
  const signup = document.querySelector("[data-form=signup]");
  signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = signup.email.value.trim();
    const password = signup.password.value;
    const fullName = signup.full_name.value.trim();
    if (!email || !password || !fullName) return setStatus(status, t("login.error.fields"), "error");
    if (password.length < 8) return setStatus(status, t("login.error.weak"), "error");
    if (!signup.consent.checked) return setStatus(status, t("login.error.consent"), "error");
    busy(signup, true);
    setStatus(status, t("login.working"));
    const { data: created, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, country: signup.country.value.trim() },
        emailRedirectTo: absolute("./"),
      },
    });
    busy(signup, false);
    if (error) return setStatus(status, friendlyError(error), "error");
    if (created.session) {
      window.location.assign("./");
      return;
    }
    setStatus(status, t("login.confirm"), "success");
  });

  /* a login link by email, for people who never remember passwords */
  const magic = document.querySelector("[data-magic]");
  if (magic) {
    magic.addEventListener("click", async () => {
      const email = signin.email.value.trim();
      if (!email) return setStatus(status, t("login.error.email"), "error");
      magic.disabled = true;
      setStatus(status, t("login.working"));
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: absolute("./") } });
      magic.disabled = false;
      setStatus(status, error ? friendlyError(error) : t("login.magic.sent"), error ? "error" : "success");
    });
  }

  /* forgotten password */
  const forgot = document.querySelector("[data-forgot]");
  if (forgot) {
    forgot.addEventListener("click", async () => {
      const email = signin.email.value.trim();
      if (!email) return setStatus(status, t("login.error.email"), "error");
      forgot.disabled = true;
      setStatus(status, t("login.working"));
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: absolute("reset.html") });
      forgot.disabled = false;
      setStatus(status, error ? friendlyError(error) : t("login.reset.sent"), error ? "error" : "success");
    });
  }
}

/* ---------- 2. The member hub ---------- */

// Turn a normal YouTube or Vimeo address into one that can be embedded.
function embedUrl(url) {
  const value = (url || "").trim();
  let m = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return "";
}

async function initHub() {
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    window.location.replace("login.html");
    return;
  }
  const user = sessionData.session.user;

  const loading = document.querySelector("[data-hub-loading]");
  const hubMain = document.querySelector("[data-hub-main]");
  const content = document.querySelector("[data-hub-content]");
  const noAccess = document.querySelector("[data-hub-noaccess]");
  const library = document.querySelector("[data-library]");
  const accessList = document.querySelector("[data-access-list]");
  const greeting = document.querySelector("[data-greeting]");
  const emailOut = document.querySelector("[data-account-email]");

  const [profileRes, membershipRes, productRes, materialRes] = await Promise.all([
    sb.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    sb.from("memberships").select("product, tier, status, expires_at").eq("status", "active"),
    sb.from("products").select("key, name, kind, position").order("position"),
    sb.from("materials").select("*").eq("published", true).order("product").order("position"),
  ]);

  const profile = profileRes.data || {};
  const name = (profile.full_name || "").split(" ")[0] || user.email;
  const memberships = (membershipRes.data || []).filter((m) => !m.expires_at || new Date(m.expires_at) > new Date());
  const products = productRes.data || [];
  const materials = materialRes.data || [];

  if (greeting) greeting.textContent = t("hub.welcome", { name });
  if (emailOut) emailOut.textContent = profile.email || user.email;

  /* what they have access to, and until when */
  if (accessList) {
    accessList.innerHTML = "";
    memberships.forEach((m) => {
      const product = products.find((p) => p.key === m.product);
      const li = document.createElement("li");
      li.className = "access-card";
      const title = document.createElement("strong");
      title.textContent = product ? product.name : m.product;
      const tier = document.createElement("span");
      tier.className = "access-card__tier";
      tier.textContent = m.tier === "beyond" ? "Beyond Mastermind" : "The Mastermind";
      const until = document.createElement("span");
      until.className = "access-card__until";
      until.textContent = m.expires_at ? t("hub.access.until", { date: fmtDate(m.expires_at) }) : t("hub.access.open");
      li.append(title, tier, until);
      accessList.append(li);
    });
  }

  /* the library, grouped by what it belongs to */
  if (library) {
    library.innerHTML = "";
    const groups = products.filter((p) => materials.some((m) => m.product === p.key));
    groups.forEach((product) => {
      const section = document.createElement("section");
      section.className = "library-group";
      const h = document.createElement("h3");
      h.textContent = product.name;
      section.append(h);
      const list = document.createElement("div");
      list.className = "library-grid";
      materials
        .filter((m) => m.product === product.key)
        .forEach((m) => list.append(materialCard(m)));
      section.append(list);
      library.append(section);
    });
    if (!materials.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = t("hub.empty");
      library.append(empty);
    }
  }

  if (loading) loading.hidden = true;
  if (hubMain) hubMain.hidden = false;
  const hasAccess = memberships.length > 0;
  if (noAccess) noAccess.hidden = hasAccess;
  if (content) content.hidden = !hasAccess;

  /* account actions */
  const logout = document.querySelector("[data-logout]");
  if (logout) {
    logout.addEventListener("click", async () => {
      await sb.auth.signOut();
      window.location.replace("login.html");
    });
  }

  const passwordForm = document.querySelector("[data-form=password]");
  if (passwordForm) {
    const status = document.querySelector("[data-password-status]");
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = passwordForm.password.value;
      if (password.length < 8) return setStatus(status, t("login.error.weak"), "error");
      setStatus(status, t("login.working"));
      const { error } = await sb.auth.updateUser({ password });
      setStatus(status, error ? friendlyError(error) : t("hub.password.saved"), error ? "error" : "success");
      if (!error) passwordForm.reset();
    });
  }

  // Re-draw our own text when the visitor changes language.
  document.addEventListener("bbb:lang", () => {
    if (greeting) greeting.textContent = t("hub.welcome", { name });
  });
}

function materialCard(m) {
  const card = document.createElement("article");
  card.className = "material";

  const title = document.createElement("h4");
  title.textContent = m.title;
  card.append(title);

  if (m.description) {
    const p = document.createElement("p");
    p.textContent = m.description;
    card.append(p);
  }

  if (m.kind === "video") {
    const src = embedUrl(m.url);
    if (src) {
      const frame = document.createElement("div");
      frame.className = "material__video";
      const iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.loading = "lazy";
      iframe.title = m.title;
      iframe.allow = "accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      frame.append(iframe);
      card.append(frame);
      return card;
    }
  }

  // Files are never handed over as a link: they open in our own protected
  // viewer, which draws them on screen with the member's email across them.
  if (m.kind === "file") {
    const open = document.createElement("a");
    open.className = "btn btn--ghost btn--sm";
    open.href = `view.html?id=${encodeURIComponent(m.id)}`;
    open.textContent = t("hub.view");
    card.append(open);
    const note = document.createElement("p");
    note.className = "material__note";
    note.textContent = m.allow_download ? t("hub.downloadable") : t("hub.viewonly");
    card.append(note);
    return card;
  }

  const action = document.createElement("button");
  action.type = "button";
  action.className = "btn btn--ghost btn--sm";
  action.textContent = t("hub.open");
  action.addEventListener("click", () => {
    if (m.url) window.open(m.url, "_blank", "noopener");
  });
  card.append(action);
  return card;
}

/* ---------- 3. Set a new password (the link from the reset email) ---------- */
async function initReset() {
  const form = document.querySelector("[data-form=reset]");
  const status = document.querySelector("[data-reset-status]");
  const params = new URLSearchParams(window.location.search);

  // Supabase sends people here in one of three ways depending on the settings.
  if (params.get("code")) {
    await sb.auth.exchangeCodeForSession(params.get("code"));
  } else if (params.get("token_hash")) {
    await sb.auth.verifyOtp({ token_hash: params.get("token_hash"), type: params.get("type") || "recovery" });
  }

  const { data } = await sb.auth.getSession();
  if (!data.session) {
    setStatus(status, t("reset.expired"), "error");
    form.hidden = true;
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = form.password.value;
    if (password.length < 8) return setStatus(status, t("login.error.weak"), "error");
    if (password !== form.password2.value) return setStatus(status, t("reset.mismatch"), "error");
    setStatus(status, t("login.working"));
    const { error } = await sb.auth.updateUser({ password });
    if (error) return setStatus(status, friendlyError(error), "error");
    setStatus(status, t("reset.done"), "success");
    form.hidden = true;
    setTimeout(() => window.location.assign("./"), 1500);
  });
}

/* ---------- start ---------- */
if (mode && mode !== "admin") {
  if (!configured) showSoon();
  else if (mode === "login") initLogin();
  else if (mode === "hub") initHub();
  else if (mode === "reset") initReset();
}
