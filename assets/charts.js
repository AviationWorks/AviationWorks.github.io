
/* MyOT charts.js  –  uses Chart.js (loaded from CDN) */

const PALETTE = [
  '#2563a8','#c75b00','#15803d','#7c3aed','#0891b2',
  '#b45309','#be185d','#065f46','#1d4ed8','#9a3412'
];

function hexAlpha(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── Generic helpers ── */

function makeLineChart(canvasId, rows, col_keys, title) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = rows.map(r => r.date || r.month);
  const datasets = col_keys.map((ck, i) => ({
    label: ck,
    data: rows.map(r => r[ck] || 0),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: hexAlpha(PALETTE[i % PALETTE.length], .12),
    borderWidth: 1.5,
    pointRadius: labels.length > 60 ? 0 : 3,
    tension: 0.3,
    fill: false,
  }));
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        title: { display: !!title, text: title, font: { size: 12 } }
      },
      scales: {
        x: { ticks: { maxRotation: 45, font: { size: 10 } } },
        y: { beginAtZero: true, ticks: { font: { size: 10 } } }
      }
    }
  });
}

function makeBarChart(canvasId, rows, col_keys, title, stacked) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = rows.map(r => r.date || r.month);
  const datasets = col_keys.map((ck, i) => ({
    label: ck,
    data: rows.map(r => r[ck] || 0),
    backgroundColor: hexAlpha(PALETTE[i % PALETTE.length], .75),
    borderColor: PALETTE[i % PALETTE.length],
    borderWidth: 1,
  }));
  new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        title: { display: !!title, text: title, font: { size: 12 } }
      },
      scales: {
        x: { stacked: !!stacked, ticks: { maxRotation: 45, font: { size: 10 } } },
        y: { stacked: !!stacked, beginAtZero: true, ticks: { font: { size: 10 } } }
      }
    }
  });
}

function makeSparkline(canvasId, rows) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const MARKED = new Set([0, 3, 5]);
  const labels = rows.map(r => {
    if (MARKED.has(r.weekday)) {
      const parts = r.date.replace('/', '-').split('-');
      return parts[1] + '/' + parts[2];
    }
    return '';
  });
  const pointRadii  = rows.map(r => MARKED.has(r.weekday) ? 3 : 0);
  const pointColors = rows.map(r => r.weekday === 5 ? '#c75b00' :
                                    r.weekday === 0 ? '#2563a8' : '#15803d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'OT Rows',
        data: rows.map(r => r.count),
        borderColor: '#4a90d9',
        backgroundColor: 'rgba(74,144,217,.15)',
        borderWidth: 1.5,
        pointRadius: pointRadii,
        pointBackgroundColor: pointColors,
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => rows[items[0].dataIndex].date.replace('/', '-'),
            label:  (item) => 'OT rows: ' + item.raw.toLocaleString()
          }
        }
      },
      scales: {
        x: {
          ticks: {
            font: { size: 9 },
            maxRotation: 0,
            autoSkip: false,
            color: (ctx2) => {
              const lbl = labels[ctx2.index] || '';
              if (!lbl) return 'transparent';
              const wd = rows[ctx2.index] ? rows[ctx2.index].weekday : -1;
              return wd === 5 ? '#c75b00' : wd === 0 ? '#2563a8' : '#15803d';
            }
          },
          grid: { display: false }
        },
        y: { display: false }
      }
    }
  });
}

/* ── Recent bar chart with 4 filter dropdowns ── */
let recentBarChart = null;
function makeRecentBar(D, base, aircraft, seat, region) {
  const ctx = document.getElementById('recent-bar');
  if (!ctx) return;
  const dates = D.recent_by_base.dates;
  // Aggregate detail rows by date matching all active filters
  const counts = {};
  dates.forEach(d => counts[d] = 0);
  D.recent_by_base.detail.forEach(r => {
    if (!counts.hasOwnProperty(r.date)) return;
    if (base     !== 'All' && r.base     !== base)     return;
    if (aircraft !== 'All' && r.aircraft !== aircraft) return;
    if (seat     !== 'All' && r.seat     !== seat)     return;
    if (region   !== 'All' && r.region   !== region)   return;
    counts[r.date] += r.count;
  });
  const labels = dates.map(d => {
    const p = d.replace('/', '-').split('-');
    return p[1] + '/' + p[2];
  });
  const data = dates.map(d => counts[d] || 0);
  if (recentBarChart) recentBarChart.destroy();
  recentBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'OT Rows',
        data,
        backgroundColor: 'rgba(37,99,168,.7)',
        borderColor: '#2563a8',
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
        y: { beginAtZero: true, ticks: { font: { size: 10 } } }
      }
    }
  });
}

/* ── Monthly summary cards with 4 filter dropdowns ── */
function updateCards(D, month, base, aircraft, seat, region) {
  const detail = (D.monthly_cards.detail[month] || []);
  let total = 0, rf = 0, pm = 0;
  detail.forEach(r => {
    if (base     !== 'All' && r.base     !== base)     return;
    if (aircraft !== 'All' && r.aircraft !== aircraft) return;
    if (seat     !== 'All' && r.seat     !== seat)     return;
    if (region   !== 'All' && r.region   !== region)   return;
    total += r.total; rf += r.rf; pm += r.pm;
  });
  document.getElementById('card-total').textContent = total.toLocaleString();
  document.getElementById('card-rf').textContent    = rf.toLocaleString();
  document.getElementById('card-pm').textContent    = pm.toLocaleString();
}

/* ── Tab logic ── */
function initTabs(containerSel) {
  document.querySelectorAll(containerSel + ' .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bar   = btn.closest('.tab-bar');
      const wrap  = btn.closest('.tab-container');
      bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      wrap.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      wrap.querySelector('#' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ── Table builder ── */
function buildTable(tbodyId, rows, col_keys, rowKey, showTotal, outlierFn) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  let grandTotals = Object.fromEntries(col_keys.map(k => [k, 0]));
  let html = '';

  rows.forEach(r => {
    const rowTotal = col_keys.reduce((s, k) => s + (r[k] || 0), 0);
    col_keys.forEach(k => grandTotals[k] += (r[k] || 0));
    html += `<tr>`;
    html += `<td>${r[rowKey]}</td>`;
    col_keys.forEach(k => {
      const v = r[k] || 0;
      const isOut = outlierFn && outlierFn(r[rowKey], k, v);
      html += `<td class="${isOut ? 'outlier' : ''}">${v.toLocaleString()}</td>`;
    });
    if (showTotal) html += `<td><strong>${rowTotal.toLocaleString()}</strong></td>`;
    html += `</tr>`;
  });

  if (showTotal) {
    const gt = col_keys.reduce((s, k) => s + grandTotals[k], 0);
    html += `<tr class="grand-total"><td>TOTAL</td>`;
    col_keys.forEach(k => html += `<td>${grandTotals[k].toLocaleString()}</td>`);
    html += `<td>${gt.toLocaleString()}</td></tr>`;
  }
  tbody.innerHTML = html;
}

function buildTableHeader(theadId, col_keys, rowLabel, showTotal) {
  const thead = document.getElementById(theadId);
  if (!thead) return;
  let html = `<tr><th>${rowLabel}</th>`;
  col_keys.forEach(k => html += `<th>${k}</th>`);
  if (showTotal) html += `<th>Total</th>`;
  html += `</tr>`;
  thead.innerHTML = html;
}

/* ── Page init helpers ── */
function initIndex(D) {
  // ── Sparkline ──
  makeSparkline('sparkline-canvas', D.sparkline);

  // ── Helper: populate a select from an array ──
  function populate(id, options, defaultVal) {
    const sel = document.getElementById(id);
    if (!sel) return sel;
    options.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
    sel.value = defaultVal;
    return sel;
  }

  // ── Card + bar filters (shared) ──
  const months   = D.monthly_cards.months;
  const lastMon  = months[months.length - 1] || '';
  const monSel   = populate('card-month-sel',    months,                   lastMon);
  const cBaseSel = populate('card-base-sel',     D.monthly_cards.bases,    'All');
  const cAcSel   = populate('card-aircraft-sel', D.monthly_cards.aircraft, 'All');
  const cSeatSel = populate('card-seat-sel',     D.monthly_cards.seats,    'All');
  const cRegSel  = populate('card-region-sel',   D.monthly_cards.regions,  'All');

  function refresh() {
    const base = cBaseSel.value, ac = cAcSel.value,
          seat = cSeatSel.value, reg = cRegSel.value;
    updateCards(D, monSel.value, base, ac, seat, reg);
    makeRecentBar(D, base, ac, seat, reg);
  }

  [monSel, cBaseSel, cAcSel, cSeatSel, cRegSel].forEach(s => {
    if (s) s.addEventListener('change', refresh);
  });
  refresh();
}

function initDaily(D) {
  initTabs('.tab-container');

  // All bases monthly bar
  makeBarChart('daily-all-monthly-bar', D.daily.all_bases.monthly,
               D.daily.all_bases.col_keys, 'Monthly OT Rows – All Bases', true);

  // All bases daily line
  makeLineChart('daily-all-line', D.daily.all_bases.rows,
                D.daily.all_bases.col_keys, '');

  // 737 CA bar
  if (D.daily['737_CA'] && D.daily['737_CA'].col_keys.length) {
    makeBarChart('daily-737-monthly-bar', D.daily['737_CA'].monthly,
                 D.daily['737_CA'].col_keys, 'Monthly OT Rows – 737 CA', true);
    makeLineChart('daily-737-line', D.daily['737_CA'].rows,
                  D.daily['737_CA'].col_keys, '');
  }

  // Tables
  buildTableHeader('daily-all-thead', D.daily.all_bases.col_keys, 'Date', true);
  buildTable('daily-all-tbody', D.daily.all_bases.rows, D.daily.all_bases.col_keys, 'date', true, null);
}

function initRF(D) {
  initTabs('.tab-container');

  makeBarChart('rf-all-monthly-bar', D.rf.all_bases.monthly,
               D.rf.all_bases.col_keys, 'Monthly RF Sequences – All Bases', true);
  makeLineChart('rf-all-line', D.rf.all_bases.rows,
                D.rf.all_bases.col_keys, '');

  if (D.rf['737_CA'] && D.rf['737_CA'].col_keys.length) {
    makeBarChart('rf-737-monthly-bar', D.rf['737_CA'].monthly,
                 D.rf['737_CA'].col_keys, 'Monthly RF – 737 CA by Bid Status', true);
    makeLineChart('rf-737-line', D.rf['737_CA'].rows,
                  D.rf['737_CA'].col_keys, '');
  }

  if (D.rf.pay_737_CA && D.rf.pay_737_CA.col_keys.length) {
    makeBarChart('rf-pay-bar', D.rf.pay_737_CA.rows,
                 D.rf.pay_737_CA.col_keys, 'Monthly RF Pay Hours – 737 CA', false);
  }

  buildTableHeader('rf-all-thead', D.rf.all_bases.col_keys, 'Date', true);
  buildTable('rf-all-tbody', D.rf.all_bases.rows, D.rf.all_bases.col_keys, 'date', true, null);
}

function initPM(D) {
  initTabs('.tab-container');

  makeBarChart('pm-all-monthly-bar', D.pm.all_bases.monthly,
               D.pm.all_bases.col_keys, 'Monthly PM Sequences – All Bases', true);
  makeLineChart('pm-all-line', D.pm.all_bases.rows,
                D.pm.all_bases.col_keys, '');

  if (D.pm['737_CA'] && D.pm['737_CA'].col_keys.length) {
    makeBarChart('pm-737-monthly-bar', D.pm['737_CA'].monthly,
                 D.pm['737_CA'].col_keys, 'Monthly PM – 737 CA by Bid Status', true);
    makeLineChart('pm-737-line', D.pm['737_CA'].rows,
                  D.pm['737_CA'].col_keys, '');
  }

  if (D.pm.pay_737_CA && D.pm.pay_737_CA.col_keys.length) {
    makeBarChart('pm-pay-bar', D.pm.pay_737_CA.rows,
                 D.pm.pay_737_CA.col_keys, 'Monthly PM Pay Hours – 737 CA', false);
  }

  buildTableHeader('pm-all-thead', D.pm.all_bases.col_keys, 'Date', true);
  buildTable('pm-all-tbody', D.pm.all_bases.rows, D.pm.all_bases.col_keys, 'date', true, null);
}
