// Token Radar dashboard: board, detail view, live comps. No network, no
// framework. Reads window.RADAR from data.js (written by main.ts).
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R || !Array.isArray(R.rows)) {
    document.body.innerHTML = '<p style="padding:40px">Token Radar: no data loaded.</p>';
    return;
  }
  var PAGE = 50;
  var state = { q: '', cat: '', chain: '', scope: 'all', sort: 'value', page: 0, detail: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function moneyFull(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) { return String(s); }

  // ---- header stats ----
  var meta = $('meta');
  [['rows', R.board_size], ['watchlist', R.watchlist_size], ['early', R.early_size], ['live comps', R.live_size]].forEach(function (kv) {
    var d = el('div', 'stat');
    d.appendChild(el('b', null, String(kv[1])));
    d.appendChild(el('span', null, kv[0]));
    meta.appendChild(d);
  });
  var asof = el('div', 'stat');
  asof.appendChild(el('b', null, R.as_of));
  asof.appendChild(el('span', null, 'snapshot date'));
  meta.appendChild(asof);
  $('mver').textContent = R.model_version;
  $('datasrc').textContent = 'Snapshot: ' + R.source + '. Floor: ' + moneyFull(R.floor_usd) + '. ' +
    'A protocol is listed as pre-token when its DefiLlama record carries no token; that is a record, not proof it has none.';

  // ---- tabs ----
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
  });
  function showTab(name) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === name); });
    ['board', 'live', 'model'].forEach(function (n) { $('tab-' + n).hidden = n !== name; });
    if (name === 'live') renderLive();
  }

  // ---- filters ----
  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    (r.chains || []).forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) { $('fcat').appendChild(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { $('fchain').appendChild(new Option(c, c)); });

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = R.rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.on_watchlist) return false;
      if (state.scope === 'early' && r.on_watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var s = state.sort;
    rows.sort(function (a, b) {
      if (s === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (s === 'growth') return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d);
      if (s === 'age') return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days);
      return b.implied_value_usd - a.implied_value_usd;
    });
    return rows;
  }

  function renderBoard() {
    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    var start = state.page * PAGE;
    var slice = rows.slice(start, start + PAGE);
    var tb = $('rows');
    tb.innerHTML = '';
    slice.forEach(function (r) {
      var tr = document.createElement('tr');
      if (state.detail === r.slug) tr.className = 'sel';
      tr.setAttribute('data-slug', r.slug);
      var td;
      td = el('td', 'num mono', String(r.rank)); tr.appendChild(td);
      td = el('td', 'name');
      var nm = el('span', 'pname', r.name);
      td.appendChild(nm);
      if (r.on_watchlist) td.appendChild(el('span', 'badge', 'WATCHLIST'));
      td.appendChild(el('div', 'pcat', (r.category || 'No category') + ' · ' + (r.chains || []).slice(0, 3).join(', ')));
      tr.appendChild(td);
      td = el('td', 'num mono', money(r.tvl_usd)); tr.appendChild(td);
      td = el('td', 'num mono', pct(r.change_7d));
      td.className += r.change_7d === null ? ' mut' : (r.change_7d >= 0 ? ' pos' : ' neg');
      tr.appendChild(td);
      td = el('td', 'num mono', ageText(r.age_days)); tr.appendChild(td);
      td = el('td', 'num mono', r.multiple.toFixed(3) + (r.multiple_source === 'global' ? ' g' : ''));
      td.title = r.multiple_source === 'global' ? 'Global median (fewer than 3 category comps)' : 'Category median';
      tr.appendChild(td);
      td = el('td', 'num mono');
      var b = el('b', null, money(r.implied_value_usd));
      td.appendChild(b);
      tr.appendChild(td);
      tr.addEventListener('click', function () { openDetail(r.slug); });
      tb.appendChild(tr);
    });
    $('count').textContent = rows.length + ' protocols · page ' + (state.page + 1) + ' of ' + pages;
    $('pageinfo').textContent = 'Page ' + (state.page + 1) + ' of ' + pages;
    $('prev').disabled = state.page === 0;
    $('next').disabled = state.page >= pages - 1;
  }

  $('prev').addEventListener('click', function () { if (state.page > 0) { state.page--; renderBoard(); } });
  $('next').addEventListener('click', function () { state.page++; renderBoard(); });
  $('q').addEventListener('input', function () { state.q = this.value; state.page = 0; renderBoard(); });
  $('fcat').addEventListener('change', function () { state.cat = this.value; state.page = 0; renderBoard(); });
  $('fchain').addEventListener('change', function () { state.chain = this.value; state.page = 0; renderBoard(); });
  $('fscope').addEventListener('change', function () { state.scope = this.value; state.page = 0; renderBoard(); });
  $('fsort').addEventListener('change', function () { state.sort = this.value; state.page = 0; renderBoard(); });

  // ---- detail ----
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) { r = R.rows[i]; break; }
    if (!r) return;
    state.detail = slug;
    var d = $('detail');
    d.innerHTML = '';
    d.hidden = false;
    var close = el('button', 'dclose', 'Close ×');
    close.type = 'button';
    close.addEventListener('click', closeDetail);
    d.appendChild(close);
    d.appendChild(el('h2', null, '#' + r.rank + ' · ' + r.name));
    d.appendChild(el('p', 'dsub', (r.category || 'No category') + ' · ' + (r.chains || []).join(', ') + (r.on_watchlist ? ' · on the watchlist' : ' · below the watchlist floor')));
    var grid = el('div', 'dgrid');
    var left = el('div');
    left.appendChild(el('h3', null, 'Implied value — how it is priced'));
    var kv = el('dl', 'kv');
    function row(k, v) {
      kv.appendChild(el('dt', null, k));
      var dd = el('dd', null, v);
      kv.appendChild(dd);
    }
    row('TVL', moneyFull(r.tvl_usd));
    row('7-day change', pct(r.change_7d));
    row('Age', r.age_days === null ? 'unknown (counts as 365d)' : ageText(r.age_days) + ' (' + r.age_days + ' days)');
    row('Multiple', r.multiple.toFixed(3) + '× (' + (r.multiple_source === 'global' ? 'global median' : 'category median') + ')');
    row('Growth factor', '×' + r.growth_multiplier.toFixed(3));
    row('Maturity factor', '×' + r.maturity_multiplier.toFixed(3));
    row('Implied value', moneyFull(r.implied_value_usd));
    left.appendChild(kv);
    var math = el('p', 'math');
    math.innerHTML = '';
    math.appendChild(document.createTextNode(moneyFull(r.tvl_usd) + ' × ' + r.multiple.toFixed(3) + ' × ' + r.growth_multiplier.toFixed(3) + ' × ' + r.maturity_multiplier.toFixed(3) + ' = '));
    math.appendChild(el('b', null, moneyFull(r.implied_value_usd)));
    left.appendChild(math);
    grid.appendChild(left);
    var right = el('div');
    right.appendChild(el('h3', null, 'Farm plan — six steps'));
    var ol = el('ol', 'steps');
    (r.farm_steps || []).forEach(function (s, i) {
      var li = el('li');
      li.appendChild(document.createTextNode((i + 1) + '. ' + s));
      ol.appendChild(li);
    });
    right.appendChild(ol);
    grid.appendChild(right);
    d.appendChild(grid);
    try { history.replaceState(null, '', '#detail=' + encodeURIComponent(slug)); } catch (e) { /* no history in some embeds */ }
    renderBoard();
  }
  function closeDetail() {
    state.detail = null;
    $('detail').hidden = true;
    $('detail').innerHTML = '';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    renderBoard();
  }

  // ---- live + comps ----
  var liveDone = false;
  function renderLive() {
    if (liveDone) return;
    liveDone = true;
    var tb = $('liverows');
    R.live.forEach(function (p) {
      var tr = document.createElement('tr');
      var td = el('td', 'name');
      td.appendChild(el('span', 'pname', p.name));
      td.appendChild(el('div', 'pcat', (p.category || 'No category') + ' · ' + (p.chains || []).slice(0, 3).join(', ')));
      tr.appendChild(td);
      tr.appendChild(el('td', 'num mono', money(p.tvl_usd)));
      tr.appendChild(el('td', 'num mono', p.mcap_usd === null ? '—' : money(p.mcap_usd)));
      tr.appendChild(el('td', 'num mono', p.fdv_tvl === null ? '—' : p.fdv_tvl.toFixed(2) + '×'));
      tb.appendChild(tr);
    });
    var cb = $('comprows');
    (R.comps || []).forEach(function (c) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', 'name', c.category));
      tr.appendChild(el('td', 'num mono', String(c.comps)));
      tr.appendChild(el('td', 'num mono', c.median_multiple.toFixed(3) + '×'));
      cb.appendChild(tr);
    });
    var g = el('tr');
    g.appendChild(el('td', 'name', 'Global median (fallback)'));
    g.appendChild(el('td', 'num mono', '—'));
    g.appendChild(el('td', 'num mono', R.global_multiple.toFixed(3) + '×'));
    cb.appendChild(g);
  }

  // ---- deep links: #detail=<slug> and #filter=<category> ----
  function applyHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var parts = h.split('&');
    parts.forEach(function (part) {
      var kv = part.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'detail' && v) openDetail(v);
      if (k === 'filter' && v) {
        state.cat = v;
        var sel = $('fcat');
        for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === v) { sel.selectedIndex = i; break; }
        state.page = 0;
      }
    });
  }

  renderBoard();
  applyHash();
  renderBoard();
})();
