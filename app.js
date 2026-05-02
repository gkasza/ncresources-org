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

  let dataset = null;
  let renderToken = 0; // bumped each render so stale batches abort

  // Lazy-loaded service descriptions. Keyed by row id.
  // Populated on first expand of any card.
  let detailsCache = null;
  let detailsPromise = null;
  function loadDetails() {
    if (detailsCache) return Promise.resolve(detailsCache);
    if (detailsPromise) return detailsPromise;
    detailsPromise = fetch("/details.json", { cache: "force-cache" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data) => { detailsCache = data; return data; })
      .catch((err) => {
        console.error("details.json fetch failed:", err);
        detailsCache = {};
        return detailsCache;
      });
    return detailsPromise;
  }

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

    // Update the visible field label to match the place type so sighted users
    // (especially low-vision) always see "City" or "County" above the dropdown.
    const placeValueLabel = document.getElementById("placeValueLabel");
    if (placeValueLabel) {
      placeValueLabel.textContent = state.placeType === "county" ? "County" : "City";
    }

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
      // hide buckets with 0 matches under the current place filter
      // (keep the currently-selected one even if 0, so the user always sees their pick)
      if (n === 0 && b !== state.bucket) continue;
      const o = document.createElement("option");
      o.value = b;
      o.textContent = `${b}  (${n})`;
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

  function flagFor(notes, noContact) {
    if (noContact) return "caution";
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

  // Short codes like 211, 311, 411, 911 are real dial-able phone numbers
  // (e.g. NC Coordinated Entry's "phone" is literally 211). Allow them.
  const SHORT_CODES = new Set(["211", "311", "411", "511", "611", "711", "811", "911"]);
  function telHref(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, "");
    if (SHORT_CODES.has(digits)) return `tel:${digits}`;
    if (digits.length < 7) return null;
    return `tel:${digits.length === 10 ? "+1" + digits : digits}`;
  }

  function mapsHref(addr, city, zip) {
    const parts = [addr, city, "NC", zip].filter(Boolean);
    if (!parts.length) return null;
    const q = encodeURIComponent(parts.join(", "));
    return `https://maps.apple.com/?q=${q}`; // iOS deep-links + Android still resolves
  }

  // Treat a website value as valid only if it has a real domain shape
  // (something.tld). Catches bad data like "http://Pleasant Ridge Baptist Church".
  function ensureProtocol(url) {
    if (!url) return null;
    const stripped = String(url).trim().replace(/^https?:\/\//i, "");
    // Must contain a dot in a plausible position and no spaces
    if (/\s/.test(stripped)) return null;
    if (!/^[\w.-]+\.[a-z]{2,}/i.test(stripped)) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${stripped}`;
  }

  // ISO date (YYYY-MM-DD) → "Apr 12, 2026" so screen readers say it well
  // and sighted users get a natural form. Falls back to the raw value.
  function formatVerifiedDate(s) {
    if (!s) return "";
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mi = parseInt(m[2], 10) - 1;
    if (mi < 0 || mi > 11) return s;
    return `${months[mi]} ${parseInt(m[3], 10)}, ${m[1]}`;
  }

  function cardHTML(r) {
    const agencyEsc = escapeHtml(r.agency);
    const tel = telHref(r.phone);
    const map = mapsHref(r.address, r.city, r.zip);
    const web = ensureProtocol(r.website);
    const noContact = !tel && !web;
    const flag = flagFor(r.notes, noContact);
    const flagAttr = flag ? `data-flag="${flag}"` : "";

    const ctas = [];
    if (tel) ctas.push(`<a class="cta" href="${tel}" aria-label="Call ${agencyEsc} at ${escapeHtml(r.phone)}"><span aria-hidden="true">📞</span> Call ${escapeHtml(r.phone)}</a>`);
    if (map) ctas.push(`<a class="cta alt" href="${map}" rel="noopener" aria-label="Get directions to ${agencyEsc}"><span aria-hidden="true">📍</span> Directions</a>`);
    if (web) ctas.push(`<a class="cta alt" href="${escapeHtml(web)}" rel="noopener" aria-label="Visit ${agencyEsc} website"><span aria-hidden="true">🌐</span> Website</a>`);

    // Safety net: agency has no phone AND no website. The user has no way
    // to reach this place to verify before showing up. Surface a 211 prompt.
    const noContact = !tel && !web;
    if (noContact) {
      ctas.unshift(`<a class="cta" href="tel:211" aria-label="Call 2-1-1 to verify this listing"><span aria-hidden="true">📞</span> Call 2-1-1 first</a>`);
    }

    const locParts = [r.address, r.city, r.zip ? String(r.zip) : null].filter(Boolean);
    const loc = locParts.length ? escapeHtml(locParts.join(", ")) : "Address not listed — call before visiting";

    const rowsHtml = [];
    if (r.schedule) rowsHtml.push(`<div class="row"><span class="row-icon" aria-hidden="true">🕒</span><span class="row-text">${escapeHtml(r.schedule)}</span></div>`);
    if (r.eligibility) rowsHtml.push(`<div class="row"><span class="row-icon" aria-hidden="true">✅</span><span class="row-text"><strong>Who:</strong> ${escapeHtml(r.eligibility)}</span></div>`);
    if (r.documents && r.documents !== "None") rowsHtml.push(`<div class="row"><span class="row-icon" aria-hidden="true">📄</span><span class="row-text"><strong>Bring:</strong> ${escapeHtml(r.documents)}</span></div>`);
    if (r.apply) rowsHtml.push(`<div class="row"><span class="row-icon" aria-hidden="true">➜</span><span class="row-text"><strong>How:</strong> ${escapeHtml(r.apply)}</span></div>`);

    // We fetch the full service description on demand from /details.json
    // — keeps the initial payload smaller. Show the toggle for every row
    // (the cache may not be loaded yet); if it turns out to have no detail,
    // we hide the toggle when the cache resolves.
    const detailHtml = `
      <button class="expand-toggle" type="button" aria-expanded="false" data-row-id="${r.id}">What this program does</button>
      <div class="detail">
        <h4>What this program does</h4>
        <p data-detail-for="${r.id}"><em>Loading…</em></p>
      </div>`;

    // Combine the audit notes with a no-contact warning if applicable
    let notesText = r.notes || "";
    if (noContact) {
      const warning = "We don't have a phone or website for this location. Call 2-1-1 to verify before going.";
      notesText = notesText ? `${warning}  ${notesText}` : warning;
    }
    const notesHtml = notesText ? `
      <div class="notes"${noContact ? ' data-strong="true"' : ""}><strong>Note:</strong> ${escapeHtml(notesText)}</div>` : "";

    const verified = r.last_verified
      ? `<div class="verified">Last checked: <time datetime="${escapeHtml(r.last_verified)}">${escapeHtml(formatVerifiedDate(r.last_verified))}</time></div>`
      : "";

    return `
    <article class="card" ${flagAttr}>
      <header class="card-head">
        <div class="card-prog">${escapeHtml(r.program || "Resource")}</div>
        <h3 class="card-name">${agencyEsc}</h3>
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
        <p lang="es"><strong>Elige una ciudad o condado</strong> y el tipo de ayuda que necesitas para ver las agencias cercanas.</p>
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

    // Render in one shot. Earlier we batched with rAF, but rAF is paused in
    // background tabs and throttled in low-power mode, leaving the user with
    // only the first 20 results and no clue more existed. Even the worst case
    // (~937 cards) parses in under 150ms on a modest phone — fast enough.
    resultsEl.innerHTML = rows.map(cardHTML).join("");
  }

  // Event delegation: expand toggles. Lazy-loads /details.json on first
  // open so the initial payload stays small.
  resultsEl.addEventListener("click", (e) => {
    const t = e.target.closest(".expand-toggle");
    if (!t) return;
    const detail = t.nextElementSibling;
    if (!detail || !detail.classList.contains("detail")) return;

    const open = detail.classList.toggle("open");
    t.setAttribute("aria-expanded", open ? "true" : "false");
    t.textContent = open ? "Hide details" : "What this program does";

    if (!open) return;
    const rowId = t.dataset.rowId;
    const para = detail.querySelector("p[data-detail-for]");
    if (!para || !rowId) return;
    if (para.dataset.loaded === "true") return;

    loadDetails().then((cache) => {
      const text = cache[rowId];
      if (text) {
        para.textContent = text;
      } else {
        // Hide the whole detail block if there's nothing to show
        para.parentElement.style.display = "none";
        t.style.display = "none";
      }
      para.dataset.loaded = "true";
    });
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

  // While the directory data (~370 KB compressed) is downloading on a
  // cellular connection, the dropdowns only have a single placeholder
  // option each. A user tapping during that window sees "Any city" as
  // the only choice and rightly thinks the app is broken. So: disable
  // every input until the data has actually loaded, with a visible
  // loading indicator on the place dropdown so users know to wait.
  function setLoading(loading) {
    [placeTypeEl, placeValueEl, bucketEl, clearBtn].forEach((el) => {
      if (!el) return;
      el.disabled = loading;
      el.setAttribute("aria-busy", loading ? "true" : "false");
    });
    if (loading) {
      // overwrite the placeholder so the user sees something is happening
      placeValueEl.innerHTML = `<option>Loading agencies…</option>`;
      bucketEl.innerHTML = `<option>Loading…</option>`;
      document.body.classList.add("is-loading");
    } else {
      document.body.classList.remove("is-loading");
    }
  }

  // Surface unexpected errors to the user instead of leaving them with
  // a silently-broken page. (Without this, a JS error during init would
  // leave inputs disabled forever and only show "Loading directory…".)
  function showFatalError(message) {
    setStatus("");
    resultsEl.innerHTML = `<div class="empty">
      <p><strong>The directory couldn't load.</strong> Please try refreshing the page.</p>
      <p>If the problem continues, dial <a href="tel:211">2-1-1</a> for community help referrals or visit <a href="https://nc211.org" rel="noopener">nc211.org</a> directly.</p>
      <p class="meta-error">Technical detail: ${escapeHtml(message)}</p>
    </div>`;
  }

  async function init() {
    setLoading(true);
    setStatus("Loading directory…");

    // Catch any JS error that fires during init (e.g. malformed JSON)
    window.addEventListener("error", (e) => {
      console.error("Uncaught error:", e.error || e.message);
      if (!dataset) showFatalError(e.error?.message || e.message || "Unknown error");
    });
    window.addEventListener("unhandledrejection", (e) => {
      console.error("Unhandled rejection:", e.reason);
      if (!dataset) showFatalError(String(e.reason).slice(0, 120));
    });

    try {
      const res = await fetch("/data.json", { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dataset = await res.json();
    } catch (err) {
      console.error("data.json fetch failed:", err);
      showFatalError(err.message || "Could not reach the directory file.");
      // Re-enable Clear so user can try interacting; leave selects disabled
      if (clearBtn) clearBtn.disabled = false;
      return;
    }

    if (dataDateEl && dataset.generated_at) {
      dataDateEl.textContent = dataset.generated_at;
    }

    setLoading(false); // re-enable inputs now that we have data

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
