/*
 * Protected viewer (members/view.html).
 *
 * A material opens here instead of being handed over as a file:
 *   - the file is fetched with a link that lives for two minutes and is never
 *     put in the page, so there is no address anyone can copy or forward;
 *   - PDFs are drawn onto a canvas, so there is no PDF file in the browser;
 *   - every page carries the member's own email address as a watermark.
 *
 * Nothing shown on a screen can be made impossible to copy. The point is that
 * passing it on is inconvenient and traceable back to one member.
 */
import { sb, configured, t, setStatus } from "./members.js";

const el = (sel) => document.querySelector(sel);

async function run() {
  const titleOut = el("[data-view-title]");
  const descOut = el("[data-view-description]");
  const noteOut = el("[data-view-note]");
  const status = el("[data-view-status]");
  const viewer = el("[data-viewer]");
  const actions = el("[data-view-actions]");

  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    window.location.replace("login.html");
    return;
  }
  const email = sessionData.session.user.email || "";

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return fail(titleOut, status);

  // The security rules only return this row if the member's plan covers it.
  const { data: material, error } = await sb.from("materials").select("*").eq("id", id).maybeSingle();
  if (error || !material) return fail(titleOut, status);

  titleOut.textContent = material.title;
  document.title = `${material.title} | Business Beyond Borders`;
  if (material.description) descOut.textContent = material.description;
  setStatus(status, "");

  if (material.kind !== "file" || !material.storage_path) {
    // Videos and links are not files: send them on their way.
    if (material.url) window.location.replace(material.url);
    return;
  }

  noteOut.hidden = false;
  setStatus(status, t("view.loading"));

  const { data: signed, error: signError } = await sb.storage
    .from("member-files")
    .createSignedUrl(material.storage_path, 120);
  if (signError || !signed) return fail(titleOut, status);

  let bytes;
  try {
    const res = await fetch(signed.signedUrl);
    if (!res.ok) throw new Error(String(res.status));
    bytes = await res.arrayBuffer();
  } catch (e) {
    return fail(titleOut, status);
  }

  const name = material.storage_path.toLowerCase();
  viewer.hidden = false;
  // Right-click "save as" is the first thing people try.
  viewer.addEventListener("contextmenu", (e) => e.preventDefault());

  if (name.endsWith(".pdf")) {
    await renderPdf(bytes, viewer, email, status);
  } else if (/\.(png|jpe?g|webp|gif|avif)$/.test(name)) {
    renderImage(bytes, viewer, email, status);
  } else {
    // Anything we cannot draw (slides, spreadsheets) can only be handed over.
    setStatus(status, t("view.unsupported"), "error");
  }

  if (material.allow_download) {
    actions.hidden = false;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn--ghost btn--sm";
    button.textContent = t("hub.download");
    button.addEventListener("click", async () => {
      const { data: fresh } = await sb.storage
        .from("member-files")
        .createSignedUrl(material.storage_path, 60, { download: true });
      if (fresh) window.location.assign(fresh.signedUrl);
    });
    actions.append(button);
  }
}

function fail(titleOut, status) {
  titleOut.textContent = t("view.error.title");
  setStatus(status, t("view.error"), "error");
}

/* Draw each page onto a canvas, then stamp the member's email across it. */
async function renderPdf(bytes, viewer, email, status) {
  if (!window.pdfjsLib) {
    setStatus(status, t("view.error"), "error");
    return;
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  let pdf;
  try {
    pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  } catch (e) {
    setStatus(status, t("view.error"), "error");
    return;
  }

  const width = Math.min(viewer.clientWidth || 900, 1100);
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // Draw at twice the size so the text stays sharp on good screens.
    const scale = (width / base.width) * 2;
    const viewport = page.getViewport({ scale });

    const wrap = document.createElement("div");
    wrap.className = "viewer__page";
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = "100%";
    wrap.append(canvas);
    wrap.append(watermark(email));
    viewer.append(wrap);

    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  }
  setStatus(status, t("view.pages", { n: pdf.numPages }));
}

function renderImage(bytes, viewer, email, status) {
  const url = URL.createObjectURL(new Blob([bytes]));
  const wrap = document.createElement("div");
  wrap.className = "viewer__page";
  const img = new Image();
  img.alt = "";
  img.draggable = false;
  img.style.width = "100%";
  img.onload = () => URL.revokeObjectURL(url);
  img.src = url;
  wrap.append(img, watermark(email));
  viewer.append(wrap);
  setStatus(status, "");
}

// Repeated, faint, and impossible to pick off a screenshot.
function watermark(email) {
  const mark = document.createElement("div");
  mark.className = "viewer__mark";
  mark.setAttribute("aria-hidden", "true");
  const line = `${email} · ${new Date().toLocaleDateString()}`;
  for (let i = 0; i < 24; i += 1) {
    const span = document.createElement("span");
    span.textContent = line;
    mark.append(span);
  }
  return mark;
}

// members.js shows the "opens soon" panel when there is nothing to connect to.
if (configured) run();
