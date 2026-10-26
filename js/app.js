/* Influencer Desk — front-end logic
   Talks to Supabase (PostgreSQL) via @supabase/supabase-js.
   Imports CSV and Excel via SheetJS (XLSX). Vanilla JS, no framework. */

(function () {
  "use strict";

  const STATUSES = ["New", "Contacted", "Negotiating", "Confirmed", "Posted", "Rejected"];
  const STATUS_COLOR = {
    New: "var(--info)", Contacted: "var(--warn)", Negotiating: "var(--accent)",
    Confirmed: "var(--ok)", Posted: "var(--ok)", Rejected: "var(--stop)"
  };
  const CATEGORIES = ["Fashion", "Beauty & Skincare", "Fitness", "Food", "Lifestyle",
    "Travel", "Tech", "Comedy", "Health", "Finance", "Other"];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const fmtNum = (n) => (n || n === 0) && !isNaN(n) ? Number(n).toLocaleString("en-IN") : "—";

  let sb = null;                 // Supabase client
  let records = [];              // [{id, handle, ...}]
  let sortKey = "handle", sortDir = "asc";
  let activeStatus = "", activeCat = "", query = "";

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    // status filter options
    STATUSES.forEach(s => $("statusFilter").insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`));
    bindUI();

    // Validate config
    const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if (!url || !key || url.includes("YOUR-PROJECT") || key.includes("YOUR-ANON")) {
      $("banner").innerHTML = `<div class="banner warn">
        <span>⚙️</span>
        <span>Supabase isn’t configured yet. Open <code>js/config.js</code> and paste your Project URL and anon key.
        Until then the app can’t load or save data. See <code>README.md</code> for the 5-minute setup.</span></div>`;
      renderEmptyShell("Connect Supabase to begin", "Add your project URL and anon key in js/config.js.");
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      showError("Couldn’t load the Supabase library (CDN blocked?). Check your connection and reload.");
      return;
    }
    sb = window.supabase.createClient(url, key);
    renderLoading();
    load();
  }

  // ---------- data ----------
  async function load() {
    try {
      const { data, error } = await sb.from("influencers").select("*");
      if (error) throw error;
      records = data || [];
      render();
    } catch (e) {
      showError(describe(e));
    }
  }

  function describe(e) {
    const msg = (e && (e.message || e.error_description || e.hint)) || "Unknown error";
    if (/relation .* does not exist/i.test(msg) || /schema cache/i.test(msg))
      return "The 'influencers' table wasn’t found. Run schema.sql in the Supabase SQL editor first.";
    if (/JWT|apikey|invalid/i.test(msg)) return "Supabase rejected the key. Double-check the anon key in js/config.js.";
    if (/row-level security|rls|policy/i.test(msg)) return "Blocked by Row Level Security. Add the read/write policy from schema.sql.";
    return msg;
  }

  function showError(text) {
    $("banner").innerHTML = `<div class="banner err"><span>⚠️</span><span>${esc(text)}</span></div>`;
    renderEmptyShell("Something went wrong", text);
  }

  // ---------- derived ----------
  function filtered() {
    let out = records.slice();
    if (activeStatus) out = out.filter(r => r.status === activeStatus);
    if (activeCat) out = out.filter(r => r.category === activeCat);
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(r =>
        (r.handle || "").toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q));
    }
    out.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "followers" || sortKey === "rate") {
        av = Number(av) || 0; bv = Number(bv) || 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      av = (av || "").toString().toLowerCase();
      bv = (bv || "").toString().toLowerCase();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return out;
  }

  // ---------- render ----------
  function renderLoading() {
    $("emptyState").innerHTML = `<div class="state"><div class="spinner"></div><p>Loading your roster…</p></div>`;
    $("rows").innerHTML = "";
  }
  function renderEmptyShell(title, body) {
    $("rows").innerHTML = "";
    $("emptyState").innerHTML = `<div class="state"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
  }

  function render() {
    renderTiles();
    renderFilters();
    const rows = filtered();
    const tbody = $("rows");
    const empty = $("emptyState");

    $("count").textContent = records.length ? `${rows.length} of ${records.length} shown` : "";

    if (!records.length) {
      tbody.innerHTML = "";
      empty.innerHTML = `<div class="state">
        <h3>No influencers yet</h3>
        <p>Add your first creator, or import a CSV / Excel file. Each entry tracks contact, category, followers, rate and deal status.</p>
        <button class="btn primary" data-act="add">Add influencer</button></div>`;
      empty.querySelector("[data-act=add]").onclick = () => openForm();
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = "";
      empty.innerHTML = `<div class="state"><h3>No matches</h3><p>No one fits the current search or filters.</p>
        <button class="btn ghost" data-act="clear">Clear filters</button></div>`;
      empty.querySelector("[data-act=clear]").onclick = clearFilters;
      return;
    }
    empty.innerHTML = "";

    document.querySelectorAll("thead th[data-sort]").forEach(th => {
      const k = th.getAttribute("data-sort");
      const a = th.querySelector(".arrow");
      th.classList.toggle("sorted", k === sortKey);
      if (a) a.textContent = (k === sortKey) ? (sortDir === "asc" ? "▲" : "▼") : "";
    });

    tbody.innerHTML = rows.map(r => {
      const initials = (r.handle || "?").replace(/[^a-z0-9]/gi, "").slice(0, 2) || "?";
      const st = STATUSES.includes(r.status) ? r.status : "New";
      return `<tr>
        <td><div class="handle">
          <div class="avatar" style="background:${STATUS_COLOR[st]}">${esc(initials)}</div>
          <div>
            <a href="https://instagram.com/${encodeURIComponent(r.handle || "")}" target="_blank" rel="noopener">@${esc(r.handle || "")}</a>
            ${r.name ? `<div class="realname">${esc(r.name)}</div>` : ``}
          </div></div></td>
        <td>${r.category ? `<span class="cat">${esc(r.category)}</span>` : `<span class="muted-dash">—</span>`}</td>
        <td class="num">${fmtNum(r.followers)}</td>
        <td class="email-cell ${r.email ? "" : "empty"}">${r.email ? esc(r.email) : "—"}</td>
        <td class="num">${r.rate ? "₹" + fmtNum(r.rate) : "—"}</td>
        <td><span class="pill s-${st}">${esc(st)}</span></td>
        <td><div class="rowbtns">
          <button class="iconbtn" title="Edit" data-edit="${r.id}" aria-label="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="iconbtn danger" title="Delete" data-del="${r.id}" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
        </div></td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openForm(b.getAttribute("data-edit")));
    tbody.querySelectorAll("[data-del]").forEach(b => b.onclick = () => askDelete(b.getAttribute("data-del")));
  }

  function renderTiles() {
    const c = { total: records.length };
    STATUSES.forEach(s => c[s] = records.filter(r => r.status === s).length);
    const tiles = [
      { key: "", label: "Total", val: c.total, color: "var(--accent)" },
      { key: "Contacted", label: "Contacted", val: c.Contacted, color: STATUS_COLOR.Contacted },
      { key: "Negotiating", label: "Negotiating", val: c.Negotiating, color: STATUS_COLOR.Negotiating },
      { key: "Confirmed", label: "Confirmed", val: c.Confirmed, color: STATUS_COLOR.Confirmed },
      { key: "Posted", label: "Posted", val: c.Posted, color: STATUS_COLOR.Posted },
    ];
    $("tiles").innerHTML = tiles.map(t => `
      <div class="tile ${t.key && t.key === activeStatus ? "active" : ""}" data-status="${t.key}">
        <div class="k"><span class="swatch" style="background:${t.color}"></span>${t.label}</div>
        <div class="v">${t.val}</div></div>`).join("");
    document.querySelectorAll(".tile").forEach(el => el.onclick = () => {
      const s = el.getAttribute("data-status");
      activeStatus = (s === activeStatus) ? "" : s;
      $("statusFilter").value = activeStatus;
      render();
    });
  }

  function renderFilters() {
    const cf = $("catFilter");
    const cats = Array.from(new Set(records.map(r => r.category).filter(Boolean))).sort();
    cf.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    cf.value = activeCat;
  }

  // ---------- UI wiring ----------
  function bindUI() {
    $("addBtn").onclick = () => openForm();
    $("importBtn").onclick = openImport;
    $("fileInput").onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; };
    $("search").addEventListener("input", e => { query = e.target.value.trim(); render(); });
    $("catFilter").addEventListener("change", e => { activeCat = e.target.value; render(); });
    $("statusFilter").addEventListener("change", e => { activeStatus = e.target.value; render(); });
    document.querySelectorAll("thead th[data-sort]").forEach(th => {
      th.onclick = () => {
        const k = th.getAttribute("data-sort");
        if (k === sortKey) sortDir = sortDir === "asc" ? "desc" : "asc";
        else { sortKey = k; sortDir = (k === "followers" || k === "rate") ? "desc" : "asc"; }
        render();
      };
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  }

  function clearFilters() {
    query = ""; activeStatus = ""; activeCat = "";
    $("search").value = ""; $("statusFilter").value = ""; $("catFilter").value = "";
    render();
  }

  // ---------- add / edit ----------
  function openForm(id) {
    const r = id ? records.find(x => String(x.id) === String(id)) : null;
    const catOpts = CATEGORIES.map(c => `<option value="${c}" ${r && r.category === c ? "selected" : ""}>${c}</option>`).join("");
    const stOpts = STATUSES.map(s => `<option value="${s}" ${(r ? r.status : "New") === s ? "selected" : ""}>${s}</option>`).join("");
    const scrim = modal(`
      <div class="modal" role="dialog" aria-modal="true" aria-label="${r ? "Edit influencer" : "Add influencer"}">
        <header><h2>${r ? "Edit influencer" : "Add influencer"}</h2>
          <button class="iconbtn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>
        <div class="body">
          <div class="field"><label for="f_handle">Instagram handle *</label>
            <input id="f_handle" type="text" placeholder="username" value="${esc(r ? r.handle : "")}">
            <span class="hint">Without the @ — e.g. sanketthite_</span></div>
          <div class="field"><label for="f_name">Name</label>
            <input id="f_name" type="text" placeholder="Full name" value="${esc(r ? r.name : "")}"></div>
          <div class="field row2">
            <div class="field"><label for="f_cat">Category</label><select id="f_cat"><option value="">—</option>${catOpts}</select></div>
            <div class="field"><label for="f_status">Status</label><select id="f_status">${stOpts}</select></div>
          </div>
          <div class="field row2">
            <div class="field"><label for="f_followers">Followers</label><input id="f_followers" type="number" min="0" placeholder="e.g. 25000" value="${r && r.followers != null ? esc(r.followers) : ""}"></div>
            <div class="field"><label for="f_rate">Rate (₹)</label><input id="f_rate" type="number" min="0" placeholder="e.g. 8000" value="${r && r.rate != null ? esc(r.rate) : ""}"></div>
          </div>
          <div class="field"><label for="f_email">Email</label><input id="f_email" type="email" placeholder="name@email.com" value="${esc(r ? r.email : "")}"></div>
          <div class="field"><label for="f_notes">Notes</label><textarea id="f_notes" placeholder="Last contact, deliverables, preferences…">${esc(r ? r.notes : "")}</textarea></div>
        </div>
        <footer><button class="btn ghost" data-close>Cancel</button>
          <button class="btn primary" id="saveBtn">${r ? "Save changes" : "Add influencer"}</button></footer>
      </div>`);
    $("f_handle").focus();
    $("saveBtn").onclick = () => saveForm(id);
    scrim.querySelectorAll("input").forEach(inp => inp.addEventListener("keydown", e => { if (e.key === "Enter") saveForm(id); }));
  }

  async function saveForm(id) {
    const handle = $("f_handle").value.trim().replace(/^@/, "");
    if (!handle) { $("f_handle").focus(); $("f_handle").style.borderColor = "var(--stop)"; return; }
    const body = {
      handle,
      name: $("f_name").value.trim(),
      category: $("f_cat").value,
      status: $("f_status").value || "New",
      followers: $("f_followers").value ? Number($("f_followers").value) : null,
      rate: $("f_rate").value ? Number($("f_rate").value) : null,
      email: $("f_email").value.trim(),
      notes: $("f_notes").value.trim(),
    };
    const btn = $("saveBtn"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      if (id) {
        const { error } = await sb.from("influencers").update(body).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("influencers").insert(body);
        if (error) throw error;
      }
      closeModal();
      await load();
    } catch (e) {
      btn.disabled = false; btn.textContent = id ? "Save changes" : "Add influencer";
      const msg = (e && e.message) || "";
      btn.textContent = /duplicate|unique/i.test(msg) ? "Handle already exists" : "Couldn’t save — retry";
    }
  }

  // ---------- delete ----------
  function askDelete(id) {
    const r = records.find(x => String(x.id) === String(id));
    if (!r) return;
    modal(`<div class="modal" role="dialog" aria-modal="true" style="max-width:420px">
        <header><h2>Remove influencer?</h2></header>
        <div class="body"><p style="margin:0;color:var(--muted)">Remove <strong style="color:var(--fg)">@${esc(r.handle)}</strong> from your roster? This can’t be undone.</p></div>
        <footer><button class="btn ghost grow" data-close>Cancel</button>
          <button class="btn primary" style="background:var(--stop);border-color:var(--stop)" id="delBtn">Remove</button></footer></div>`);
    $("delBtn").onclick = async () => {
      $("delBtn").disabled = true; $("delBtn").textContent = "Removing…";
      try { const { error } = await sb.from("influencers").delete().eq("id", id); if (error) throw error; closeModal(); await load(); }
      catch (e) { $("delBtn").disabled = false; $("delBtn").textContent = "Retry"; }
    };
  }

  // ---------- import CSV / Excel ----------
  function openImport() {
    modal(`<div class="modal" role="dialog" aria-modal="true" aria-label="Import influencers">
        <header><h2>Import CSV / Excel</h2>
          <button class="iconbtn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>
        <div class="body">
          <div class="dropzone" id="dz">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0-12 4 4m-4-4-4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
            <div><strong>Click to choose</strong> or drag a file here</div>
            <div class="import-note">.csv, .xlsx or .xls</div>
          </div>
          <div class="import-preview">
            Expected columns (any order, case-insensitive): <strong>handle</strong> (required), name, category,
            followers, email, rate, status, notes. A single column of handles also works.
            <div class="import-note">Rows are matched on handle — an existing handle is updated, a new one is added.</div>
          </div>
          <div id="importMsg"></div>
        </div>
        <footer><button class="btn ghost grow" data-close>Close</button></footer></div>`);
    const dz = $("dz");
    dz.onclick = () => $("fileInput").click();
    dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
    dz.addEventListener("drop", e => {
      e.preventDefault(); dz.classList.remove("drag");
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  function handleFile(file) {
    const msg = $("importMsg");
    const setMsg = (cls, html) => { if (msg) msg.innerHTML = `<div class="banner ${cls}" style="margin:12px 0 0">${html}</div>`; };
    if (msg) setMsg("warn", "Reading file…");
    const reader = new FileReader();
    reader.onerror = () => setMsg("err", "Couldn’t read that file.");
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const rows = normalizeRows(raw);
        if (!rows.length) { setMsg("err", "No usable rows found — need at least a <strong>handle</strong> column."); return; }
        setMsg("warn", `Importing ${rows.length} row(s)…`);
        const { error } = await sb.from("influencers").upsert(rows, { onConflict: "handle" });
        if (error) throw error;
        setMsg("ok", `Imported ${rows.length} influencer(s). ✓`);
        await load();
        setTimeout(closeModal, 900);
      } catch (err) {
        setMsg("err", esc(describe(err)));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Map arbitrary spreadsheet rows to our column set
  function normalizeRows(raw) {
    const pick = (obj, keys) => {
      for (const k of Object.keys(obj)) {
        const norm = k.toLowerCase().replace(/[^a-z]/g, "");
        if (keys.includes(norm)) return obj[k];
      }
      return "";
    };
    const out = [];
    for (const row of raw) {
      let handle = String(pick(row, ["handle", "instagramhandle", "username", "instagram", "ig"]) || "").trim().replace(/^@/, "");
      // Fallback: a bare single-column sheet with no recognizable header
      if (!handle) {
        const vals = Object.values(row).map(v => String(v).trim()).filter(Boolean);
        if (vals.length === 1) handle = vals[0].replace(/^@/, "");
      }
      if (!handle) continue;

      const statusRaw = String(pick(row, ["status", "stage"]) || "").trim();
      const status = STATUSES.find(s => s.toLowerCase() === statusRaw.toLowerCase()) || "New";
      const toInt = (v) => { const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10); return isNaN(n) ? null : n; };

      out.push({
        handle,
        name: String(pick(row, ["name", "fullname", "creator"]) || "").trim(),
        category: String(pick(row, ["category", "niche", "type"]) || "").trim(),
        followers: toInt(pick(row, ["followers", "followercount", "follower"])),
        email: String(pick(row, ["email", "mail", "contact"]) || "").trim(),
        rate: toInt(pick(row, ["rate", "price", "cost", "fee"])),
        status,
        notes: String(pick(row, ["notes", "note", "remarks", "comment"]) || "").trim(),
      });
    }
    // de-dupe within the file (keep last)
    const map = new Map();
    out.forEach(r => map.set(r.handle, r));
    return Array.from(map.values());
  }

  // ---------- modal helpers ----------
  function modal(html) {
    closeModal();
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = html;
    document.body.appendChild(scrim);
    scrim.addEventListener("mousedown", e => { if (e.target === scrim) closeModal(); });
    scrim.querySelectorAll("[data-close]").forEach(b => b.onclick = closeModal);
    return scrim;
  }
  function closeModal() { const s = document.querySelector(".scrim"); if (s) s.remove(); }
})();
