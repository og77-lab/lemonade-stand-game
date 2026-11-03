// Strategy tournament (Axelrod style): fixed pricing styles play whole neighborhood seasons against each other in every mix.
// Everything but the price is the same for everyone (a medium bot's cup, stock and place), so the price strategy is what's measured.
// A healthy game has no dominant style: each one is beaten by some other, and who wins depends on who else is on the street.
// usage: node tools/tournament.js [seasons per mix=150] [stands=6] [days=7]
const E = require('../engine.js');
const [N = 150, STANDS = 6, DAYS = 7] = process.argv.slice(2).map(Number);
const usual = T => E.TYPES.reduce((s, t) => s + E.CT[t].pct * E.pMt(E.CT[t], T), 0);

// a style sees what every player sees: yesterday's prices on the street, its own yesterday, and its own forecast (none here: 24°)
const STYLES = {
  cartel:   { n: 'גבוה תמיד', price: o => Math.round(usual(24) * 1.15) },
  cutter:   { n: 'זול תמיד', price: o => Math.round(usual(24) * 0.8), stock: 1.4 },
  follow:   { n: 'כמו הרחוב', price: o => o.street.length ? Math.round(median(o.street.map(s => s.price))) : Math.round(usual(24)) },
  // a shekel under the street's median: wins share from those who follow the street, without starting a war
  shade:    { n: 'שקל מתחת לרחוב', price: o => o.street.length ? Math.max(5, Math.round(median(o.street.map(s => s.price))) - 1) : Math.round(usual(24)) - 1, stock: 1.2 },
  under1:   { n: 'שקל מתחת לזול', price: o => o.street.length ? Math.max(3, Math.min(...o.street.map(s => s.price)) - 1) : Math.round(usual(24)), stock: 1.3 },
  // tit for tat: starts high and stays high while the street does; answers an undercut by matching the cheapest, then forgives
  tft:      { n: 'עין תחת עין', price: o => { const hi = Math.round(usual(24) * 1.15); if (!o.street.length) return hi; const low = Math.min(...o.street.map(s => s.price)); return low < hi - 1 ? low : hi; } },
};
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

function season(styles, seed) {
  const world = E.buildWorld(seed, DAYS);
  let S = styles.map((st, k) => ({ id: 's' + k, style: st, st: E.newStand(), prev: null })), street = [];
  for (let day = 1; day <= DAYS; day++) {
    const board = S.map(s => ({ id: s.id, tot: s.st.tot }));
    const decs = S.map((s, k) => {
      const d = E.botDecision(E.PERSONAS[2], s.st, { seed, world, day, diff: 'medium', n: STANDS, board, me: s.id, k, prev: s.prev, street });
      const sty = STYLES[s.style], others = street.filter(x => x.id !== s.id);
      d.price = Math.max(2, Math.min(15, sty.price({ street: others, prev: s.prev, day })));
      d.bh = []; d.sec = 0; d.loc = 1; d.mk = [];
      // a cheaper stand expects more customers, so it stocks more
      if (sty.stock) { d.cups = Math.round(d.cups * sty.stock); d.helper = d.cups > E.CAP_BASE; const P = world[day - 1].p, r = d.recipe; d.buy = { l: d.cups * r.l, h: d.cups * r.h, i: d.cups * r.i }; }
      d.autoStock = true; return d;
    });
    // last night's catches: exposed or kept quiet, before the stands open
    { const sts = Object.fromEntries(S.map(s => [s.id, s.st])); E.resolveCatches(sts, Object.fromEntries(S.map((s, k) => [s.id, decs[k]])), day); S = S.map(s => ({ ...s, st: sts[s.id] })); }
    const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, day, STANDS));
    const out = E.runNeighborhoodDay({ seed, world, day, stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
    street = out.results.map(r => ({ id: r.id, price: r.price, loc: r.loc }));
    S = S.map((s, k) => ({ ...s, st: E.settleStand(prep[k].st, prep[k].plan, out.results[k], prep[k].spent, day).st, prev: { dec: decs[k], res: out.results[k] } }));
  }
  return S.map(s => ({ style: s.style, score: E.nbScore(s.st) }));
}
const play = mix => { const tot = {}, wins = {}, cnt = {}; mix.forEach(s => { tot[s] = 0; wins[s] = 0; cnt[s] = 0; });
  for (let g = 1; g <= N; g++) { const r = season(mix, g * 7919 + 33), best = Math.max(...r.map(x => x.score)); r.forEach(x => { tot[x.style] += x.score; cnt[x.style]++; if (x.score === best) wins[x.style]++; }); }
  return Object.fromEntries(Object.keys(tot).map(s => [s, { avg: tot[s] / cnt[s], win: wins[s] / N }])); };

const names = Object.keys(STYLES), t0 = Date.now();
// 1. everyone plays the same style: what the street earns when all cooperate (or all fight)
console.log(`${N} seasons per mix · ${STANDS} stands · ${DAYS} days\n\nEveryone the same style (profit per stand):`);
for (const s of names) console.log(`  ${STYLES[s].n.padEnd(14)} ₪${play(Array(STANDS).fill(s))[s].avg.toFixed(0)}`);
// 2. head to head: half and half, and one alone against the rest
console.log('\nHead to head (profit per stand: row style vs column style · half/half | one row style among the rest):');
const beats = Object.fromEntries(names.map(a => [a, 0]));
for (const a of names) {
  const cells = names.filter(b => b !== a).map(b => { const half = play([...Array(STANDS / 2).fill(a), ...Array(STANDS / 2).fill(b)]), lone = play([a, ...Array(STANDS - 1).fill(b)]);
    if (half[a].avg > half[b].avg) beats[a]++;
    return `${STYLES[b].n}: ${(half[a].avg - half[b].avg >= 0 ? '+' : '')}${(half[a].avg - half[b].avg).toFixed(0)} | ${(lone[a].avg - lone[b].avg >= 0 ? '+' : '')}${(lone[a].avg - lone[b].avg).toFixed(0)}`; });
  console.log(`  ${STYLES[a].n.padEnd(14)} ${cells.join(' · ')}`);
}
// 3. all styles on one street
const mixAll = Array.from({ length: STANDS }, (_, k) => names[k % names.length]), all = play(mixAll);
console.log('\nAll styles on one street (avg profit · share of wins):');
for (const s of names) if (all[s]) console.log(`  ${STYLES[s].n.padEnd(14)} ₪${all[s].avg.toFixed(0)} · ${(all[s].win * 100).toFixed(0)}%`);
const dom = names.filter(a => beats[a] === names.length - 1);
console.log(`\n${dom.length ? 'DOMINANT: ' + dom.map(s => STYLES[s].n).join(', ') + ' beats every other style head to head' : 'No style beats every other one head to head'} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
