/* NC Resources — client-side filter + render
 *
 * Loads /data.json once on first page load, keeps the dataset in memory,
 * and re-renders results as the user changes the City/County or Need filter.
 *
 * Designed to feel instant on a modest phone: results are rendered in batches
 * with requestAnimationFrame so the UI never blocks even on the worst-case
 * "show me every Food Bank in NC" query.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const placeTypeEl = $("placeType");
  const placeValueEl = $("placeValue");
  const bucketEl = $("bucket");
  const clearBtn = $("clear");
  const statusEl = $("status");
  const resultsEl = $("results");
  const dataDateEl = $("data-date");

  const RENDER_BATCH = 20;
  let dataset = null;
  let renderToken = 0; // bumped each render so stale batches abort

  function setStatus(html) {
    statusEl.innerHTML = html;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readState() {
    return {
      placeType: placeTypeEl.value,           // "city" | "county"
      placeValue: placeValueEl.value || "",   // "" = any
      bucket: bucketEl.value || "",           // "" = any
    };
  }

  function urlFromState(s) {
    const params = new URLSearchParams();
    if (s.placeType !== "city") params.set("place", s.placeType);
    if (s.placeValue) params.set(s.placeType, s.placeValue);
    if (s.bucket) params.set("need", s.bucket);
    const qs = params.toString();
    return qs ? `?${qs}` : "/";
  }

  function stateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const s = { placeType: "city", placeValue: "", bucket: "" };
    if (params.get("place") === "county") s.placeType = "county";
    s.placeValue = params.get(s.placeType) || "";
    s.bucket = params.get("need") || "";
    return s;
  }

  // Compute facet counts that account for the OTHER active filters.
  //   - For the bucket dropdown: count rows that match the current place filter
  //     (but ignore the bucket filter so each bucket shows its own potential count).
  //   - For the place dropdown: count rows that match the current bucket filter.
  // This way the (count) next to "Food & Meals" reflects what you'll actually see
  // once you click it, given everything else you've already picked.
  function computeFacetCounts(state) {
    const placeKey = state.placeType === "county" ? "county" : "city";
    const buckets = Object.create(null);
    const places = Object.create(null);

    for (const r of dataset.rows) {
      const matchesPlace = !state.placeValue || (r[placeKey] || "") === state.placeValue;
      const matchesBucket = !state.bucket || (r.bucket || "") === state.bucket;

      // Bucket count: ignore current bucket selection (we want each option's reachable count)
      if (matchesPlace) {
        const b = r.bucket || "Other";
        buckets[b] = (buckets[b] || 0) + 1;
      }

      // Place count: ignore current place selection
      if (matchesBucket) {
        const p = r[placeKey];
        if (p) places[p] = (places[p] || 0) + 1;
      }
    }
    return { buckets, places };
  }

  function populateFacets(state) {
    const facets = dataset.facets;
    const counts = computeFacetCounts(state);

    // ---- Place dropdown: cities OR counties, only those with non-zero matches
    // (always keep the currently-selected one visible, even if it would now be 0)
    const fullList = state.placeType === "county" ? facets.counties : facets.cities;
    const totalForPlaceholder = Object.values(counts.places).reduce((a, b) => a + b, 0);
    const placeholder = state.placeType === "county"
      ? `Any county  (${totalForPlaceholder})`
      : `Any city  (${totalForPlaceholder})`;

    placeValueEl.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    placeValueEl.appendChild(empty);

    for (const v of fullList) {
      const n = counts.places[v] || 0;
      // hide places with 0 matches under the current bucket filter,
      // but keep the currently-selected one so the user always sees their pick
      if (n === 0 && v !== state.placeValue) continue;
      const o = document.createElement("option");
      o.value = v;
      o.textContent = `${v}  (${n})`;
      if (v === state.placeValue) o.selected = true;
      placeValueEl.appendChild(o);
    }

    // ---- Bucket dropdown: every bucket with its (place-filtered) count
    bucketEl.innerHTML = "";
    const totalAcross = Object.values(counts.buckets).reduce((a, b) => a + b, 0);
    const any = document.createElement("option");
    any.value = "";
    any.textContent = `Any kind of help  (${totalAcross})`;
    bucketEl.appendChild(any);

    for (const b of facets.buckets) {
      const n = counts.buckets[b] || 0;
      const o = document.createElement("option");
      o.value = b;
      o.textContent = `${b}  (${n})`;
      // visually de-emphasize 0-count buckets but keep them selectable
      // (in case the user wants to clear the place filter and see them anyway)
      if (n === 0) o.style.color = "#999";
      bucketEl.appendChild(o);
    }
    bucketEl.value = state.bucket;
  }

  function filterRows(state) {
    if (!state.placeValue && !state.bucket) {
      // Don't render the entire 2500-row directory by default — pick something first
      return null;
    }
    const placeKey = state.placeType === "county" ? "county" : "city";
    return dataset.rows.filter((r) => {
      if (state.placeValue && (r[placeKey] || "") !== state.placeValue) return false;
      if (state.bucket && (r.bucket || "") !== state.bucket) return false;
      return true;
    });
  }

  function flagFor(notes) {
    if (!notes) return null;
    const n = notes.toLowerCase();
    if (n.includes("critical") || n.includes("safety-critical")) return "critical";
    if (
      n.includes("phone confirmation") ||
      n.includes("recommend phone") ||
      n.includes("dead") ||
      n.includes("appears dead") ||
      n.includes("waitlist") ||
      n.includes("closed") ||
      n.includes("audit ")
    ) return "caution";
    return null;
  }

  function telHref(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return null;
    return `tel:${digits.length === 10 ? "+1" + digits : digits}`;
  }

  function mapsHref(addr, city, zip) {
    const parts = [addr, city, "NC", zip].filter(Boolean);
    if (!parts.length) return null;
    const q = encodeURIComponent(parts.join(", "));
    return `https://maps.apple.com/?q=${q}`; // iOS deep-links + Android still resolves
  }

  function ensureProtocol(url) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  }

  function cardHTML(r) {
    const flag = flagFor(r.notes);
    const flagAttr = flag ? `data-flag="${flag}"` : "";

    const tel = telHref(r.phone);
    const map = mapsHref(r.address, r.city, r.zip);
    const web = ensureProtocol(r.website);

    const ctas = [];
    if (tel) ctas.push(`<a class="cta" href="${tel}" aria-label="Call ${escapeHtml(r.agency)}">📞 Call ${escapeHtml(r.phone)}</a>`);
    if (map) ctas.push(`<a class="cta alt" href="${map}" rel="noopener" aria-label="Get directions">📍 Directions</a>`);
    if (web) ctas.push(`<a class="cta alt" href="${escapeHtml(web)}" rel="noopener" aria-label="Visit website">🌐 Website</a>`);

    const locParts = [r.address, r.city, r.zip ? String(r.zip) : null].filter(Boolean);
    const loc = locParts.length ? escapeHtml(locParts.join(", ")) : "Address not listed — call before visiting";

    const rowsHtml = [];
    if (r.schedule) rowsHtml.push(`<div class="row"><span class="row-icon">🕒</span><span class="row-text">${escapeHtml(r.schedule)}</span></div>`);
    if (r.eligibility) rowsHtml.push(`<div class="row"><span class="row-icon">✅</span><span class="row-text"><strong>Who:</strong> ${escapeHtml(r.eligibility)}</span></div>`);
    if (r.documents && r.documents !== "None") rowsHtml.push(`<div class="row"><span class="row-icon">📄</span><span class="row-text"><strong>Bring:</strong> ${escapeHtml(r.documents)}</span></div>`);
    if (r.apply) rowsHtml.push(`<div class="row"><span class="row-icon">➜</span><span class="row-text"><strong>How:</strong> ${escapeHtml(r.apply)}</span></div>`);

    const detailHtml = r.service ? `
      <button class="expand-toggle" type="button" aria-expanded="false">More about this program</button>
      <div class="detail">
        <h4>About this program</h4>
        <p>${escapeHtml(r.service)}</p>
      </div>` : "";

    const notesHtml = r.notes ? `
      <div class="notes"><strong>Note:</strong> ${escapeHtml(r.notes)}</div>` : "";

    const verified = r.last_verified ? `<div class="verified">Last checked: ${escapeHtml(r.last_verified)}</div>` : "";

    return `
    <article class="card" ${flagAttr}>
      <header class="card-head">
        <div class="card-prog">${escapeHtml(r.program || "Resource")}</div>
        <h3 class="card-name">${escapeHtml(r.agency)}</h3>
        <div class="card-loc">${loc}</div>
      </header>
      <div class="card-grid">${rowsHtml.join("")}</div>
      <div class="cta-row">${ctas.join("")}</div>
      ${notesHtml}
      ${detailHtml}
      ${verified}
    </article>`;
  }

  function render(state) {
    const myToken = ++renderToken;
    const rows = filterRows(state);

    if (rows === null) {
      resultsEl.innerHTML = `<div class="empty">
        <p><strong>Pick a city or county</strong> — and what kind of help you need — to see agencies near you.</p>
      </div>`;
      setStatus("");
      return;
    }

    if (rows.length === 0) {
      resultsEl.innerHTML = `<div class="empty">
        <p><strong>No matches.</strong> Try a different city/county or a different type of help.</p>
        <p>If you're not finding what you need, dial <a href="tel:211">2-1-1</a> for help finding a referral.</p>
      </div>`;
      setStatus("");
      return;
    }

    const placeName = state.placeValue || (state.placeType === "county" ? "any county" : "any city");
    const needName = state.bucket || "any kind of help";
    setStatus(`<span class="count">${rows.length}</span> ${rows.length === 1 ? "agency" : "agencies"} in <strong>${escapeHtml(placeName)}</strong> · ${escapeHtml(needName)}`);

    // Render in batches so the main thread never blocks
    resultsEl.innerHTML = "";
    let i = 0;
    function step() {
      if (myToken !== renderToken) return;
      const end = Math.min(i + RENDER_BATCH, rows.length);
      const html = [];
      for (; i < end; i++) html.push(cardHTML(rows[i]));
      resultsEl.insertAdjacentHTML("beforeend", html.join(""));
      if (i < rows.length) {
        requestAnimationFrame(step);
      }
    }
    step();
  }

  // Event delegation: expand toggles
  resultsEl.addEventListener("click", (e) => {
    const t = e.target.closest(".expand-toggle");
    if (!t) return;
    const detail = t.nextElementSibling;
    if (detail && detail.classList.contains("detail")) {
      const open = detail.classList.toggle("open");
      t.setAttribute("aria-expanded", open ? "true" : "false");
      t.textContent = open ? "Hide details" : "More about this program";
    }
  });

  function applyState(state, push) {
    populateFacets(state);
    render(state);
    const newUrl = urlFromState(state);
    if (push) {
      history.pushState(state, "", newUrl);
    } else {
      history.replaceState(state, "", newUrl);
    }
  }

  function bindControls() {
    placeTypeEl.addEventListener("change", () => {
      const s = readState();
      s.placeValue = "";
      applyState(s, true);
    });
    placeValueEl.addEventListener("change", () => applyState(readState(), true));
    bucketEl.addEventListener("change", () => applyState(readState(), true));
    clearBtn.addEventListener("click", () => {
      placeValueEl.value = "";
      bucketEl.value = "";
      applyState(readState(), true);
    });
    window.addEventListener("popstate", (e) => {
      const s = e.state || stateFromUrl();
      placeTypeEl.value = s.placeType || "city";
      placeValueEl.value = s.placeValue || "";
      bucketEl.value = s.bucket || "";
      applyState(s, false);
    });
  }

  async function init() {
    setStatus("Loading directory…");
    try {
      const res = await fetch("/data.json", { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dataset = await res.json();
    } catch (err) {
      setStatus(`Could not load directory data: ${err.message}. Try refreshing.`);
      return;
    }
    if (dataDateEl && dataset.generated_at) {
      dataDateEl.textContent = dataset.generated_at;
    }
    const initial = stateFromUrl();
    placeTypeEl.value = initial.placeType;
    bindControls();
    applyState(initial, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
