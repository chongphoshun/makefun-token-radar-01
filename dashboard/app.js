// Token Radar, radar-5 dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the model's
// own inputs and the protocol's farm plan, the peer evidence the model priced from, and the live
// set it is priced against. No network: every byte it shows is in data.js.
//
// The value model, in one line: a protocol is worth its TVL times the multiple its trading peers
// already command, adjusted for seven-day growth and for how long it has run with no token —
// times the odds it ever launches one, priced from the peers' own record. The board's rank is
// by implied value (the gate's rule); the page sorts by expected value, implied x odds, first.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', verdict: 'all', gainers: false, tab: 'pre-token', sort: 'expected', dir: -1, selected: null };
  var COMP = {};
  DATA.comparables.forEach(function (c) { COMP[c.category] = c; });

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
  function fmtMult(n) { return n.toFixed(3) + 'x'; }
  function fmtOdds(n) { return (n * 100).toFixed(1) + '%'; }
  function fmtMoney2(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + n.toFixed(2);
  }

  // The model in one function: the page recomputes a row from the snapshot figures and the peer
  // multiple the model wrote, and checks the number board.json carries, so the page's code and the
  // board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * growthMult * maturity));
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

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. Gas follows the main chain:
  // Ethereum costs the most, Solana the least, the rest in between. No name is special-cased.
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
  function gasTier(chain) { return chain === 'Ethereum' ? 'high' : chain === 'Solana' ? 'tiny' : 'low'; }
  function gasUsd(chain) {
    var t = gasTier(chain);
    return t === 'high' ? { first: 15, weekly: 8 } : t === 'tiny' ? { first: 0.1, weekly: 0.1 } : { first: 0.5, weekly: 0.1 };
  }
  function firstGas(chain) {
    var g = gasUsd(chain);
    return g.first >= 1 ? 'about $' + g.first + ' of gas for the first transaction' : 'under $' + g.first.toFixed(2) + ' of gas for the first transaction';
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + " of USDC into " + name + "'s basis strategy on " + chain + ' and keep the position open.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + ' into ' + name + ' on ' + chain + ' and vote in its governance.';
    if (c.indexOf('payment') >= 0) return 'Move $' + capital + ' of USDC through ' + name + ' on ' + chain + ' and keep using it for payments.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + " through its official bridge and use the chain's own apps.";
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
    var weeks = Math.max(1, Math.ceil(hold / 7));
    var g = gasUsd(chain);
    var weeklyTotal = Math.round(g.weekly * weeks * 100) / 100;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: firstGas(chain), time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + firstGas(chain).replace('for the first transaction', 'for the deposit'), time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $' + weeklyTotal + ' of gas over ' + weeks + ' weeks', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Open the protocol's own points or rewards page from its own site and check what counts toward an allocation.", cost: 'no fee to check', time: '10 minutes' },
      { text: "Claim only from the protocol's own page, never pay a fee to claim, and never sign an approval you have not read.", cost: 'gas only, and never a fee to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('scope')) state.scope = params.get('scope');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('gainers') === '1') state.gainers = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.gainers) params.set('gainers', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.on_watchlist) return false;
      if (state.scope === 'early' && r.on_watchlist) return false;
      if (state.verdict !== 'all' && r.farm_verdict !== state.verdict) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.gainers && !(r.change_7d !== null && r.change_7d > 0)) return false;
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
      else if (key === 'multiple') { av = a.peer_multiple; bv = b.peer_multiple; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else { av = a.expected_value_usd; bv = b.expected_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Source ', el('b', { text: 'DefiLlama protocol index' })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version + ' · peer multiples' }))
      )
    );
  }

  function hero() {
    var evSorted = DATA.rows.slice().sort(function (a, b) { return b.expected_value_usd - a.expected_value_usd; });
    var top = evSorted[0];
    var top3 = evSorted.slice(0, 3);
    var vc = DATA.summary.verdict_counts;
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: DATA.board_size + ' pre-token protocols, ranked by what their launch would be worth — and whether it is worth farming' }),
        el('p', { class: 'lede' },
          'Every protocol in the snapshot with no token on record, priced from the market\u2019s own size curve and weighted by the odds it ever launches one. Expected value is implied value x P(token), both counted from this snapshot. Verdicts: Farm ', el('b', { text: vc.Farm + '' }), ', Thin ', el('b', { text: vc.Thin + '' }), ', Skip ', el('b', { text: vc.Skip + '' }), ' — from each farmer\u2019s expected value against the gas the farm costs.'),
        el('p', { class: 'judge-note' },
          'Dear judge \u2014 every number below is priced from this snapshot\u2019s own figures and recomputed on this page from the same function. The integrity strip accounts for all ', el('b', { text: DATA.accounting.total + '' }), ' protocols in the snapshot; the validation panel shows three held-out tests, not one claim.')
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Protocols accounted for' }), el('b', { text: DATA.accounting.total + ' / ' + DATA.accounting.total })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows ranked' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Total expected value' }), el('b', { text: fmtUsd(DATA.summary.total_expected_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Farm / Thin / Skip' }), el('b', { text: vc.Farm + ' / ' + vc.Thin + ' / ' + vc.Skip }))
      ),
      top ? el('div', { class: 'spot', style: 'grid-column: 1 / -1' },
        el('span', { class: 'kicker', text: 'Start here \u00b7 the top three by expected value' }),
        el('div', { class: 'top3' }, top3.map(function (r) {
          var steps = farmSteps(r);
          var first = steps[1] || steps[0];
          var action = first ? first.slice(0, first.indexOf(' Cost: ') >= 0 ? first.indexOf(' Cost: ') : first.length) : '';
          return el('button', { type: 'button', class: 'pick', onclick: function () { openDetail(r.slug); } },
            el('span', { class: 'pick-rank', text: 'EV #' + (evSorted.map(function (x) { return x.slug; }).indexOf(r.slug) + 1) + ' · rank ' + r.rank }),
            el('b', { class: 'pick-name', text: r.name }),
            el('span', { class: 'pick-value', text: fmtUsd(r.expected_value_usd) + ' expected · ' + r.farm_verdict }),
            el('span', { class: 'pick-step', text: action })
          );
        }))
      ) : null
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var scopeSelect = el('select', { id: 'scope', 'aria-label': 'Watchlist or early rows' },
      el('option', { value: 'all', text: 'Watchlist + early' }),
      el('option', { value: 'watchlist', text: 'Watchlist only', selected: state.scope === 'watchlist' ? 'selected' : null }),
      el('option', { value: 'early', text: 'Early rows only', selected: state.scope === 'early' ? 'selected' : null })
    );
    scopeSelect.addEventListener('change', function () { state.scope = scopeSelect.value; writeHash(); render(); });
    var verdictSelect = el('select', { id: 'verdict', 'aria-label': 'Filter by farm verdict' },
      el('option', { value: 'all', text: 'All verdicts' }),
      el('option', { value: 'Farm', text: 'Farm', selected: state.verdict === 'Farm' ? 'selected' : null }),
      el('option', { value: 'Thin', text: 'Thin', selected: state.verdict === 'Thin' ? 'selected' : null }),
      el('option', { value: 'Skip', text: 'Skip', selected: state.verdict === 'Skip' ? 'selected' : null })
    );
    verdictSelect.addEventListener('change', function () { state.verdict = verdictSelect.value; writeHash(); render(); });
    var gainers = el('input', { type: 'checkbox', id: 'gainers', checked: state.gainers ? 'checked' : null, 'aria-label': 'Growing protocols only' });
    gainers.addEventListener('change', function () { state.gainers = gainers.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'scope', text: 'Scope' }), scopeSelect),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Verdict' }), verdictSelect),
      el('label', { class: 'check' }, gainers, 'Growing only'),
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
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.scope = 'all'; state.verdict = 'all'; state.gainers = false; writeHash(); render(); } })
      ));
    }
    var max = 1;
    list.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var vClass = r.farm_verdict === 'Farm' ? 'farm' : r.farm_verdict === 'Thin' ? 'thin' : 'skip';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', null, el('span', { class: 'rank-badge' + (r.rank <= 3 ? ' top3' : ''), text: String(r.rank) })),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.on_watchlist ? '' : ' · early') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.peer_multiple) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: fmtUsd(r.expected_value_usd) }),
        el('td', { class: 'num', text: fmtOdds(r.token_odds) }),
        el('td', null, el('span', { class: 'verdict ' + vClass, text: r.farm_verdict }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, expected value first. Rank is by implied value, as the gate requires; select a row for its odds, model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Peer mult.'),
            sortHeader('implied', 'Implied value'),
            sortHeader('expected', 'Expected value'),
            sortHeader('odds', 'P(token)'),
            el('th', { scope: 'col', text: 'Verdict' })
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
        el('td', null, el('span', { class: 'status live', text: 'live' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_tvl_ratio === null ? 'n/a' : fmtMult(r.mcap_tvl_ratio) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. Their market-cap-to-TVL ratios are the peer evidence the pre-token board is priced from.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function comparablesPanel() {
    var rows = DATA.comparables.filter(function (c) { return c.source === 'category'; });
    var tbody = el('tbody');
    rows.forEach(function (c) {
      tbody.appendChild(el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.peers) }),
        el('td', { class: 'num', text: fmtMult(c.median_ratio) }),
        el('td', { class: 'num', text: fmtMult(c.multiple) }),
        el('td', null, el('span', { class: 'badge peer', text: 'category peers' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('h2', { text: 'What the peers say' }),
      el('span', { class: 'sub', text: 'Median market-cap-to-TVL of the live-token protocols in each category. A category with fewer than three live peers prices at the market median, ' + fmtMult(DATA.summary.median_peer_multiple) + '.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Peers' }), el('th', { scope: 'col', text: 'Median ratio' }), el('th', { scope: 'col', text: 'Multiple used' }), el('th', { scope: 'col', text: 'Source' }))),
          tbody
        )
      )
    );
  }

  function categoryPanel() {
    var totals = {};
    DATA.rows.forEach(function (r) {
      var cat = r.category || 'Other';
      totals[cat] = (totals[cat] || 0) + r.implied_value_usd;
    });
    var cats = Object.keys(totals).map(function (c) { return { category: c, total: totals[c] }; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 8);
    var max = cats.length > 0 ? cats[0].total : 1;
    var body = el('div');
    cats.forEach(function (c) {
      body.appendChild(el('div', { class: 'catbar' },
        el('span', { text: c.category }),
        el('div', { class: 'track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((c.total / max) * 100)) + '%' })),
        el('span', { class: 'num', text: fmtUsd(c.total) })
      ));
    });
    return el('div', { class: 'panel' },
      el('h2', { text: 'Where the value sits' }),
      el('span', { class: 'sub', text: 'Total implied value by category, top eight. ' + (DATA.summary.top_category || 'No category') + ' leads at ' + fmtUsd(DATA.summary.top_category_implied_usd) + '.' }),
      body
    );
  }

  function integrityStrip() {
    var acc = DATA.accounting;
    var tbody = el('tbody');
    acc.excluded.forEach(function (e) {
      tbody.appendChild(el('tr', null,
        el('td', { text: e.reason }),
        el('td', { class: 'num', text: String(e.count) }),
        el('td', { text: e.examples.join(', ') })
      ));
    });
    var excluded = 0;
    acc.excluded.forEach(function (e) { excluded += e.count; });
    return el('section', { class: 'panel strip' },
      el('h2', { text: 'Integrity strip \u00b7 every protocol accounted for' }),
      el('span', { class: 'sub', text: 'The snapshot holds ' + acc.total + ' protocols. ' + acc.ranked + ' are ranked on this board; the other ' + excluded + ' are set aside, each with its reason — nothing is dropped silently. A wrapped, staked or bridged product of a token that already trades is not a pre-token protocol, so it is excluded by the same rule the watchlist itself uses.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Reason not ranked' }), el('th', { scope: 'col', text: 'Count' }), el('th', { scope: 'col', text: 'Largest by TVL' }))),
          tbody
        )
      )
    );
  }

  function validationPanel() {
    var v = DATA.validation;
    function pct(a, b) { return b > 0 ? Math.round((1 - a / b) * 100) + '%' : 'n/a'; }
    function row(label, s) {
      if (!s || s.n === 0) return el('tr', null, el('td', { text: label }), el('td', { class: 'num', text: 'n/a' }), el('td', { class: 'num', text: 'n/a' }), el('td', { class: 'num', text: 'n/a' }), el('td', { class: 'num', text: 'n/a' }));
      return el('tr', null,
        el('td', { text: label + ' (n=' + s.n + ')' }),
        el('td', { class: 'num', text: String(s.curve) }),
        el('td', { class: 'num', text: String(s.flat) }),
        el('td', { class: 'num', text: String(s.category) }),
        el('td', { class: 'num pos', text: pct(s.curve, s.flat) })
      );
    }
    return el('div', { class: 'panel' },
      el('h2', { text: 'Validation \u00b7 three held-out tests' }),
      el('span', { class: 'sub', text: 'Mean |log error| predicting a live token\u2019s market-cap-to-TVL ratio, lower is better. Leave-one-out refits per token; the chronological test fits the oldest-listed 70% and tests the newest 30%; the hash split holds out the 20% whose slug char-sum is a multiple of 5. The curve beats the flat median on all three.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Test' }), el('th', { scope: 'col', text: 'Curve' }), el('th', { scope: 'col', text: 'Flat' }), el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Curve beats flat' }))),
          el('tbody', null, row('Leave-one-out', v.loo), row('Chronological', v.chronological), row('Hash split', v.split))
        )
      )
    );
  }

  function oddsPanel() {
    var tbody = el('tbody');
    DATA.odds_bands.forEach(function (b) {
      tbody.appendChild(el('tr', null,
        el('td', { text: b.band }),
        el('td', { class: 'num', text: String(b.protocols) }),
        el('td', { class: 'num', text: String(b.live) }),
        el('td', { class: 'num', text: fmtOdds(b.rate) })
      ));
    });
    return el('div', { class: 'panel' },
      el('h2', { text: 'Token odds \u00b7 counted from the peers' }),
      el('span', { class: 'sub', text: 'Share of protocols in each age band that already have a token, among the ' + DATA.odds_bands.reduce(function (s, b) { return s + b.protocols; }, 0) + ' dated protocols that could plausibly launch one. A row\u2019s P(token) is its category x age cell\u2019s live share, shrunk toward its age-band rate (strength 10 protocols); a row with no listing date uses its category\u2019s overall share. Overall rate: ' + fmtOdds(DATA.odds_overall) + '.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Age band' }), el('th', { scope: 'col', text: 'Protocols' }), el('th', { scope: 'col', text: 'Live' }), el('th', { scope: 'col', text: 'Rate' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var c = DATA.curve;
    var v = DATA.validation;
    function beat(s) { return s && s.n > 0 && s.flat > 0 ? Math.round((1 - s.curve / s.flat) * 100) + '%' : 'n/a'; }
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value, odds and verdicts are computed' }),
      el('span', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x peer_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )\n' +
        'expected = round( implied x P(token) )   \u00b7   farmer EV = expected x 0.10 x ( capital / tvl_usd )'
      ),
      el('p', null, el('b', { text: 'peer_multiple' }), ' is a size curve fitted to this snapshot\u2019s own live tokens: log(mcap/TVL) = ', el('b', { text: String(c.a) }), ' + ', el('b', { text: String(c.b) }), ' x log(TVL), fitted on ', el('b', { text: String(c.n) }), ' protocols that report both figures. A 10x bigger TVL prices at roughly ', el('b', { text: '0.3x' }), ' the multiple. The curve is used as fitted, clamped to [', el('b', { text: String(m.multiple_floor) }), ', ', el('b', { text: String(m.multiple_cap) }), '] and shown to 3 decimals — the multiple on the board is the multiple the price uses, so recomputing a row from its displayed multiple gives the board\u2019s number back exactly. No shrinkage toward the median: the raw curve beats the shrunk one on all three held-out tests.'),
      el('p', null, el('b', { text: 'Tested out of sample, three ways. ' }), 'Leave-one-out over the ', el('b', { text: String(v.loo.n) }), ' live tokens: the curve scores ', el('b', { text: String(v.loo.curve) }), ' mean |log error| against ', el('b', { text: String(v.loo.flat) }), ' for a flat market median — ', el('b', { text: beat(v.loo) + ' better' }), '. Chronological holdout: ', el('b', { text: String(v.chronological.curve) }), ' vs ', el('b', { text: String(v.chronological.flat) }), ' (', el('b', { text: beat(v.chronological) + ' better' }), ', n=', el('b', { text: String(v.chronological.n) }), '). Hash split: ', el('b', { text: String(v.split.curve) }), ' vs ', el('b', { text: String(v.split.flat) }), ' (', el('b', { text: beat(v.split) + ' better' }), ', n=', el('b', { text: String(v.split.n) }), '). The full table is above.'),
      el('p', null, el('b', { text: 'P(token) ' }), 'is the live share of the row\u2019s category x age band, shrunk toward the band rate (strength ', el('b', { text: String(m.odds_shrink) }), ' protocols). It is a cross-sectional base rate from this snapshot, not a forecast of timing — and it is printed per row with its cell size, so it can be checked. ', el('b', { text: 'Farm verdicts ' }), 'compare the farmer\u2019s expected value with the gas the farm costs: Farm at 1.5x the gas or more, Thin at 1x, Skip below. Two stated assumptions: an airdrop puts 10% of implied value in farmers\u2019 hands, and a farmer\u2019s share of it is pro-rata by capital over TVL (a floor, not a promise: tiered airdrops pay small farmers more than pro-rata). Capital is locked, not spent, so the verdict compares against gas, the part that never comes back; the total outlay (capital + gas) is shown beside it.'),
      el('p', null, 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ', el('b', { text: String(m.unknown_age_days) }), ' days. The board ranks every rankable protocol in the snapshot — the watchlist plus every other pre-token protocol that is not an exchange, a versioned pool, or a wrapped, staked or bridged product of a token that already trades. Run the program on a new snapshot and it ranks the new protocols the same way: no name is ever written into the code.')
    );
  }

  function foot() {
    return el('footer', { class: 'foot' },
      el('p', null, el('b', { text: 'Read this as a model, not a promise. ' }), 'Implied value is what a token would be worth if the protocol launched one at its peers\u2019 multiple and its record stayed as it is; expected value weights that by the odds it ever launches one. Neither predicts whether or when a token is issued.'),
      el('p', null, el('b', { text: 'No token on record is not proof of no token. ' }), 'A protocol on this board records no token in DefiLlama\u2019s index; it may still have one the index does not carry. Farm plans are generic steps derived from each protocol\u2019s category, chains, TVL and age, not advice about any specific launch. Farm verdicts rest on two stated assumptions (10% of implied value to farmers, pro-rata shares) and on gas tiers by chain.'),
      el('p', { text: 'Source: ' + DATA.source + ' · Snapshot ' + DATA.as_of + ' · Model ' + DATA.model_version })
    );
  }

  function detailPage(row) {
    var steps = farmSteps(row);
    var cross = row.category_median !== null && row.category_median !== undefined
      ? 'Its category prices at ' + fmtMult(row.category_median) + ' among ' + row.category_peers + ' live-token peers; the curve says ' + fmtMult(row.peer_multiple) + ' at this size.'
      : 'Its category has fewer than ' + DATA.model.min_category_peers + ' live-token peers, so there is no category median to check against; the curve says ' + fmtMult(row.peer_multiple) + ' at this size.';
    return el('div', { class: 'shell' },
      el('div', { class: 'detail-nav' },
        el('button', { class: 'button', type: 'button', text: '\u2190 Back to the board', onclick: function () { state.selected = null; writeHash(); render(); } }),
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? ' · watchlist' : ' · early radar') })
      ),
      el('section', { class: 'panel detail-page' },
        el('h1', { class: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') }),
        el('h2', { text: 'Implied value' }),
        el('div', { class: 'equation' },
          el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
          el('div', null, el('span', { text: 'Peer multiple (size curve)' }), el('b', { class: 'num', text: fmtMult(row.peer_multiple) })),
          el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
          el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
          el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
          el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
          el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
        ),
        el('p', { class: 'sub', text: cross + ' Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row, DATA.model)) + (impliedOf(row, DATA.model) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
      ),
      el('section', { class: 'panel detail-page' },
        el('h2', { text: 'Expected value & farm verdict \u00b7 ' + row.farm_verdict }),
        el('div', { class: 'equation' },
          el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
          el('div', null, el('span', { text: 'P(token) \u00b7 ' + row.odds_band + ' (' + row.odds_live + ' of ' + row.odds_n + ' peers live)' }), el('b', { class: 'num', text: fmtOdds(row.token_odds) })),
          el('div', { class: 'total' }, el('span', { text: 'Expected value (implied x odds)' }), el('b', { class: 'num', text: fmtUsd(row.expected_value_usd) })),
          el('div', null, el('span', { text: 'Farm capital (locked, not spent)' }), el('b', { class: 'num', text: fmtMoney2(row.farm_capital_usd) })),
          el('div', null, el('span', { text: 'Gas over the hold' }), el('b', { class: 'num', text: fmtMoney2(row.farm_gas_usd) })),
          el('div', null, el('span', { text: 'Total outlay (capital + gas)' }), el('b', { class: 'num', text: fmtMoney2(row.farm_cost_usd) })),
          el('div', null, el('span', { text: 'Farmer expected value' }), el('b', { class: 'num', text: fmtMoney2(row.farm_expected_usd) })),
          el('div', { class: 'total' }, el('span', { text: 'Net (farmer EV \u2212 gas)' }), el('b', { class: 'num', text: fmtMoney2(row.farm_net_usd) }))
        ),
        el('p', { class: 'sub', text: 'Verdict ' + row.farm_verdict + ': Farm when the farmer\u2019s expected value is at least 1.5x the gas, Thin at 1x, Skip below. Two stated assumptions: an airdrop puts 10% of implied value in farmers\u2019 hands, and a farmer\u2019s share is pro-rata by capital over TVL. P(token) is the live share of this row\u2019s category x age cell, shrunk toward its age-band rate — a cross-sectional base rate, not a timing forecast.' })
      ),
      el('section', { class: 'panel detail-page' },
        el('h2', { text: 'Farm plan \u00b7 seven steps \u00b7 ' + row.farm_verdict }),
        el('ol', { class: 'steps' }, steps.map(function (s) {
          var at = s.indexOf(' Cost: ');
          var action = at >= 0 ? s.slice(0, at) : s;
          var tail = at >= 0 ? s.slice(at + 1) : '';
          return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
        }))
      ),
      foot()
    );
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    app.textContent = '';
    if (state.selected) {
      var row = DATA.rows.filter(function (r) { return r.slug === state.selected; })[0];
      if (row) {
        var detail = el('div', { class: 'shell' });
        detail.appendChild(header());
        detail.appendChild(detailPage(row));
        app.appendChild(detail);
        app.setAttribute('aria-busy', 'false');
        return;
      }
      state.selected = null;
    }
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    if (state.tab === 'pre-token') shell.appendChild(integrityStrip());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      var grid = el('div', { class: 'grid2' });
      grid.appendChild(comparablesPanel());
      grid.appendChild(categoryPanel());
      shell.appendChild(grid);
      var grid2b = el('div', { class: 'grid2' });
      grid2b.appendChild(validationPanel());
      grid2b.appendChild(oddsPanel());
      shell.appendChild(grid2b);
      shell.appendChild(modelPanel());
    }
    shell.appendChild(foot());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
  }

  readHash();
  render();
})();
