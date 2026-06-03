
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
  // total: deduplicated via COUNT(DISTINCT seq|dep) in q_monthly_detail
  const detail = (D.monthly_cards.detail[month] || []);
  let total = 0;
  detail.forEach(r => {
    if (base     !== 'All' && r.base     !== base)     return;
    if (aircraft !== 'All' && r.aircraft !== aircraft) return;
    if (seat     !== 'All' && r.seat     !== seat)     return;
    if (region   !== 'All' && r.region   !== region)   return;
    total += r.total;
  });
  // RF, PM, APU, FT: all from deduplicated page.daily arrays
  let rf = 0, pm = 0, apu = 0, ft = 0;
  if (D.rf_page) {
    D.rf_page.daily.forEach(r => {
      if (r.month    !== month)                          return;
      if (base     !== 'All' && r.base     !== base)     return;
      if (aircraft !== 'All' && r.aircraft !== aircraft) return;
      if (seat     !== 'All' && r.seat     !== seat)     return;
      if (region   !== 'All' && r.region   !== region)   return;
      rf += r.count;
    });
  }
  if (D.pm_page) {
    D.pm_page.daily.forEach(r => {
      if (r.month    !== month)                          return;
      if (base     !== 'All' && r.base     !== base)     return;
      if (aircraft !== 'All' && r.aircraft !== aircraft) return;
      if (seat     !== 'All' && r.seat     !== seat)     return;
      if (region   !== 'All' && r.region   !== region)   return;
      pm += r.count;
    });
  }
  if (D.apu_page) {
    D.apu_page.daily.forEach(r => {
      if (r.month    !== month)                          return;
      if (base     !== 'All' && r.base     !== base)     return;
      if (aircraft !== 'All' && r.aircraft !== aircraft) return;
      if (seat     !== 'All' && r.seat     !== seat)     return;
      if (region   !== 'All' && r.region   !== region)   return;
      apu += r.count;
    });
  }
  if (D.ft_page) {
    D.ft_page.detail.forEach(r => {
      if (r.month    !== month)                          return;
      if (base     !== 'All' && r.base     !== base)     return;
      if (aircraft !== 'All' && r.aircraft !== aircraft) return;
      if (seat     !== 'All' && r.seat     !== seat)     return;
      if (region   !== 'All' && r.region   !== region)   return;
      ft += r.count;
    });
  }
  document.getElementById('card-total').textContent = total.toLocaleString();
  document.getElementById('card-rf').textContent    = rf.toLocaleString();
  document.getElementById('card-pm').textContent    = pm.toLocaleString();
  const apuEl = document.getElementById('card-apu');
  if (apuEl) apuEl.textContent = apu.toLocaleString();
  const ftEl = document.getElementById('card-ft');
  if (ftEl) ftEl.textContent = ft.toLocaleString();
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
  var P = D.daily_code_page;
  if (!P) return;

  // ── Code lookup tables ─────────────────────────────────────────────────────
  //
  // Colour families (per spec):
  //   ORANGE  – Reserve:           RF
  //   GREEN   – Premium:           PM, OG, PR, PH, P7, HP, 7P
  //   PURPLE  – Aggressive Pickup: AL, AH, AG
  //   RED     – Fatigue:           FT
  //   BLUE    – Open Trips:        everything not in the above sets
  //   GRAY    – explicitly unknown / catch-all fallback
  //
  var RESERVE_SET = new Set(['RF']);
  var PREMIUM_SET = new Set(['PM','OG','PR','PH','P7','HP','7P']);
  var APU_SET     = new Set(['AL','AH','AG']);
  var FATIGUE_SET = new Set(['FT']);

  var CODE_DESC = {
    'OT': 'Trip Trade with Open Time (PBS: Non-Duty Absence)',
    'RF': 'Reserve Flying (Awards/Assignments)',
    'TT': 'Trip Trade (PBS: Non-Duty Absence)',
    'MU': 'Pickup Flying',
    'Mu': 'Pickup Flying',
    'SP': 'Pickup Flying – straight from TTS with Open Time',
    'IE': 'Initial Operating Experience (OE) (PBS: Non-Duty Absence)',
    'SD': 'Sequence added / drop thru TTS with Open Time (PBS: Non-Duty Absence)',
    'PM': 'Premium Flying at 50% – Lineholder. Awarded from TTS, DOTC, or Aggressive Pickup',
    'TV': 'Pilot picked up trip over VMAX using TTS',
    'MO': 'Pickup Flying – out of base',
    'AL': 'Aggressive Pickup – Lineholder, Base Rate (Pay and Credit)',
    'EA': 'Early Award/Assignment – DOTC Volunteer in RAS signing in prior to 1000 on first Reserve day',
    'OG': 'Over Guarantee – Reserve only',
    'PR': 'Premium Flying at 50% – Reserve. Awarded through DOTC or Aggressive Pickup',
    '25': 'Miscellaneous Add – Other (normally Reserves)',
    'RO': 'Recovery Obligation – Lineholder',
    'MF': 'Management Flying – LQ Requests',
    'HP': 'Aggressive Pickup (Premium family)',
    'AH': 'Aggressive Pickup – Lineholder. Pick-up over cancelled Trip Footprint (Obligation met); Pay Only',
    'AG': 'Aggressive Pickup – Reserves. Pay Only, Over Guarantee',
    '7P': 'Aggressive Pickup (Premium family)',
    'PH': 'Aggressive Pickup (Premium family)',
    'P7': 'Aggressive Pickup (Premium family)',
    'RP': 'Report. Day 1 pay protection (lineholder) or no-go (reserve) for cancellation',
    'RA': 'Reassignment. Normally used on HI1 for lineholders (AF used on HI3) – 2023 CBA Section 15.N',
    'AR': 'Reserve Flying – Opposite Division (Awards/Assignments)',
    'CH': 'Changeover pairing. End-of-month trip changed to next-month trip',
    'HY': 'Hybrid day assignment. Pay only, no credit',
    'PD': 'Consolidation Flying',
    'MN': 'RO Pickup on Footprint (MU on FP). Pay and no credit',
    'CD': 'Check pilot proficiency displacement',
    'AP': 'Apportionment pays',
    'OD': 'Reserve Flying – Assignment into DFP prior to 1200 HBT on a non-Golden DFP',
    'SS': 'Self-Repair. Trip awarded to Lineholder from Open Time satisfying Self-Repair provisions after Full Trip Cancellation – 2023 CBA Section 4.C.4.b.(1)',
    'FM': 'RO Out of Base Pickup on Footprint (MO on FP). Pay and no credit',
    'FT': 'Full Trip adds following post-fatigue rest, assigned at time of fatigue removal',
    'SW': 'Pilot receiving a Shared Trip (new split-off portion), without RIG',
    'DP': 'Management Flying – LQ Requests Displacement',
    'OR': 'Recovery Obligation for OG/PR',
    'SR': 'Original pilot who Shared Trip (remainder of original trip); existing RIG added',
    'DF': 'RO Trip Drop on Footprint (SD on FP). Pay and no credit',
  };

  function codeDesc(code) {
    return CODE_DESC[code] || CODE_DESC[code.toUpperCase()] || '';
  }

  function codeColor(code) {
    if (RESERVE_SET.has(code))           return 'rgba(199,91,0,.75)';    // orange – Reserve
    if (PREMIUM_SET.has(code))           return 'rgba(52,211,153,.75)';  // green  – Premium
    if (APU_SET.has(code))               return 'rgba(124,58,237,.75)';  // purple – Aggressive Pickup
    if (FATIGUE_SET.has(code))           return 'rgba(220,38,38,.75)';   // red    – Fatigue
    return 'rgba(37,99,168,.75)';                                         // blue   – Open Trips (inclusive)
  }
  function codeBorder(code) {
    if (RESERVE_SET.has(code))           return '#c75b00';
    if (PREMIUM_SET.has(code))           return '#15803d';
    if (APU_SET.has(code))               return '#7c3aed';
    if (FATIGUE_SET.has(code))           return '#dc2626';
    return '#2563a8';
  }
  function codeFamily(code) {
    if (RESERVE_SET.has(code))           return 'Reserve';
    if (PREMIUM_SET.has(code))           return 'Premium';
    if (APU_SET.has(code))               return 'Aggressive Pickup';
    if (FATIGUE_SET.has(code))           return 'Fatigue';
    return 'Open Trips';
  }

  // ── Populate helper ────────────────────────────────────────────────────────
  function populate(id, options, defaultVal) {
    var sel = document.getElementById(id);
    if (!sel) return sel;
    options.forEach(function(v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v; sel.appendChild(o);
    });
    sel.value = defaultVal;
    return sel;
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  var lastMon    = P.months[P.months.length - 1] || '';
  var dMonSel    = populate('daily-month-sel',    P.months,   lastMon);
  var dBasSel    = populate('daily-base-sel',     P.bases,    'All');
  var dAcSel     = populate('daily-aircraft-sel', P.aircraft, 'All');
  var dStSel     = populate('daily-seat-sel',     P.seats,    'All');
  var dRgSel     = populate('daily-region-sel',   P.regions,  'All');

  var codeBarChart = null;

  function refreshDaily() {
    var month  = dMonSel.value,  base = dBasSel.value,
        ac     = dAcSel.value,   seat = dStSel.value,
        region = dRgSel.value;

    // ── Aggregate code counts for selected month + filters ──
    var codeMap = {};
    P.rows.forEach(function(r) {
      if (r.month    !== month)                      return;
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      codeMap[r.code] = (codeMap[r.code] || 0) + r.count;
    });

    // Sort highest to lowest
    var codes = Object.keys(codeMap).sort(function(a, b) {
      return codeMap[b] - codeMap[a];
    });
    var counts  = codes.map(function(c) { return codeMap[c]; });
    var total   = counts.reduce(function(s, v) { return s + v; }, 0);
    var topCode = codes.length ? codes[0] : '—';
    var topVal  = codes.length ? codeMap[topCode] : 0;

    // ── Summary cards ──
    document.getElementById('daily-card-total').textContent = total.toLocaleString();
    document.getElementById('daily-card-codes').textContent = codes.length.toString();
    document.getElementById('daily-card-top').textContent   = topCode;
    var topSub = document.getElementById('daily-card-top-sub');
    if (topSub) topSub.textContent = topCode !== '—'
      ? topVal.toLocaleString() + ' trips (' + (topVal / total * 100).toFixed(1) + '%)'
      : 'Highest volume code';

    // ── Bar chart ──
    if (codeBarChart) { codeBarChart.destroy(); codeBarChart = null; }
    var barCtx = document.getElementById('daily-code-bar');
    if (barCtx && codes.length) {
      codeBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: codes,
          datasets: [{
            label: 'Trip Count',
            data:  counts,
            backgroundColor: codes.map(codeColor),
            borderColor:     codes.map(codeBorder),
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: function(items) {
                var c = codes[items[0].dataIndex];
                return c + '  –  ' + codeFamily(c);
              },
              label: function(item) {
                var pct = total > 0 ? (item.raw / total * 100).toFixed(1) : '0.0';
                return item.raw.toLocaleString() + ' trips  (' + pct + '% of total)';
              },
              afterLabel: function(item) {
                var d = codeDesc(codes[item.dataIndex]);
                return d ? d : undefined;
              }
            }}
          },
          scales: {
            x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
            y: {
              beginAtZero: true,
              ticks: { font: { size: 10 } },
              title: { display: true, text: 'Trip Count',
                       font: { size: 10 }, color: '#7a8aab' }
            }
          }
        }
      });
    } else if (barCtx && !codes.length) {
      // No data message
      if (codeBarChart) { codeBarChart.destroy(); codeBarChart = null; }
    }

    // ── Detail table ──
    var tbody = document.getElementById('daily-code-tbody');
    var tfoot = document.getElementById('daily-code-tfoot');
    if (!tbody) return;
    var html = '';
    codes.forEach(function(code, i) {
      var cnt = codeMap[code];
      var pct = total > 0 ? (cnt / total * 100).toFixed(1) : '0.0';
      var fam  = codeFamily(code);
      var desc = codeDesc(code);
      var dotColor = codeBorder(code);
      var bg = i % 2 === 1 ? ' style="background:var(--gray0)"' : '';
      html += `<tr${bg}>
        <td style="font-family:var(--font-mono);font-weight:600;color:${dotColor}">${code}</td>
        <td style="text-align:right">${cnt.toLocaleString()}</td>
        <td style="text-align:right">${pct}%</td>
        <td style="color:var(--gray3);font-size:.82rem">${fam}</td>
        <td style="color:var(--gray4);font-size:.79rem;max-width:340px">${desc}</td>
      </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:var(--gray3)">No data for selected filters</td></tr>';
    if (tfoot) {
      tfoot.innerHTML = `<tr class="grand-total">
        <td>TOTAL</td>
        <td style="text-align:right">${total.toLocaleString()}</td>
        <td style="text-align:right">100%</td>
        <td colspan="2"></td>
      </tr>`;
    }
  }

  [dMonSel, dBasSel, dAcSel, dStSel, dRgSel].forEach(function(s) {
    if (s) s.addEventListener('change', refreshDaily);
  });
  refreshDaily();
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
    let rfApuTotal = 0;
    if (D.apu_page) {
      D.apu_page.daily.forEach(r => {
        if (!rfFilter(r, month, base, ac, seat, region)) return;
        rfApuTotal += r.count;
      });
    }
    document.getElementById('rf-card-total').textContent = rfTotal.toLocaleString();
    document.getElementById('rf-card-ot').textContent    = otTotal.toLocaleString();
    document.getElementById('rf-card-pm').textContent    = pmTotal.toLocaleString();
    const rfApuEl = document.getElementById('rf-card-apu');
    if (rfApuEl) rfApuEl.textContent = rfApuTotal.toLocaleString();
    let rfFtTotal = 0;
    if (D.ft_page) { D.ft_page.detail.forEach(r => { if (rfFilter(r, month, base, ac, seat, region)) rfFtTotal += r.count; }); }
    const rfFtEl = document.getElementById('rf-card-ft');
    if (rfFtEl) rfFtEl.textContent = rfFtTotal.toLocaleString();

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

    // Aggregate pay hours per month (from pay_detail)
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

    // Aggregate trip counts per month (from daily, deduplicated)
    const tripsByMonth = {};
    months.forEach(mo => { tripsByMonth[mo] = 0; });
    P.daily.forEach(r => {
      if (!tripsByMonth.hasOwnProperty(r.month))    return;
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      tripsByMonth[r.month] += r.count;
    });

    // Std dev on hours to flag high-demand months
    const monthVals = months.map(mo => minsByMonth[mo]);
    const { threshold: moThreshold } = stdDevStats(monthVals.filter(v => v > 0));

    const wrap = document.getElementById('rf-pay-delta-wrap');
    if (!wrap || !months.length) return;
    let html = `<table style="font-size:.8rem;border-collapse:collapse;min-width:760px">
      <thead>
        <tr>
          <th rowspan="2" style="background:var(--navy);color:#fff;padding:6px 12px;text-align:left;vertical-align:middle">Month</th>
          <th colspan="4" style="background:var(--navy);color:#fff;padding:4px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,.2)">Reserve Trips</th>
          <th colspan="4" style="background:#0f2a42;color:#fff;padding:4px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,.2)">Reserve Hours</th>
          <th rowspan="2" style="background:var(--navy);color:#fff;padding:6px 12px;text-align:center;vertical-align:middle">Demand</th>
        </tr>
        <tr>
          <th style="background:var(--navy);color:#cbd5e0;padding:4px 10px;text-align:right;font-weight:400">Trips</th>
          <th style="background:var(--navy);color:#cbd5e0;padding:4px 10px;text-align:right;font-weight:400">Change</th>
          <th style="background:var(--navy);color:#cbd5e0;padding:4px 10px;text-align:right;font-weight:400">%</th>
          <th style="background:var(--navy);color:#cbd5e0;padding:4px 10px;text-align:center;font-weight:400">Trend</th>
          <th style="background:#0f2a42;color:#cbd5e0;padding:4px 10px;text-align:right;font-weight:400">Hours</th>
          <th style="background:#0f2a42;color:#cbd5e0;padding:4px 10px;text-align:right;font-weight:400">Change</th>
          <th style="background:#0f2a42;color:#cbd5e0;padding:4px 10px;text-align:right;font-weight:400">%</th>
          <th style="background:#0f2a42;color:#cbd5e0;padding:4px 10px;text-align:center;font-weight:400">Trend</th>
        </tr>
      </thead><tbody>`;
    months.forEach((mo, i) => {
      // ── Trip count deltas ──
      const trips     = tripsByMonth[mo];
      const prevTrips = i > 0 ? tripsByMonth[months[i-1]] : null;
      const diffTrips = prevTrips !== null ? trips - prevTrips : null;
      const pctTrips  = (prevTrips && prevTrips > 0) ? ((trips - prevTrips) / prevTrips * 100) : null;
      let dtFmt = '—', dtPct = '—', dtArrow = '—', dtColor = 'inherit';
      if (diffTrips !== null) {
        dtFmt   = (diffTrips >= 0 ? '+' : '') + diffTrips.toLocaleString();
        dtPct   = (pctTrips  >= 0 ? '+' : '') + pctTrips.toFixed(1) + '%';
        dtColor = diffTrips > 0 ? '#15803d' : diffTrips < 0 ? '#b91c1c' : 'inherit';
        dtArrow = diffTrips > 0 ? '&#9650;' : diffTrips < 0 ? '&#9660;' : '&#9644;';
      }

      // ── Hours deltas ──
      const cur      = minsByMonth[mo];
      const prev     = i > 0 ? minsByMonth[months[i-1]] : null;
      const diffMins = prev !== null ? cur - prev : null;
      const diffPct  = (prev && prev > 0) ? ((cur - prev) / prev * 100) : null;
      const hrs      = Math.round(cur / 60 * 10) / 10;
      const isHighDemand = isFinite(moThreshold) && cur > moThreshold;
      let dhFmt = '—', dhPct = '—', dhArrow = '—', dhColor = 'inherit';
      if (diffMins !== null) {
        dhFmt   = (diffMins >= 0 ? '+' : '') + minsToHHMM(diffMins);
        dhPct   = (diffPct  >= 0 ? '+' : '') + diffPct.toFixed(1) + '%';
        dhColor = diffMins > 0 ? '#15803d' : diffMins < 0 ? '#b91c1c' : 'inherit';
        dhArrow = diffMins > 0 ? '&#9650;' : diffMins < 0 ? '&#9660;' : '&#9644;';
      }

      const bg = i % 2 === 1 ? 'background:var(--gray0)' : '';
      const demandBadge = isHighDemand ? '<span class="tag-outlier">&#9888; High</span>' : '';
      html += `<tr style="${bg}">
        <td style="padding:5px 12px;font-family:var(--font-mono)">${mo}</td>
        <td style="padding:5px 10px;text-align:right">${trips.toLocaleString()}</td>
        <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);color:${dtColor}">${dtFmt}</td>
        <td style="padding:5px 10px;text-align:right;color:${dtColor};font-weight:600">${dtPct}</td>
        <td style="padding:5px 10px;text-align:center;color:${dtColor};font-size:1rem">${dtArrow}</td>
        <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)${isHighDemand ? ';font-weight:700;color:#c75b00' : ''}">${hrs}</td>
        <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);color:${dhColor}">${dhFmt}</td>
        <td style="padding:5px 10px;text-align:right;color:${dhColor};font-weight:600">${dhPct}</td>
        <td style="padding:5px 10px;text-align:center;color:${dhColor};font-size:1rem">${dhArrow}</td>
        <td style="padding:5px 10px;text-align:center">${demandBadge}</td>
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
  if (rfpMonSel) rfpMonSel.addEventListener('change', () => { refreshRFDeltaTable(); refreshRFPayFiltered(); });

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

  // Premium code colour palette (7 codes, green family)
  const PM_CODE_COLORS = {
    'PM': { bg: 'rgba(21,128,61,.80)',   border: '#15803d' },
    'OG': { bg: 'rgba(34,197,94,.75)',   border: '#16a34a' },
    'PR': { bg: 'rgba(52,211,153,.75)',  border: '#059669' },
    'PH': { bg: 'rgba(110,231,183,.75)', border: '#34d399' },
    'P7': { bg: 'rgba(167,243,208,.80)', border: '#6ee7b7' },
    'HP': { bg: 'rgba(187,247,208,.80)', border: '#86efac' },
    '7P': { bg: 'rgba(220,252,231,.90)', border: '#bbf7d0' },
  };
  const PM_CODE_ORDER = ['PM','OG','PR','PH','P7','HP','7P'];

  function refreshPMAnalysis() {
    const month  = pmMonSel.value, base = pmBasSel.value,
          ac     = pmAcSel.value,  seat = pmStSel.value,
          region = pmRgSel.value;

    // ── Cards ──
    let pmTotal = 0, otTotal = 0, rfTotal = 0, apuTotal = 0;
    P.daily.forEach(r => {
      if (!pmFilter(r, month, base, ac, seat, region)) return;
      pmTotal += r.count;
    });
    const mcDetail = (D.monthly_cards.detail[month] || []);
    mcDetail.forEach(r => {
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      otTotal += r.total;
    });
    // RF from deduplicated rf_page.daily
    if (D.rf_page) {
      D.rf_page.daily.forEach(r => {
        if (!pmFilter(r, month, base, ac, seat, region)) return;
        rfTotal += r.count;
      });
    }
    if (D.apu_page) {
      D.apu_page.daily.forEach(r => {
        if (!pmFilter(r, month, base, ac, seat, region)) return;
        apuTotal += r.count;
      });
    }
    document.getElementById('pm-card-total').textContent = pmTotal.toLocaleString();
    document.getElementById('pm-card-ot').textContent    = otTotal.toLocaleString();
    const pmApuEl = document.getElementById('pm-card-apu');
    if (pmApuEl) pmApuEl.textContent = apuTotal.toLocaleString();
    document.getElementById('pm-card-rf').textContent    = rfTotal.toLocaleString();
    let pmFtTotal = 0;
    if (D.ft_page) { D.ft_page.detail.forEach(r => { if (pmFilter(r, month, base, ac, seat, region)) pmFtTotal += r.count; }); }
    const pmFtEl = document.getElementById('pm-card-ft');
    if (pmFtEl) pmFtEl.textContent = pmFtTotal.toLocaleString();

    // ── Stacked bar chart: daily counts by code ──
    // Build: dayCodeMap[day][code] = count
    const dayCodeMap = {};
    P.daily.forEach(r => {
      if (!pmFilter(r, month, base, ac, seat, region)) return;
      if (!dayCodeMap[r.day]) dayCodeMap[r.day] = {};
      dayCodeMap[r.day][r.code] = (dayCodeMap[r.day][r.code] || 0) + r.count;
    });
    const days = Object.keys(dayCodeMap).sort();
    const barLabels = days.map(d => {
      const p = d.replace('/', '-').split('-');
      return p[1] + '/' + p[2];
    });

    // Only include codes that have at least one count in this selection
    const activeCodes = PM_CODE_ORDER.filter(code =>
      days.some(d => (dayCodeMap[d][code] || 0) > 0)
    );

    const datasets = activeCodes.map(code => ({
      label: code,
      data:  days.map(d => dayCodeMap[d][code] || 0),
      backgroundColor: (PM_CODE_COLORS[code] || { bg: 'rgba(52,211,153,.7)' }).bg,
      borderColor:     (PM_CODE_COLORS[code] || { border: '#15803d' }).border,
      borderWidth: 1,
      stack: 'pm',
    }));

    if (pmBarChart) pmBarChart.destroy();
    const barCtx = document.getElementById('pm-monthly-bar');
    if (barCtx) {
      pmBarChart = new Chart(barCtx, {
        type: 'bar',
        data: { labels: barLabels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: {
              display: activeCodes.length > 1,
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10 } }
            },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: {
                footer: function(items) {
                  const total = items.reduce((s, i) => s + i.raw, 0);
                  return total > 0 ? 'Total: ' + total.toLocaleString() : '';
                }
              }
            }
          },
          scales: {
            x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } } }
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

    // ── Stacked line chart: x = seniority (high→low), stacked by Premium code ──
    // Build senCodeMap[seniority][code] = {pm_count, mins}
    const senCodeMap = {};
    rows.forEach(r => {
      const k = String(r.seniority);
      const c = r.code || 'PM';
      if (!senCodeMap[k])        senCodeMap[k] = {};
      if (!senCodeMap[k][c])     senCodeMap[k][c] = { pm: 0, mins: 0 };
      senCodeMap[k][c].pm   += r.pm_count;
      senCodeMap[k][c].mins += r.pay_mins;
    });

    // Sorted seniority axis — numerically descending (high number = most junior, on left)
    const senKeys = Object.keys(senCodeMap).sort((a, b) => Number(b) - Number(a));

    // Aggregate total per seniority for tooltip
    const senTotal = {};
    senKeys.forEach(k => {
      senTotal[k] = PM_CODE_ORDER.reduce((s, c) =>
        s + (senCodeMap[k][c] ? senCodeMap[k][c].pm : 0), 0);
    });

    // Only include codes active in this selection
    const activeSenCodes = PM_CODE_ORDER.filter(code =>
      senKeys.some(k => senCodeMap[k][code] && senCodeMap[k][code].pm > 0)
    );

    const senDatasets = activeSenCodes.map(code => ({
      label: code,
      data:  senKeys.map(k => senCodeMap[k][code] ? senCodeMap[k][code].pm : 0),
      borderColor:     (PM_CODE_COLORS[code] || { border: '#15803d' }).border,
      backgroundColor: (PM_CODE_COLORS[code] || { bg: 'rgba(52,211,153,.15)' }).bg,
      borderWidth: 1.5,
      pointRadius: senKeys.length > 80 ? 0 : 3,
      tension: 0.3,
      fill: true,
      stack: 'sen',
    }));

    if (senChart) { senChart.destroy(); senChart = null; }
    const senCtx = document.getElementById('sen-chart');
    if (senCtx) {
      try {
        if (senKeys.length) {
          senChart = new Chart(senCtx, {
            type: 'line',
            data: { labels: senKeys, datasets: senDatasets },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: activeSenCodes.length > 1,
                  position: 'bottom',
                  labels: { boxWidth: 12, font: { size: 10 } }
                },
                tooltip: {
                  mode: 'index', intersect: false,
                  callbacks: {
                    title:  (items) => 'Seniority #' + senKeys[items[0].dataIndex],
                    footer: (items) => {
                      const t = senTotal[senKeys[items[0].dataIndex]] || 0;
                      return t > 0 ? 'Total: ' + t : '';
                    },
                  }
                }
              },
              scales: {
                x: {
                  stacked: true,
                  title: { display: true, text: 'Seniority Number (high to low)',
                           font: { size: 10 }, color: '#7a8aab' },
                  ticks: { font: { size: 9 }, maxTicksLimit: 20 }
                },
                y: {
                  stacked: true,
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

  // Delta table — shows all months, filtered by Base/Aircraft/Seat/Division only
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
function initAPU(D) {
  const P = D.apu_page;
  if (!P) return;

  // APU code colour palette — violet/purple family, 3 codes
  const APU_CODE_COLORS = {
    'AL': { bg: 'rgba(124,58,237,.80)',  border: '#7c3aed' },
    'AH': { bg: 'rgba(167,139,250,.75)', border: '#a78bfa' },
    'AG': { bg: 'rgba(196,181,253,.80)', border: '#c4b5fd' },
  };
  const APU_CODE_ORDER = ['AL','AH','AG'];

  function populate(id, options, def) {
    const sel = document.getElementById(id);
    if (!sel) return sel;
    options.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v; sel.appendChild(o);
    });
    sel.value = def;
    return sel;
  }

  const minsToHHMM = m => {
    const h = Math.floor(Math.abs(m)/60), mm = Math.abs(m)%60;
    return (m < 0 ? '-' : '') + h + ':' + String(mm).padStart(2,'0');
  };

  function apuFilter(r, month, base, ac, seat, region) {
    if (r.month    !== month)                      return false;
    if (base   !== 'All' && r.base     !== base)   return false;
    if (ac     !== 'All' && r.aircraft !== ac)     return false;
    if (seat   !== 'All' && r.seat     !== seat)   return false;
    if (region !== 'All' && r.region   !== region) return false;
    return true;
  }

  // ── 60-day sparkline (unfiltered) ─────────────────────────────
  (function() {
    const ctx = document.getElementById('apu-sparkline');
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
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124,58,237,.12)',
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
          tooltip: { callbacks: {
            title: items => rows[items[0].dataIndex].date.replace('/', '-'),
            label: item  => 'APU trips: ' + item.raw.toLocaleString()
          }}
        },
        scales: {
          x: { ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: false,
            color: function(tickCtx) {
              const lbl = labels[tickCtx.index] || '';
              if (!lbl) return 'transparent';
              const wd = rows[tickCtx.index] ? rows[tickCtx.index].weekday : -1;
              return wd === 5 ? '#c75b00' : wd === 0 ? '#2563a8' : '#15803d';
            }}, grid: { display: false }},
          y: { display: false }
        }
      }
    });
  })();

  // ─────────────────────────────────────────────────────────────────
  // TAB 1 — Daily APU Volume
  // ─────────────────────────────────────────────────────────────────
  const lastMon   = P.months[P.months.length - 1] || '';
  const apuMonSel = populate('apu-month-sel',    P.months,   lastMon);
  const apuBasSel = populate('apu-base-sel',     P.bases,    'All');
  const apuAcSel  = populate('apu-aircraft-sel', P.aircraft, 'All');
  const apuStSel  = populate('apu-seat-sel',     P.seats,    'All');
  const apuRgSel  = populate('apu-region-sel',   P.regions,  'All');

  let apuBarChart = null;

  function refreshAPUVolume() {
    const month = apuMonSel.value, base = apuBasSel.value,
          ac    = apuAcSel.value,  seat = apuStSel.value,
          region = apuRgSel.value;

    // ── Summary cards ──
    let apuTotal = 0, otTotal = 0, pmTotal = 0, rfTotal = 0;
    P.daily.forEach(r => {
      if (!apuFilter(r, month, base, ac, seat, region)) return;
      apuTotal += r.count;
    });
    const mcDetail = (D.monthly_cards.detail[month] || []);
    mcDetail.forEach(r => {
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      otTotal += r.total;
    });
    // RF from deduplicated rf_page.daily
    if (D.rf_page) {
      D.rf_page.daily.forEach(r => {
        if (!apuFilter(r, month, base, ac, seat, region)) return;
        rfTotal += r.count;
      });
    }
    if (D.pm_page) {
      D.pm_page.daily.forEach(r => {
        if (!apuFilter(r, month, base, ac, seat, region)) return;
        pmTotal += r.count;
      });
    }
    document.getElementById('apu-card-total').textContent = apuTotal.toLocaleString();
    document.getElementById('apu-card-ot').textContent    = otTotal.toLocaleString();
    document.getElementById('apu-card-pm').textContent    = pmTotal.toLocaleString();
    document.getElementById('apu-card-rf').textContent    = rfTotal.toLocaleString();
    let apuFtTotal = 0;
    if (D.ft_page) { D.ft_page.detail.forEach(r => { if (apuFilter(r, month, base, ac, seat, region)) apuFtTotal += r.count; }); }
    const apuFtEl = document.getElementById('apu-card-ft');
    if (apuFtEl) apuFtEl.textContent = apuFtTotal.toLocaleString();

    // ── Stacked bar: daily counts by code ──
    const dayCodeMap = {};
    P.daily.forEach(r => {
      if (!apuFilter(r, month, base, ac, seat, region)) return;
      if (!dayCodeMap[r.day]) dayCodeMap[r.day] = {};
      dayCodeMap[r.day][r.code] = (dayCodeMap[r.day][r.code] || 0) + r.count;
    });
    const days = Object.keys(dayCodeMap).sort();
    const barLabels = days.map(d => {
      const p = d.replace('/', '-').split('-');
      return p[1] + '/' + p[2];
    });
    const activeCodes = APU_CODE_ORDER.filter(code =>
      days.some(d => (dayCodeMap[d][code] || 0) > 0)
    );
    const datasets = activeCodes.map(code => ({
      label: code,
      data:  days.map(d => dayCodeMap[d][code] || 0),
      backgroundColor: (APU_CODE_COLORS[code] || { bg: 'rgba(124,58,237,.7)' }).bg,
      borderColor:     (APU_CODE_COLORS[code] || { border: '#7c3aed' }).border,
      borderWidth: 1, stack: 'apu',
    }));

    if (apuBarChart) apuBarChart.destroy();
    const barCtx = document.getElementById('apu-monthly-bar');
    if (barCtx) {
      apuBarChart = new Chart(barCtx, {
        type: 'bar',
        data: { labels: barLabels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: activeCodes.length > 1, position: 'bottom',
                      labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: {
                footer: items => {
                  const t = items.reduce((s, i) => s + i.raw, 0);
                  return t > 0 ? 'Total: ' + t.toLocaleString() : '';
                }
              }
            }
          },
          scales: {
            x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  }

  [apuMonSel, apuBasSel, apuAcSel, apuStSel, apuRgSel].forEach(s => {
    if (s) s.addEventListener('change', refreshAPUVolume);
  });
  refreshAPUVolume();

  // ─────────────────────────────────────────────────────────────────
  // TAB 2 — APU Seniority
  // ─────────────────────────────────────────────────────────────────
  const apusMonSel = populate('apus-month-sel',    P.months,   lastMon);
  const apusBasSel = populate('apus-base-sel',     P.bases,    'All');
  const apusAcSel  = populate('apus-aircraft-sel', P.aircraft, 'All');
  const apusStSel  = populate('apus-seat-sel',     P.seats,    'All');
  const apusRgSel  = populate('apus-region-sel',   P.regions,  'All');

  let apusSenChart = null;

  function refreshAPUSeniority() {
    const month  = apusMonSel.value, base = apusBasSel.value,
          ac     = apusAcSel.value,  seat = apusStSel.value,
          region = apusRgSel.value;

    const rows = P.seniority.filter(r => {
      if (r.month !== month)                         return false;
      if (base   !== 'All' && r.base     !== base)   return false;
      if (ac     !== 'All' && r.aircraft !== ac)     return false;
      if (seat   !== 'All' && r.seat     !== seat)   return false;
      if (region !== 'All' && r.region   !== region) return false;
      return true;
    });

    // ── Stacked line chart by code ──
    const senCodeMap = {};
    rows.forEach(r => {
      const k = String(r.seniority);
      const c = r.code || 'AL';
      if (!senCodeMap[k])    senCodeMap[k] = {};
      if (!senCodeMap[k][c]) senCodeMap[k][c] = { apu: 0, mins: 0 };
      senCodeMap[k][c].apu  += r.apu_count;
      senCodeMap[k][c].mins += r.pay_mins;
    });
    const senKeys = Object.keys(senCodeMap).sort((a, b) => Number(b) - Number(a));
    const senTotal = {};
    senKeys.forEach(k => {
      senTotal[k] = APU_CODE_ORDER.reduce((s, c) =>
        s + (senCodeMap[k][c] ? senCodeMap[k][c].apu : 0), 0);
    });
    const activeSenCodes = APU_CODE_ORDER.filter(code =>
      senKeys.some(k => senCodeMap[k][code] && senCodeMap[k][code].apu > 0)
    );
    const senDatasets = activeSenCodes.map(code => ({
      label: code,
      data:  senKeys.map(k => senCodeMap[k][code] ? senCodeMap[k][code].apu : 0),
      borderColor:     (APU_CODE_COLORS[code] || { border: '#7c3aed' }).border,
      backgroundColor: (APU_CODE_COLORS[code] || { bg: 'rgba(124,58,237,.15)' }).bg,
      borderWidth: 1.5,
      pointRadius: senKeys.length > 80 ? 0 : 3,
      tension: 0.3, fill: true, stack: 'apusen',
    }));

    if (apusSenChart) { apusSenChart.destroy(); apusSenChart = null; }
    const senCtx = document.getElementById('apus-chart');
    if (senCtx && senKeys.length) {
      try {
        apusSenChart = new Chart(senCtx, {
          type: 'line',
          data: { labels: senKeys, datasets: senDatasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: activeSenCodes.length > 1, position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 10 } } },
              tooltip: {
                mode: 'index', intersect: false,
                callbacks: {
                  title:  items => 'Seniority #' + senKeys[items[0].dataIndex],
                  footer: items => {
                    const t = senTotal[senKeys[items[0].dataIndex]] || 0;
                    return t > 0 ? 'Total: ' + t : '';
                  }
                }
              }
            },
            scales: {
              x: { stacked: true,
                   title: { display: true, text: 'Seniority Number (high to low)',
                            font: { size: 10 }, color: '#7a8aab' },
                   ticks: { font: { size: 9 }, maxTicksLimit: 20 } },
              y: { stacked: true,
                   title: { display: true, text: 'APU Trips',
                            font: { size: 10 }, color: '#7a8aab' },
                   beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 } }
            }
          }
        });
      } catch(e) { console.error('APU seniority chart error:', e); }
    }

    // ── Table ──
    const tbody = document.getElementById('apus-tbody');
    const tfoot = document.getElementById('apus-tfoot');
    if (!tbody) return;
    const sorted = [...rows].sort((a, b) => b.apu_count - a.apu_count || a.seniority - b.seniority);
    let totalAPU = 0, totalMins = 0;
    let html = '';
    sorted.forEach((r, i) => {
      const cls = i % 2 === 1 ? ' style="background:var(--gray0)"' : '';
      html += `<tr${cls}>
        <td>${r.seniority}</td>
        <td>${r.base}</td><td>${r.aircraft}</td>
        <td>${r.seat}</td><td>${r.region}</td>
        <td style="text-align:right">${r.apu_count.toLocaleString()}</td>
        <td style="text-align:right;font-family:var(--font-mono)">${r.pay_hhmm}</td>
      </tr>`;
      totalAPU  += r.apu_count;
      totalMins += r.pay_mins;
    });
    tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:var(--gray3)">No data for selected filters</td></tr>';
    if (tfoot) {
      tfoot.innerHTML = `<tr class="grand-total">
        <td colspan="5">TOTAL (${sorted.length} rows)</td>
        <td style="text-align:right">${totalAPU.toLocaleString()}</td>
        <td style="text-align:right;font-family:var(--font-mono)">${minsToHHMM(totalMins)}</td>
      </tr>`;
    }
  }

  [apusMonSel, apusBasSel, apusAcSel, apusStSel, apusRgSel].forEach(s => {
    if (s) s.addEventListener('change', refreshAPUSeniority);
  });

  // ─────────────────────────────────────────────────────────────────
  // TAB 3 — Monthly Change in APU
  // ─────────────────────────────────────────────────────────────────
  const apupMonSel = populate('apup-month-sel',    P.months,   lastMon);
  const apupBasSel = populate('apup-base-sel',     P.bases,    'All');
  const apupAcSel  = populate('apup-aircraft-sel', P.aircraft, 'All');
  const apupStSel  = populate('apup-seat-sel',     P.seats,    'All');
  const apupRgSel  = populate('apup-region-sel',   P.regions,  'All');

  function refreshAPUDelta() {
    const base = apupBasSel.value, ac = apupAcSel.value,
          seat = apupStSel.value,  region = apupRgSel.value;
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
    const wrap = document.getElementById('apu-pay-delta-wrap');
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
      let deltaHHMM = '—', deltaPct = '—', arrow = '—', clr = 'inherit';
      if (diffMins !== null) {
        deltaHHMM = (diffMins >= 0 ? '+' : '') + minsToHHMM(diffMins);
        deltaPct  = (diffPct  >= 0 ? '+' : '') + diffPct.toFixed(1) + '%';
        clr       = diffMins >= 0 ? '#15803d' : '#b91c1c';
        arrow     = diffMins > 0 ? '&#9650;' : diffMins < 0 ? '&#9660;' : '&#9644;';
      }
      html += `<tr style="${bg}">
        <td style="padding:5px 12px;font-family:var(--font-mono)">${mo}</td>
        <td style="padding:5px 12px;text-align:right;font-family:var(--font-mono)">${hrs}</td>
        <td style="padding:5px 12px;text-align:right;font-family:var(--font-mono);color:${clr}">${deltaHHMM}</td>
        <td style="padding:5px 12px;text-align:right;color:${clr};font-weight:600">${deltaPct}</td>
        <td style="padding:5px 12px;text-align:center;color:${clr};font-size:1rem">${arrow}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  let apupPayChart = null;
  function refreshAPUPayFiltered() {
    const month = apupMonSel.value, base = apupBasSel.value,
          ac    = apupAcSel.value,  seat = apupStSel.value,
          region = apupRgSel.value;
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
    if (apupPayChart) { apupPayChart.destroy(); apupPayChart = null; }
    const ctx = document.getElementById('apu-pay-filtered-bar');
    if (ctx) {
      apupPayChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: keys, datasets: [{
          label: 'APU Pay (hrs)', data,
          backgroundColor: 'rgba(124,58,237,.70)',
          borderColor: '#7c3aed', borderWidth: 1
        }]},
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: item => item.raw + ' hrs' } }},
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

  [apupBasSel, apupAcSel, apupStSel, apupRgSel].forEach(s => {
    if (s) s.addEventListener('change', () => { refreshAPUDelta(); refreshAPUPayFiltered(); });
  });
  if (apupMonSel) apupMonSel.addEventListener('change', refreshAPUPayFiltered);

  // ── Lazy-render seniority and monthly tabs ──
  let apusSenRendered = false, apupMonRendered = false;
  initTabs('.tab-container', tabId => {
    if (tabId === 'apu-tab-seniority' && !apusSenRendered) {
      apusSenRendered = true; refreshAPUSeniority();
    } else if (tabId === 'apu-tab-seniority') {
      refreshAPUSeniority();
    }
    if (tabId === 'apu-tab-monthly' && !apupMonRendered) {
      apupMonRendered = true; refreshAPUDelta(); refreshAPUPayFiltered();
    } else if (tabId === 'apu-tab-monthly') {
      refreshAPUPayFiltered();
    }
  });
}

function initFT(D) {
  const P = D.ft_page;
  if (!P) return;

  function populate(id, options, def) {
    const sel = document.getElementById(id);
    if (!sel) return sel;
    options.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v; sel.appendChild(o);
    });
    sel.value = def;
    return sel;
  }

  const FT_RED    = 'rgba(220,38,38,.75)';
  const FT_BORDER = '#dc2626';

  const lastMon  = P.months[P.months.length - 1] || '';
  const ftMonSel = populate('ft-month-sel',    P.months,   lastMon);
  const ftBasSel = populate('ft-base-sel',     P.bases,    'All');
  const ftAcSel  = populate('ft-aircraft-sel', P.aircraft, 'All');
  const ftStSel  = populate('ft-seat-sel',     P.seats,    'All');
  const ftRgSel  = populate('ft-region-sel',   P.regions,  'All');

  function ftFilter(r, month, base, ac, seat, region) {
    if (r.month    !== month)                      return false;
    if (base   !== 'All' && r.base     !== base)   return false;
    if (ac     !== 'All' && r.aircraft !== ac)     return false;
    if (seat   !== 'All' && r.seat     !== seat)   return false;
    if (region !== 'All' && r.region   !== region) return false;
    return true;
  }

  function refreshFT() {
    const month  = ftMonSel.value, base = ftBasSel.value,
          ac     = ftAcSel.value,  seat = ftStSel.value,
          region = ftRgSel.value;

    // ── Filter rows ──
    const rows = P.detail.filter(r => ftFilter(r, month, base, ac, seat, region));

    // ── Summary cards ──
    let ftTotal = 0;
    const seqSet = new Set();
    rows.forEach(r => { ftTotal += r.count; seqSet.add(r.sequence); });

    let otTotal = 0;
    const mcDetail = (D.monthly_cards.detail[month] || []);
    mcDetail.forEach(r => {
      if (base   !== 'All' && r.base     !== base)   return;
      if (ac     !== 'All' && r.aircraft !== ac)     return;
      if (seat   !== 'All' && r.seat     !== seat)   return;
      if (region !== 'All' && r.region   !== region) return;
      otTotal += r.total;
    });

    document.getElementById('ft-card-total').textContent     = ftTotal.toLocaleString();
    document.getElementById('ft-card-sequences').textContent = seqSet.size.toLocaleString();
    document.getElementById('ft-card-ot').textContent        = otTotal.toLocaleString();

    // ── Trip detail table ─────────────────────────────────────────
    // One row per (sequence, dep_local) pair, sorted by sequence number.
    const tbody = document.getElementById('ft-tbody');
    const tfoot = document.getElementById('ft-tfoot');
    if (!tbody) return;

    const sortedRows = [...rows].sort((a, b) =>
      a.sequence.localeCompare(b.sequence, undefined, { numeric: true })
    );

    let html = '';
    sortedRows.forEach((r, i) => {
      const bg  = i % 2 === 1 ? ' style="background:var(--gray0)"' : '';
      // dep_local is typically "MM/DD HH:MM" — show just MM/DD for brevity
      const depDisplay = r.dep ? r.dep.slice(0, 5) : '—';
      html += `<tr${bg}>
        <td style="font-family:var(--font-mono);font-weight:600;color:${FT_BORDER}">${r.sequence}</td>
        <td style="font-family:var(--font-mono)">${depDisplay}</td>
        <td>${r.base}</td>
        <td>${r.aircraft}</td>
        <td>${r.seat}</td>
        <td>${r.region}</td>
      </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;color:var(--gray3)">No FT data for selected filters</td></tr>';

    if (tfoot) {
      tfoot.innerHTML = `<tr class="grand-total">
        <td colspan="6">TOTAL — ${sortedRows.length} trip${sortedRows.length !== 1 ? 's' : ''}</td>
      </tr>`;
    }
  }

  [ftMonSel, ftBasSel, ftAcSel, ftStSel, ftRgSel].forEach(s => {
    if (s) s.addEventListener('change', refreshFT);
  });
  refreshFT();
}

/* ── Insights page ─────────────────────────────────────────────── */
function showInsight(id) {
  document.querySelectorAll('.insight-panel').forEach(function(p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.insight-topic').forEach(function(t) {
    t.style.background    = 'var(--gray0)';
    t.style.borderColor   = 'var(--gray1)';
    t.style.opacity       = '0.55';
  });
  var panel = document.getElementById('insight-' + id);
  if (panel) panel.classList.add('active');
  var topic = document.getElementById('topic-' + id);
  if (topic) {
    topic.style.background  = 'var(--sky)';
    topic.style.borderColor = 'var(--blue)';
    topic.style.opacity     = '1';
  }
}

function initInsights(D) {
  var fp = document.querySelector('.insight-panel');
  if (fp) fp.classList.add('active');
  var INS = D.insights; if (!INS) return;
  var ins = INS['apu_vs_pm']; if (!ins) return;

  var el = function(id){ return document.getElementById(id); };
  if (el('ins-headline')) el('ins-headline').textContent = ins.headline || '—';
  if (el('ins-generated')&&INS._meta) el('ins-generated').textContent='Computed '+INS._meta.generated_at;
  if (el('ins-caveats')&&ins.caveats)
    el('ins-caveats').innerHTML=ins.caveats.map(function(c){return '<li>'+c+'</li>';}).join('');

  // ── helpers ───────────────────────────────────────────────────
  var N  = function(v){ return (v!=null)?v.toLocaleString():'—'; };
  var P  = function(v,d){ if(v==null) return '—'; d=d||1;
             return (v>=0?'+':'')+v.toFixed(d)+'%'; };
  var S  = function(v){ if(v==null) return '—';
             return (v>=0?'+':'')+Math.round(v).toLocaleString(); };
  var HR = function(h){ // hours (decimal) → H:MM
    if(h==null||h===0) return '0:00';
    var neg=h<0; h=Math.abs(h);
    var hh=Math.floor(h), mm=Math.round((h-hh)*60);
    return (neg?'-':'')+hh+':'+(mm<10?'0':'')+mm;
  };
  var clr = function(v){
    if(!v) return ''; return v>0?'color:#15803d':'color:#b91c1c';
  };
  var NAVY='var(--navy)';
  var TH = function(t,a,bg,fg,x){
    bg=bg||NAVY;fg=fg||'#fff';a=a||'right';x=x||'';
    return '<th style="background:'+bg+';color:'+fg+';padding:5px 10px;'
          +'text-align:'+a+';white-space:nowrap;'+x+'">'+t+'</th>';
  };
  var TD = function(v,s){ s=s||''; return '<td style="padding:5px 10px;'+s+'">'+v+'</td>'; };
  var APU_B='<span style="font-size:.62rem;font-weight:700;background:#7c3aed;color:#fff;'
    +'padding:1px 5px;border-radius:3px;margin-left:5px">APU Launch</span>';
  var SEL_B='<span style="font-size:.62rem;font-weight:700;background:#15803d;color:#fff;'
    +'padding:1px 6px;border-radius:3px;margin-left:6px">Selected</span>';

  var rowBg = function(r,i){
    return r.is_apu
      ? 'background:#f5f0ff;outline:2px solid rgba(124,58,237,.3);outline-offset:-2px'
      : i%2?'background:var(--gray0)':'';
  };

  // ══════════════════════════════════════════════════════════════
  // STEP 1 — Raw data
  // ══════════════════════════════════════════════════════════════
  (function(){
    var th=el('s1-thead'),tb=el('s1-tbody'),obs=el('s1-obs');
    if(!th||!tb||!ins.act1_rows) return;
    th.innerHTML='<tr>'+TH('Month','left')
      +TH('Total Trips')+TH('Reserve','right',NAVY,'#fbd38d')
      +TH('Premium','right',NAVY,'#9ae6b4')+TH('APU','right',NAVY,'#d9b8ff')
      +TH('Other')+'</tr>';
    var html='';
    ins.act1_rows.forEach(function(r,i){
      html+='<tr style="'+rowBg(r,i)+'">'
        +TD(r.month+(r.is_apu?APU_B:''),'text-align:left;font-family:var(--font-mono);font-weight:600')
        +TD(N(r.total))+TD(N(r.rf),'color:#b45309')+TD(N(r.pm),'color:#15803d')
        +TD(N(r.apu),'color:#7c3aed')+TD(N(r.other),'color:var(--gray3)')+'</tr>';
    });
    tb.innerHTML=html;
    if(obs){
      var aRow=ins.act1_rows.find(function(r){return r.is_apu;});
      var bRow=ins.act1_rows.find(function(r){return !r.is_apu;});
      if(aRow&&bRow) obs.textContent=
        'Premium fell from '+N(bRow.pm)+' to '+N(aRow.pm)+' in the APU launch month. '
        +'APU contributed '+N(aRow.apu)+' trips that did not exist the prior month. '
        +'But did Premium simply fall because April was a quieter month? The next steps investigate.';
    }
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 2 — Premium rate
  // ══════════════════════════════════════════════════════════════
  (function(){
    var th=el('s2-thead'),tb=el('s2-tbody'),obs=el('s2-obs');
    if(!th||!tb||!ins.act2_rows) return;
    th.innerHTML='<tr>'+TH('Month','left')
      +TH('Total Trips')+TH('Premium Trips','right',NAVY,'#9ae6b4')
      +TH('MoM Change')+TH('MoM %')
      +TH('PM Rate','right',NAVY,'#9ae6b4')+'</tr>';
    var html=''; var kRow=null;
    ins.act2_rows.forEach(function(r,i){
      html+='<tr style="'+rowBg(r,i)+'">'
        +TD(r.month+(r.is_apu?APU_B:''),'text-align:left;font-family:var(--font-mono);font-weight:600')
        +TD(N(r.total))+TD(N(r.pm),'color:#15803d')
        +TD(S(r.pm_chg),'font-family:var(--font-mono);'+clr(r.pm_chg))
        +TD(P(r.pm_chg_pct),clr(r.pm_chg_pct))
        +TD((r.pm_rate||0).toFixed(2)+'%','font-weight:700;color:#15803d')+'</tr>';
      if(r.is_apu) kRow=r;
    });
    tb.innerHTML=html;
    // Build line chart for Premium rate
    (function(){
      var ctx=el('s2-chart'); if(!ctx) return;
      var months=ins.act2_rows.map(function(r){return r.month;});
      var rates=ins.act2_rows.map(function(r){return r.pm_rate||0;});
      var bgColors=ins.act2_rows.map(function(r){return r.is_apu?'#7c3aed':'#15803d';});
      new Chart(ctx,{type:'line',data:{labels:months,datasets:[{
        label:'Premium Rate (%)',data:rates,
        borderColor:'#15803d',backgroundColor:'rgba(21,128,61,.1)',
        pointBackgroundColor:bgColors,pointRadius:5,pointHoverRadius:7,
        fill:true,tension:.3
      }]},options:{responsive:true,plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(it){return 'Premium Rate: '+it.raw.toFixed(2)+'%';}}}},
        scales:{y:{beginAtZero:false,ticks:{callback:function(v){return v.toFixed(1)+'%';}}}}}});
    })();
    if(obs&&kRow){
      var firstRow=ins.act2_rows[0];
      obs.textContent=
        'Premium’s share of total trips fell from '+(firstRow?firstRow.pm_rate.toFixed(2)+'%':'-')
        +' in '+(firstRow?firstRow.month:'-')+' to '+kRow.pm_rate.toFixed(2)+'% in '+kRow.month
        +' ('+P(kRow.pm_rate_rel_chg,1)+' relative change). '
        +'This means Premium lost more than just the trips lost due to a quieter schedule. '
        +'Let’s compare it to the change in Reserve usage.';
    }
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 3 — Reserve rate
  // ══════════════════════════════════════════════════════════════
  (function(){
    var th=el('s3-thead'),tb=el('s3-tbody'),obs=el('s3-obs');
    if(!th||!tb||!ins.act3_rows) return;
    th.innerHTML='<tr>'+TH('Month','left')
      +TH('Total Trips')+TH('Reserve Trips','right',NAVY,'#fbd38d')
      +TH('MoM Change')+TH('MoM %')
      +TH('RF Rate','right',NAVY,'#fbd38d')+'</tr>';
    var html=''; var kRow=null;
    ins.act3_rows.forEach(function(r,i){
      html+='<tr style="'+rowBg(r,i)+'">'
        +TD(r.month+(r.is_apu?APU_B:''),'text-align:left;font-family:var(--font-mono);font-weight:600')
        +TD(N(r.total))+TD(N(r.rf),'color:#b45309')
        +TD(S(r.rf_chg),'font-family:var(--font-mono);'+clr(r.rf_chg))
        +TD(P(r.rf_chg_pct),clr(r.rf_chg_pct))
        +TD((r.rf_rate||0).toFixed(2)+'%','font-weight:700;color:#b45309')+'</tr>';
      if(r.is_apu) kRow=r;
    });
    tb.innerHTML=html;
    // Build line chart for Reserve rate
    (function(){
      var ctx=el('s3-chart'); if(!ctx) return;
      var months=ins.act3_rows.map(function(r){return r.month;});
      var rates=ins.act3_rows.map(function(r){return r.rf_rate||0;});
      var bgColors=ins.act3_rows.map(function(r){return r.is_apu?'#7c3aed':'#b45309';});
      new Chart(ctx,{type:'line',data:{labels:months,datasets:[{
        label:'Reserve Rate (%)',data:rates,
        borderColor:'#b45309',backgroundColor:'rgba(199,91,0,.1)',
        pointBackgroundColor:bgColors,pointRadius:5,pointHoverRadius:7,
        fill:true,tension:.3
      }]},options:{responsive:true,plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(it){return 'Reserve Rate: '+it.raw.toFixed(2)+'%';}}}},
        scales:{y:{beginAtZero:false,ticks:{callback:function(v){return v.toFixed(1)+'%';}}}}}});
    })();
    if(obs&&kRow){
      var firstRfRow=ins.act3_rows[0];
      obs.textContent=
        'Reserve’s share of total trips moved from '+(firstRfRow?firstRfRow.rf_rate.toFixed(2)+'%':'-')
        +' in '+(firstRfRow?firstRfRow.month:'-')+' to '+kRow.rf_rate.toFixed(2)+'% in '+kRow.month
        +' ('+P(kRow.rf_rate_rel_chg,1)+' relative change). '
        +'This confirms the period was operationally different from the baseline, '
        +'so some Premium reduction is expected. '
        +'The next step compares the two relative changes directly.';
    }
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 4 — So-what comparison table + pies
  // ══════════════════════════════════════════════════════════════
  (function(){
    var th=el('s4c-thead'),tb=el('s4c-tbody'),obs=el('s4c-obs');
    if(!th||!tb||!ins.act4_compare) return;
    th.innerHTML='<tr>'
      +TH('Period','left')
      +TH('Reserve Pre','right','#5c2d00','#fde68a')
      +TH('Reserve Post','right','#5c2d00','#fde68a')
      +TH('RF Rel. Change','right','#5c2d00','#fde68a')
      +TH('Premium Pre','right','#063020','#bbf7d0','border-left:2px solid rgba(255,255,255,.2)')
      +TH('Premium Post','right','#063020','#bbf7d0')
      +TH('PM Rel. Change','right','#063020','#bbf7d0')
      +'</tr>';
    var html=''; var kRow=null;
    ins.act4_compare.forEach(function(r,i){
      var bg=r.is_apu?'background:#f5f0ff;outline:2px solid rgba(124,58,237,.3);outline-offset:-2px':i%2?'background:var(--gray0)':'';
      html+='<tr style="'+bg+'">'
        +TD(r.pre_mo+' → '+r.post_mo+(r.is_apu?APU_B:''),'text-align:left;font-family:var(--font-mono);font-size:.76rem')
        +TD(r.rf_rate_pre.toFixed(2)+'%','color:#b45309')
        +TD(r.rf_rate_post.toFixed(2)+'%','color:#b45309')
        +TD(P(r.rf_rel,1),'font-weight:700;'+clr(r.rf_rel))
        +TD(r.pm_rate_pre.toFixed(2)+'%','color:#15803d;border-left:2px solid var(--gray1)')
        +TD(r.pm_rate_post.toFixed(2)+'%','color:#15803d')
        +TD(P(r.pm_rel,1),'font-weight:700;'+clr(r.pm_rel))+'</tr>';
      if(r.is_apu) kRow=r;
    });
    tb.innerHTML=html;
    if(obs&&kRow){
      var rfR=kRow.rf_rel||0, pmR=kRow.pm_rel||0;
      var multiple=(pmR!=0&&rfR!=0)?Math.abs(pmR/rfR).toFixed(1):null;
      obs.textContent=
        'Reserve’s share of total trips changed '+P(rfR,1)+' relative to its prior-month rate. '
        +'Premium’s share changed '+P(pmR,1)+' — '
        +(multiple?multiple+'× the Reserve change. ':'significantly more. ')
        +'Volume alone cannot explain this gap. '
        +'Something materially changed in how open trips were covered in '+kRow.post_mo+'.';
    }
  })();

  // ── Pie charts ────────────────────────────────────────────────
  (function(){
    var wrap=el('ins-pies'),obs=el('s4p-obs');
    if(!wrap||!ins.act4_pies) return;
    wrap.innerHTML='';
    var COLORS={rf:'#c75b00',pm:'#15803d',apu:'#7c3aed',other:'#9ca3af'};
    ins.act4_pies.forEach(function(pie,idx){
      var cid='ins-pie-'+pie.month.replace(/[-\/]/g,'_');
      var div=document.createElement('div');
      div.style.cssText='text-align:center;min-width:210px';
      // build annotation lines (pp change vs prior month)
      var ann='';
      if(pie.pm_pct_chg!=null){
        ann+='<div style="font-size:.7rem;line-height:1.8;margin-top:6px">'
          +'<span style="color:'+COLORS.rf+'">▪ Reserve: '+pie.rf_pct+'%</span><br>'
          +'<span style="color:'+COLORS.pm+'">▪ Premium: '+pie.pm_pct+'%</span><br>'
          +(pie.apu>0?'<span style="color:'+COLORS.apu+'">▪ APU: '+pie.apu_pct+'%'+(pie.apu_pct_chg!=null?' (NEW)':'')+'</span><br>':'')
          +'<span style="color:'+COLORS.other+'">▪ Other: '+pie.other_pct+'%</span>'
          +'</div>';
      } else {
        ann='<div style="font-size:.7rem;color:var(--gray3);margin-top:6px;line-height:1.8">'
          +'<span style="color:'+COLORS.rf+'">▪ Reserve '+pie.rf_pct+'%</span><br>'
          +'<span style="color:'+COLORS.pm+'">▪ Premium '+pie.pm_pct+'%</span><br>'
          +(pie.apu>0?'<span style="color:'+COLORS.apu+'">▪ APU '+pie.apu_pct+'%</span><br>':'')
          +'<span style="color:'+COLORS.other+'">▪ Other '+pie.other_pct+'%</span>'+'</div>';
      }
      div.innerHTML='<div style="font-weight:700;font-size:.82rem;color:var(--navy);margin-bottom:6px">'
        +pie.month+(pie.is_apu?'<span style="font-size:.62rem;font-weight:700;background:#7c3aed;color:#fff;padding:1px 5px;border-radius:3px;margin-left:5px">APU Launch</span>':'')
        +'</div>'
        +'<canvas id="'+cid+'" width="200" height="200" style="max-width:200px"></canvas>'
        +ann;
      wrap.appendChild(div);
      setTimeout((function(cid,pie){return function(){
        var ctx=document.getElementById(cid); if(!ctx) return;
        var labels=['Reserve','Premium'];
        var data=[pie.rf,pie.pm];
        var bgColors=[COLORS.rf,COLORS.pm];
        if(pie.apu>0){labels.push('APU');data.push(pie.apu);bgColors.push(COLORS.apu);}
        if(pie.other>0){labels.push('Other');data.push(pie.other);bgColors.push(COLORS.other);}
        new Chart(ctx,{type:'pie',
          data:{labels:labels,datasets:[{data:data,backgroundColor:bgColors,borderWidth:2,borderColor:'#fff'}]},
          options:{responsive:false,plugins:{legend:{display:false},
            tooltip:{callbacks:{label:function(it){
              var t=it.dataset.data.reduce(function(s,v){return s+v;},0);
              return it.label+': '+it.raw.toLocaleString()+' ('+Math.round(it.raw/t*1000)/10+'%)';
            }}}}}});
      };})(cid,pie),0);
    });
    if(obs&&ins.act4_pies.length>=2){
      var prePie=ins.act4_pies.find(function(p){return p.month===ins.pre_mo;});
      var postPie=ins.act4_pies.find(function(p){return p.month===ins.post_mo;});
      if(prePie&&postPie)
        obs.textContent='The Premium slice shrank from '+prePie.pm_pct+'% in '+prePie.month
          +' to '+postPie.pm_pct+'% in '+postPie.month+'. '
          +'The Reserve slice moved from '+prePie.rf_pct+'% to '+postPie.rf_pct+'%. '
          +'The asymmetry between those two changes is the visual representation of the rate divergence identified above.';
    }
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 5 — Volume Model expected vs actual
  // ══════════════════════════════════════════════════════════════
  (function(){
    var wrap=el('s5a-wrap'),obs=el('s5a-obs');
    if(!wrap||!ins.act6a) return;
    var a=ins.act6a;
    var selClass=ins.act6_select&&ins.act6_select.selected==='vol'
      ?'background:#f0fdf4;outline:2px solid #15803d;outline-offset:-2px':'';
    wrap.innerHTML='<table style="font-size:.8rem;border-collapse:collapse;max-width:560px;width:100%">'
      +'<tbody>'
      +'<tr><td style="padding:5px 10px;color:var(--gray3);width:55%">Prior-month Premium rate ('+a.pre_mo+')</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">'+a.pm_rate_pre.toFixed(2)+'%</td></tr>'
      +'<tr style="background:var(--gray0)"><td style="padding:5px 10px;color:var(--gray3)">'+a.post_mo+' Total Trips</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">'+N(a.tot_post)+'</td></tr>'
      +'<tr><td style="padding:5px 10px;font-weight:600">Expected Premium ('+a.tot_post.toLocaleString()+' × '+a.pm_rate_pre.toFixed(2)+'%)</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700">'+N(a.pm_exp)+'</td></tr>'
      +'<tr style="background:var(--gray0)"><td style="padding:5px 10px;font-weight:600">Actual Premium ('+a.post_mo+')</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#b91c1c">'+N(a.pm_actual)+'</td></tr>'
      +'<tr style="'+selClass+'"><td style="padding:5px 10px;font-weight:700;color:#b91c1c">Shortfall</td>'
        +'<td style="padding:5px 10px;text-align:right;font-weight:700;color:#b91c1c">'+N(a.shortfall)+' trips ('+a.shortfall_pct+'% below expectation)'
        +(ins.act6_select&&ins.act6_select.selected==='vol'?SEL_B:'')+'</td></tr>'
      +'</tbody></table>';
    if(obs) obs.textContent=a.description;
    // Expected vs Actual bar chart
    (function(){
      var ctx=el('s5a-chart'); if(!ctx) return;
      new Chart(ctx,{type:'bar',
        data:{labels:['Expected Premium','Actual Premium'],
          datasets:[{data:[a.pm_exp,a.pm_actual],
            backgroundColor:['rgba(21,128,61,.7)','rgba(185,28,28,.7)'],
            borderColor:['#15803d','#b91c1c'],borderWidth:2}]},
        options:{responsive:true,indexAxis:'y',
          plugins:{legend:{display:false},
            tooltip:{callbacks:{label:function(it){return it.raw.toLocaleString()+' trips';}}}},
          scales:{x:{beginAtZero:true,ticks:{callback:function(v){return v.toLocaleString();}}}}}});
    })();
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 6 — RF-Normalised Model
  // ══════════════════════════════════════════════════════════════
  (function(){
    var wrap=el('s6b-wrap'),obs=el('s6b-obs'),selWrap=el('s6-select-wrap'),selTxt=el('s6-select-text');
    if(!wrap||!ins.act6b) return;
    var b=ins.act6b;
    var selClass=ins.act6_select&&ins.act6_select.selected==='rf'
      ?'background:#f0fdf4;outline:2px solid #15803d;outline-offset:-2px':'';
    wrap.innerHTML='<table style="font-size:.8rem;border-collapse:collapse;max-width:560px;width:100%">'
      +'<tbody>'
      +'<tr><td style="padding:5px 10px;color:var(--gray3);width:55%">Reserve scale factor (RF changed '+P(b.rf_rel_chg,1)+')</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">'+b.rf_scale.toFixed(4)+'×</td></tr>'
      +'<tr style="background:var(--gray0)"><td style="padding:5px 10px;color:var(--gray3)">Prior-month Premium trips ('+b.pre_mo+')</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">'+N(b.pm_pre)+'</td></tr>'
      +'<tr><td style="padding:5px 10px;font-weight:600">Expected Premium ('+N(b.pm_pre)+' × '+b.rf_scale.toFixed(4)+')</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700">'+N(b.pm_exp)+'</td></tr>'
      +'<tr style="background:var(--gray0)"><td style="padding:5px 10px;font-weight:600">Actual Premium ('+b.post_mo+')</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#b91c1c">'+N(b.pm_actual)+'</td></tr>'
      +'<tr style="'+selClass+'"><td style="padding:5px 10px;font-weight:700;color:#b91c1c">Shortfall</td>'
        +'<td style="padding:5px 10px;text-align:right;font-weight:700;color:#b91c1c">'+N(b.shortfall)+' trips ('+b.shortfall_pct+'% below expectation)'
        +(ins.act6_select&&ins.act6_select.selected==='rf'?SEL_B:'')+'</td></tr>'
      +'</tbody></table>';
    if(obs) obs.textContent=b.description;
    if(ins.act6_select&&selTxt) selTxt.textContent=ins.act6_select.reason;
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 7 — Raw pay hours change
  // ══════════════════════════════════════════════════════════════
  (function(){
    var wrap=el('s7a-wrap'),obs=el('s7a-obs');
    if(!wrap||!ins.act7a) return;
    var a=ins.act7a;
    wrap.innerHTML='<table style="font-size:.8rem;border-collapse:collapse;max-width:480px;width:100%">'
      +'<thead><tr>'+TH('','left')+TH(a.pre_mo)+TH(a.post_mo)+TH('Change')+TH('Change %')+'</tr></thead>'
      +'<tbody><tr>'
        +TD('Premium Pay Hours (HH:MM)','font-weight:600;color:var(--gray4)')
        +TD(HR(a.pay_pre),'text-align:right;font-family:var(--font-mono)')
        +TD(HR(a.pay_post),'text-align:right;font-family:var(--font-mono);color:#b91c1c')
        +TD(HR(a.pay_chg),'text-align:right;font-family:var(--font-mono);font-weight:700;'+clr(a.pay_chg))
        +TD(P(a.pay_chg_pct,1),'text-align:right;'+clr(a.pay_chg_pct))
      +'</tr></tbody></table>';
    if(obs) obs.textContent=
      'Premium pay hours fell from '+HR(a.pay_pre)+' in '+a.pre_mo+' to '+HR(a.pay_post)+' in '+a.post_mo
      +' — a change of '+HR(a.pay_chg)+' ('+P(a.pay_chg_pct,1)+'). '
      +'Not all of this decline is attributable to APU. '
      +'The next step separates the portion explained by lower operational demand from the unexplained remainder.';
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 8 — Stress-adjustment side-by-side
  // ══════════════════════════════════════════════════════════════
  (function(){
    var wrap=el('s7b-wrap'),obs=el('s7b-obs');
    if(!wrap||!ins.act7b) return;
    var b=ins.act7b;
    var volSel=b.pay_cons_scale==='vol';
    var rfSel =b.pay_cons_scale==='rf';
    wrap.innerHTML='<table style="font-size:.8rem;border-collapse:collapse;width:100%;max-width:680px">'
      +'<thead><tr>'
        +TH('','left')
        +TH('Volume Model','right','#1a2a4a')
        +TH('RF-Normalised Model','right','#1a2a4a','#bfdbfe','border-left:2px solid rgba(255,255,255,.2)')
      +'</tr></thead>'
      +'<tbody>'
      +'<tr><td style="padding:5px 10px;color:var(--gray3)">Scale factor used</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">'+b.vol_scale.toFixed(4)+'× (Total trips ratio)</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);border-left:2px solid var(--gray1)">'+b.rf_scale.toFixed(4)+'× (Reserve ratio)</td></tr>'
      +'<tr style="background:var(--gray0)"><td style="padding:5px 10px;color:var(--gray3)">Prior-month pay hours</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">'+HR(b.pay_pre)+'</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);border-left:2px solid var(--gray1)">'+HR(b.pay_pre)+'</td></tr>'
      +'<tr><td style="padding:5px 10px;font-weight:600">Expected pay hours</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700">'+HR(b.pay_exp_vol)+'</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;border-left:2px solid var(--gray1)">'+HR(b.pay_exp_rf)+'</td></tr>'
      +'<tr style="background:var(--gray0)"><td style="padding:5px 10px;font-weight:600">Actual pay hours</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);color:#b91c1c;font-weight:700">'+HR(b.pay_post||0)+'</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);color:#b91c1c;font-weight:700;border-left:2px solid var(--gray1)">'+HR(b.pay_post||0)+'</td></tr>'
      +'<tr style="'+(rfSel?'background:#f0fdf4;outline:2px solid #15803d;outline-offset:-2px;':'')+'"><td style="padding:5px 10px;font-weight:700;color:#b91c1c">Pay hours shortfall</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#b91c1c">'
          +HR(b.pay_short_vol)+(volSel?SEL_B:'')+'</td>'
        +'<td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#b91c1c;border-left:2px solid var(--gray1)">'
          +HR(b.pay_short_rf)+(rfSel?SEL_B:'')+'</td></tr>'
      +'</tbody></table>';
    if(obs) obs.textContent=
      'The Volume Model gives a shortfall of '+HR(b.pay_short_vol)
      +'; the RF-Normalised Model gives '+HR(b.pay_short_rf)+'. '
      +'We use the '+( b.pay_cons_scale==='rf'?'RF-Normalised':'Volume')
      +' figure ('+HR(b.pay_short_cons)+') as the conservative floor — '
      +'it attributes the least possible pay reduction to APU and the most to genuine operational conditions. '
      +'APU actual pay hours in '+(ins.post_mo||'')+'were '+HR(b.apu_pay_hrs)+', '
      +'which are used directly for the financial estimate below'
      +(b.apu_pay_hrs<=b.pay_short_cons?' (within the shortfall ceiling).':' (exceeds shortfall ceiling; capped at '+HR(b.pay_short_cons)+').');
  })();

  // ══════════════════════════════════════════════════════════════
  // STEP 9 — Financial impact with monthly + cumulative cards
  // ══════════════════════════════════════════════════════════════
  (function(){
    var wrap=el('s8-wrap');
    if(!wrap||!ins.act8) return;
    var a=ins.act8;
    var HR2=function(h){ if(!h) return '0:00'; var neg=h<0; h=Math.abs(h);
      var hh=Math.floor(h),mm=Math.round((h-hh)*60);
      return (neg?'-':'')+hh+':'+(mm<10?'0':'')+mm; };
    var hasCum = (a.post_months&&a.post_months.length>1);

    var card=function(lbl,val,sub,sub2,color){
      return '<div style="background:#fff;border-radius:var(--radius);padding:14px 16px;'
        +'border-top:4px solid '+color+';box-shadow:var(--shadow)">'
        +'<div style="font-size:.7rem;font-weight:700;color:var(--gray3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+lbl+'</div>'
        +'<div style="font-size:1.5rem;font-weight:700;color:var(--navy);line-height:1.1">'+val+'</div>'
        +'<div style="font-size:.74rem;color:var(--gray3);margin-top:4px;line-height:1.5">'+sub+'</div>'
        +(sub2?'<div style="font-size:.74rem;color:var(--gray3);border-top:1px dashed var(--gray1);margin-top:8px;padding-top:6px;line-height:1.5">'+sub2+'</div>':'')
        +'</div>';
    };

    wrap.innerHTML=
      '<div style="font-size:.7rem;font-weight:700;color:var(--gray3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">'
        +(hasCum
          ?'This month ('+a.post_mo+') &nbsp;/&nbsp; <span style="color:var(--navy)">Cumulative since APU launch</span>'
          :'This month ('+a.post_mo+')')
      +'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-bottom:24px">'
        +card('APU Pay Hours Attributed',
              HR2(a.apu_hrs_attributed),
              'This month'+((a.apu_pay_hrs>a.pay_short_cons)?' (capped at shortfall)':''),
              hasCum?'Cumulative: '+HR2(a.cum_apu_hrs):null,
              '#7c3aed')
        +card('Incremental Premium Rate',
              '$'+a.incr_rate+'/hr',
              '50% uplift on $250/hr base rate',
              null,
              '#b45309')
        +card('Lost Premium Compensation',
              '$'+a.lost_comp.toLocaleString(),
              'This month: '+HR2(a.apu_hrs_attributed)+' hrs × $'+a.incr_rate,
              hasCum?'Cumulative: $'+a.cum_lost_comp.toLocaleString():null,
              '#b91c1c')
        +card('Lost Union Revenue',
              '$'+a.union_loss.toLocaleString(),
              'This month: '+a.union_rate_pct.toFixed(1)+'% of $'+a.lost_comp.toLocaleString(),
              hasCum?'Cumulative: $'+a.cum_union_loss.toLocaleString():null,
              '#1a3a5c')
      +'</div>';

    // Bottom Line
    var btm=el('ins-bottom-text');
    if(btm){
      var numMonths=hasCum?a.post_months.length:1;
      var monthWord=numMonths===1?'month':'months';
      btm.innerHTML=
        'Over '+(numMonths>1?numMonths+' '+monthWord+' since APU launched':'the first APU month')
        +', pilots collectively forfeited an estimated '
        +'<span style="color:#f9a8d4">$'+a.cum_lost_comp.toLocaleString()+'</span>'
        +' in incremental Premium compensation — '
        +'representing <span style="color:#c4b5fd">$'+a.cum_union_loss.toLocaleString()+'</span>'
        +' in lost union revenue.';
    }
  })();
}



