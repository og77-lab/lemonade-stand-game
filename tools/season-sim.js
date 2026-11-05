// Plays whole neighborhood seasons with bots, checks that every number stays sane, and prints balance figures.
// usage: node tools/season-sim.js [seasons=200] [stands=10] [days=7] [diff=medium]
const E = require('../engine.js');
const [N = 200, STANDS = 10, DAYS = 7, DIFF = 'medium'] = process.argv.slice(2).map((x, i) => i < 3 ? +x : x);

const LOC_RENT = p => E.LOC[p.loc].rent + (p.helper ? E.HELPER_C : 0);
const fail = [];
const check = (ok, msg) => { if (!ok && fail.length < 20) fail.push(msg); };
const stats = { byPersona: {}, soldOut: 0, standDays: 0, sick: 0, vip: 0, tricks: 0, caught: 0, known: 0, attacked: 0, events: 0, closed: 0, winners: {} };

function season(seed) {
  const world = E.buildWorld(seed, DAYS);
  const people = Array.from({ length: STANDS }, (_, k) => E.PERSONAS[k % E.PERSONAS.length]);
  let stands = people.map((p, k) => ({ id: 's' + k, p, st: E.newStand(), last: null, lastRes: null }));
  let lastStreet = [];
  for (let day = 1; day <= DAYS; day++) {
    const board = stands.map(s => ({ id: s.id, tot: s.st.tot }));
    // half the stands are bots by character, the other half "players" who went quiet (autopilot) on odd days
    const decs = stands.map((s, k) => k % 2 === 1 && day % 2 === 1 && day > 1 ? E.autopilot(s.st, s.last, s.lastRes, world, day)
      : E.botDecision(s.p, s.st, { seed, world, day, diff: DIFF, n: STANDS, board, me: s.id, k, prev: s.lastRes && { dec: s.last, res: s.lastRes }, street: lastStreet }));
    const prep = stands.map((s, k) => E.prepareStand(s.st, decs[k], world, day, STANDS));
    // purchases never take cash below zero (a stand already in debt just can't buy)
    prep.forEach((p, k) => check(p.st.cash >= Math.min(0, stands[k].st.cash) - 1e-6, `day ${day}: purchases took cash from ${stands[k].st.cash} to ${p.st.cash}`));
    prep.forEach(p => check(p.st.cash - LOC_RENT(p.plan) >= Math.min(0, p.st.cash) - 1e-6 || p.plan.loc === 0, 'rent not covered'));
    const out = E.runNeighborhoodDay({ seed, world, day, diff: DIFF, stands: stands.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
    check(out.events.every((e, i) => i === 0 || e.m >= out.events[i - 1].m), 'events out of order');
    check(out.events.every(e => e.m >= 480 && e.m <= 1020), 'event outside 08:00–17:00');
    stats.events += out.events.length;
    stands = stands.map((s, k) => {
      const r = out.results[k], set = E.settleStand(prep[k].st, prep[k].plan, r, prep[k].spent, day);
      const sales = out.events.filter(e => e.type === 'sale' && e.stand === s.id).length;
      check(r.sold <= r.cups, `${s.id} sold ${r.sold} of ${r.cups}`);
      const vipBought = out.events.some(e => e.type === 'vip' && e.stand === s.id && e.bought);
      check(sales === r.sold - (vipBought ? 1 : 0), `${s.id} day ${day}: ${sales} sale events vs ${r.sold} sold`);
      for (const [k2, v] of Object.entries(set.st)) if (typeof v === 'number') check(Number.isFinite(v), `${s.id}.${k2} = ${v}`);
      check(set.st.rep >= 0 && set.st.rep <= 100, 'reputation out of range');
      check(set.st.sugar >= 0 && set.st.ice >= 0 && set.st.lemons.every(b => b.q > 0), `negative stock: ${JSON.stringify({ before: prep[k].st.lemons, after: set.st.lemons, sold: r.sold, plan: prep[k].plan.recipe, buy: decs[k].buy })}`);
      stats.standDays++; stats.sold = (stats.sold || 0) + r.sold; if (r.soldAt) stats.soldOut++; if (r.sick) stats.sick++; if (r.vip !== null) stats.vip++; if (r.closed) stats.closed++;
      stats.tricks += r.myTricks.length; stats.caught += r.myTricks.filter(t => t.caught).length;
      stats.known += r.attacks.length;
      return { ...s, st: set.st, last: decs[k], lastRes: r };
    });
    lastStreet = out.results.map(r => ({ id: r.id, price: r.price, loc: r.loc }));
    stats.attacked += out.results.reduce((x, r) => x + (r.attacks.length ? 1 : 0), 0);
  }
  const final = stands.map(s => ({ p: s.p.id, score: E.nbScore(s.st) })).sort((a, b) => b.score - a.score);
  final.forEach(f => { const b = stats.byPersona[f.p] = stats.byPersona[f.p] || { n: 0, sum: 0, min: Infinity, max: -Infinity }; b.n++; b.sum += f.score; b.min = Math.min(b.min, f.score); b.max = Math.max(b.max, f.score); });
  stats.winners[final[0].p] = (stats.winners[final[0].p] || 0) + 1;
}

const t0 = Date.now();
for (let i = 1; i <= N; i++) season(i * 7919 + 3);
const pct = x => (100 * x / stats.standDays).toFixed(1) + '%';
console.log(`${N} seasons · ${STANDS} stands · ${DAYS} days · ${DIFF} · ${Date.now() - t0}ms`);
console.log('final score by character (avg / min / max), wins:');
for (const [p, b] of Object.entries(stats.byPersona)) console.log(`  ${p.padEnd(8)} ${(b.sum / b.n).toFixed(0).padStart(5)} ${b.min.toFixed(0).padStart(6)} ${b.max.toFixed(0).padStart(6)}   wins ${stats.winners[p] || 0}`);
console.log(`per stand-day: ${(stats.sold / stats.standDays).toFixed(1)} cups · sold out ${pct(stats.soldOut)} · closed ${pct(stats.closed)} · sick ${pct(stats.sick)} · critic ${pct(stats.vip)} · events/day ${(stats.events / (N * DAYS)).toFixed(0)}`);
console.log(`dirty tricks ${stats.tricks} · caught ${(100 * stats.caught / Math.max(1, stats.tricks)).toFixed(0)}% · attack reports ${stats.known}`);
if (fail.length) { console.log('PROBLEMS:\n  ' + [...new Set(fail)].join('\n  ')); process.exit(1); }
console.log('all checks passed');
