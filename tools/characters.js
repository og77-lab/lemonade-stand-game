// The bot characters against each other in random streets: each season draws 6 characters (repeats allowed), all at one level.
// For each character: how often it wins the season when it's on the street, its average place, and its average profit.
// A healthy line-up has no character that wins almost everywhere; who wins should depend on who else is on the street.
// usage: node tools/characters.js [seasons=600] [level=medium] [stands=6] [days=7]
const E = require('../engine.js');
const [N = 600, LEVEL = 'medium', STANDS = 6, DAYS = 7] = process.argv.slice(2).map((x, i) => i === 1 ? x : +x);
const rand = s => { let x = s % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };
const stat = Object.fromEntries(E.PERSONAS.map(p => [p.id, { seen: 0, seasons: 0, wins: 0, place: 0, profit: 0 }]));
for (let g = 1; g <= N; g++) {
  const r = rand(g * 104729 + 17), seed = g * 7919 + 5, world = E.buildWorld(seed, DAYS);
  const cast = Array.from({ length: STANDS }, () => E.PERSONAS[Math.floor(r() * E.PERSONAS.length)]);
  let S = cast.map((p, k) => ({ id: 's' + k, p, st: E.newStand(), prev: null })), street = [];
  for (let day = 1; day <= DAYS; day++) {
    const board = S.map(s => ({ id: s.id, tot: s.st.tot }));
    const pairs = E.couponPairs(S.map(s => s.id), day), mate = Object.fromEntries(pairs.flatMap(([a, b]) => [[a, b], [b, a]])), peers = Object.fromEntries(S.map(s => [s.id, s.st.cp || []])), fund = E.fundOffer('h' + g, day, STANDS);
    const decs = S.map((s, k) => E.botDecision(s.p, s.st, { seed, world, day, diff: LEVEL, n: STANDS, board, me: s.id, k, prev: s.prev, street, partner: mate[s.id], peers, days: DAYS, fund }));
    const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, day, STANDS));
    const out = E.runNeighborhoodDay({ seed, world, day, pairs, fund, stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
    street = out.results.map(x => ({ id: x.id, price: x.price, loc: x.loc }));
    S = S.map((s, k) => ({ ...s, st: E.settleStand(prep[k].st, prep[k].plan, out.results[k], prep[k].spent, day).st, prev: { dec: decs[k], res: out.results[k] } }));
  }
  const fin = S.map(s => E.nbScore(s.st)), best = Math.max(...fin);
  S.forEach((s, k) => { const c = stat[s.p.id]; c.seen++; c.place += fin.filter(x => x > fin[k]).length + 1; c.profit += fin[k]; });
  new Set(S.map(s => s.p.id)).forEach(id => { stat[id].seasons++; if (S.some((s, k) => s.p.id === id && fin[k] === best)) stat[id].wins++; });
}
console.log(`${N} random streets · ${STANDS} stands · ${DAYS} days · ${LEVEL} bots\n`);
console.log('character          style    wins when present · avg place · avg profit');
for (const p of E.PERSONAS) { const c = stat[p.id]; console.log(`  ${p.n.padEnd(14)} ${E.NB.STYLE[p.id].padEnd(7)}  ${(100 * c.wins / c.seasons).toFixed(0).padStart(3)}%  ·  ${(c.place / c.seen).toFixed(2)}  ·  ₪${(c.profit / c.seen).toFixed(0)}`); }
