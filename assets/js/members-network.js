/*
 * The network pages: the member directory with introduction requests
 * (members/directory.html) and the LinkedIn pod (members/pod.html).
 *
 * The directory holds no email address, phone number or LinkedIn link, by
 * design: members see who is in the room, and only Mariam connects them.
 * Supabase enforces that, not this file.
 */
import { sb, configured, t, setStatus } from "./members.js";

const el = (sel) => document.querySelector(sel);
const mode = document.body.dataset.member || "";

/* ---------- directory ---------- */
async function initDirectory() {
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    window.location.replace("login.html");
    return;
  }
  const me = sessionData.session.user;

  const loading = el("[data-dir-loading]");
  const main = el("[data-dir-main]");
  const locked = el("[data-dir-locked]");
  const list = el("[data-dir-list]");
  const search = el("[data-dir-search]");
  const form = el("[data-form=profile]");
  const quotaOut = el("[data-intro-quota]");

  const [{ data: memberships }, { data: mine }, { data: used }] = await Promise.all([
    sb.from("memberships").select("product, tier, status, expires_at").eq("status", "active"),
    sb.from("directory_profiles").select("*").eq("user_id", me.id).maybeSingle(),
    sb.from("intro_requests").select("id, created_at").gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);

  const live = (memberships || []).filter((m) => !m.expires_at || new Date(m.expires_at) > new Date());
  const isBeyond = live.some((m) => m.product === "community" && m.tier === "beyond");

  if (loading) loading.hidden = true;
  if (!isBeyond) {
    if (locked) locked.hidden = false;
    return;
  }
  if (main) main.hidden = false;

  /* my own card in the directory */
  if (mine && form) {
    form.display_name.value = mine.display_name || "";
    form.country.value = mine.country || "";
    form.city.value = mine.city || "";
    form.industry.value = mine.industry || "";
    form.headline.value = mine.headline || "";
    form.looking_for.value = mine.looking_for || "";
    form.can_offer.value = mine.can_offer || "";
    form.listed.checked = Boolean(mine.listed);
  }

  if (form) {
    const status = el("[data-profile-status]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.display_name.value.trim()) return setStatus(status, t("dir.error.name"), "error");
      setStatus(status, t("login.working"));
      const { error } = await sb.from("directory_profiles").upsert({
        user_id: me.id,
        display_name: form.display_name.value.trim(),
        country: form.country.value.trim(),
        city: form.city.value.trim(),
        industry: form.industry.value.trim(),
        headline: form.headline.value.trim(),
        looking_for: form.looking_for.value.trim(),
        can_offer: form.can_offer.value.trim(),
        listed: form.listed.checked,
        updated_at: new Date().toISOString(),
      });
      setStatus(status, error ? error.message : t("dir.saved"), error ? "error" : "success");
      if (!error) load();
    });
  }

  const quotaLeft = Math.max(0, 3 - (used || []).length);
  if (quotaOut) quotaOut.textContent = t("dir.quota", { n: quotaLeft });

  let people = [];

  async function load() {
    const { data } = await sb
      .from("directory_profiles")
      .select("user_id, display_name, country, city, industry, headline, looking_for, can_offer")
      .eq("listed", true)
      .order("updated_at", { ascending: false });
    people = (data || []).filter((p) => p.user_id !== me.id);
    render();
  }

  function render() {
    const term = (search && search.value ? search.value : "").toLowerCase().trim();
    const shown = term
      ? people.filter((p) =>
          [p.country, p.city, p.industry, p.headline, p.looking_for, p.can_offer, p.display_name]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : people;

    list.innerHTML = "";
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = t("dir.empty");
      list.append(empty);
      return;
    }
    shown.forEach((person) => list.append(personCard(person)));
  }

  function personCard(person) {
    const card = document.createElement("article");
    card.className = "person";

    const name = document.createElement("h3");
    name.textContent = person.display_name;
    card.append(name);

    const where = [person.city, person.country, person.industry].filter(Boolean).join(" · ");
    if (where) {
      const meta = document.createElement("p");
      meta.className = "person__meta";
      meta.textContent = where;
      card.append(meta);
    }
    if (person.headline) {
      const line = document.createElement("p");
      line.textContent = person.headline;
      card.append(line);
    }
    [
      ["dir.looking", person.looking_for],
      ["dir.offers", person.can_offer],
    ].forEach(([key, value]) => {
      if (!value) return;
      const row = document.createElement("p");
      row.className = "person__row";
      const label = document.createElement("strong");
      label.textContent = `${t(key)} `;
      row.append(label, document.createTextNode(value));
      card.append(row);
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn--ghost btn--sm";
    button.textContent = t("dir.request");
    button.addEventListener("click", () => openRequest(person, card, button));
    card.append(button);
    return card;
  }

  function openRequest(person, card, button) {
    if (card.querySelector(".intro-form")) return;
    button.hidden = true;

    const box = document.createElement("form");
    box.className = "intro-form";
    const label = document.createElement("label");
    label.textContent = t("dir.why");
    const area = document.createElement("textarea");
    area.rows = 3;
    area.required = true;
    label.append(area);
    const send = document.createElement("button");
    send.type = "submit";
    send.className = "btn btn--primary btn--sm";
    send.textContent = t("dir.send");
    const status = document.createElement("p");
    status.className = "form-status";
    box.append(label, send, status);

    box.addEventListener("submit", async (e) => {
      e.preventDefault();
      const reason = area.value.trim();
      if (!reason) return setStatus(status, t("dir.error.why"), "error");
      send.disabled = true;
      setStatus(status, t("login.working"));
      const { error } = await sb.from("intro_requests").insert({
        requester: me.id,
        target: person.user_id,
        reason,
      });
      send.disabled = false;
      if (error) {
        // The quota is enforced by the database, so this is the usual refusal.
        setStatus(status, t("dir.error.quota"), "error");
        return;
      }
      // Also email Mariam, through the same script the website forms use.
      if (window.BBB && window.BBB.notify) {
        window.BBB.notify("intro-request", {
          name: (mine && mine.display_name) || me.email,
          email: me.email,
          message: `Introduction to ${person.display_name}: ${reason}`,
          topic: "Introduction request",
        });
      }
      box.innerHTML = "";
      const done = document.createElement("p");
      done.className = "form-status";
      done.dataset.state = "success";
      done.textContent = t("dir.sent");
      box.append(done);
    });

    card.append(box);
    area.focus();
  }

  if (search) search.addEventListener("input", render);
  await load();
}

/* ---------- the LinkedIn pod ---------- */
async function initPod() {
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    window.location.replace("login.html");
    return;
  }
  const me = sessionData.session.user;

  const loading = el("[data-pod-loading]");
  const main = el("[data-pod-main]");
  const locked = el("[data-pod-locked]");
  const list = el("[data-pod-list]");
  const form = el("[data-form=pod]");
  const status = el("[data-pod-status]");

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    sb.from("memberships").select("status, expires_at").eq("status", "active"),
    sb.from("profiles").select("full_name").eq("id", me.id).maybeSingle(),
  ]);
  const live = (memberships || []).filter((m) => !m.expires_at || new Date(m.expires_at) > new Date());

  if (loading) loading.hidden = true;
  if (!live.length) {
    if (locked) locked.hidden = false;
    return;
  }
  if (main) main.hidden = false;

  const firstName = ((profile && profile.full_name) || me.email || "").split(" ")[0];

  async function load() {
    const since = new Date(Date.now() - 48 * 36e5).toISOString();
    const { data } = await sb
      .from("pod_posts")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    const posts = data || [];
    list.innerHTML = "";
    if (!posts.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = t("pod.empty");
      list.append(empty);
      return;
    }
    posts.forEach((post) => {
      const card = document.createElement("article");
      card.className = "pod-post";

      const who = document.createElement("p");
      who.className = "pod-post__who";
      who.textContent = `${post.display_name || t("pod.member")} · ${timeAgo(post.created_at)}`;
      card.append(who);

      if (post.note) {
        const note = document.createElement("p");
        note.textContent = post.note;
        card.append(note);
      }

      const open = document.createElement("a");
      open.className = "btn btn--ghost btn--sm";
      open.href = post.url;
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = t("pod.open");
      card.append(open);

      if (post.user_id === me.id) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "link-button";
        remove.textContent = t("pod.remove");
        remove.addEventListener("click", async () => {
          await sb.from("pod_posts").delete().eq("id", post.id);
          load();
        });
        card.append(remove);
      }
      list.append(card);
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = form.url.value.trim();
      if (!/^https?:\/\/(www\.)?linkedin\.com\//i.test(url)) return setStatus(status, t("pod.error.url"), "error");
      setStatus(status, t("login.working"));
      const { error } = await sb.from("pod_posts").insert({
        user_id: me.id,
        display_name: firstName,
        url,
        note: form.note.value.trim() || null,
      });
      if (error) return setStatus(status, t("pod.error.today"), "error");
      setStatus(status, t("pod.added"), "success");
      form.reset();
      load();
    });
  }

  await load();
}

function timeAgo(iso) {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 36e5);
  if (hours < 1) return t("pod.now");
  return t("pod.hours", { n: hours });
}

if (configured) {
  if (mode === "directory") initDirectory();
  else if (mode === "pod") initPod();
}
