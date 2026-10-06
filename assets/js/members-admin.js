/*
 * Members admin (members/admin.html). Only for the site owner.
 *
 * Everything on this page needs an account whose profile has is_admin = true.
 * Even if someone opened this file, Supabase refuses every request that does
 * not come from an admin, so the page would simply stay empty.
 */
import { sb, configured, setStatus } from "./members.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const setupBox = $("[data-setup]");
const loginBox = $("[data-login]");
const app = $("[data-app]");
const who = $("[data-who]");
const logoutBtn = $("[data-logout]");

let products = [];
let members = [];
let memberships = [];

const fmt = (value) =>
  value ? new Date(value).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "";

const esc = (value) => String(value == null ? "" : value);

/* ---------- start ---------- */
if (!configured) {
  setupBox.hidden = false;
} else {
  start();
}

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return showLogin();
  const { data: profile } = await sb.from("profiles").select("full_name, email, is_admin").eq("id", data.session.user.id).maybeSingle();
  if (!profile || !profile.is_admin) {
    await sb.auth.signOut();
    showLogin("That account is not an admin yet. Run the last line of members-schema.sql in Supabase, then log in again.");
    return;
  }
  who.textContent = profile.email || "";
  logoutBtn.hidden = false;
  app.hidden = false;
  initTabs();
  await loadAll();
}

function showLogin(message = "") {
  loginBox.hidden = false;
  if (message) setStatus($("[data-login-status]"), message, "error");
}

$("[data-login-form]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = $("[data-login-status]");
  setStatus(status, "Checking…");
  const { error } = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
  if (error) return setStatus(status, error.message, "error");
  window.location.reload();
});

logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
  window.location.reload();
});

function initTabs() {
  $$("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
      $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== btn.dataset.tab));
    });
  });
}

/* ---------- load everything ---------- */
async function loadAll() {
  const [p, m, ms] = await Promise.all([
    sb.from("products").select("*").order("position"),
    sb.from("profiles").select("*").order("created_at", { ascending: false }),
    sb.from("memberships").select("*").order("created_at", { ascending: false }),
  ]);
  products = p.data || [];
  members = m.data || [];
  memberships = ms.data || [];
  fillProductSelects();
  renderMembers();
  renderProducts();
  await renderMaterials();
}

function fillProductSelects() {
  const options = products.map((p) => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join("");
  const select = $("#m-product");
  if (select) select.innerHTML = options;
}

/* ---------- members ---------- */
const liveAccess = (userId) =>
  memberships.filter(
    (m) => m.user_id === userId && m.status === "active" && (!m.expires_at || new Date(m.expires_at) > new Date())
  );

function renderMembers() {
  const list = $("[data-members-list]");
  const term = ($("#member-search").value || "").toLowerCase();
  const shown = members.filter(
    (m) => !term || (m.full_name || "").toLowerCase().includes(term) || (m.email || "").toLowerCase().includes(term)
  );
  list.innerHTML = "";

  if (!shown.length) {
    list.innerHTML = '<p class="muted">No members yet. They appear here as soon as they create an account on the website.</p>';
    return;
  }

  shown.forEach((member) => {
    const access = liveAccess(member.id);
    const card = document.createElement("div");
    card.className = "member";
    card.innerHTML = `
      <div class="member__top">
        <strong>${esc(member.full_name || "(no name)")}</strong>
        <span class="muted small">${esc(member.email)}</span>
        <span class="muted small">joined ${fmt(member.created_at)}</span>
        ${member.is_admin ? '<span class="pill">admin</span>' : ""}
      </div>
      <div class="access-row">
        ${
          access.length
            ? access
                .map(
                  (a) =>
                    `<span class="pill">${esc(productName(a.product))} · ${a.tier === "beyond" ? "Beyond" : "Mastermind"} · ${
                      a.expires_at ? "until " + fmt(a.expires_at) : "no end date"
                    }<button type="button" class="btn btn--danger btn--small" data-revoke="${a.id}">Stop</button></span>`
                )
                .join("")
            : '<span class="pill pill--none">no access yet</span>'
        }
      </div>
      <div class="grant">
        <div><label>Give access to</label><select data-grant-product>${products
          .map((p) => `<option value="${esc(p.key)}">${esc(p.name)}</option>`)
          .join("")}</select></div>
        <div><label>Plan</label><select data-grant-tier>
          <option value="mastermind">The Mastermind</option>
          <option value="beyond">Beyond Mastermind</option>
        </select></div>
        <div><label>For how long</label><select data-grant-length>
          <option value="1">1 month</option>
          <option value="3">3 months</option>
          <option value="6">6 months</option>
          <option value="12">1 year</option>
          <option value="0">No end date</option>
        </select></div>
        <div><label>&nbsp;</label><button type="button" class="btn btn--primary btn--small" data-grant="${member.id}">Switch on</button></div>
      </div>`;
    list.append(card);
  });

  $$("[data-grant]", list).forEach((btn) => btn.addEventListener("click", () => grant(btn)));
  $$("[data-revoke]", list).forEach((btn) => btn.addEventListener("click", () => revoke(btn.dataset.revoke)));
}

const productName = (key) => (products.find((p) => p.key === key) || {}).name || key;

async function grant(btn) {
  const card = btn.closest(".member");
  const months = Number($("[data-grant-length]", card).value);
  const expires = months ? new Date(new Date().setMonth(new Date().getMonth() + months)).toISOString() : null;
  btn.disabled = true;
  const { error } = await sb.from("memberships").insert({
    user_id: btn.dataset.grant,
    product: $("[data-grant-product]", card).value,
    tier: $("[data-grant-tier]", card).value,
    status: "active",
    expires_at: expires,
  });
  btn.disabled = false;
  const status = $("[data-members-status]");
  if (error) return setStatus(status, error.message, "error");
  setStatus(status, "Access switched on.", "ok");
  await refreshMemberships();
}

async function revoke(id) {
  if (!window.confirm("Stop this access now?")) return;
  const { error } = await sb.from("memberships").update({ status: "cancelled" }).eq("id", id);
  const status = $("[data-members-status]");
  if (error) return setStatus(status, error.message, "error");
  setStatus(status, "Access stopped.", "ok");
  await refreshMemberships();
}

async function refreshMemberships() {
  const { data } = await sb.from("memberships").select("*").order("created_at", { ascending: false });
  memberships = data || [];
  renderMembers();
}

$("#member-search").addEventListener("input", renderMembers);

/* ---------- materials ---------- */
const kindSelect = $("#m-kind");
kindSelect.addEventListener("change", () => {
  const isFile = kindSelect.value === "file";
  $("[data-file-field]").hidden = !isFile;
  $("[data-url-field]").hidden = isFile;
});

$("[data-material-form]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = $("[data-material-status]");
  const button = form.querySelector("button[type=submit]");
  const kind = form.kind.value;
  const file = form.file.files[0];

  if (kind === "file" && !file) return setStatus(status, "Choose a file first.", "error");
  if (kind !== "file" && !form.url.value.trim()) return setStatus(status, "Add the link.", "error");

  button.disabled = true;
  let storagePath = null;
  if (kind === "file") {
    setStatus(status, "Uploading…");
    const safe = file.name.replace(/[^\w.-]+/g, "-").toLowerCase();
    storagePath = `${form.product.value}/${Date.now()}-${safe}`;
    const { error: upErr } = await sb.storage.from("member-files").upload(storagePath, file, { upsert: false });
    if (upErr) {
      button.disabled = false;
      return setStatus(status, upErr.message, "error");
    }
  }

  setStatus(status, "Saving…");
  const { error } = await sb.from("materials").insert({
    title: form.title.value.trim(),
    description: form.description.value.trim() || null,
    kind,
    url: kind === "file" ? null : form.url.value.trim(),
    storage_path: storagePath,
    product: form.product.value,
    min_tier: form.min_tier.value,
    published: form.published.checked,
    position: Date.now() % 100000,
  });
  button.disabled = false;
  if (error) return setStatus(status, error.message, "error");
  setStatus(status, "Added.", "ok");
  form.reset();
  $("[data-file-field]").hidden = true;
  $("[data-url-field]").hidden = false;
  await renderMaterials();
});

async function renderMaterials() {
  const list = $("[data-materials-list]");
  const { data, error } = await sb.from("materials").select("*").order("product").order("position");
  if (error) {
    list.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    list.innerHTML = '<p class="muted">No materials yet.</p>';
    return;
  }
  list.innerHTML = "";
  rows.forEach((m) => {
    const card = document.createElement("div");
    card.className = "member";
    card.innerHTML = `
      <div class="member__top">
        <strong>${esc(m.title)}</strong>
        <span class="muted small">${esc(productName(m.product))} · ${esc(m.kind)} · ${
      m.min_tier === "beyond" ? "Beyond only" : "all members"
    }</span>
        <span class="pill ${m.published ? "" : "pill--none"}">${m.published ? "visible" : "hidden"}</span>
      </div>
      ${m.description ? `<p class="muted small">${esc(m.description)}</p>` : ""}
      <div class="access-row">
        <button type="button" class="btn btn--ghost btn--small" data-toggle="${m.id}" data-published="${m.published}">${
      m.published ? "Hide from members" : "Show to members"
    }</button>
        <button type="button" class="btn btn--danger btn--small" data-delete="${m.id}">Delete</button>
      </div>`;
    list.append(card);
  });

  $$("[data-toggle]", list).forEach((btn) =>
    btn.addEventListener("click", async () => {
      await sb.from("materials").update({ published: btn.dataset.published !== "true" }).eq("id", btn.dataset.toggle);
      await renderMaterials();
    })
  );
  $$("[data-delete]", list).forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!window.confirm("Delete this material?")) return;
      const row = rows.find((r) => r.id === btn.dataset.delete);
      if (row && row.storage_path) await sb.storage.from("member-files").remove([row.storage_path]);
      await sb.from("materials").delete().eq("id", btn.dataset.delete);
      await renderMaterials();
    })
  );
}

/* ---------- products ---------- */
$("[data-product-form]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = $("[data-product-status]");
  const key = form.key.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!key) return setStatus(status, "Add a short code.", "error");
  const { error } = await sb.from("products").insert({
    key,
    name: form.name.value.trim(),
    kind: key === "community" ? "community" : "course",
    position: products.length,
  });
  if (error) return setStatus(status, error.message, "error");
  setStatus(status, "Added.", "ok");
  form.reset();
  const { data } = await sb.from("products").select("*").order("position");
  products = data || [];
  fillProductSelects();
  renderProducts();
  renderMembers();
});

function renderProducts() {
  const list = $("[data-products-list]");
  list.innerHTML = "";
  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "member";
    card.innerHTML = `<div class="member__top"><strong>${esc(p.name)}</strong>
      <span class="muted small">code: ${esc(p.key)} · ${esc(p.kind)}</span></div>`;
    list.append(card);
  });
}
