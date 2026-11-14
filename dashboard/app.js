// Token Radar's dashboard, model radar-2. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail drawer with
// the model's own inputs and the protocol's farm plan. No network: every byte it shows is in
// data.js. The farm plan and the implied value are the same derivations main.ts writes to
// board.json: category, chains, TVL and age decide the action, the capital, the hold and every
// cost and time. No name is special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_max_chains);
    var breadth = 1 + extra * model.breadth_per_chain;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  var CHEAP_GAS = { solana: 1, base: 1, arbitrum: 1, optimism: 1, polygon: 1, binance: 1, bsc: 1, monad: 1, avalanche: 1, sei: 1, sui: 1, aptos: 1, linea: 1, scroll: 1, zksync: 1, blast: 1, mode: 1, fraxtal: 1, berachain: 1 };
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasFor(p) {
    var first = (p.chains && p.chains.length > 0 ? p.chains[0] : '').toLowerCase();
    if (CHEAP_GAS[first]) return { setup: 'about $1 of gas', weekly: 'under $1 of gas a week' };
    return { setup: 'about $8 of gas', weekly: 'about $3 of gas a week' };
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(p);
    var second = p.chains && p.chains.length > 1 ? p.chains[1] : null;
    var steps = [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas.setup, time: '15 minutes to set up' },
      second === null
        ? { text: 'Do a second kind of action in the same app, such as a swap, a borrow or a vote, so the activity is not one transaction.', cost: gas.weekly, time: '10 minutes' }
        : { text: 'Repeat the position on ' + second + ' too, with half the capital, so the farm covers a second chain.', cost: '$' + Math.round(capital / 2) + ' of capital and ' + gas.setup, time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: gas.weekly, time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, then unwind in one transaction and keep the receipt.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    return steps.map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function band() {
    return el('div', { class: 'band' },
      el('div', { class: 'band-inner' },
        el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
        el('div', { class: 'band-meta' },
          el('span', { text: 'Snapshot ' + DATA.as_of }),
          el('span', { text: 'DefiLlama protocol index' }),
          el('span', { text: DATA.model_version + ' model' })
        )
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar ranks every other pre-token protocol too — ' + DATA.early_size + ' of them — so the board is the whole pre-token universe, not a top slice. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function spotlight() {
    var top = DATA.rows.slice(0, 5);
    return el('section', { class: 'spotlight', 'aria-label': 'Top five by implied value' },
      top.map(function (r, i) {
        return el('button', { type: 'button', class: 'spot' + (i === 0 ? ' first' : ''), onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rank', text: '#' + r.rank }),
          el('b', { text: r.name }),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'sub', text: fmtUsd(r.tvl_usd) + ' TVL · ' + fmtPct(r.change_7d) + ' 7d' })
        );
      })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var tvlSelect = el('select', { id: 'mintvl', 'aria-label': 'Minimum TVL' },
      [0, 50000000, 100000000, 500000000, 1000000000].map(function (v) {
        return el('option', { value: String(v), text: v === 0 ? 'Any TVL' : 'TVL >= ' + fmtUsd(v), selected: v === state.minTvl ? 'selected' : null });
      })
    );
    tvlSelect.addEventListener('change', function () { state.minTvl = Number(tvlSelect.value); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'mintvl', text: 'Minimum TVL' }), tvlSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var nameCell = el('div', { class: 'name' },
        el('span', null,
          el('b', { text: r.name }),
          r.on_watchlist ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null
        ),
        el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.chains && r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') })
      );
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, nameCell),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  // The five fastest-growing pre-token protocols over seven days, by the snapshot's own
  // change_7d. Growth is momentum, not a verdict: a small protocol can spike on one week.
  function topMovers() {
    var list = DATA.rows.filter(function (r) { return r.change_7d !== null; })
      .slice().sort(function (a, b) { return b.change_7d - a.change_7d; }).slice(0, 5);
    if (list.length === 0) return null;
    return el('section', { class: 'panel movers' },
      el('h2', { text: 'Top movers, last 7 days' }),
      el('p', { class: 'sub', text: 'The fastest-growing pre-token protocols by seven-day TVL change. A mover is hot, not necessarily first: check its rank and its farm plan before you chase it.' }),
      el('div', { class: 'mover-list' },
        list.map(function (r) {
          return el('button', { type: 'button', class: 'mover', onclick: function () { openDetail(r.slug); } },
            el('b', { text: r.name }),
            el('span', { class: 'num pos', text: fmtPct(r.change_7d) }),
            el('span', { class: 'sub', text: 'Rank ' + r.rank + ' · ' + fmtUsd(r.tvl_usd) + ' TVL' })
          );
        })
      )
    );
  }

  // One row per category: how many pre-token protocols it holds, their combined TVL, and its
  // strongest protocol by implied value. The board ranks protocols, this table ranks the
  // categories they belong to, from the same figures.
  function categorySummary() {
    var by = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      if (!by[c]) by[c] = { count: 0, tvl: 0, top: r };
      by[c].count++;
      by[c].tvl += r.tvl_usd;
      if (r.implied_value_usd > by[c].top.implied_value_usd) by[c].top = r;
    });
    var cats = Object.keys(by).sort(function (a, b) { return by[b].tvl - by[a].tvl; });
    var tbody = el('tbody');
    cats.forEach(function (c) {
      var g = by[c];
      tbody.appendChild(el('tr', { onclick: function () { state.category = c; state.tab = 'pre-token'; render(); } },
        el('td', null, el('b', { text: c })),
        el('td', { class: 'num', text: String(g.count) }),
        el('td', { class: 'num', text: fmtUsd(g.tvl) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: g.top.name }),
          el('span', { class: 'sub', text: 'Rank ' + g.top.rank })
        )),
        el('td', { class: 'num', text: fmtUsd(g.top.implied_value_usd) })
      ));
    });
    return el('section', { class: 'panel summary' },
      el('div', { class: 'summary-head' },
        el('h2', { text: 'Categories at a glance' }),
        el('button', { class: 'button', type: 'button', text: 'Download board as CSV', onclick: downloadCsv })
      ),
      el('p', { class: 'sub', text: 'Select a category to filter the board to it. The CSV holds the rows the board shows now, with their rank, implied value, TVL, growth and age.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols grouped by category, largest combined TVL first.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', text: 'Protocols' }),
            el('th', { scope: 'col', text: 'Combined TVL' }),
            el('th', { scope: 'col', text: 'Strongest protocol' }),
            el('th', { scope: 'col', text: 'Its implied value' })
          )),
          tbody
        )
      )
    );
  }

  // The filtered board as a CSV file, built in the page from the same rows it shows. No
  // network: the file is made from window.RADAR and downloaded from a blob URL.
  function csvOf(list) {
    var head = 'rank,name,category,chains,tvl_usd,change_7d,age_days,implied_value_usd,on_watchlist';
    function cell(v) {
      var s = v === null || v === undefined ? '' : String(v);
      return s.indexOf(',') >= 0 || s.indexOf('"') >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var lines = list.map(function (r) {
      return [r.rank, r.name, r.category || '', (r.chains || []).join(';'), r.tvl_usd,
        r.change_7d === null ? '' : r.change_7d, r.age_days === null ? '' : r.age_days,
        r.implied_value_usd, r.on_watchlist ? 'yes' : 'no'].map(cell).join(',');
    });
    return head + '\n' + lines.join('\n') + '\n';
  }
  function downloadCsv() {
    var blob = new Blob([csvOf(sortedRows(rows()))], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'token-radar-board.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // The model, stated in the open: the formula as one line and the plain reading of each
  // factor beneath it, so any reader can check a rank against the snapshot's own figures.
  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One rule scores every row, and it comes only from the snapshot: implied value = TVL x ' + m.base_multiple + ' x growth x maturity x breadth. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + 0.05 x min(chains - 1, 4)) )'
      ),
      el('p', { class: 'sub', text: 'TVL is the anchor, because a bigger protocol\'s token would be worth more. Growth is the momentum, clamped so one wild week cannot run the board. Age is the time since the protocol was first listed, the best record of how long it has run with no token, capped at three years; an unlisted age uses ' + m.unknown_age_days + ' days. Breadth is the chain count: one chain adds nothing, each extra chain up to four adds 5%. The board ranks the whole pre-token universe in the snapshot, and the live-token protocols are set aside with their market caps shown, never mixed into the ranking.' }),
      el('p', { class: 'note', text: 'What this is not: a prediction that a token will be issued, or when. A protocol records no token in this snapshot; that is the record, not proof it has none. Farm only money you can lose, and claim only from the protocol\'s own published links.' })
    );
  }

  // Three steps for a reader who has never used a radar: find, check, farm. The guide sits
  // below the board so the board itself stays the first thing a reader meets.
  function readingGuide() {
    var steps = [
      { h: '1. Find a candidate', b: 'Start at the top of the board, or filter to a category you already use. The top movers strip shows what is hot this week, and the category table shows which corner of the market holds the most value.' },
      { h: '2. Check why it ranks there', b: 'Select a row to open its detail drawer. It shows the four factors of the model for that protocol, in plain words, and the farm plan beneath them. A high rank with a falling seven-day change is a warning, not a buy signal.' },
      { h: '3. Farm it, or don\'t', b: 'Every row carries seven steps with a cost and a time on each. The cheapest farms run on low-fee chains and need a few dollars; Ethereum rows cost more in gas. If the plan asks for money you cannot lose, skip the row.' },
      { h: '4. Start from the watchlist', b: 'The watchlist badge marks the forty protocols the house already watches. They are the floor of this board, not the ceiling: the board adds every other pre-token protocol in the snapshot, so a protocol outside the watchlist can outrank one inside it.' },
      { h: '5. Take the board with you', b: 'The CSV button in the categories section downloads the rows the board shows now, with rank, implied value, TVL, growth and age. It is the same data the page shows, in a form a spreadsheet can sort.' }
    ];
    return el('section', { class: 'panel guide' },
      el('h2', { text: 'How to read this board' }),
      el('ol', { class: 'guide-list' },
        steps.map(function (s) {
          return el('li', null, el('b', { text: s.h }), el('span', { text: ' ' + s.b }));
        })
      )
    );
  }

  // A footer that states where the numbers come from and when: the snapshot date, how many
  // protocols it holds, how many the watchlist names, and how many rows the board scores.
  // The radar is only as fresh as its snapshot, and the footer says so in plain words.
  function snapshotFooter() {
    var facts = [
      ['Snapshot date', DATA.as_of],
      ['Protocols in the snapshot', String(DATA.snapshot_total)],
      ['On the house watchlist', String(DATA.watchlist_size)],
      ['Rows on this board', String(DATA.rows.length)],
      ['Live-token protocols set aside', String(DATA.live.length)],
      ['Model', DATA.model_version + ' — implied value from TVL, seven-day growth, age and chain count']
    ];
    return el('footer', { class: 'panel footer' },
      el('h2', { text: 'About this snapshot' }),
      el('p', { class: 'sub', text: 'The board is a read of one sealed snapshot. It does not fetch prices, it does not watch the chain, and it cannot know what a protocol does after the snapshot date. A rank here is a starting point for research, not a recommendation.' }),
      el('dl', { class: 'facts-foot' },
        facts.map(function (f) {
          return el('div', { class: 'fact' }, el('dt', { text: f[0] }), el('dd', { text: f[1] }));
        })
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function whyRank(row) {
    var parts = [];
    parts.push(fmtUsd(row.tvl_usd) + ' of TVL');
    if (row.change_7d !== null && row.change_7d >= 10) parts.push('growing ' + fmtPct(row.change_7d) + ' in 7 days');
    else if (row.change_7d !== null && row.change_7d < 0) parts.push('shrinking ' + fmtPct(row.change_7d) + ' in 7 days');
    if (row.age_days !== null && row.age_days >= 365) parts.push('running ' + fmtAge(row.age_days) + ' with no token on record');
    if (row.chains && row.chains.length >= 3) parts.push('live on ' + row.chains.length + ' chains');
    if (row.on_watchlist) parts.push('on the house watchlist');
    return 'Rank ' + row.rank + ' because of ' + parts.join(', ') + '.';
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? ' · Watchlist' : '') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: String(row.breadth_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row, DATA.model)) + (impliedOf(row, DATA.model) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' ' + whyRank(row) + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(band());
    shell.appendChild(lede());
    shell.appendChild(spotlight());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      shell.appendChild(topMovers());
      shell.appendChild(categorySummary());
      shell.appendChild(modelPanel());
      shell.appendChild(readingGuide());
      shell.appendChild(snapshotFooter());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
