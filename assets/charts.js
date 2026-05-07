
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
        label: 'Open Trips Rows',
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
            label:  (item) => 'Open Trips rows: ' + item.raw.toLocaleString()
          }
        }
      },
      scales: {
        x: {
          ticks: {
            font: { size: 9 },
            maxRotation: 0,
            autoSkip: false,
            color: function(tickCtx) {
              var lbl = labels[tickCtx.index] || '';
              if (!lbl) return 'transparent';
              var wd = rows[tickCtx.index] ? rows[tickCtx.index].weekday : -1;
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
function makeRecentBar(D, month, base, aircraft, seat, region) {
  const ctx = document.getElementById('recent-bar');
  if (!ctx) return;

  // ── Filter all_detail to dates belonging to the selected month ──
  // Date format in data: "YYYY-MM/DD"  → month prefix is "YYYY-MM"
  const allDatesForMonth = [...new Set(
    D.recent_by_base.all_detail
      .map(r => r.date)
      .filter(d => d.startsWith(month))
  )].sort();
  const dates = allDatesForMonth.length
    ? allDatesForMonth
    : D.recent_by_base.dates; // fallback to default window if no match

  // ── Aggregate display data for the selected month ──
  const counts = {};
  dates.forEach(d => counts[d] = 0);
  D.recent_by_base.all_detail.forEach(r => {
    if (!counts.hasOwnProperty(r.date)) return;
    if (base     !== 'All' && r.base     !== base)     return;
    if (aircraft !== 'All' && r.aircraft !== aircraft) return;
    if (seat     !== 'All' && r.seat     !== seat)     return;
    if (region   !== 'All' && r.region   !== region)   return;
    counts[r.date] += r.count;
  });

  // ── Compute std dev threshold from full history ──
  const allDayCounts = {};
  D.recent_by_base.all_detail.forEach(r => {
    if (base     !== 'All' && r.base     !== base)     return;
    if (aircraft !== 'All' && r.aircraft !== aircraft) return;
    if (seat     !== 'All' && r.seat     !== seat)     return;
    if (region   !== 'All' && r.region   !== region)   return;
    allDayCounts[r.date] = (allDayCounts[r.date] || 0) + r.count;
  });
  const allVals = Object.values(allDayCounts);
  let stdDevLine = null;
  if (allVals.length >= 2) {
    const mean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
    const variance = allVals.reduce((s, v) => s + (v - mean) ** 2, 0) / allVals.length;
    stdDevLine = Math.round((mean + 1.5 * Math.sqrt(variance)) * 10) / 10;
  }

  const labels = dates.map(d => {
    const p = d.replace('/', '-').split('-');
    return p[1] + '/' + p[2];
  });
  const data = dates.map(d => counts[d] || 0);

  if (recentBarChart) recentBarChart.destroy();
  const datasets = [
    {
      label: 'Open Trips Rows',
      data,
      backgroundColor: data.map(v => stdDevLine !== null && v > stdDevLine
        ? 'rgba(185,28,28,.8)' : 'rgba(37,99,168,.7)'),
      borderColor: data.map(v => stdDevLine !== null && v > stdDevLine
        ? '#b91c1c' : '#2563a8'),
      borderWidth: 1,
      order: 2,
    }
  ];
  if (stdDevLine !== null) {
    datasets.push({
      label: '1.5σ threshold (' + stdDevLine + ')',
      data: dates.map(() => stdDevLine),
      type: 'line',
      borderColor: 'rgba(185,28,28,.65)',
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
      order: 1,
    });
  }

  recentBarChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: stdDevLine !== null,
          position: 'bottom',
          labels: { boxWidth: 14, font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              if (stdDevLine === null) return;
              const v = items[0].raw;
              return v > stdDevLine
                ? ['Above threshold (+' + (v - stdDevLine).toFixed(0) + ' rows)']
                : [];
            }
          }
        }
      },
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
  let total = 0, rf = 0;
  detail.forEach(r => {
    if (base     !== 'All' && r.base     !== base)     return;
    if (aircraft !== 'All' && r.aircraft !== aircraft) return;
    if (seat     !== 'All' && r.seat     !== seat)     return;
    if (region   !== 'All' && r.region   !== region)   return;
    total += r.total; rf += r.rf;
  });
  // PM: use deduplicated count from pm_page.daily
  let pm = 0;
  if (D.pm_page) {
    D.pm_page.daily.forEach(r => {
      if (r.month    !== month)                      return;
      if (base     !== 'All' && r.base     !== base)     return;
      if (aircraft !== 'All' && r.aircraft !== aircraft) return;
      if (seat     !== 'All' && r.seat     !== seat)     return;
      if (region   !== 'All' && r.region   !== region)   return;
      pm += r.count;
    });
  }
  document.getElementById('card-total').textContent = total.toLocaleString();
  document.getElementById('card-rf').textContent    = rf.toLocaleString();
  document.getElementById('card-pm').textContent    = pm.toLocaleString();
}

/* ── Tab logic ── */
function initTabs(containerSel, onSwitch) {
  document.querySelectorAll(containerSel + ' .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bar   = btn.closest('.tab-bar');
      const wrap  = btn.closest('.tab-container');
      bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      wrap.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      wrap.querySelector('#' + btn.dataset.tab).classList.add('active');
      if (onSwitch) onSwitch(btn.dataset.tab);
    });
  });
}

/* ── Table builder ── */
function buildTable(tbodyId, rows, col_keys, rowKey, showTotal, outlierFn) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  let grandTotals = {};
  col_keys.forEach(function(k) { grandTotals[k] = 0; });
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
    const mon  = monSel.value,   base = cBaseSel.value,
          ac   = cAcSel.value,   seat = cSeatSel.value,
          reg  = cRegSel.value;
    updateCards(D, mon, base, ac, seat, reg);
    makeRecentBar(D, mon, base, ac, seat, reg);
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
               D.daily.all_bases.col_keys, 'Monthly Open Trips Rows – All Bases', true);

  // All bases daily line
  makeLineChart('daily-all-line', D.daily.all_bases.rows,
                D.daily.all_bases.col_keys, '');

  // 737 CA bar
  if (D.daily['737_CA'] && D.daily['737_CA'].col_keys.length) {
    makeBarChart('daily-737-monthly-bar', D.daily['737_CA'].monthly,
                 D.daily['737_CA'].col_keys, 'Monthly Open Trips Rows – 737 CA', true);
    makeLineChart('daily-737-line', D.daily['737_CA'].rows,
                  D.daily['737_CA'].col_keys, '');
  }

  // Tables
  buildTableHeader('daily-all-thead', D.daily.all_bases.col_keys, 'Date', true);
  buildTable('daily-all-tbody', D.daily.all_bases.rows, D.daily.all_bases.col_keys, 'date', true, null);
}

function initRF(D) {
  const P = D.rf_page;
  if (!P) return;

  // ── Shared populate helper ──
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

  // ── Stats helpers ──
  function stdDevStats(vals) {
    if (vals.length < 2) return { mean: vals[0] || 0, sd: 0, threshold: Infinity };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd   = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    return { mean, sd, threshold: mean + 1.5 * sd };
  }

  const minsToHHMM = m => {
    const h = Math.floor(Math.abs(m) / 60), mm = Math.abs(m) % 60;
    return (m < 0 ? '-' : '') + h + ':' + String(mm).padStart(2, '0');
  };

  // ─────────────────────────────────────────────────────────────────
  // TAB 1 — Daily Reserve Volume
  // ─────────────────────────────────────────────────────────────────
  const lastMon    = P.months[P.months.length - 1] || '';
  const rfMonSel   = populate('rf-month-sel',    P.months,   lastMon);
  const rfBasSel   = populate('rf-base-sel',     P.bases,    'All');
  const rfAcSel    = populate('rf-aircraft-sel', P.aircraft, 'All');
  const rfStSel    = populate('rf-seat-sel',     P.seats,    'All');
  const rfRgSel    = populate('rf-region-sel',   P.regions,  'All');

  // 60-day sparkline (unfiltered)
  (function() {
    const ctx = document.getElementById('rf-sparkline');
    if (!ctx) return;
    const rows = P.sparkline;
    const MARKED = new Set([0, 3, 5]);
    const labels = rows.map(r => {
      if (MARKED.has(r.weekday)) {
        const p = r.date.replace('/', '-').split('-');
        return p[1] + '/' + p[2];
      }
      return '';
    });
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: rows.map(r => r.count),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,.15)',
          borderWidth: 1.5,
          pointRadius: rows.map(r => MARKED.has(r.weekday) ? 3 : 0),
          pointBackgroundColor: rows.map(r =>
            r.weekday === 5 ? '#c75b00' : r.weekday === 0 ? '#2563a8' : '#15803d'),
          tension: 0.4, fill: true,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => rows[items[0].dataIndex].date.replace('/', '-'),
              label:  (item) => 'Reserve trips: ' + item.raw.toLocaleString()
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: false,
              color: (c) => {
                const lbl = labels[c.index] || '';
                if (!lbl) return 'transparent';
                const wd = rows[c.index] ? rows[c.index].weekday : -1;
                return wd === 5 ? '#c75b00' : wd === 0 ? '#2563a8' : '#15803d';
              }
            },
            grid: { display: false }
          },
          y: { display: false }
        }
      }
    });
  })();

  function rfFilter(r, month, base, ac, seat, region) {
    if (r.month    !== month)                    return false;
    if (base   !== 'All' && r.base     !== base)   return false;
    if (ac     !== 'All' && r.aircraft !== ac)     return false;
    if (seat   !== 'All' && r.seat     !== seat)   return false;
    if (region !== 'All' && r.region   !== region) return false;
    return true;
  }

  let rfDailyChart = null;
  function refreshRFDaily() {
    const month = rfMonSel.value, base = rfBasSel.value,
          ac    = rfAcSel.value,  seat = rfStSel.value,
          region = rfRgSel.value;

    // ── Summary cards ──
    let rfTotal = 0, otTotal = 0, pmTotal = 0;
    P.daily.forEach(r => {
      if (!rfFilter(r, month, base, ac, seat, region)) return;
      rfTotal += r.count;
    });
    const mcDetail = (D.monthly_cards.detail[month] || []);
    mcDetail.forEach(r => {
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      otTotal += r.total;
    });
    if (D.pm_page) {
      D.pm_page.daily.forEach(r => {
        if (!rfFilter(r, month, base, ac, seat, region)) return;
        pmTotal += r.count;
      });
    }
    document.getElementById('rf-card-total').textContent = rfTotal.toLocaleString();
    document.getElementById('rf-card-ot').textContent    = otTotal.toLocaleString();
    document.getElementById('rf-card-pm').textContent    = pmTotal.toLocaleString();

    // ── Std dev threshold from full history (filtered) ──
    const allDayMap = {};
    P.daily.forEach(r => {
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      allDayMap[r.day] = (allDayMap[r.day] || 0) + r.count;
    });
    const { threshold } = stdDevStats(Object.values(allDayMap).filter(v => v > 0));

    // ── Daily bar chart for selected month ──
    const dayMap = {};
    P.daily.forEach(r => {
      if (!rfFilter(r, month, base, ac, seat, region)) return;
      dayMap[r.day] = (dayMap[r.day] || 0) + r.count;
    });
    const days = Object.keys(dayMap).sort();
    const barLabels = days.map(d => { const p = d.replace('/', '-').split('-'); return p[1] + '/' + p[2]; });
    const barData   = days.map(d => dayMap[d]);
    const isOutlier = barData.map(v => isFinite(threshold) && v > threshold);

    if (rfDailyChart) rfDailyChart.destroy();
    const barCtx = document.getElementById('rf-daily-bar');
    if (barCtx) {
      // 7-day rolling average
      const rolling7 = barData.map((_, i) => {
        const window = barData.slice(Math.max(0, i - 6), i + 1);
        return Math.round(window.reduce((a, b) => a + b, 0) / window.length * 10) / 10;
      });

      const datasets = [{
        label: 'Reserve Trips',
        data:  barData,
        backgroundColor: isOutlier.map(o => o ? 'rgba(199,91,0,.8)' : 'rgba(199,131,11,.7)'),
        borderColor:     isOutlier.map(o => o ? '#c75b00' : '#b45309'),
        borderWidth: 1,
        order: 3,
      }, {
        label: '7-day rolling avg',
        data:  rolling7,
        type:  'line',
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
        order: 2,
      }];
      if (isFinite(threshold)) {
        datasets.push({
          label: '1.5σ threshold (' + Math.round(threshold) + ')',
          data:  days.map(() => Math.round(threshold * 10) / 10),
          type: 'line', borderColor: 'rgba(199,91,0,.65)',
          borderWidth: 1.5, borderDash: [6, 4],
          pointRadius: 0, fill: false, order: 1,
        });
      }
      rfDailyChart = new Chart(barCtx, {
        type: 'bar',
        data: { labels: barLabels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: isFinite(threshold), position: 'bottom',
                      labels: { boxWidth: 14, font: { size: 10 } } },
            tooltip: { callbacks: {
              afterBody: (items) => {
                if (!isFinite(threshold)) return;
                const v = items[0].raw;
                return v > threshold
                  ? ['⚠ Above threshold (+' + (v - threshold).toFixed(0) + ' trips)'] : [];
              }
            }}
          },
          scales: {
            x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { beginAtZero: true, ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  }

  [rfMonSel, rfBasSel, rfAcSel, rfStSel, rfRgSel].forEach(s => {
    if (s) s.addEventListener('change', refreshRFDaily);
  });
  refreshRFDaily();

  // ─────────────────────────────────────────────────────────────────
  // TAB 2 — Reserve Seniority
  // ─────────────────────────────────────────────────────────────────
  const rfsMonSel = populate('rfs-month-sel',    P.months,   lastMon);
  const rfsBasSel = populate('rfs-base-sel',     P.bases,    'All');
  const rfsAcSel  = populate('rfs-aircraft-sel', P.aircraft, 'All');
  const rfsStSel  = populate('rfs-seat-sel',     P.seats,    'All');
  const rfsRgSel  = populate('rfs-region-sel',   P.regions,  'All');

  let rfsChart = null;

  function refreshRFSeniority() {
    const month  = rfsMonSel.value, base = rfsBasSel.value,
          ac     = rfsAcSel.value,  seat = rfsStSel.value,
          region = rfsRgSel.value;

    const rows = P.seniority.filter(r => {
      if (r.month !== month)                         return false;
      if (base   !== 'All' && r.base     !== base)   return false;
      if (ac     !== 'All' && r.aircraft !== ac)     return false;
      if (seat   !== 'All' && r.seat     !== seat)   return false;
      if (region !== 'All' && r.region   !== region) return false;
      return true;
    });

    // ── Aggregate per seniority across bid groups ──
    const senMap = {};
    rows.forEach(r => {
      const k = String(r.seniority);
      if (!senMap[k]) senMap[k] = { rf: 0, mins: 0 };
      senMap[k].rf   += r.rf_count;
      senMap[k].mins += r.pay_mins;
    });
    const senKeys  = Object.keys(senMap).sort((a, b) => Number(b) - Number(a));
    const rfCounts = senKeys.map(k => senMap[k].rf);
    const totalTrips = rfCounts.reduce((a, b) => a + b, 0);

    // ── 1. Dual 1.5σ thresholds — flag both heavy users AND avoiders ──
    const { mean, sd, threshold: upperThreshold } = stdDevStats(rfCounts.length ? rfCounts : [0]);
    const lowerThreshold = Math.max(0, mean - 1.5 * sd);   // floored at 0, can't fly negative trips
    const zScore = k => sd > 0 ? ((senMap[k].rf - mean) / sd) : 0;

    // ── 2. Seniority burden index ──────────────────────────────────────────
    // Split pilots into senior half (higher seniority numbers = less senior)
    // and junior half (lower seniority numbers = more senior).
    // Note: seniority number 1 = most senior. Lower number = more senior.
    // senKeys is sorted descending (highest seniority# first = most junior first).
    // So senKeys[0..half-1] = most junior half, senKeys[half..] = most senior half.
    const half        = Math.floor(senKeys.length / 2);
    const juniorKeys  = senKeys.slice(0, half);              // higher seniority numbers = juniors
    const seniorKeys  = senKeys.slice(half);                 // lower seniority numbers = seniors
    const juniorTrips = juniorKeys.reduce((s, k) => s + senMap[k].rf, 0);
    const seniorTrips = seniorKeys.reduce((s, k) => s + senMap[k].rf, 0);
    const juniorCount = juniorKeys.length || 1;
    const seniorCount = seniorKeys.length || 1;
    // Trips-per-pilot for each cohort
    const juniorRate  = juniorTrips / juniorCount;
    const seniorRate  = seniorTrips / seniorCount;
    // Burden gap: how many more trips per pilot is the junior cohort absorbing?
    // Positive = juniors flying more per pilot; negative = seniors flying more per pilot
    const burdenGap   = juniorRate - seniorRate;
    const burdenPct   = seniorRate > 0
      ? ((juniorRate - seniorRate) / ((juniorRate + seniorRate) / 2) * 100)
      : (juniorRate > 0 ? 100 : 0);
    // Flag when junior cohort rate exceeds senior rate by 20%+ (adjustable threshold)
    const burdenFlag  = burdenGap > 0 && burdenPct >= 20;

    // ── Update seniority burden index bar ──────────────────────────────────
    const concEl = document.getElementById('rfs-concentration-bar');
    if (concEl) {
      const gapLabel  = burdenGap > 0
        ? `Higher-numbered half averaging <strong>${burdenGap.toFixed(2)} more trips/seniority number</strong> than the lower-numbered half`
        : burdenGap < 0
          ? `Lower-numbered half averaging <strong>${Math.abs(burdenGap).toFixed(2)} more trips/seniority number</strong> than the higher-numbered half`
          : 'Even distribution across both halves of the seniority group';
      const barLeftPct  = Math.min(100, seniorRate / (Math.max(juniorRate, seniorRate) || 1) * 100);
      const barRightPct = Math.min(100, juniorRate  / (Math.max(juniorRate, seniorRate) || 1) * 100);
      concEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
          <div style="flex:1;min-width:260px">
            <div style="font-weight:700;font-size:.88rem;color:${burdenFlag ? '#c75b00' : 'var(--navy)'};margin-bottom:4px">
              Seniority Burden Index
              ${burdenFlag ? '&nbsp;<span class="tag-outlier">&#9888; Uneven Distribution</span>' : ''}
            </div>
            <div style="font-size:.8rem;color:var(--gray4);margin-bottom:8px">${gapLabel}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.78rem">
              <div>
                <div style="color:var(--gray3);margin-bottom:2px">Senior half (${seniorCount} seniority numbers)</div>
                <div style="background:var(--gray1);border-radius:3px;height:10px;overflow:hidden;margin-bottom:2px">
                  <div style="width:${barLeftPct.toFixed(1)}%;height:100%;background:#2563a8;border-radius:3px"></div>
                </div>
                <div style="font-family:var(--font-mono);color:var(--navy)">${seniorTrips} trips &nbsp;(${seniorRate.toFixed(2)}/pilot)</div>
              </div>
              <div>
                <div style="color:var(--gray3);margin-bottom:2px">Junior half (${juniorCount} seniority numbers)</div>
                <div style="background:var(--gray1);border-radius:3px;height:10px;overflow:hidden;margin-bottom:2px">
                  <div style="width:${barRightPct.toFixed(1)}%;height:100%;background:${burdenFlag ? '#c75b00' : '#2563a8'};border-radius:3px"></div>
                </div>
                <div style="font-family:var(--font-mono);color:${burdenFlag ? '#c75b00' : 'var(--navy)'};">${juniorTrips} trips &nbsp;(${juniorRate.toFixed(2)}/pilot)</div>
              </div>
            </div>
          </div>
          <div style="font-size:.75rem;color:var(--gray3);border-left:1px solid var(--gray1);padding-left:14px;min-width:160px;line-height:2">
            Mean trips/seniority: <strong>${mean.toFixed(2)}</strong><br>
            Std deviation (&sigma;): <strong>${sd.toFixed(2)}</strong><br>
            Upper threshold: <strong>${upperThreshold.toFixed(1)}</strong><br>
            Lower threshold: <strong>${lowerThreshold.toFixed(1)}</strong><br>
            Burden gap: <strong style="color:${burdenFlag ? '#c75b00' : 'var(--navy)'}">${burdenGap >= 0 ? '+' : ''}${burdenGap.toFixed(2)} trips/pilot (${burdenPct >= 0 ? '+' : ''}${burdenPct.toFixed(0)}%)</strong>
          </div>
        </div>`;
    }

    // ── Build chart points with dual outlier flags ─────────────────────────
    const chartPts = senKeys.map(k => ({
      seniority:   k,
      rf:          senMap[k].rf,
      mins:        senMap[k].mins,
      hhmm:        minsToHHMM(senMap[k].mins),
      z:           zScore(k),
      heavyUser:   isFinite(upperThreshold) && senMap[k].rf > upperThreshold,
      avoider:     sd > 0 && senMap[k].rf < lowerThreshold,
    }));

    if (rfsChart) { rfsChart.destroy(); rfsChart = null; }
    const senCtx = document.getElementById('rfs-chart');
    if (senCtx && chartPts.length) {
      const ptColor = d =>
        d.heavyUser ? '#c75b00' :      // orange = heavy user
        d.avoider   ? '#2563a8' :      // blue   = statistical avoider
                      '#b45309';       // amber  = normal
      const ptRadius = d => (d.heavyUser || d.avoider) ? 5 : (chartPts.length > 100 ? 2 : 3);
      try {
        const datasets = [
          {
            label: 'Reserve Trips',
            data:  chartPts.map(d => d.rf),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,.10)',
            borderWidth: 1.5,
            pointRadius: chartPts.map(ptRadius),
            pointBackgroundColor: chartPts.map(ptColor),
            pointBorderColor:     chartPts.map(ptColor),
            tension: 0.3,
            fill: true,
            order: 3,
          }
        ];
        if (isFinite(upperThreshold) && sd > 0) {
          datasets.push({
            label: 'Upper 1.5σ (heavy user)',
            data:  chartPts.map(() => Math.round(upperThreshold * 10) / 10),
            type: 'line', borderColor: 'rgba(199,91,0,.75)',
            borderWidth: 1.5, borderDash: [6, 4],
            pointRadius: 0, fill: false, order: 2,
          });
          if (lowerThreshold > 0) {
            datasets.push({
              label: 'Lower 1.5σ (avoider)',
              data:  chartPts.map(() => Math.round(lowerThreshold * 10) / 10),
              type: 'line', borderColor: 'rgba(37,99,168,.75)',
              borderWidth: 1.5, borderDash: [4, 6],
              pointRadius: 0, fill: false, order: 1,
            });
          }
        }
        rfsChart = new Chart(senCtx, {
          type: 'line',
          data: { labels: chartPts.map(d => d.seniority), datasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: true, position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 10 } } },
              tooltip: { callbacks: {
                title:      (items) => 'Seniority #' + chartPts[items[0].dataIndex].seniority,
                afterTitle: (items) => {
                  const pt = chartPts[items[0].dataIndex];
                  if (pt.heavyUser) return '⚠ Heavily used — above upper threshold';
                  if (pt.avoider)   return '↓ Lightly used — below lower threshold';
                  return '';
                },
                label:      (item)  => 'Reserve Trips: ' + item.raw,
                afterLabel: (item)  => {
                  const pt = chartPts[item.dataIndex];
                  const zStr = sd > 0 ? (pt.z >= 0 ? '+' : '') + pt.z.toFixed(2) : 'N/A';
                  return ['Pay: ' + pt.hhmm, 'Z-Score: ' + zStr];
                },
              }}
            },
            scales: {
              x: { title: { display: true, text: 'Seniority Number ← more senior    more junior →',
                            font: { size: 10 }, color: '#7a8aab' },
                   ticks: { font: { size: 9 }, maxTicksLimit: 20 } },
              y: { title: { display: true, text: 'Reserve Trips',
                            font: { size: 10 }, color: '#7a8aab' },
                   beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 } }
            }
          }
        });
      } catch(e) { console.error('RF seniority chart error:', e); }
    }

    // ── Table — sorted by rf_count desc ──────────────────────────────────
    const tbody = document.getElementById('rfs-tbody');
    const tfoot = document.getElementById('rfs-tfoot');
    if (!tbody) return;

    const sortedRows = [...rows].sort((a, b) => b.rf_count - a.rf_count || a.seniority - b.seniority);
    let totalRF = 0, totalMins = 0;
    let html = '';
    sortedRows.forEach((r, i) => {
      const senKey  = String(r.seniority);
      const rowZ    = sd > 0 ? ((senMap[senKey] ? senMap[senKey].rf : r.rf_count) - mean) / sd : 0;
      const isHeavy = isFinite(upperThreshold) && r.rf_count > upperThreshold;
      const isAvoid = sd > 0 && r.rf_count < lowerThreshold;
      const zFmt    = sd > 0 ? (rowZ >= 0 ? '+' : '') + rowZ.toFixed(2) : '—';
      // Z-score coloring: orange for heavy users, blue for avoiders, gray for normal
      const zColor  = isHeavy ? ';color:#c75b00;font-weight:700'
                    : isAvoid ? ';color:#2563a8;font-weight:700'
                    : rowZ < 0 ? ';color:var(--gray3)' : '';
      // Trip count coloring mirrors z-score
      const cntColor = isHeavy ? ';font-weight:700;color:#c75b00'
                     : isAvoid ? ';font-weight:700;color:#2563a8' : '';
      // Flag badge
      const flag = isHeavy ? '<span class="tag-outlier" style="background:#c75b00;color:#fff">&#9650; High</span>'
                 : isAvoid ? '<span class="tag-outlier" style="background:#2563a8;color:#fff">&#9660; Low</span>'
                 : '';
      const cls = i % 2 === 1 ? ' style="background:var(--gray0)"' : '';
      html += `<tr${cls}>
        <td>${r.seniority}</td>
        <td>${r.base}</td><td>${r.aircraft}</td>
        <td>${r.seat}</td><td>${r.region}</td>
        <td style="text-align:right${cntColor}">${r.rf_count.toLocaleString()}</td>
        <td style="text-align:right;font-family:var(--font-mono)${zColor}">${zFmt}</td>
        <td style="text-align:right;font-family:var(--font-mono)">${r.pay_hhmm}</td>
        <td style="text-align:center">${flag}</td>
      </tr>`;
      totalRF   += r.rf_count;
      totalMins += r.pay_mins;
    });
    tbody.innerHTML = html || '<tr><td colspan="9" style="text-align:center;color:var(--gray3)">No data for selected filters</td></tr>';

    if (tfoot) {
      tfoot.innerHTML = `<tr class="grand-total">
        <td colspan="5">TOTAL (${sortedRows.length} pilots)</td>
        <td style="text-align:right">${totalRF.toLocaleString()}</td>
        <td></td>
        <td style="text-align:right;font-family:var(--font-mono)">${minsToHHMM(totalMins)}</td>
        <td></td>
      </tr>`;
    }
  }

  [rfsMonSel, rfsBasSel, rfsAcSel, rfsStSel, rfsRgSel].forEach(s => {
    if (s) s.addEventListener('change', refreshRFSeniority);
  });

  // ─────────────────────────────────────────────────────────────────
  // TAB 3 — Monthly Change in Reserves
  // ─────────────────────────────────────────────────────────────────
  const rfpMonSel = populate('rfp-month-sel',    P.months,   lastMon);
  const rfpBasSel = populate('rfp-base-sel',     P.bases,    'All');
  const rfpAcSel  = populate('rfp-aircraft-sel', P.aircraft, 'All');
  const rfpStSel  = populate('rfp-seat-sel',     P.seats,    'All');
  const rfpRgSel  = populate('rfp-region-sel',   P.regions,  'All');

  function refreshRFDeltaTable() {
    const base = rfpBasSel.value, ac = rfpAcSel.value,
          seat = rfpStSel.value,  region = rfpRgSel.value;
    const months = P.months;
    const minsByMonth = {};
    months.forEach(mo => { minsByMonth[mo] = 0; });
    P.pay_detail.forEach(r => {
      if (!minsByMonth.hasOwnProperty(r.month))     return;
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      minsByMonth[r.month] += r.pay_mins;
    });

    // Std dev across all months to flag unusually high months
    const monthVals = months.map(mo => minsByMonth[mo]);
    const { threshold: moThreshold } = stdDevStats(monthVals.filter(v => v > 0));

    const wrap = document.getElementById('rf-pay-delta-wrap');
    if (!wrap || !months.length) return;
    let html = `<table style="font-size:.8rem;border-collapse:collapse;min-width:520px">
      <thead><tr>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:left">Month</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:right">Total Hours</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:right">Change (HH:MM)</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:right">Change (%)</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:center">Trend</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:center">Demand</th>
      </tr></thead><tbody>`;
    months.forEach((mo, i) => {
      const cur  = minsByMonth[mo];
      const prev = i > 0 ? minsByMonth[months[i-1]] : null;
      const diffMins = prev !== null ? cur - prev : null;
      const diffPct  = prev ? ((cur - prev) / prev * 100) : null;
      const hrs  = Math.round(cur / 60 * 10) / 10;
      const bg   = i % 2 === 1 ? 'background:var(--gray0)' : '';
      const isHighDemand = isFinite(moThreshold) && cur > moThreshold;
      let deltaHHMM = '—', deltaPct = '—', arrow = '—', deltaColor = 'inherit';
      if (diffMins !== null) {
        deltaHHMM  = (diffMins >= 0 ? '+' : '') + minsToHHMM(diffMins);
        deltaPct   = (diffPct  >= 0 ? '+' : '') + diffPct.toFixed(1) + '%';
        deltaColor = diffMins >= 0 ? '#15803d' : '#b91c1c';
        arrow      = diffMins > 0 ? '&#9650;' : diffMins < 0 ? '&#9660;' : '&#9644;';
      }
      const demandBadge = isHighDemand
        ? '<span class="tag-outlier">&#9888; High</span>' : '';
      html += `<tr style="${bg}">
        <td style="padding:5px 12px;font-family:var(--font-mono)">${mo}</td>
        <td style="padding:5px 12px;text-align:right;font-family:var(--font-mono)${isHighDemand ? ';font-weight:700;color:#c75b00' : ''}">${hrs}</td>
        <td style="padding:5px 12px;text-align:right;font-family:var(--font-mono);color:${deltaColor}">${deltaHHMM}</td>
        <td style="padding:5px 12px;text-align:right;color:${deltaColor};font-weight:600">${deltaPct}</td>
        <td style="padding:5px 12px;text-align:center;color:${deltaColor};font-size:1rem">${arrow}</td>
        <td style="padding:5px 12px;text-align:center">${demandBadge}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  let rfPayChart = null;
  function refreshRFPayFiltered() {
    const month  = rfpMonSel.value, base = rfpBasSel.value,
          ac     = rfpAcSel.value,  seat = rfpStSel.value,
          region = rfpRgSel.value;
    const bidMap = {};
    P.pay_detail.forEach(r => {
      if (r.month !== month)                         return;
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      const key = [r.base, r.aircraft, r.seat, r.region].join('/');
      bidMap[key] = (bidMap[key] || 0) + r.pay_mins;
    });
    const keys = Object.keys(bidMap).sort((a, b) => bidMap[b] - bidMap[a]);
    const data = keys.map(k => Math.round(bidMap[k] / 60 * 10) / 10);
    if (rfPayChart) { rfPayChart.destroy(); rfPayChart = null; }
    const ctx = document.getElementById('rf-pay-filtered-bar');
    if (ctx) {
      rfPayChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: keys,
          datasets: [{ label: 'Reserve Hours', data,
            backgroundColor: 'rgba(199,131,11,.7)',
            borderColor: '#b45309', borderWidth: 1 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: (item) => item.raw + ' hrs' } } },
          scales: {
            x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { beginAtZero: true,
                 title: { display: true, text: 'Hours', font: { size: 10 }, color: '#7a8aab' },
                 ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  }

  [rfpBasSel, rfpAcSel, rfpStSel, rfpRgSel].forEach(s => {
    if (s) s.addEventListener('change', () => { refreshRFDeltaTable(); refreshRFPayFiltered(); });
  });
  if (rfpMonSel) rfpMonSel.addEventListener('change', refreshRFPayFiltered);

  // ── Wire tabs — lazy-render seniority and monthly tabs ──
  let rfsSenRendered = false, rfpMonRendered = false;
  initTabs('.tab-container', function(tabId) {
    if (tabId === 'rf-tab-seniority' && !rfsSenRendered) {
      rfsSenRendered = true; refreshRFSeniority();
    } else if (tabId === 'rf-tab-seniority') {
      refreshRFSeniority();
    }
    if (tabId === 'rf-tab-monthly' && !rfpMonRendered) {
      rfpMonRendered = true; refreshRFDeltaTable(); refreshRFPayFiltered();
    } else if (tabId === 'rf-tab-monthly') {
      refreshRFPayFiltered();
    }
  });
}

function initPM(D) {
  const P = D.pm_page;
  if (!P) return;

  // ── Shared populate helper ──
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

  // ── Sparkline (60-day all-bases, no filter) ──
  (function() {
    const ctx = document.getElementById('pm-sparkline');
    if (!ctx) return;
    const rows = P.sparkline;
    const MARKED = new Set([0, 3, 5]);
    const labels = rows.map(r => {
      if (MARKED.has(r.weekday)) {
        const p = r.date.replace('/', '-').split('-');
        return p[1] + '/' + p[2];
      }
      return '';
    });
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: rows.map(r => r.count),
          borderColor: '#34d399',
          backgroundColor: 'rgba(52,211,153,.15)',
          borderWidth: 1.5,
          pointRadius: rows.map(r => MARKED.has(r.weekday) ? 3 : 0),
          pointBackgroundColor: rows.map(r =>
            r.weekday === 5 ? '#c75b00' : r.weekday === 0 ? '#2563a8' : '#15803d'),
          tension: 0.4, fill: true,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => rows[items[0].dataIndex].date.replace('/', '-'),
              label:  (item) => 'Premium trips: ' + item.raw.toLocaleString()
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: { size: 9 }, maxRotation: 0, autoSkip: false,
              color: (c) => {
                const lbl = labels[c.index] || '';
                if (!lbl) return 'transparent';
                const wd = rows[c.index] ? rows[c.index].weekday : -1;
                return wd === 5 ? '#c75b00' : wd === 0 ? '#2563a8' : '#15803d';
              }
            },
            grid: { display: false }
          },
          y: { display: false }
        }
      }
    });
  })();

  // ── PM Analysis tab filters ──
  const lastMon  = P.months[P.months.length - 1] || '';
  const pmMonSel = populate('pm-month-sel',    P.months,    lastMon);
  const pmBasSel = populate('pm-base-sel',     P.bases,     'All');
  const pmAcSel  = populate('pm-aircraft-sel', P.aircraft,  'All');
  const pmStSel  = populate('pm-seat-sel',     P.seats,     'All');
  const pmRgSel  = populate('pm-region-sel',   P.regions,   'All');

  let pmBarChart = null;

  function pmFilter(r, month, base, ac, seat, region) {
    if (r.month    !== month)                    return false;
    if (base   !== 'All' && r.base     !== base)   return false;
    if (ac     !== 'All' && r.aircraft !== ac)     return false;
    if (seat   !== 'All' && r.seat     !== seat)   return false;
    if (region !== 'All' && r.region   !== region) return false;
    return true;
  }

  function refreshPMAnalysis() {
    const month = pmMonSel.value, base = pmBasSel.value,
          ac    = pmAcSel.value,  seat = pmStSel.value,
          region = pmRgSel.value;

    // ── Cards: filter monthly_cards for Total Open Trips + Reserve, pm_page.daily for Premium ──
    let pmTotal = 0, otTotal = 0, rfTotal = 0;
    P.daily.forEach(r => {
      if (!pmFilter(r, month, base, ac, seat, region)) return;
      pmTotal += r.count;
    });
    // Open Trips + Reserve from monthly_cards detail
    const mcDetail = (D.monthly_cards.detail[month] || []);
    mcDetail.forEach(r => {
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      otTotal += r.total; rfTotal += r.rf;
    });
    document.getElementById('pm-card-total').textContent = pmTotal.toLocaleString();
    document.getElementById('pm-card-ot').textContent    = otTotal.toLocaleString();
    document.getElementById('pm-card-rf').textContent    = rfTotal.toLocaleString();

    // ── Bar chart: daily PM counts for the selected month ──
    const dayMap = {};
    P.daily.forEach(r => {
      if (!pmFilter(r, month, base, ac, seat, region)) return;
      dayMap[r.day] = (dayMap[r.day] || 0) + r.count;
    });
    const days  = Object.keys(dayMap).sort();
    const barLabels = days.map(d => {
      const p = d.replace('/', '-').split('-');
      return p[1] + '/' + p[2];
    });
    const barData = days.map(d => dayMap[d]);

    if (pmBarChart) pmBarChart.destroy();
    const barCtx = document.getElementById('pm-monthly-bar');
    if (barCtx) {
      pmBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: barLabels,
          datasets: [{
            label: 'Premium Trips',
            data: barData,
            backgroundColor: 'rgba(52,211,153,.7)',
            borderColor: '#15803d',
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { beginAtZero: true, ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  }

  [pmMonSel, pmBasSel, pmAcSel, pmStSel, pmRgSel].forEach(s => {
    if (s) s.addEventListener('change', refreshPMAnalysis);
  });
  refreshPMAnalysis();

  // ── Seniority Analysis tab ──
  const senMonSel = populate('sen-month-sel',    P.months,   lastMon);
  const senBasSel = populate('sen-base-sel',     P.bases,    'All');
  const senAcSel  = populate('sen-aircraft-sel', P.aircraft, 'All');
  const senStSel  = populate('sen-seat-sel',     P.seats,    'All');
  const senRgSel  = populate('sen-region-sel',   P.regions,  'All');

  let senChart = null;

  function refreshSeniority() {
    const month  = senMonSel.value,  base = senBasSel.value,
          ac     = senAcSel.value,   seat = senStSel.value,
          region = senRgSel.value;

    const rows = P.seniority.filter(r => {
      if (r.month !== month)                         return false;
      if (base   !== 'All' && r.base     !== base)   return false;
      if (ac     !== 'All' && r.aircraft !== ac)     return false;
      if (seat   !== 'All' && r.seat     !== seat)   return false;
      if (region !== 'All' && r.region   !== region) return false;
      return true;
    });
    rows.sort((a, b) => b.pay_mins - a.pay_mins);

    // ── Chart: x = seniority (high to low), y = flight hours ──
    // Aggregate across bases so each pilot is one point
    const senMap = {};
    rows.forEach(r => {
      const k = String(r.seniority);
      if (!senMap[k]) senMap[k] = { pm: 0, mins: 0 };
      senMap[k].pm   += r.pm_count;
      senMap[k].mins += r.pay_mins;
    });
    // Sort keys numerically descending (high seniority# left), keep as strings
    // to avoid Number(key) -> NaN round-trip bug on non-numeric seniority values
    const senKeys = Object.keys(senMap).sort((a, b) => Number(b) - Number(a));
    const chartPts = senKeys.map(k => {
      const s = senMap[k];
      return {
        seniority: k,
        hours: Math.round(s.mins / 60 * 10) / 10,
        pm:    s.pm,
        hhmm:  Math.floor(s.mins/60) + ':' + String(s.mins % 60).padStart(2,'0'),
      };
    });

    if (senChart) { senChart.destroy(); senChart = null; }
    const senCtx = document.getElementById('sen-chart');
    if (senCtx) {
      try {
        if (chartPts.length) {
          senChart = new Chart(senCtx, {
            type: 'line',
            data: {
              labels: chartPts.map(d => d.seniority),
              datasets: [{
                label: 'Premium Trips',
                data:  chartPts.map(d => d.pm),
                borderColor: '#34d399',
                backgroundColor: 'rgba(52,211,153,.12)',
                borderWidth: 1.5,
                pointRadius: chartPts.length > 100 ? 2 : 4,
                pointBackgroundColor: '#15803d',
                tension: 0.3,
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
                    title: (items) => 'Seniority #' + chartPts[items[0].dataIndex].seniority,
                    afterTitle: (items) => 'Pay: ' + chartPts[items[0].dataIndex].hhmm,
                    label: (item) => 'Premium Trips: ' + item.raw,
                  }
                }
              },
              scales: {
                x: {
                  title: { display: true, text: 'Seniority Number (high to low)',
                           font: { size: 10 }, color: '#7a8aab' },
                  ticks: { font: { size: 9 }, maxTicksLimit: 20 }
                },
                y: {
                  title: { display: true, text: 'Premium Trips',
                           font: { size: 10 }, color: '#7a8aab' },
                  beginAtZero: true,
                  ticks: { font: { size: 10 }, stepSize: 1 }
                }
              }
            }
          });
        }
      } catch(e) {
        console.error('Seniority chart error:', e);
      }
    }

    const tbody = document.getElementById('sen-tbody');
    const tfoot = document.getElementById('sen-tfoot');
    if (!tbody) return;

    let totalPM = 0, totalMins = 0;
    let html = '';
    rows.forEach((r, i) => {
      const cls = i % 2 === 1 ? ' style="background:var(--gray0)"' : '';
      html += `<tr${cls}>
        <td>${r.seniority}</td>
        <td>${r.base}</td><td>${r.aircraft}</td>
        <td>${r.seat}</td><td>${r.region}</td>
        <td style="text-align:right">${r.pm_count.toLocaleString()}</td>
        <td style="text-align:right;font-family:var(--font-mono)">${r.pay_hhmm}</td>
      </tr>`;
      totalPM   += r.pm_count;
      totalMins += r.pay_mins;
    });
    tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:var(--gray3)">No data for selected filters</td></tr>';

    const hhmm = Math.floor(totalMins/60) + ':' + String(totalMins%60).padStart(2,'0');
    if (tfoot) {
      tfoot.innerHTML = `<tr class="grand-total">
        <td colspan="5">TOTAL (${rows.length} rows)</td>
        <td style="text-align:right">${totalPM.toLocaleString()}</td>
        <td style="text-align:right;font-family:var(--font-mono)">${hhmm}</td>
      </tr>`;
    }
  }

  [senMonSel, senBasSel, senAcSel, senStSel, senRgSel].forEach(s => {
    if (s) s.addEventListener('change', refreshSeniority);
  });
  // Don't call refreshSeniority() here — the tab is hidden and Chart.js
  // can't measure a canvas with display:none. It fires on first tab click instead.

  // ── Pay Analysis tab ──
  const payMonSel = populate('pay-month-sel',    P.months,   lastMon);
  const payBasSel = populate('pay-base-sel',     P.bases,    'All');
  const payAcSel  = populate('pay-aircraft-sel', P.aircraft, 'All');
  const payStSel  = populate('pay-seat-sel',     P.seats,    'All');
  const payRgSel  = populate('pay-region-sel',   P.regions,  'All');

  const minsToHHMM = m => {
    const h = Math.floor(Math.abs(m)/60), mm = Math.abs(m)%60;
    return (m < 0 ? '-' : '') + h + ':' + String(mm).padStart(2,'0');
  };

  // Delta table — shows all months, filtered by Base/Aircraft/Seat/Region only
  function refreshDeltaTable() {
    const base = payBasSel.value, ac = payAcSel.value,
          seat = payStSel.value,  region = payRgSel.value;
    const months = P.months;
    const minsByMonth = {};
    months.forEach(mo => { minsByMonth[mo] = 0; });
    P.pay_detail.forEach(r => {
      if (!minsByMonth.hasOwnProperty(r.month))       return;
      if (base   !== 'All' && r.base     !== base)     return;
      if (ac     !== 'All' && r.aircraft !== ac)       return;
      if (seat   !== 'All' && r.seat     !== seat)     return;
      if (region !== 'All' && r.region   !== region)   return;
      minsByMonth[r.month] += r.pay_mins;
    });

    const wrap = document.getElementById('pm-pay-delta-wrap');
    if (!wrap || !months.length) return;
    let html = `<table style="font-size:.8rem;border-collapse:collapse;min-width:480px">
      <thead><tr>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:left">Month</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:right">Total Hours</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:right">Change (HH:MM)</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:right">Change (%)</th>
        <th style="background:var(--navy);color:#fff;padding:6px 12px;text-align:center">Trend</th>
      </tr></thead><tbody>`;
    months.forEach((mo, i) => {
      const cur  = minsByMonth[mo];
      const prev = i > 0 ? minsByMonth[months[i-1]] : null;
      const diffMins = prev !== null ? cur - prev : null;
      const diffPct  = prev ? ((cur - prev) / prev * 100) : null;
      const hrs  = Math.round(cur / 60 * 10) / 10;
      const bg   = i % 2 === 1 ? 'background:var(--gray0)' : '';
      let deltaHHMM = '—', deltaPct = '—', arrow = '—', deltaColor = 'inherit';
      if (diffMins !== null) {
        deltaHHMM  = (diffMins >= 0 ? '+' : '') + minsToHHMM(diffMins);
        deltaPct   = (diffPct  >= 0 ? '+' : '') + diffPct.toFixed(1) + '%';
        deltaColor = diffMins >= 0 ? '#15803d' : '#b91c1c';
        arrow      = diffMins > 0 ? '&#9650;' : diffMins < 0 ? '&#9660;' : '&#9644;';
      }
      html += `<tr style="${bg}">
        <td style="padding:5px 12px;font-family:var(--font-mono)">${mo}</td>
        <td style="padding:5px 12px;text-align:right;font-family:var(--font-mono)">${hrs}</td>
        <td style="padding:5px 12px;text-align:right;font-family:var(--font-mono);color:${deltaColor}">${deltaHHMM}</td>
        <td style="padding:5px 12px;text-align:right;color:${deltaColor};font-weight:600">${deltaPct}</td>
        <td style="padding:5px 12px;text-align:center;color:${deltaColor};font-size:1rem">${arrow}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // Bid group chart — filtered by all 5 selectors including Month
  let payFilteredChart = null;
  function refreshPayFiltered() {
    const month  = payMonSel.value, base = payBasSel.value,
          ac     = payAcSel.value,  seat = payStSel.value,
          region = payRgSel.value;
    const bidMap = {};
    P.pay_detail.forEach(r => {
      if (r.month !== month)                         return;
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      const key = [r.base, r.aircraft, r.seat, r.region].join('/');
      bidMap[key] = (bidMap[key] || 0) + r.pay_mins;
    });
    const keys = Object.keys(bidMap).sort((a,b) => bidMap[b]-bidMap[a]);
    const data = keys.map(k => Math.round(bidMap[k] / 60 * 10) / 10);
    if (payFilteredChart) { payFilteredChart.destroy(); payFilteredChart = null; }
    const ctx = document.getElementById('pm-pay-filtered-bar');
    if (ctx) {
      payFilteredChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: keys,
          datasets: [{
            label: 'Premium Pay (hrs)',
            data,
            backgroundColor: 'rgba(37,99,168,.7)',
            borderColor: '#2563a8',
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (item) => item.raw + ' hrs' } }
          },
          scales: {
            x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { beginAtZero: true,
                 title: { display: true, text: 'Hours',
                          font: { size: 10 }, color: '#7a8aab' },
                 ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  }

  // All 5 filters trigger both; Month only triggers chart (table ignores it)
  [payBasSel, payAcSel, payStSel, payRgSel].forEach(s => {
    if (s) s.addEventListener('change', () => { refreshDeltaTable(); refreshPayFiltered(); });
  });
  if (payMonSel) payMonSel.addEventListener('change', refreshPayFiltered);

  // ── Wire tabs ──
  let senRendered = false;
  let payRendered = false;
  initTabs('.tab-container', function(tabId) {
    if (tabId === 'pm-tab-seniority' && !senRendered) {
      senRendered = true; refreshSeniority();
    } else if (tabId === 'pm-tab-seniority') {
      refreshSeniority();
    }
    if (tabId === 'pm-tab-pay' && !payRendered) {
      payRendered = true; refreshDeltaTable(); refreshPayFiltered();
    } else if (tabId === 'pm-tab-pay') {
      refreshPayFiltered();
    }
  });
}
