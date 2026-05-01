(() => {
  const STORAGE_KEY = 'bukmuk:mylist:v1';
  const NAME_KEY = 'bukmuk:childname:v1';
  const SUBSCRIBED_KEY = 'bukmuk:subscribed:v1';

  // === Lead capture (Google Forms) ======================================
  // To enable WhatsApp lead capture:
  //   1. Create a Google Form with TWO short-answer fields:
  //        a) "WhatsApp number"
  //        b) "Source"
  //   2. Click ⋮ (top-right of editor) → "Get pre-filled link", fill dummy
  //      values in both fields, then click "Get link" → copy.
  //   3. From that URL, extract:
  //        - the FORM ID: the long string after `/d/e/` and before `/viewform`
  //        - the ENTRY IDs: the `entry.NNNNNNNNN=...` keys for each field
  //   4. Replace the three values below.
  // Until configured, lead submission is silently skipped (PDF still works).
  const LEAD_FORM = {
    formId: '1FAIpQLSd5E6mUxHR3c4zogd-O7J9T0sw-phitIGLLIZKC77gexcpFUw',
    phoneEntry: 'entry.1011721616',
    sourceEntry: 'entry.918038827',
  };
  const LEAD_FORM_CONFIGURED = LEAD_FORM.formId && LEAD_FORM.formId !== 'YOUR_FORM_ID';

  const state = {
    lists: [],
    activeAge: 'all',
    activeGenre: 'all',
    expanded: new Set(),
    selected: new Map(),
  };

  // --- Boot ---------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const res = await fetch('data/lists.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed to load lists.json (${res.status})`);
      state.lists = await res.json();
    } catch (err) {
      console.error(err);
      document.getElementById('lists').innerHTML =
        `<p class="empty-state">Could not load book lists. Please refresh.</p>`;
      return;
    }

    loadSelected();
    loadChildName();
    renderChips();
    renderCards();
    wireBuilder();
    updateFab();
    syncConsentCard();
  }

  // --- Filter chips -------------------------------------------------------
  function renderChips() {
    const ages = ['all', ...uniq(state.lists.map(l => l.ageBadge), sortAge)];
    const genres = ['all', ...uniq(state.lists.map(l => l.genre))];

    const ageEl = document.getElementById('ageChips');
    ageEl.innerHTML = ages.map(a => chipHtml(a, a === 'all' ? 'All ages' : a, 'age')).join('');

    const genreEl = document.getElementById('genreChips');
    genreEl.innerHTML = genres.map(g => {
      const label = g === 'all' ? 'All genres' : labelForGenre(g);
      return chipHtml(g, label, 'genre');
    }).join('');

    ageEl.addEventListener('click', e => onChipClick(e, 'age'));
    genreEl.addEventListener('click', e => onChipClick(e, 'genre'));
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    syncChipUi();
  }

  function chipHtml(value, label, kind) {
    return `<button type="button" class="chip" data-value="${value}" data-kind="${kind}">${escapeHtml(label)}</button>`;
  }

  function onChipClick(e, kind) {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const v = btn.dataset.value;
    if (kind === 'age') state.activeAge = v;
    else state.activeGenre = v;
    syncChipUi();
    renderCards();
  }

  function resetFilters() {
    state.activeAge = 'all';
    state.activeGenre = 'all';
    syncChipUi();
    renderCards();
  }

  function syncChipUi() {
    document.querySelectorAll('#ageChips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.value === state.activeAge);
    });
    document.querySelectorAll('#genreChips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.value === state.activeGenre);
    });
  }

  function labelForGenre(g) {
    const list = state.lists.find(l => l.genre === g);
    return list ? list.genreLabel : g;
  }

  function sortAge(a, b) {
    const oa = ageOrderOf(a), ob = ageOrderOf(b);
    return oa - ob;
  }
  function ageOrderOf(badge) {
    const list = state.lists.find(l => l.ageBadge === badge);
    return list ? list.ageOrder : 999;
  }

  // --- Cards --------------------------------------------------------------
  function filteredLists() {
    return state.lists.filter(l => {
      if (state.activeAge !== 'all' && l.ageBadge !== state.activeAge) return false;
      if (state.activeGenre !== 'all' && l.genre !== state.activeGenre) return false;
      return true;
    });
  }

  function renderCards() {
    const grid = document.getElementById('lists');
    const empty = document.getElementById('emptyState');
    const lists = filteredLists();

    grid.innerHTML = lists.map(cardHtml).join('');
    empty.hidden = lists.length > 0;

    grid.querySelectorAll('.list-card').forEach(card => {
      card.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleCard(card.dataset.id));
      card.querySelectorAll('[data-action="add"]').forEach(btn => {
        btn.addEventListener('click', () => toggleBook(card.dataset.id, parseInt(btn.dataset.idx, 10), btn));
      });
    });
  }

  function cardHtml(list) {
    const isExpanded = state.expanded.has(list.id);
    const totalSeries = list.books.length;
    const pdfHref = list.pdf ? encodeURI(list.pdf) : null;

    const pdfBtn = pdfHref
      ? `<a class="btn btn-soft" href="${pdfHref}" download>⬇ Download PDF</a>`
      : `<span class="btn btn-pdf-disabled" title="PDF coming soon">PDF coming soon</span>`;

    const booksBlock = isExpanded
      ? `<div class="card-books">
           ${list.books.map((b, i) => bookRowHtml(list.id, b, i)).join('')}
           ${list.browseUrl ? `<div class="browse-more">Want more? <a href="${escapeAttr(list.browseUrl)}" target="_blank" rel="noopener">Browse all on bukmuk.com →</a></div>` : ''}
         </div>`
      : '';

    return `
      <article class="list-card ${isExpanded ? 'expanded' : ''}" data-id="${list.id}" style="--card-accent:${list.accent};">
        <div class="card-cover">
          <span class="cover-icon">${list.icon || '📚'}</span>
          <div class="card-badges">
            <span class="badge">Age ${escapeHtml(list.ageBadge)}</span>
            <span class="badge">${escapeHtml(list.genreLabel)}</span>
          </div>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(list.title)}</h3>
          <p class="card-sub">${escapeHtml(list.subtitle || '')}</p>
          <p class="card-stats"><strong>${totalSeries}</strong> picks · curated by Bukmuk</p>
          <div class="card-actions">
            <button class="btn btn-primary" type="button" data-action="toggle">${isExpanded ? 'Hide books' : 'View books'}</button>
            ${pdfBtn}
          </div>
        </div>
        ${booksBlock}
      </article>
    `;
  }

  function bookRowHtml(listId, book, idx) {
    const key = bookKey(listId, idx);
    const added = state.selected.has(key);
    const meta = [book.author, book.count].filter(Boolean).join(' · ');
    return `
      <div class="book-row">
        <div class="book-info">
          <div class="book-title">${escapeHtml(book.title)}</div>
          ${meta ? `<div class="book-meta">${escapeHtml(meta)}</div>` : ''}
        </div>
        <button type="button" class="add-btn ${added ? 'added' : ''}" data-action="add" data-idx="${idx}" aria-label="${added ? 'Remove from my list' : 'Add to my list'}">${added ? '✓' : '+'}</button>
      </div>
    `;
  }

  function toggleCard(id) {
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    renderCards();
  }

  // --- Selection ----------------------------------------------------------
  function bookKey(listId, idx) { return `${listId}::${idx}`; }

  function toggleBook(listId, idx, btnEl) {
    const key = bookKey(listId, idx);
    const list = state.lists.find(l => l.id === listId);
    const book = list && list.books[idx];
    if (!book) return;

    if (state.selected.has(key)) {
      state.selected.delete(key);
      btnEl.classList.remove('added');
      btnEl.textContent = '+';
      btnEl.setAttribute('aria-label', 'Add to my list');
    } else {
      state.selected.set(key, {
        title: book.title,
        author: book.author || null,
        count: book.count || null,
        listTitle: list.title,
        ageBadge: list.ageBadge,
      });
      btnEl.classList.add('added');
      btnEl.textContent = '✓';
      btnEl.setAttribute('aria-label', 'Remove from my list');
    }
    saveSelected();
    updateFab();
    renderDrawerList();
  }

  function loadSelected() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      state.selected = new Map(arr);
    } catch (_) { /* ignore */ }
  }
  function saveSelected() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.selected])); } catch (_) {}
  }
  function loadChildName() {
    try {
      const v = localStorage.getItem(NAME_KEY);
      if (v != null) document.getElementById('childName').value = v;
    } catch (_) {}
  }
  function saveChildName(v) {
    try { localStorage.setItem(NAME_KEY, v); } catch (_) {}
  }

  function isSubscribed() {
    try { return !!localStorage.getItem(SUBSCRIBED_KEY); } catch (_) { return false; }
  }
  function markSubscribed(phone) {
    try { localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify({ phone, ts: Date.now() })); } catch (_) {}
  }

  function syncConsentCard() {
    const card = document.getElementById('consentCard');
    if (!card) return;
    if (isSubscribed()) {
      card.classList.add('subscribed');
      const status = document.getElementById('consentStatus');
      status.hidden = false;
      status.classList.add('ok');
      status.textContent = '✓ You\'re on the list. Thank you!';
      card.querySelector('#leadPhone').disabled = true;
      card.querySelector('#leadConsent').disabled = true;
      card.querySelector('#leadConsent').checked = true;
    }
  }

  async function submitLead(phone) {
    if (!LEAD_FORM_CONFIGURED) {
      console.info('[bukmuk] Lead form not configured; skipping submit. Phone:', phone);
      return false;
    }
    const url = `https://docs.google.com/forms/d/e/${LEAD_FORM.formId}/formResponse`;
    const params = new URLSearchParams();
    params.append(LEAD_FORM.phoneEntry, phone);
    params.append(LEAD_FORM.sourceEntry, 'bukmuk-recommendations');
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', body: params });
      return true;
    } catch (err) {
      console.error('[bukmuk] Lead submit failed', err);
      return false;
    }
  }

  function normalisePhone(raw) {
    const digits = String(raw || '').replace(/[^\d+]/g, '');
    return digits;
  }
  function isValidPhone(raw) {
    const d = normalisePhone(raw).replace(/^\+/, '');
    return d.length >= 10 && d.length <= 15;
  }

  // --- Builder drawer + FAB ----------------------------------------------
  function wireBuilder() {
    const fab = document.getElementById('builderFab');
    const drawer = document.getElementById('builderDrawer');
    const scrim = document.getElementById('drawerScrim');
    const closeBtn = document.getElementById('drawerClose');
    const clearBtn = document.getElementById('clearListBtn');
    const dlBtn = document.getElementById('downloadListBtn');
    const nameEl = document.getElementById('childName');

    fab.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    clearBtn.addEventListener('click', () => {
      if (state.selected.size === 0) return;
      if (!confirm('Remove all books from your list?')) return;
      state.selected.clear();
      saveSelected();
      updateFab();
      renderDrawerList();
      renderCards();
    });

    nameEl.addEventListener('input', () => saveChildName(nameEl.value));

    dlBtn.addEventListener('click', downloadPdf);
  }

  function openDrawer() {
    document.getElementById('builderDrawer').classList.add('open');
    document.getElementById('builderDrawer').setAttribute('aria-hidden', 'false');
    document.getElementById('drawerScrim').hidden = false;
    document.body.style.overflow = 'hidden';
    renderDrawerList();
  }
  function closeDrawer() {
    document.getElementById('builderDrawer').classList.remove('open');
    document.getElementById('builderDrawer').setAttribute('aria-hidden', 'true');
    document.getElementById('drawerScrim').hidden = true;
    document.body.style.overflow = '';
  }

  function updateFab() {
    const fab = document.getElementById('builderFab');
    const count = state.selected.size;
    document.getElementById('fabCount').textContent = String(count);
    fab.hidden = count === 0;
    document.getElementById('downloadListBtn').disabled = count === 0;
  }

  function renderDrawerList() {
    const wrap = document.getElementById('drawerList');
    const empty = document.getElementById('drawerEmpty');
    if (state.selected.size === 0) {
      wrap.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    wrap.innerHTML = [...state.selected.entries()].map(([key, b]) => `
      <div class="drawer-item" data-key="${escapeAttr(key)}">
        <div class="drawer-item-info">
          <div class="drawer-item-title">${escapeHtml(b.title)}</div>
          <div class="drawer-item-meta">${escapeHtml(b.listTitle)} · Age ${escapeHtml(b.ageBadge)}${b.count ? ' · ' + escapeHtml(b.count) : ''}</div>
        </div>
        <button type="button" class="remove-btn" aria-label="Remove">×</button>
      </div>
    `).join('');
    wrap.querySelectorAll('.drawer-item').forEach(item => {
      item.querySelector('.remove-btn').addEventListener('click', () => {
        const key = item.dataset.key;
        state.selected.delete(key);
        saveSelected();
        const [listId, idxStr] = key.split('::');
        const card = document.querySelector(`.list-card[data-id="${CSS.escape(listId)}"]`);
        if (card) {
          const btn = card.querySelector(`[data-action="add"][data-idx="${idxStr}"]`);
          if (btn) { btn.classList.remove('added'); btn.textContent = '+'; }
        }
        updateFab();
        renderDrawerList();
      });
    });
  }

  // --- PDF generation -----------------------------------------------------
  function buildPdfTemplate() {
    const name = (document.getElementById('childName').value || '').trim();
    const title = name ? escapeHtml(name) : 'My Bukmuk Reading List';
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const items = [...state.selected.values()].map((b, i) => {
      const meta = [b.listTitle, 'Age ' + b.ageBadge, b.count].filter(Boolean).join(' · ');
      return `<li><span class="num">${i + 1}.</span> <strong>${escapeHtml(b.title)}</strong><div style="font-size:12px;color:#6B7280;margin-top:2px;">${escapeHtml(meta)}</div></li>`;
    }).join('');

    return `
      <div class="pdf-page">
        <div class="pdf-head">
          <div class="pdf-logo">BUKMUK</div>
          <div class="pdf-tag">Books for Bachpan<br/>Curated reading list · ${today}</div>
        </div>
        <h1 class="pdf-title">${title}</h1>
        <p class="pdf-sub">A personal book list curated with Bukmuk's recommendations.</p>
        <ol class="pdf-list">${items}</ol>
        <div class="pdf-foot">
          <span><strong>+91 81302 86286</strong></span>
          <span><strong>www.bukmuk.com</strong></span>
          <span><strong>@bukmuklibrary</strong></span>
        </div>
        <div class="pdf-promo">
          📚 Want to read all of these without buying? <strong>Bukmuk library</strong> · 40,000+ books · Free home delivery in Delhi NCR · Trusted by parents since 2015.
        </div>
      </div>
    `;
  }

  async function downloadPdf() {
    if (state.selected.size === 0) return;

    // Lead capture (best-effort, non-blocking) — only if user opted in.
    const consentEl = document.getElementById('leadConsent');
    const phoneEl = document.getElementById('leadPhone');
    const statusEl = document.getElementById('consentStatus');
    if (consentEl && consentEl.checked && !isSubscribed()) {
      const rawPhone = phoneEl.value.trim();
      if (!isValidPhone(rawPhone)) {
        statusEl.hidden = false;
        statusEl.classList.remove('ok');
        statusEl.classList.add('err');
        statusEl.textContent = 'Please enter a valid WhatsApp number, or untick the box.';
        phoneEl.focus();
        return;
      }
      const normalised = normalisePhone(rawPhone);
      // Fire-and-forget; do not block PDF on submission.
      submitLead(normalised).then(ok => {
        if (ok) {
          markSubscribed(normalised);
          syncConsentCard();
        }
      });
      // Optimistically mark subscribed locally so the UI reflects opt-in.
      markSubscribed(normalised);
      syncConsentCard();
    }

    const node = document.getElementById('pdfTemplate');
    const childName = document.getElementById('childName').value.trim();
    const prevTitle = document.title;
    const filename = (childName || 'my-bukmuk-list')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-bukmuk-list';

    node.innerHTML = buildPdfTemplate();
    // Browsers use document.title as the default Save-as-PDF filename.
    document.title = filename;

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const restore = () => {
      node.innerHTML = '';
      document.title = prevTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    window.print();

    // Safari does not always fire afterprint reliably — fall back on a timer.
    setTimeout(() => {
      if (node.innerHTML) restore();
    }, 1500);
  }

  // --- Helpers ------------------------------------------------------------
  function uniq(arr, sortFn) {
    const out = [...new Set(arr)];
    if (sortFn) out.sort(sortFn);
    return out;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
