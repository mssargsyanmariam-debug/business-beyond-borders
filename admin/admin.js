/*
 * Admin panel for Business Beyond Borders.
 * Talks to GitHub directly with a fine-grained access key the owner pastes in.
 * The key is kept in this browser only (localStorage) and is sent to api.github.com alone.
 */
const REPO = { owner: "mssargsyanmariam-debug", name: "business-beyond-borders", branch: "main" };
const CONTENT_PATH = "content.json";
const PHOTO_DIR = "assets/img/trainings";
const TOKEN_KEY = "bbb-admin-token";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Text fields offered in the "Text & prices" tab: [key, label, multiline]
const TEXT_FIELDS = [
  ["hero.title", "Headline (HTML allowed)", true],
  ["hero.lead", "Intro paragraph", true],
  ["features.title", "What you get: heading", true],
  ["founder.bio", "About me", true],
  ["hl.1", "Highlight 1", true],
  ["hl.2", "Highlight 2", true],
  ["hl.3", "Highlight 3", true],
  ["hl.4", "Highlight 4", true],
  ["trainings.title", "Trainings section: heading", false],
  ["trainings.lead", "Trainings section: intro", true],
  ["cta.title", "Closing headline", false],
];

const PRICE_FIELDS = [
  ["EUR", "mastermind", "month", "The Mastermind, monthly (EUR)"],
  ["EUR", "mastermind", "quarter", "The Mastermind, 3 months (EUR)"],
  ["EUR", "beyond", "month", "Beyond Mastermind, monthly (EUR)"],
  ["EUR", "beyond", "quarter", "Beyond Mastermind, 3 months (EUR)"],
  ["USD", "mastermind", "month", "The Mastermind, monthly (USD)"],
  ["USD", "mastermind", "quarter", "The Mastermind, 3 months (USD)"],
  ["USD", "beyond", "month", "Beyond Mastermind, monthly (USD)"],
  ["USD", "beyond", "quarter", "Beyond Mastermind, 3 months (USD)"],
  ["AMD", "mastermind", "month", "The Mastermind, monthly (AMD)"],
  ["AMD", "mastermind", "quarter", "The Mastermind, 3 months (AMD)"],
  ["AMD", "beyond", "month", "Beyond Mastermind, monthly (AMD)"],
  ["AMD", "beyond", "quarter", "Beyond Mastermind, 3 months (AMD)"],
];

let token = "";
let content = { gallery: [], videos: [], testimonials: [], text: {}, prices: {} };
let contentSha = null;

const $ = (sel) => document.querySelector(sel);
const el = (sel) => document.querySelector(`[${sel}]`);

function setStatus(node, message, state) {
  node.textContent = message;
  node.dataset.state = state || "";
}

/* ---------- GitHub API ---------- */
async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) throw new Error("That key was refused. Check it is correct and has 'Contents: read and write' for this website.");
  if (res.status === 409) throw new Error("Someone else saved a change first. Reload the page and try again.");
  if (!res.ok && res.status !== 404) throw new Error(`GitHub error ${res.status}. ${(await res.json().catch(() => ({}))).message || ""}`);
  return res;
}

const decodeBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const encodeBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

async function loadContent() {
  const res = await gh(`repos/${REPO.owner}/${REPO.name}/contents/${CONTENT_PATH}?ref=${REPO.branch}`);
  if (res.status === 404) {
    contentSha = null;
    return;
  }
  const data = await res.json();
  contentSha = data.sha;
  const parsed = JSON.parse(decodeBase64(data.content));
  content = { gallery: [], videos: [], testimonials: [], text: {}, prices: {}, ...parsed };
}

async function saveContent(message) {
  const body = {
    message,
    content: encodeBase64(JSON.stringify(content, null, 2) + "\n"),
    branch: REPO.branch,
  };
  if (contentSha) body.sha = contentSha;
  const res = await gh(`repos/${REPO.owner}/${REPO.name}/contents/${CONTENT_PATH}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  contentSha = data.content.sha;
}

async function uploadFile(path, base64, message) {
  const res = await gh(`repos/${REPO.owner}/${REPO.name}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: base64, branch: REPO.branch }),
  });
  return res.json();
}

/* ---------- Sign in ---------- */
async function signIn(candidate, remember) {
  token = candidate;
  const res = await gh(`repos/${REPO.owner}/${REPO.name}`);
  const repo = await res.json();
  if (remember) localStorage.setItem(TOKEN_KEY, candidate);
  await loadContent();
  el("data-login").hidden = true;
  el("data-panel").hidden = false;
  const who = el("data-who");
  who.hidden = false;
  who.textContent = `Connected to ${repo.full_name}`;
  el("data-logout").hidden = false;
  renderAll();
}

/* ---------- Rendering ---------- */
function renderPhotos() {
  const list = el("data-photo-list");
  list.replaceChildren();
  if (!content.gallery.length) {
    list.innerHTML = '<p class="muted">No pictures yet.</p>';
    return;
  }
  content.gallery.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <img src="../${item.file}" alt="">
      <div>
        <div class="field"><label>Caption</label><input type="text" value="${(item.caption || "").replace(/"/g, "&quot;")}" data-caption="${index}"></div>
        <p class="muted small">${item.file}</p>
      </div>
      <div style="display:grid;gap:8px">
        <button type="button" class="btn btn--ghost btn--small" data-move="${index}">Move up</button>
        <button type="button" class="btn btn--danger btn--small" data-remove-photo="${index}">Remove</button>
      </div>`;
    list.appendChild(row);
  });
}

function renderVideos() {
  const list = el("data-video-list");
  list.replaceChildren();
  if (!content.videos.length) {
    list.innerHTML = '<p class="muted">No videos yet.</p>';
    return;
  }
  content.videos.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "list-item list-item--plain";
    row.innerHTML = `
      <div>
        <strong>${item.title || "Untitled"}</strong> ${item.featured ? '<span class="pill pill--live">Only this one is shown</span>' : ""}
        <p class="muted small">${item.note || ""}</p>
        <p class="small"><a href="${item.url}" target="_blank" rel="noopener">${item.url}</a></p>
      </div>
      <div style="display:grid;gap:8px">
        <button type="button" class="btn btn--ghost btn--small" data-feature="${index}">${item.featured ? "Show all videos" : "Show only this"}</button>
        <button type="button" class="btn btn--danger btn--small" data-remove-video="${index}">Remove</button>
      </div>`;
    list.appendChild(row);
  });
}

function renderTestimonials() {
  const list = el("data-testimonial-list");
  list.replaceChildren();
  if (!content.testimonials.length) {
    list.innerHTML = '<p class="muted">No testimonials yet.</p>';
    return;
  }
  content.testimonials.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "list-item list-item--plain";
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong> <span class="muted small">${item.role || ""}</span>
        ${item.published ? '<span class="pill pill--live">On the website</span>' : '<span class="pill">Hidden</span>'}
        <p class="small">${item.text || ""}</p>
        <p class="muted small">${item.rating ? "★".repeat(item.rating) : "No rating"}</p>
      </div>
      <div style="display:grid;gap:8px">
        <button type="button" class="btn btn--ghost btn--small" data-publish="${index}">${item.published ? "Hide" : "Publish"}</button>
        <button type="button" class="btn btn--danger btn--small" data-remove-testimonial="${index}">Remove</button>
      </div>`;
    list.appendChild(row);
  });
}

function renderTextFields() {
  const lang = $("#text-lang").value;
  const box = el("data-text-fields");
  box.replaceChildren();
  TEXT_FIELDS.forEach(([key, label, multiline]) => {
    const value = (content.text[key] && content.text[key][lang]) || "";
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `<label for="tf-${key}">${label}</label>` +
      (multiline
        ? `<textarea id="tf-${key}" data-text-key="${key}"></textarea>`
        : `<input id="tf-${key}" type="text" data-text-key="${key}">`);
    box.appendChild(wrap);
    wrap.querySelector("[data-text-key]").value = value;
  });
}

function renderPriceFields() {
  const box = el("data-price-fields");
  box.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "row";
  PRICE_FIELDS.forEach(([currency, plan, period, label]) => {
    const value = (content.prices[currency] && content.prices[currency][plan] && content.prices[currency][plan][period]) ?? "";
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `<label for="pf-${currency}-${plan}-${period}">${label}</label><input id="pf-${currency}-${plan}-${period}" type="number" step="0.01" min="0" data-price="${currency}|${plan}|${period}">`;
    grid.appendChild(wrap);
    wrap.querySelector("input").value = value;
  });
  box.appendChild(grid);
}

function renderAll() {
  renderPhotos();
  renderVideos();
  renderTestimonials();
  renderTextFields();
  renderPriceFields();
}

/* ---------- Collect edits before saving ---------- */
function collectEdits() {
  document.querySelectorAll("[data-caption]").forEach((input) => {
    content.gallery[Number(input.dataset.caption)].caption = input.value.trim();
  });
  const lang = $("#text-lang").value;
  document.querySelectorAll("[data-text-key]").forEach((input) => {
    const key = input.dataset.textKey;
    const value = input.value.trim();
    if (value) {
      content.text[key] = { ...(content.text[key] || {}), [lang]: value };
    } else if (content.text[key]) {
      delete content.text[key][lang];
      if (!Object.keys(content.text[key]).length) delete content.text[key];
    }
  });
  document.querySelectorAll("[data-price]").forEach((input) => {
    const [currency, plan, period] = input.dataset.price.split("|");
    const value = input.value.trim();
    if (value === "") return;
    content.prices[currency] = content.prices[currency] || {};
    content.prices[currency][plan] = content.prices[currency][plan] || {};
    content.prices[currency][plan][period] = Number(value);
  });
}

/* ---------- Events ---------- */
function initTabs() {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
      document.querySelectorAll("[data-panel-tab]").forEach((panel) => {
        panel.hidden = panel.dataset.panelTab !== btn.dataset.tab;
      });
    });
  });
}

function initLogin() {
  const status = el("data-login-status");
  el("data-login-btn").addEventListener("click", async () => {
    const candidate = $("#token").value.trim();
    if (!candidate) return setStatus(status, "Paste your key first.", "error");
    setStatus(status, "Checking…");
    try {
      await signIn(candidate, $("#remember").checked);
    } catch (err) {
      token = "";
      setStatus(status, err.message, "error");
    }
  });
  el("data-logout").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  });
}

function initPhotos() {
  const status = el("data-photo-status");
  el("data-upload-photos").addEventListener("click", async () => {
    const files = [...$("#photo-files").files];
    if (!files.length) return setStatus(status, "Choose at least one picture.", "error");
    const tooBig = files.find((f) => f.size > MAX_PHOTO_BYTES);
    if (tooBig) return setStatus(status, `"${tooBig.name}" is larger than 5 MB. Please use a smaller picture.`, "error");
    const caption = $("#photo-caption").value.trim();
    const button = el("data-upload-photos");
    button.disabled = true;
    try {
      for (const [i, file] of files.entries()) {
        setStatus(status, `Uploading ${i + 1} of ${files.length}…`);
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
          reader.readAsDataURL(file);
        });
        const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
        const path = `${PHOTO_DIR}/${Date.now()}-${safe}`;
        await uploadFile(path, base64, `Add training photo ${safe}`);
        content.gallery.unshift({ file: path, caption });
      }
      await saveContent("Update gallery from admin panel");
      $("#photo-files").value = "";
      $("#photo-caption").value = "";
      renderPhotos();
      setStatus(status, "Uploaded and published.", "ok");
    } catch (err) {
      setStatus(status, err.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  el("data-photo-list").addEventListener("click", (e) => {
    const remove = e.target.closest("[data-remove-photo]");
    const move = e.target.closest("[data-move]");
    if (remove) {
      content.gallery.splice(Number(remove.dataset.removePhoto), 1);
      renderPhotos();
    } else if (move) {
      const i = Number(move.dataset.move);
      if (i > 0) {
        [content.gallery[i - 1], content.gallery[i]] = [content.gallery[i], content.gallery[i - 1]];
        renderPhotos();
      }
    }
  });
}

function initVideos() {
  const status = el("data-video-status");
  el("data-add-video").addEventListener("click", () => {
    const url = $("#video-url").value.trim();
    const title = $("#video-title").value.trim();
    if (!url) return setStatus(status, "Paste the video link.", "error");
    if (!/^https?:\/\//i.test(url)) return setStatus(status, "The link should start with https://", "error");
    if (!title) return setStatus(status, "Give the video a title.", "error");
    const featured = $("#video-featured").checked;
    if (featured) content.videos.forEach((v) => (v.featured = false));
    content.videos.unshift({ url, title, note: $("#video-note").value.trim(), featured });
    $("#video-url").value = "";
    $("#video-title").value = "";
    $("#video-note").value = "";
    $("#video-featured").checked = false;
    renderVideos();
    setStatus(status, "Added. Press 'Save and publish' when you're done.", "ok");
  });

  el("data-video-list").addEventListener("click", (e) => {
    const feature = e.target.closest("[data-feature]");
    const remove = e.target.closest("[data-remove-video]");
    if (feature) {
      const i = Number(feature.dataset.feature);
      const makeFeatured = !content.videos[i].featured;
      content.videos.forEach((v) => (v.featured = false));
      content.videos[i].featured = makeFeatured;
      renderVideos();
    } else if (remove) {
      content.videos.splice(Number(remove.dataset.removeVideo), 1);
      renderVideos();
    }
  });
}

function initTestimonials() {
  const status = el("data-testimonial-status");
  el("data-add-testimonial").addEventListener("click", () => {
    const name = $("#t-name").value.trim();
    const text = $("#t-text").value.trim();
    if (!name || !text) return setStatus(status, "Name and testimonial text are both needed.", "error");
    content.testimonials.unshift({
      name,
      role: $("#t-role").value.trim(),
      text,
      rating: Number($("#t-rating").value),
      published: $("#t-published").checked,
    });
    $("#t-name").value = "";
    $("#t-role").value = "";
    $("#t-text").value = "";
    renderTestimonials();
    setStatus(status, "Added. Press 'Save and publish' when you're done.", "ok");
  });

  el("data-testimonial-list").addEventListener("click", (e) => {
    const publish = e.target.closest("[data-publish]");
    const remove = e.target.closest("[data-remove-testimonial]");
    if (publish) {
      const i = Number(publish.dataset.publish);
      content.testimonials[i].published = !content.testimonials[i].published;
      renderTestimonials();
    } else if (remove) {
      content.testimonials.splice(Number(remove.dataset.removeTestimonial), 1);
      renderTestimonials();
    }
  });
}

function initTextTab() {
  $("#text-lang").addEventListener("change", () => {
    collectEdits();
    renderTextFields();
  });
}

function initSave() {
  const status = el("data-save-status");
  el("data-save").addEventListener("click", async () => {
    const button = el("data-save");
    button.disabled = true;
    setStatus(status, "Saving…");
    try {
      collectEdits();
      await saveContent("Update website content from admin panel");
      setStatus(status, "Saved. The website updates in about a minute.", "ok");
    } catch (err) {
      setStatus(status, err.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

initTabs();
initLogin();
initPhotos();
initVideos();
initTestimonials();
initTextTab();
initSave();

const savedToken = localStorage.getItem(TOKEN_KEY);
if (savedToken) {
  signIn(savedToken, true).catch((err) => {
    token = "";
    localStorage.removeItem(TOKEN_KEY);
    setStatus(el("data-login-status"), err.message, "error");
  });
}
