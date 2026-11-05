// The street fund. Whole days on a street of six medium stands, with every event tier: what giving is worth, by who else gives; then how often bots alone reach the target.
// Margin = revenue less the ingredients of the cups sold, less the gift, against the same day with no fund at all.
// usage: node tools/fund.js [days=600]   (env SPONSORS tries another share of the crowd for the givers)
const E = require('../engine.js');
const N = +process.argv[2] || 600, n = 6;
if (process.env.SPONSORS) E.NB.FUND.sponsors = +process.env.SPONSORS;
function day(seed, offer, gifts, extraCups) {
  const world = E.buildWorld(seed, 7), d = 3, P = world[d - 1].p;
  const S = Array.from({ length: n }, (_, k) => ({ id: 's' + k, p: E.PERSONAS[2], st: { ...E.newStand(), cash: 200, lemons: [{ q: 90, d: 3 }], sugar: 40, ice: 0 } }));
  const decs = S.map((s, k) => { const x = E.botDecision(s.p, s.st, { seed, world, day: d, diff: 'medium', n, board: S.map(q => ({ id: q.id, tot: 0 })), me: s.id, k, prev: null, street: [] }); x.bh = []; x.sec = 0; x.autoStock = true; x.fund = gifts[k]; if (extraCups && gifts[k]) x.cups = Math.round(x.cups * extraCups); return x; });
  const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, d, n));
  const out = E.runNeighborhoodDay({ seed, world, day: d, fund: offer, stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
  return out.results.map((r, k) => { const p = prep[k].plan; return r.rev - r.sold * (p.recipe.l * P.l + p.recipe.h * P.h + p.recipe.i * P.i) - gifts[k]; });
}
const avg = (offer, gifts, x) => { const t = Array(n).fill(0); for (let g = 1; g <= N; g++) day(g * 7919 + 31, offer, gifts, x).forEach((v, k) => { t[k] += v; }); return t.map(v => v / N); };
const none = avg(null, Array(n).fill(0));
for (const t of E.NB.FUND.tiers) {
  const offer = { ...t, target: Math.round(t.per * n) }, fair = Math.ceil(offer.target / n), four = Math.ceil(offer.target / 4), base = none[0];
  const all = avg(offer, Array(n).fill(fair)), allP = avg(offer, Array(n).fill(fair), 1.3), most = avg(offer, [0, four, four, four, four, 0]), lost = avg(offer, [fair, 0, 0, 0, 0, 0]), mostP = avg(offer, [0, four, four, four, four, 0], 1.3);
  console.log(`${t.n}: target ₪${offer.target}, crowd ×${t.boost}`);
  console.log(`  everyone gives ₪${fair}             giver ${(all[0] - base).toFixed(1).padStart(6)}   (with 30% more cups ${(allP[0] - base).toFixed(1)})`);
  console.log(`  four give ₪${four}, two don't       giver ${(most[1] - base).toFixed(1).padStart(6)}   (with 30% more cups ${(mostP[1] - base).toFixed(1)})   free rider ${(most[0] - base).toFixed(1)}`);
  console.log(`  I alone give ₪${fair}, target missed  giver ${(lost[0] - base).toFixed(1).padStart(6)}`);
}
// how often the bots alone get there, in random streets
let ok = 0, tot = 0, gave = 0; const r = E.rng(77);
for (let g = 1; g <= 4000; g++) { const cast = Array.from({ length: n }, () => E.PERSONAS[Math.floor(r() * 6)]), offer = E.fundOffer('h' + g, 1 + g % 7, n); let sum = 0; cast.forEach(p => { const v = E.fundMove(p, 'medium', r, { offer, n, fd: [] }); sum += v; if (v) gave++; }); tot++; if (sum >= offer.target) ok++; }
console.log(`\nsix bots alone reach the target ${(100 * ok / tot).toFixed(0)}% of the time; ${(100 * gave / tot / n).toFixed(0)}% of them give`);
