// What the dilemma cards show: the usual range of a day's gain from each choice, against the same day with no deal. "Usual" = the middle 60% of days.
// usage: node tools/ranges.js [days=500] [stands=6]
const E = require('../engine.js');
const N = +process.argv[2] || 500, n = +process.argv[3] || 6;
function day(seed, opt) {
  const world = E.buildWorld(seed, 7), d = 3, P = world[d - 1].p;
  const S = Array.from({ length: n }, (_, k) => ({ id: 's' + k, p: E.PERSONAS[2], st: { ...E.newStand(), cash: 400, lemons: [{ q: 150, d: 3 }], sugar: 60, ice: 0 } }));
  const decs = S.map((s, k) => { const x = E.botDecision(s.p, s.st, { seed, world, day: d, diff: 'medium', n, board: S.map(q => ({ id: q.id, tot: 0 })), me: s.id, k, prev: null, street: [] }); x.bh = []; x.sec = 0; x.autoStock = true; x.fund = (opt.gifts || [])[k] || 0; if (opt.coupon && k < 2) x.coupon = opt.coupon[k]; return x; });
  const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, d, n));
  const out = E.runNeighborhoodDay({ seed, world, day: d, fund: opt.fund || null, pairs: opt.coupon ? [['s0', 's1']] : [], stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
  const r = out.results[0], p = prep[0].plan;
  return r.rev + (r.prize || 0) - r.sold * (p.recipe.l * P.l + p.recipe.h * P.h + p.recipe.i * P.i) - (r.costs.coupon || 0) - ((opt.gifts || [])[0] || 0);
}
const range = opt => { const v = []; for (let g = 1; g <= N; g++) { const s = g * 7919 + 31; v.push(day(s, opt) - day(s, {})); } v.sort((a, b) => a - b); const q = p => Math.round(v[Math.floor(p * v.length)] / 5) * 5; return `${q(0.2)}..${q(0.8)} (avg ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(0)})`; };
console.log(`${n} stands, ${N} days`);
for (const t of E.NB.FUND.tiers) {
  const target = Math.round(t.per * n), fund = { ...t, target }, fair = Math.ceil(target / n);
  console.log(t.n, 'target', target, 'share', fair);
  [0, 1, 2, 3].forEach(k => { const others = Array(n - 1).fill(k ? fair : Math.ceil(target / (n - 1))); console.log(`  I give ₪${k * fair}: ${range({ fund, gifts: [k * fair, ...others] })}`); });
}
console.log('coupons');
for (const [name, c] of [['both hand out', [true, true]], ['I throw, it hands out', [false, true]], ['I hand out, it throws', [true, false]], ['both throw', [false, false]]]) console.log(`  ${name}: ${range({ coupon: c })}`);
