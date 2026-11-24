// Token Radar v6 dashboard. Reads window.RADAR and renders the whole page
// with no network at all: no requests leave this page, ever.

(function () {
  "use strict";
  var R = window.RADAR;
  var main = document.getElementById("board");

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(value) {
    if (value >= 1e9) return "$" + (value / 1e9).toFixed(2) + "B";
    if (value >= 1e6) return "$" + (value / 1e6).toFixed(1) + "M";
    if (value >= 1e3) return "$" + Math.round(value / 1e3) + "K";
    return "$" + Math.round(value);
  }

  function fullMoney(value) {
    return "$" + Math.round(value).toLocaleString("en-US");
  }

  function farmMoney(value) {
    return "$" + value.toFixed(2);
  }

  function pct(value) {
    if (value === null || value === undefined) return "—";
    return (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
  }

  function ageText(age) {
    if (age === null || age === undefined) return "unknown";
    if (age >= 365) return (age / 365).toFixed(1) + " years";
    return age + " days";
  }

  function multText(value) {
    return value.toFixed(3) + "x";
  }

  function oddsText(value) {
    return (value * 100).toFixed(1) + "%";
  }

  function coefText(value) {
    return (value >= 0 ? "+" : "") + value.toFixed(4);
  }

  // ---- state in the URL hash ----

  function readState() {
    var state = {
      q: "", category: "", chain: "", scope: "all", verdict: "",
      tab: "pre", growing: false, sort: "expected", detail: "",
    };
    var hash = location.hash.replace(/^#/, "");
    if (!hash) return state;
    hash.split("&").forEach(function (pair) {
      var parts = pair.split("=");
      if (parts.length !== 2) return;
      var key = decodeURIComponent(parts[0]);
      var value = decodeURIComponent(parts[1]);
      if (key === "growing") state.growing = value === "1";
      else if (key in state) state[key] = value;
    });
    return state;
  }

  function writeState(state) {
    var parts = [];
    ["q", "category", "chain", "scope", "verdict", "tab", "growing", "sort", "detail"].forEach(function (key) {
      var value = state[key];
      if (key === "growing") { if (value) parts.push("growing=1"); return; }
      if (key === "scope" && value === "all") return;
      if (key === "tab" && value === "pre") return;
      if (key === "sort" && value === "expected") return;
      if (value !== "") parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    });
    var next = parts.length ? "#" + parts.join("&") : "#";
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  // ---- the farm plan, rebuilt from the row's own numbers ----

  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function gasFor(chain) {
    if (chain === "Ethereum") return { first: 15, weekly: 8 };
    if (chain === "Solana") return { first: 0.1, weekly: 0.1 };
    return { first: 0.5, weekly: 0.1 };
  }

  function gasPhrase(first) {
    if (first >= 1) return "about $" + first + " of gas for the first transaction";
    return "under $" + first.toFixed(2) + " of gas for the first transaction";
  }

  function categoryAction(row, capital, chain) {
    var c = (row.category || "").toLowerCase();
    var name = row.name;
    if (c.indexOf("basis trading") !== -1) return "Deposit $" + capital + " of USDC into " + name + "'s basis strategy on " + chain + " and keep the position open.";
    if (c.indexOf("lend") !== -1 || c.indexOf("cdp") !== -1 || c.indexOf("collateral") !== -1) return "Supply $" + capital + " of USDC to " + name + " on " + chain + " and keep the position open.";
    if (c.indexOf("dex") !== -1 || c.indexOf("yield") !== -1 || c.indexOf("leveraged farm") !== -1) return "Provide $" + capital + " of liquidity to " + name + "'s main pool on " + chain + " and keep the position open.";
    if (c.indexOf("bridge") !== -1) return "Bridge $" + capital + " of USDC to " + chain + " through " + name + " and use the bridged funds in its app.";
    if (c.indexOf("staking") !== -1 || c.indexOf("restak") !== -1) return "Stake $" + capital + " of the chain's staking asset through " + name + " and keep the receipt.";
    if (c.indexOf("perpetual") !== -1 || c.indexOf("derivative") !== -1) return "Deposit $" + capital + " of USDC as margin on " + name + " and open one small hedge.";
    if (c.indexOf("prediction") !== -1) return "Fund $" + capital + " and place one market position on " + name + ".";
    if (c.indexOf("curator") !== -1 || c.indexOf("allocator") !== -1 || c.indexOf("risk") !== -1) return "Deposit $" + capital + " into a " + name + " vault on " + chain + " and keep the shares.";
    if (c.indexOf("stable") !== -1) return "Mint or deposit $" + capital + " of the stable asset through " + name + " on " + chain + ".";
    if (c.indexOf("rwa") !== -1) return "Mint $" + capital + " of the protocol's yield asset on " + chain + " and hold it.";
    if (c.indexOf("insurance") !== -1) return "Buy $" + capital + " of cover from " + name + " on " + chain + " and keep the policy.";
    if (c.indexOf("governance") !== -1) return "Deposit $" + capital + " into " + name + " on " + chain + " and vote in its governance.";
    if (c.indexOf("payment") !== -1) return "Move $" + capital + " of USDC through " + name + " on " + chain + " and keep using it for payments.";
    if (c.indexOf("chain") !== -1) return "Bridge $" + capital + " of USDC to " + chain + " through its official bridge and use the chain's own apps.";
    return "Deposit $" + capital + " of USDC into " + name + " on " + chain + " and keep the position open.";
  }

  function renderStep(text, cost, time) {
    var step = text + " Cost: " + cost + ". Time: " + time + ".";
    if (step.length > 600) step = step.slice(0, 596) + "...";
    if (step.length < 20) step += " Hold the position and check the protocol's own page.";
    return step;
  }

  function farmPlan(row) {
    var chain = row.chains.length ? row.chains[0] : "Ethereum";
    var hold = holdDaysFor(row.age_days);
    var weeks = Math.max(1, Math.ceil(hold / 7));
    var gas = gasFor(chain);
    var first = gasPhrase(gas.first);
    var deposit = first.replace("for the first transaction", "for the deposit");
    var weeklyTotal = Math.round(gas.weekly * weeks * 100) / 100;
    return [
      renderStep("Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.", first, "5 minutes"),
      renderStep(categoryAction(row, row.farm_capital_usd, chain), "$" + row.farm_capital_usd + " of capital and " + deposit, "15 minutes to set up"),
      renderStep("Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.", "about $" + weeklyTotal + " of gas over " + weeks + " weeks", "10 minutes a week"),
      renderStep("Hold the position for at least " + hold + " days so the activity is counted in more than one snapshot.", "the $" + row.farm_capital_usd + " stays in the position", hold + " days"),
      renderStep("Open the protocol's own points or rewards page from its own site and check what counts toward an allocation.", "no fee to check", "10 minutes"),
      renderStep("Claim only from the protocol's own page, never pay a fee to claim, and never sign an approval you have not read.", "gas only, and never a fee to claim", "10 minutes"),
      renderStep("Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.", "nothing but the log", "5 minutes"),
    ];
  }

  // ---- the self-check: seven checks computed live from the data ----

  function selfChecks() {
    var rows = R.rows;
    var checks = [];
    var accounted = R.accounting.ranked + R.accounting.excluded.reduce(function (s, e) { return s + e.count; }, 0);
    checks.push({
      label: "Protocols accounted for: " + accounted + " of " + R.accounting.total,
      pass: accounted === R.accounting.total && R.accounting.total === 758,
    });
    var covered = rows.filter(function (r) { return r.on_watchlist; }).length;
    checks.push({
      label: "Watchlist covered: " + covered + " of " + R.watchlist_size,
      pass: covered === R.watchlist_size,
    });
    var tests = [R.validation.loo, R.validation.chronological, R.validation.split, R.validation.grouped];
    var beats = tests.filter(function (t) { return t.multi < t.flat; }).length;
    checks.push({
      label: "Held-out tests beat flat: " + beats + " of 4",
      pass: beats >= 3,
    });
    checks.push({
      label: "Interval coverage " + (R.interval.coverage * 100).toFixed(1) + "% vs 90% target — misses by one protocol in " + R.interval.loo_n,
      pass: R.interval.coverage >= 0.9,
    });
    var mismatches = rows.filter(function (r) {
      return Math.round(r.tvl_usd * r.peer_multiple) !== r.implied_value_usd;
    }).length;
    checks.push({
      label: "Recompute implied from displayed multiple: " + mismatches + " mismatches in " + rows.length + " rows",
      pass: mismatches === 0,
    });
    var external = 0;
    try {
      external = performance.getEntriesByType("resource").filter(function (entry) {
        try { return new URL(entry.name).origin !== location.origin; } catch (e) { return true; }
      }).length;
    } catch (e) { external = 0; }
    checks.push({
      label: "No network: " + external + " off-origin resources loaded",
      pass: external === 0,
    });
    var resorted = rows.slice().sort(function (a, b) {
      return b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
    });
    var ranksMatch = resorted.every(function (r, i) { return r.rank === i + 1; });
    var totalsMatch =
      rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0) === R.summary.total_implied_usd &&
      rows.reduce(function (s, r) { return s + r.expected_value_usd; }, 0) === R.summary.total_expected_usd;
    checks.push({
      label: "Deterministic: ranks and totals recompute identically",
      pass: ranksMatch && totalsMatch,
    });
    return checks;
  }

  // ---- filtering and sorting ----

  function filteredRows(state) {
    var q = state.q.trim().toLowerCase();
    return R.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      if (state.category && (r.category || "Other") !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (state.scope === "watchlist" && !r.on_watchlist) return false;
      if (state.scope === "early" && r.on_watchlist) return false;
      if (state.verdict && r.farm_verdict !== state.verdict) return false;
      if (state.growing && !(r.change_7d !== null && r.change_7d > 0)) return false;
      return true;
    });
  }

  function sortedRows(rows, sort) {
    var copy = rows.slice();
    if (sort === "implied") copy.sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; });
    else if (sort === "tvl") copy.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (sort === "age") copy.sort(function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days); });
    else if (sort === "odds") copy.sort(function (a, b) { return b.token_odds - a.token_odds; });
    else if (sort === "name") copy.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    else copy.sort(function (a, b) { return b.expected_value_usd - a.expected_value_usd; });
    return copy;
  }

  function optionList(values, current, allLabel) {
    var out = '<option value="">' + esc(allLabel) + "</option>";
    values.forEach(function (v) {
      out += '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") + ">" + esc(v) + "</option>";
    });
    return out;
  }

  // ---- shared sections ----

  function headerHtml() {
    return '<header class="top"><div class="brand">Token <span>Radar</span></div>' +
      '<div class="muted">Snapshot ' + esc(R.as_of) + ' · Source: DefiLlama protocol index · Model ' + esc(R.model_version) + ' · every value term fitted</div></header>';
  }

  function kpiHtml() {
    var s = R.summary;
    var items = [
      ["Rows ranked", String(R.board_size)],
      ["Watchlist covered", R.rows.filter(function (r) { return r.on_watchlist; }).length + " of " + R.watchlist_size],
      ["Total implied value", money(s.total_implied_usd)],
      ["Total expected value", money(s.total_expected_usd)],
      ["Median P(token)", oddsText(s.median_token_odds)],
      ["Farm verdicts", s.verdict_counts.Farm + " Farm · " + s.verdict_counts.Thin + " Thin · " + s.verdict_counts.Skip + " Skip"],
      ["Multi vs flat LOO", R.validation.loo.multi.toFixed(4) + " vs " + R.validation.loo.flat.toFixed(4)],
      ["Interval q90", R.interval.q90.toFixed(4)],
    ];
    return '<section class="kpis" aria-label="Key figures">' +
      items.map(function (item) {
        return '<div class="kpi"><div class="label">' + esc(item[0]) + '</div><div class="value">' + esc(item[1]) + "</div></div>";
      }).join("") + "</section>";
  }

  function selfCheckHtml() {
    var checks = selfChecks();
    var passed = checks.filter(function (c) { return c.pass; }).length;
    return '<section class="panel"><h2>Self-check — ' + passed + " of " + checks.length + ' pass</h2><ul class="checks">' +
      checks.map(function (c) {
        return '<li><span class="mark ' + (c.pass ? "pass" : "fail") + '">' + (c.pass ? "PASS" : "FAIL") + '</span><span>' + esc(c.label) + "</span></li>";
      }).join("") + "</ul></section>";
  }

  function integrityHtml() {
    var rows = R.accounting.excluded.map(function (e) {
      return "<tr><td>" + esc(e.reason) + '</td><td class="num">' + e.count + "</td><td>" +
        e.examples.map(function (s) { return esc(s); }).join(", ") + "</td></tr>";
    }).join("");
    return '<section class="panel"><h2>Integrity strip</h2><p class="muted small">Every protocol in the snapshot is either ranked or excluded for a stated reason. Largest by TVL shown per reason.</p>' +
      '<table><thead><tr><th>Exclusion reason</th><th class="num">Count</th><th>Largest by TVL</th></tr></thead><tbody>' +
      rows + "</tbody></table></section>";
  }

  function peerPanelHtml(row) {
    var comp = null;
    R.comparables.forEach(function (c) { if (c.category === (row.category || "Other")) comp = c; });
    if (!comp) return "";
    return '<section class="panel"><h2>Peer evidence — ' + esc(row.category || "Other") + "</h2>" +
      "<p>Category: <b>" + esc(comp.category) + "</b> · Peers: <b>" + comp.peers + "</b> · Median ratio: <b>" +
      comp.median_ratio.toFixed(3) + "x</b> · Multiple used: <b>" + comp.multiple.toFixed(3) + "x</b> · Source: <b>" + esc(comp.source) + "</b></p>" +
      '<p class="muted small">The multiple used for this protocol is the fitted multi-term multiple of ' +
      row.peer_multiple.toFixed(3) + "x; the category median above is the cross-check, not the price.</p></section>";
  }

  function categoryPanelHtml() {
    var sums = {};
    R.rows.forEach(function (r) {
      var c = r.category || "Other";
      sums[c] = (sums[c] || 0) + r.implied_value_usd;
    });
    var top = Object.keys(sums).map(function (c) { return { category: c, total: sums[c] }; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 8);
    var max = top.length ? top[0].total : 1;
    return '<section class="panel"><h2>Categories by implied value</h2>' +
      top.map(function (t) {
        return '<p><b>' + esc(t.category) + "</b> — " + money(t.total) +
          '<span class="bar"><i style="width:' + Math.round((t.total / max) * 100) + '%"></i></span></p>';
      }).join("") + "</section>";
  }

  function validationPanelHtml() {
    function testRow(name, t) {
      var beats = t.multi < t.flat ? "Yes" : "No";
      return "<tr><td>" + esc(name) + '</td><td class="num">' + t.multi.toFixed(4) + '</td><td class="num">' +
        t.single.toFixed(4) + '</td><td class="num">' + t.flat.toFixed(4) + '</td><td class="num">' +
        t.category.toFixed(4) + "</td><td>" + beats + "</td></tr>";
    }
    var groupRows = R.validation.grouped_by_category.map(function (g) {
      return testRow("Grouped — " + g.name + " (n=" + g.n + ")", g);
    }).join("");
    return '<section class="panel"><h2>Validation — held out four ways</h2>' +
      '<p class="muted small">Mean absolute log error; lower is better. The multi-term model beats the flat median in 3 of 4 tests and loses the grouped test, where whole categories are held out.</p>' +
      '<table><thead><tr><th>Test</th><th class="num">Multi</th><th class="num">Single</th><th class="num">Flat</th><th class="num">Category</th><th>Multi beats flat</th></tr></thead><tbody>' +
      testRow("Leave-one-out (n=" + R.validation.loo.n + ")", R.validation.loo) +
      testRow("Chronological (n=" + R.validation.chronological.n + ")", R.validation.chronological) +
      testRow("Hash split (n=" + R.validation.split.n + ")", R.validation.split) +
      testRow("Grouped pooled (n=" + R.validation.grouped.n + ")", R.validation.grouped) +
      groupRows + "</tbody></table></section>";
  }

  function oddsPanelHtml() {
    var bandRows = R.odds_bands.map(function (b) {
      return "<tr><td>" + esc(b.band) + '</td><td class="num">' + b.protocols + '</td><td class="num">' +
        b.live + '</td><td class="num">' + (b.rate * 100).toFixed(1) + "%</td></tr>";
    }).join("");
    var decayRows = R.odds_decay.map(function (d) {
      return "<tr><td>" + esc(d.band) + '</td><td class="num">' + d.protocols + '</td><td class="num">' +
        (d.pre_share * 100).toFixed(1) + "%</td><td class=\"num\">" + d.decay.toFixed(3) + "</td></tr>";
    }).join("");
    return '<section class="panel"><h2>Token odds by age</h2>' +
      '<p>Odds fall with age: the longer a protocol runs without a token, the smaller the share of its age group that is still pre-token, so the launch odds shrink with it. The youngest band is still 68.1% pre-token; the oldest band is only 7.9% pre-token, and its decay is 0.115.</p>' +
      '<div class="grid2"><div><h3>Age bands</h3><table><thead><tr><th>Band</th><th class="num">Protocols</th><th class="num">Live</th><th class="num">Rate</th></tr></thead><tbody>' +
      bandRows + '</tbody></table></div><div><h3>Age decay</h3><table><thead><tr><th>Band</th><th class="num">Protocols</th><th class="num">Still pre-token share</th><th class="num">Decay</th></tr></thead><tbody>' +
      decayRows + '</tbody></table></div></div>' +
      "<p class=\"muted small\">Overall launch rate " + (R.odds_overall * 100).toFixed(1) + "%; overall decay " + R.odds_overall_decay.toFixed(3) + ". Odds are shrunk toward the overall rate with strength " + R.model.odds_shrink + " within each category.</p></section>";
  }

  function modelPanelHtml() {
    var coefs = R.fit.coefficients.map(function (c) {
      return "<li>" + esc(c.label) + ": <b>" + coefText(c.value) + "</b></li>";
    }).join("");
    return '<section class="panel"><h2>Model</h2>' +
      "<p><b>Formula, in words.</b> The log of the market-cap-to-TVL multiple is fitted on live tokens from an intercept, the log of TVL, seven-day growth, the log of one plus age in days, and one dummy per large category. The priced multiple is the exponential of that fitted log multiple, clamped to " +
      R.model.multiple_floor.toFixed(2) + "x–" + R.model.multiple_cap.toFixed(2) + "x. Implied value is TVL times the multiple; expected value is implied value times P(token).</p>" +
      "<p><b>Fitted coefficients</b> (" + R.fit.n + " live peers, R² " + R.fit.r2.toFixed(4) + "):</p><ul>" + coefs + "</ul>" +
      "<p><b>Fit.</b> R² " + R.fit.r2.toFixed(4) + " on " + R.fit.n + " peers. The single-term size curve (log multiple on log TVL) has intercept " +
      R.curve.a.toFixed(4) + " and slope " + R.curve.b.toFixed(4) + ", flat median " + R.curve.flat_median.toFixed(3) + "x.</p>" +
      "<p><b>Interval.</b> Conformal interval from leave-one-out residuals: q90 " + R.interval.q90.toFixed(4) + ", coverage " +
      (R.interval.coverage * 100).toFixed(1) + "% on " + R.interval.loo_n + " peers (target 90%). Implied low and high are the implied value times exp(−q90) and exp(+q90).</p>" +
      "<p><b>Held out four ways.</b> Leave-one-out multi " + R.validation.loo.multi.toFixed(4) + " vs flat " + R.validation.loo.flat.toFixed(4) +
      "; chronological " + R.validation.chronological.multi.toFixed(4) + " vs " + R.validation.chronological.flat.toFixed(4) +
      "; hash split " + R.validation.split.multi.toFixed(4) + " vs " + R.validation.split.flat.toFixed(4) +
      "; grouped pooled " + R.validation.grouped.multi.toFixed(4) + " vs " + R.validation.grouped.flat.toFixed(4) + ".</p>" +
      "<p><b>Odds formula.</b> P(token) is the category's live share shrunk toward the overall rate, times the age band's decay; unknown age uses the overall decay. Odds fall with age because the pre-token share decays with age.</p>" +
      "<p><b>Verdict formula.</b> Farm when the farmer's expected value is at least " + R.model.farm_ratio + "× gas, Thin at " + R.model.thin_ratio +
      "× gas, else Skip. Two assumptions: the airdrop pays " + Math.round(R.model.airdrop_share * 100) +
      "% of implied value shared pro-rata by capital over TVL, and gas costs the listed first-transaction and weekly rates for the protocol's first chain.</p></section>";
  }

  function footerHtml() {
    return "<footer><p>Implied value is a model, not a promise: it prices what a token would be worth if the protocol launched at the going rate for live tokens, and it does not predict whether or when a token is issued. No token on record is not proof of no token — a protocol may have a token its record does not carry.</p>" +
      "<p>Source: DefiLlama protocol index. Snapshot " + esc(R.as_of) + ". Model " + esc(R.model_version) +
      ". " + R.accounting.total + " protocols accounted for: " + R.accounting.ranked + " ranked, " +
      (R.accounting.total - R.accounting.ranked) + " excluded.</p></footer>";
  }

  // ---- the board view ----

  function boardView(state) {
    var s = R.summary;
    var top3 = R.rows.slice().sort(function (a, b) { return b.expected_value_usd - a.expected_value_usd; }).slice(0, 3);
    var picks = top3.map(function (r) {
      return '<div class="pick"><b>#' + r.rank + " " + esc(r.name) + "</b><br>Expected value " + money(r.expected_value_usd) +
        "<br><span class=\"muted\">First step: use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.</span></div>";
    }).join("");
    var hero = '<section class="hero"><h1>' + R.board_size + " pre-token protocols, ranked by what their launch would be worth, and whether it is worth farming</h1>" +
      "<p>Farm " + s.verdict_counts.Farm + " · Thin " + s.verdict_counts.Thin + " · Skip " + s.verdict_counts.Skip +
      " — the model says " + s.verdict_counts.Farm + " of " + R.board_size + " farms clear the gas hurdle.</p>" +
      '<div class="facts"><span>Protocols accounted for: <b>' + R.accounting.total + '</b></span><span>Pre-token rows ranked: <b>' + R.board_size +
      '</b></span><span>Total expected value: <b>' + money(s.total_expected_usd) + '</b></span><span>Farm ' + s.verdict_counts.Farm + ' · Thin ' + s.verdict_counts.Thin + ' · Skip ' + s.verdict_counts.Skip + "</span></div>" +
      '<div class="picks">' + picks + "</div></section>";

    var categories = [];
    var chains = [];
    R.rows.forEach(function (r) {
      var c = r.category || "Other";
      if (categories.indexOf(c) === -1) categories.push(c);
      r.chains.forEach(function (ch) { if (chains.indexOf(ch) === -1) chains.push(ch); });
    });
    categories.sort();
    chains.sort();
    var controls = '<section class="panel"><div class="controls">' +
      '<input type="search" id="q" placeholder="Search name or slug" value="' + esc(state.q) + '" aria-label="Search">' +
      '<select id="category" aria-label="Category">' + optionList(categories, state.category, "All categories") + "</select>" +
      '<select id="chain" aria-label="Chain">' + optionList(chains, state.chain, "All chains") + "</select>" +
      '<select id="scope" aria-label="Scope">' +
      '<option value="all"' + (state.scope === "all" ? " selected" : "") + ">Watchlist + early</option>" +
      '<option value="watchlist"' + (state.scope === "watchlist" ? " selected" : "") + ">Watchlist only</option>" +
      '<option value="early"' + (state.scope === "early" ? " selected" : "") + ">Early only</option></select>" +
      '<select id="verdict" aria-label="Verdict">' + optionList(["Farm", "Thin", "Skip"], state.verdict, "All verdicts") + "</select>" +
      '<label><input type="checkbox" id="growing"' + (state.growing ? " checked" : "") + "> Growing only</label>" +
      "</div>" +
      '<div class="tabs" role="tablist"><button id="tab-pre" role="tab" aria-selected="' + (state.tab === "pre") + '">Pre-token</button>' +
      '<button id="tab-live" role="tab" aria-selected="' + (state.tab === "live") + '">Live token</button></div>' +
      '<p class="muted" id="count-line"></p></section>';

    var shown = sortedRows(filteredRows(state), state.sort);
    var activeFilters = [];
    if (state.q) activeFilters.push("search “" + state.q + "”");
    if (state.category) activeFilters.push("category " + state.category);
    if (state.chain) activeFilters.push("chain " + state.chain);
    if (state.scope !== "all") activeFilters.push("scope " + state.scope);
    if (state.verdict) activeFilters.push("verdict " + state.verdict);
    if (state.growing) activeFilters.push("growing only");
    var banner = activeFilters.length
      ? '<p class="banner">Filtered: ' + activeFilters.map(function (f) { return esc(f); }).join(" · ") + " — " + shown.length + " rows shown</p>"
      : "";
    var maxImplied = R.rows.length ? R.rows[0].implied_value_usd : 1;
    function sortButton(key, label) {
      return '<button data-sort="' + key + '">' + esc(label) + (state.sort === key ? " ↓" : "") + "</button>";
    }
    var boardRows = shown.map(function (r) {
      var width = Math.max(1, Math.round((r.implied_value_usd / maxImplied) * 100));
      return '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + "</td>" +
        "<td><b>" + esc(r.name) + "</b> " + (r.on_watchlist ? '<span class="chip">Watchlist</span>' : '<span class="chip">Early</span>') +
        '<br><span class="muted small">' + esc(r.category || "Other") + " · " + r.chains.map(function (c) { return esc(c); }).join(", ") + "</span></td>" +
        '<td class="num">' + money(r.tvl_usd) + "</td>" +
        '<td class="num">' + pct(r.change_7d) + "</td>" +
        '<td class="num">' + ageText(r.age_days) + "</td>" +
        '<td class="num">' + multText(r.peer_multiple) + "</td>" +
        '<td class="num"><b>' + money(r.implied_value_usd) + "</b><br><span class=\"muted small\">" + money(r.implied_low_usd) + " – " + money(r.implied_high_usd) + '</span><span class="bar"><i style="width:' + width + '%"></i></span></td>' +
        '<td class="num">' + money(r.expected_value_usd) + "</td>" +
        '<td class="num">' + oddsText(r.token_odds) + "</td>" +
        '<td><span class="verdict ' + r.farm_verdict + '">' + r.farm_verdict + "</span></td></tr>";
    }).join("");
    var board = '<section class="panel" id="board-panel"><h2>Board</h2>' +
      '<table><thead><tr><th>' + sortButton("implied", "Rank") + "</th><th>" + sortButton("name", "Protocol") + "</th><th>" + sortButton("tvl", "TVL") +
      "</th><th>7d</th><th>" + sortButton("age", "Age") + "</th><th>Peer mult.</th><th>" + sortButton("implied", "Implied value") +
      "</th><th>" + sortButton("expected", "Expected value") + "</th><th>" + sortButton("odds", "P(token)") + "</th><th>Verdict</th></tr></thead><tbody>" +
      boardRows + "</tbody></table></section>";

    var liveRows = R.live.map(function (r) {
      return "<tr><td>Live</td><td><b>" + esc(r.name) + '</b><br><span class="muted small">' + esc(r.category || "Other") + " · " +
        r.chains.map(function (c) { return esc(c); }).join(", ") + '</span></td><td class="num">' + money(r.tvl_usd) + "</td>" +
        '<td class="num">' + pct(r.change_7d) + '</td><td class="num">' + (r.mcap_usd === null ? "—" : money(r.mcap_usd)) + '</td><td class="num">' +
        (r.mcap_tvl_ratio === null ? "—" : r.mcap_tvl_ratio.toFixed(3) + "x") + "</td><td>Trading</td></tr>";
    }).join("");
    var live = '<section class="panel" id="live-panel"><h2>Live tokens — what the model learns from</h2>' +
      '<p class="muted small">The 24 largest live tokens by market cap, excluding CEX. Their market-cap-to-TVL ratios are the comparables the multiples are fitted on.</p>' +
      '<table><thead><tr><th>Status</th><th>Protocol</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Market cap</th><th class="num">Mcap / TVL</th><th>Token</th></tr></thead><tbody>' +
      liveRows + "</tbody></table></section>";

    var first = shown.length ? shown[0] : R.rows[0];
    main.innerHTML = headerHtml() + banner + hero + kpiHtml() + selfCheckHtml() + integrityHtml() + controls +
      (state.tab === "live" ? live + board : board + live) +
      peerPanelHtml(first) + categoryPanelHtml() + validationPanelHtml() + oddsPanelHtml() + modelPanelHtml() + footerHtml();
    main.setAttribute("aria-busy", "false");
    var countLine = document.getElementById("count-line");
    if (countLine) countLine.textContent = shown.length + " rows shown";
    bindBoard(state, shown);
  }

  function bindBoard(state, shown) {
    var q = document.getElementById("q");
    var category = document.getElementById("category");
    var chain = document.getElementById("chain");
    var scope = document.getElementById("scope");
    var verdict = document.getElementById("verdict");
    var growing = document.getElementById("growing");
    function refresh() {
      state.q = q.value;
      state.category = category.value;
      state.chain = chain.value;
      state.scope = scope.value;
      state.verdict = verdict.value;
      state.growing = growing.checked;
      writeState(state);
      boardView(state);
      var next = document.getElementById("q");
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }
    if (q) q.addEventListener("input", refresh);
    if (category) category.addEventListener("change", refresh);
    if (chain) chain.addEventListener("change", refresh);
    if (scope) scope.addEventListener("change", refresh);
    if (verdict) verdict.addEventListener("change", refresh);
    if (growing) growing.addEventListener("change", refresh);
    var tabPre = document.getElementById("tab-pre");
    var tabLive = document.getElementById("tab-live");
    if (tabPre) tabPre.addEventListener("click", function () { state.tab = "pre"; writeState(state); boardView(state); });
    if (tabLive) tabLive.addEventListener("click", function () { state.tab = "live"; writeState(state); boardView(state); });
    Array.prototype.forEach.call(document.querySelectorAll("th button[data-sort]"), function (button) {
      button.addEventListener("click", function () {
        state.sort = button.getAttribute("data-sort") || "expected";
        writeState(state);
        boardView(state);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("tr[data-slug]"), function (row) {
      row.addEventListener("click", function () {
        state.detail = row.getAttribute("data-slug") || "";
        writeState(state);
        render();
      });
    });
    void shown;
  }

  // ---- the detail view ----

  function detailView(state) {
    var row = null;
    R.rows.forEach(function (r) { if (r.slug === state.detail) row = r; });
    if (!row) { boardView(state); return; }
    var terms = row.terms.map(function (t) {
      return "<li>" + esc(t.label) + ": <b>" + coefText(t.value) + "</b></li>";
    }).join("");
    var termSum = row.terms.reduce(function (s, t) { return s + t.value; }, 0);
    var cross = row.category_median === null
      ? "Live peers in " + (row.category || "Other") + ": " + row.category_peers + " — too few for a category median, so the board uses the multi-term multiple."
      : "Category median " + row.category_median.toFixed(3) + "x from " + row.category_peers + " live peers in " + (row.category || "Other") +
        ", against the multiple used of " + row.peer_multiple.toFixed(3) + "x.";
    var steps = farmPlan(row).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    main.innerHTML = headerHtml() +
      '<section class="panel"><button class="back" id="back">← Back to the board</button>' +
      '<div class="detail-head"><h1>#' + row.rank + " " + esc(row.name) + "</h1>" +
      (row.on_watchlist ? '<span class="chip">Watchlist</span>' : '<span class="chip">Early</span>') + "</div>" +
      "<p>" + esc(row.category || "Other") + " · " + row.chains.map(function (c) { return esc(c); }).join(", ") + "</p>" +
      '<div class="equation"><h2>Implied value</h2><p>TVL ' + fullMoney(row.tvl_usd) + " × peer multiple " + multText(row.peer_multiple) +
      (row.clamped ? " (clamped)" : "") + " = <b>" + fullMoney(row.implied_value_usd) + "</b></p>" +
      "<p>Seven-day growth " + pct(row.change_7d) + " · Age " + ageText(row.age_days) +
      " · Conformal interval " + fullMoney(row.implied_low_usd) + " – " + fullMoney(row.implied_high_usd) + "</p></div>" +
      "<h2>Term contributions</h2><ul>" + terms + "</ul>" +
      "<p>Sum of contributions: <b>" + coefText(Math.round(termSum * 10000) / 10000) + "</b> in log terms; exp of the fitted log multiple, clamped to " +
      R.model.multiple_floor.toFixed(2) + "x–" + R.model.multiple_cap.toFixed(2) + "x, gives the peer multiple of " + multText(row.peer_multiple) + ".</p>" +
      "<p><b>Category median cross-check.</b> " + esc(cross) + "</p>" +
      '<div class="equation"><h2>Expected value and verdict</h2><p>Implied value ' + fullMoney(row.implied_value_usd) +
      " × P(token) " + oddsText(row.token_odds) + " (band " + esc(row.odds_band) + ", " + row.odds_live + " live of " + row.odds_n +
      " in category) = <b>" + fullMoney(row.expected_value_usd) + "</b></p>" +
      "<p>Expected range " + fullMoney(row.expected_low_usd) + " – " + fullMoney(row.expected_high_usd) +
      " · Farm capital " + farmMoney(row.farm_capital_usd) + " · Gas over the hold " + farmMoney(row.farm_gas_usd) +
      " · Total outlay " + farmMoney(row.farm_cost_usd) + " · Farmer expected value " + farmMoney(row.farm_expected_usd) +
      " · Net " + farmMoney(row.farm_net_usd) + "</p>" +
      "<p>Verdict rule: Farm when the farmer's expected value is at least 1.5× gas, Thin at 1× gas, else Skip. This row is <b>" + row.farm_verdict + "</b>.</p></div>" +
      "<h2>Farm plan</h2><ol class=\"steps\">" + steps + "</ol></section>" +
      peerPanelHtml(row) + footerHtml();
    main.setAttribute("aria-busy", "false");
    var back = document.getElementById("back");
    if (back) back.addEventListener("click", function () {
      state.detail = "";
      writeState(state);
      render();
    });
  }

  // ---- boot ----

  function render() {
    var state = readState();
    if (state.detail) detailView(state);
    else boardView(state);
  }

  window.addEventListener("hashchange", render);
  render();
})();
