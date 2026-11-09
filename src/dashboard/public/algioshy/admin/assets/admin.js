/* Smart College Admin Dashboard — client logic
   Renders list, status filter, search, drawer with inline edit. */
(function () {
    'use strict';

    const state = {
        type: 'visits',       // visits | admissions
        status: 'all',
        q: '',
        page: 1,
        per: 25,
        total: 0,
        rows: [],
        statusCounts: {},
    };

    const STATUS_LIST = {
        visits:     ['new','contacted','scheduled','visited','rejected'],
        admissions: ['new','reviewing','interview_scheduled','accepted','waitlist','rejected'],
    };

    const COLS = {
        visits: [
            { key: 'parent_name',    label: 'Parent',         render: (r) => renderName(r.parent_name, r.child_name) },
            { key: 'grade',          label: 'Grade' },
            { key: 'phone',          label: 'Phone' },
            { key: 'email',          label: 'Email' },
            { key: 'preferred_date', label: 'Preferred' },
            { key: 'status',         label: 'Status',         render: (r) => pill(r.status) },
            { key: 'created_at',     label: 'Received',       render: (r) => fmtDate(r.created_at) },
        ],
        admissions: [
            { key: 'student_name',   label: 'Student',        render: (r) => renderName(r.student_name, r.parent_name) },
            { key: 'grade_applying', label: 'Grade' },
            { key: 'pathway',        label: 'Pathway' },
            { key: 'phone',          label: 'Phone' },
            { key: 'email',          label: 'Email' },
            { key: 'status',         label: 'Status',         render: (r) => pill(r.status) },
            { key: 'created_at',     label: 'Received',       render: (r) => fmtDate(r.created_at) },
        ],
    };

    // ── helpers ───────────────────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
    function fmtDate(s) {
        if (!s) return '';
        const d = new Date(s.replace(' ', 'T') + 'Z');
        if (isNaN(d)) return s;
        return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
             + ' ' + d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
    }
    function pill(status) {
        return '<span class="pill pill-' + esc(status) + '">' + esc((status || '').replace(/_/g,' ')) + '</span>';
    }
    function renderName(primary, secondary) {
        return '<div class="cell-name">' + esc(primary || '—') + '</div>' +
               (secondary ? '<div class="cell-sub">' + esc(secondary) + '</div>' : '');
    }

    // ── fetch ─────────────────────────────────────────────────────────────
    async function fetchList() {
        const url = new URL('api/list-leads.php', location.href);
        url.searchParams.set('type', state.type);
        url.searchParams.set('status', state.status);
        if (state.q) url.searchParams.set('q', state.q);
        url.searchParams.set('page', state.page);
        url.searchParams.set('per', state.per);
        const res = await fetch(url, { credentials: 'same-origin' });
        if (res.status === 401) { location.href = 'login.php'; return; }
        const data = await res.json();
        state.rows = data.rows || [];
        state.total = data.total || 0;
        state.statusCounts = data.status_counts || {};
        render();
    }

    async function updateRow(type, id, patch) {
        const res = await fetch('api/update-status.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.SC_CSRF },
            body: JSON.stringify({ type, id, csrf_token: window.SC_CSRF, ...patch }),
        });
        return res.json();
    }

    // ── render ────────────────────────────────────────────────────────────
    function render() {
        renderTabs();
        renderChips();
        renderTable();
        renderPagination();
    }

    function renderTabs() {
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.type === state.type);
        });
    }

    function renderChips() {
        const box = $('#statusChips');
        const statuses = ['all', ...STATUS_LIST[state.type]];
        const totalAll = Object.values(state.statusCounts).reduce((a, b) => a + b, 0);
        box.innerHTML = statuses.map(s => {
            const label = s === 'all' ? 'All' : s.replace(/_/g, ' ');
            const count = s === 'all' ? totalAll : (state.statusCounts[s] || 0);
            return `<span class="chip ${state.status === s ? 'active' : ''}" data-status="${s}">
                ${esc(label)} <span class="chip-count">${count}</span>
            </span>`;
        }).join('');
        box.querySelectorAll('.chip').forEach(c => {
            c.addEventListener('click', () => { state.status = c.dataset.status; state.page = 1; fetchList(); });
        });
    }

    function renderTable() {
        const table = $('#leads-table');
        const empty = $('#empty');
        if (!state.rows.length) {
            empty.classList.remove('hidden');
            table.classList.add('hidden');
            return;
        }
        empty.classList.add('hidden');
        table.classList.remove('hidden');

        const cols = COLS[state.type];
        table.querySelector('thead').innerHTML =
            '<tr>' + cols.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';
        table.querySelector('tbody').innerHTML = state.rows.map(r =>
            `<tr data-id="${r.id}">` +
                cols.map(c => {
                    const v = c.render ? c.render(r) : esc(r[c.key] || '');
                    return `<td>${v}</td>`;
                }).join('') +
            `</tr>`
        ).join('');
        table.querySelectorAll('tbody tr').forEach(tr => {
            tr.addEventListener('click', () => openDrawer(Number(tr.dataset.id)));
        });
    }

    function renderPagination() {
        const pg = $('#pagination');
        const pages = Math.max(1, Math.ceil(state.total / state.per));
        if (pages <= 1) { pg.innerHTML = ''; return; }
        let html = `<button ${state.page <= 1 ? 'disabled' : ''} data-p="prev">‹ Prev</button>`;
        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || Math.abs(i - state.page) <= 2) {
                html += `<button data-p="${i}" class="${state.page === i ? 'active' : ''}">${i}</button>`;
            } else if (Math.abs(i - state.page) === 3) {
                html += `<span style="padding:0 4px">…</span>`;
            }
        }
        html += `<button ${state.page >= pages ? 'disabled' : ''} data-p="next">Next ›</button>`;
        pg.innerHTML = html;
        pg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
            const v = b.dataset.p;
            if (v === 'prev') state.page = Math.max(1, state.page - 1);
            else if (v === 'next') state.page = Math.min(pages, state.page + 1);
            else state.page = Number(v);
            fetchList();
        }));
    }

    // ── drawer ────────────────────────────────────────────────────────────
    function openDrawer(id) {
        const row = state.rows.find(r => r.id === id);
        if (!row) return;
        const drawer = $('#drawer');
        const content = $('#drawerContent');
        const isAdmission = state.type === 'admissions';

        const fields = isAdmission ? [
            ['Student',       row.student_name],
            ['Parent',        row.parent_name],
            ['Date of Birth', row.date_of_birth],
            ['Grade',         row.grade_applying],
            ['Pathway',       row.pathway],
            ['Current School', row.current_school],
            ['Phone',         row.phone, 'tel'],
            ['Email',         row.email, 'mail'],
            ['Address',       row.address],
            ['Notes',         row.notes],
            ['Received',      fmtDate(row.created_at)],
        ] : [
            ['Parent',         row.parent_name],
            ['Child',          row.child_name],
            ['Grade',          row.grade],
            ['Current School', row.current_school],
            ['Phone',          row.phone, 'tel'],
            ['Email',          row.email, 'mail'],
            ['Preferred Date', row.preferred_date],
            ['Preferred Time', row.preferred_time],
            ['Notes',          row.notes],
            ['Received',       fmtDate(row.created_at)],
        ];

        const fieldsHtml = fields.map(([k, v, type]) => {
            let val = '';
            if (!v) val = '<span class="muted">—</span>';
            else if (type === 'tel') val = `<a href="tel:${esc(v)}">${esc(v)}</a>  ·  <a href="https://wa.me/${esc(v.replace(/\D/g,''))}" target="_blank" rel="noopener">WhatsApp</a>`;
            else if (type === 'mail') val = `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
            else val = esc(v);
            return `<div class="field-row"><div class="k">${esc(k)}</div><div class="v">${val}</div></div>`;
        }).join('');

        const statusOpts = STATUS_LIST[state.type].map(s =>
            `<option value="${s}" ${row.status === s ? 'selected' : ''}>${esc(s.replace(/_/g,' '))}</option>`
        ).join('');

        content.innerHTML = `
            <h2>${esc(isAdmission ? row.student_name : row.parent_name) || '#' + row.id}</h2>
            <p class="sub">${isAdmission ? 'Admission' : 'Visit'} #${row.id} · ${pill(row.status)}</p>

            <div class="status-row">
                <label><strong>Status:</strong></label>
                <select id="statusSel">${statusOpts}</select>
            </div>

            ${fieldsHtml}

            <h3 style="margin-top:20px; color: var(--navy); font-size:14px;">Admin notes (internal)</h3>
            <textarea id="adminNotes" placeholder="Add notes for internal team…">${esc(row.admin_notes || '')}</textarea>

            <div class="save-row">
                <button class="btn-primary" id="saveBtn">Save changes</button>
                <button class="btn-ghost" data-close>Close</button>
            </div>
        `;

        drawer.classList.remove('hidden');
        $('#saveBtn').addEventListener('click', async () => {
            const newStatus = $('#statusSel').value;
            const newNotes = $('#adminNotes').value;
            const btn = $('#saveBtn');
            btn.disabled = true; btn.textContent = 'Saving…';
            const res = await updateRow(state.type, row.id, { status: newStatus, admin_notes: newNotes });
            if (res.ok) {
                btn.textContent = 'Saved ✓';
                setTimeout(() => { closeDrawer(); fetchList(); }, 400);
            } else {
                btn.disabled = false; btn.textContent = 'Save changes';
                alert(res.error || 'Save failed');
            }
        });
    }
    function closeDrawer() { $('#drawer').classList.add('hidden'); }

    // ── boot ──────────────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) closeDrawer();
    });
    document.querySelectorAll('.tab').forEach(t => {
        t.addEventListener('click', () => {
            state.type = t.dataset.type;
            state.status = 'all';
            state.page = 1;
            fetchList();
        });
    });
    $('#searchBox').addEventListener('input', (e) => {
        clearTimeout(window.__scSearch);
        window.__scSearch = setTimeout(() => {
            state.q = e.target.value.trim();
            state.page = 1;
            fetchList();
        }, 300);
    });
    $('#exportBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const u = new URL('api/export.php', location.href);
        u.searchParams.set('type', state.type);
        u.searchParams.set('status', state.status);
        location.href = u.toString();
    });

    fetchList();
})();
