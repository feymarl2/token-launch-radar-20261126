const DATA = window.RADAR_DATA;
const rows = DATA.rows;
const state = { q: '', category: 'All', status: 'All', sort: 'rank', minTvl: 0, selected: rows[0]?.slug };

const $ = (s, el = document) => el.querySelector(s);
const money = (v) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString('en-US')}`;
const pct = (v) => v === null ? 'n/a' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const age = (v) => v === null ? 'date n/a' : v < 365 ? `${v}d tokenless` : `${(v / 365).toFixed(1)}y tokenless`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function categories() {
  return ['All', ...new Set(rows.map((r) => r.category))].sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  let out = rows.filter((r) =>
    (state.category === 'All' || r.category === state.category) &&
    (state.status === 'All' || r.status === state.status) &&
    r.tvl_usd >= state.minTvl &&
    (!q || `${r.name} ${r.slug} ${r.category} ${r.chains.join(' ')}`.toLowerCase().includes(q)));
  const by = {
    rank: (a, b) => a.rank - b.rank,
    value: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    momentum: (a, b) => (b.change_7d ?? -999) - (a.change_7d ?? -999),
    score: (a, b) => b.score - a.score || a.rank - b.rank,
  };
  return out.sort(by[state.sort]);
}

function selectedRow(list) {
  return list.find((r) => r.slug === state.selected) || list[0] || rows[0];
}

function render() {
  const list = filtered();
  const current = selectedRow(list);
  if (current) state.selected = current.slug;
  const maxValue = Math.max(...rows.map((r) => r.implied_value_usd));
  $('#app').innerHTML = `
  <div class="shell">
    <section class="hero">
      <div class="card hero-main">
        <div class="eyebrow">Sealed snapshot · ${esc(DATA.as_of)}</div>
        <h1>Token Launch Radar</h1>
        <p class="lede">Protocols that record no token on DefiLlama, screened for wrapped and staked derivatives, then ranked by a transparent implied launch value.</p>
        <div class="formula">Implied FDV = TVL × category multiple × momentum × tokenless age × chain breadth × confidence</div>
      </div>
      <div class="stats">
        <div class="card stat"><span>Board rows</span><b>${DATA.totals.board_rows}</b><span>ranked launch candidates</span></div>
        <div class="card stat"><span>Watchlist covered</span><b>${DATA.totals.watchlist_covered}/40</b><span>house floor fully included</span></div>
        <div class="card stat"><span>Token-trading set aside</span><b>${DATA.totals.token_trading}</b><span>separated from launch ranking</span></div>
        <div class="card stat"><span>Derivative screen</span><b>${DATA.totals.derivative_excluded}</b><span>tokenless rows excluded</span></div>
      </div>
    </section>

    <section class="card toolbar" aria-label="Board filters">
      <div class="field"><label for="q">Search</label><input id="q" type="search" placeholder="Protocol, slug, category, chain" value="${esc(state.q)}"></div>
      <div class="field"><label for="cat">Category</label><select id="cat">${categories().map((c) => `<option ${c === state.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="status">Status</label><select id="status">${['All', 'Watchlist', 'Early radar'].map((s) => `<option ${s === state.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label for="sort">Sort</label><select id="sort">
        <option value="rank" ${state.sort === 'rank' ? 'selected' : ''}>Rank</option>
        <option value="value" ${state.sort === 'value' ? 'selected' : ''}>Implied value</option>
        <option value="tvl" ${state.sort === 'tvl' ? 'selected' : ''}>TVL</option>
        <option value="momentum" ${state.sort === 'momentum' ? 'selected' : ''}>7d momentum</option>
        <option value="score" ${state.sort === 'score' ? 'selected' : ''}>Radar score</option>
      </select></div>
      <button class="btn" id="reset" type="button">Reset</button>
    </section>

    <section class="layout">
      <div class="card board">
        <div class="board-head"><div><h2>Ranked board</h2><p>${list.length} protocols shown · click a row for the full farm plan</p></div><span class="pill watch">Watchlist = house floor</span></div>
        ${list.length ? `<table><thead><tr><th>Rank</th><th>Protocol</th><th>Implied FDV</th><th>TVL</th><th>7d</th><th class="hide-sm">Score</th></tr></thead><tbody>
          ${list.map((r) => `<tr data-slug="${esc(r.slug)}" class="${current && r.slug === current.slug ? 'selected' : ''}" tabindex="0">
            <td class="rank">#${r.rank}</td>
            <td><div class="name">${esc(r.name)}</div><div class="sub">${esc(r.category)} · ${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ` +${r.chains.length - 3}` : ''}</div><span class="pill ${r.status === 'Watchlist' ? 'watch' : 'early'}">${esc(r.status)}</span></td>
            <td><span class="money">${money(r.implied_value_usd)}</span><div class="bar"><i style="width:${Math.max(3, r.implied_value_usd / maxValue * 100)}%"></i></div></td>
            <td>${money(r.tvl_usd)}</td>
            <td class="${r.change_7d === null ? 'flat' : r.change_7d >= 0 ? 'pos' : 'neg'}">${pct(r.change_7d)}</td>
            <td class="hide-sm"><b>${r.score}</b><div class="sub">${age(r.age_days)}</div></td>
          </tr>`).join('')}
        </tbody></table>` : '<div class="empty">No protocols match these filters.</div>'}
      </div>
      <aside class="card detail" id="detail">${current ? detailHtml(current) : '<p class="note">Select a protocol.</p>'}</aside>
    </section>

    <section class="card method">
      <h2>How to read this radar</h2>
      <div class="method-grid">
        <div><h3>Method</h3><ul>${DATA.methodology.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h3>Assumptions</h3><ul>${DATA.assumptions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
    </section>
    <p class="footer">Implied value is this entry's model claim from the sealed snapshot, not a promise that a token will launch or that farming will be rewarded.</p>
  </div>`;
  bind();
  $('#app').setAttribute('aria-busy', 'false');
}

function detailHtml(r) {
  return `
    <div class="eyebrow">Rank #${r.rank} · ${esc(r.status)}</div>
    <h2>${esc(r.name)}</h2>
    <div class="meta"><span class="pill">${esc(r.category)}</span><span class="pill">${esc(r.slug)}</span><span class="pill">${r.confidence}% confidence</span></div>
    <div class="kpis">
      <div class="kpi"><span>Implied FDV</span><b>${money(r.implied_value_usd)}</b></div>
      <div class="kpi"><span>TVL</span><b>${money(r.tvl_usd)}</b></div>
      <div class="kpi"><span>7d change</span><b>${pct(r.change_7d)}</b></div>
      <div class="kpi"><span>Tokenless age</span><b>${age(r.age_days)}</b></div>
    </div>
    <p class="note"><b>Chains:</b> ${esc(r.chains.join(', ') || 'not listed')}</p>
    <h3>Why this value</h3>
    <ul>${r.drivers.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
    <h3>Farm plan</h3>
    <ol>${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
}

function bind() {
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); });
  $('#cat').addEventListener('change', (e) => { state.category = e.target.value; render(); });
  $('#status').addEventListener('change', (e) => { state.status = e.target.value; render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('#reset').addEventListener('click', () => { Object.assign(state, { q: '', category: 'All', status: 'All', sort: 'rank', minTvl: 0, selected: rows[0].slug }); render(); });
  document.querySelectorAll('tbody tr').forEach((tr) => {
    const choose = () => { state.selected = tr.dataset.slug; render(); };
    tr.addEventListener('click', choose);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
  });
}

render();
