// The street's economy: how much a stand can make, how much the street would buy, and when the cups run out. Bots only, whole seasons.
// usage: node tools/street-econ.js [seasons=60] [stands=10] [days=7]   (env CASH, WALK try other values)
const E = require('../engine.js');
const [N = 60, STANDS = 10, DAYS = 7] = process.argv.slice(2).map(Number);
if (process.env.CASH) E.NB.START_CASH = +process.env.CASH;
if (process.env.WALK) E.NB.WALK = +process.env.WALK;
if (process.env.CAP) E.NB.CAP.base = +process.env.CAP;
if (process.env.STATION) E.NB.CAP.station = +process.env.STATION;
if (process.env.SHARE) E.NB.SHARE = +process.env.SHARE;
const a = { n: 0, cups: 0, sold: 0, vis: 0, miss: 0, out: 0, outAt: 0, closed: 0, profit: 0, mk: 0, broke: 0, d1: 0, d1n: 0, end: 0 };
for (let g = 1; g <= N; g++) {
  const members = Array.from({ length: STANDS }, (_, k) => ({ id: 'b' + k, slot: k, persona: E.PERSONAS[(k + g) % E.PERSONAS.length].id, state: E.newStand() }));
  const out = E.advanceHood({ hood: { id: 'h' + g, seed: g * 7919, days: DAYS, difficulty: 'medium', last_day: 0 }, members, decisions: {}, paid: {}, prev: {}, street: [], now: { day: DAYS + 1, minutes: 18 * 60 } });
  for (const run of out.runs) for (const p of run.privates) { const r = p.data.res, cups = p.data.plan.cups || 0;
    a.n++; a.cups += cups; a.sold += r.sold; a.vis += r.visitors || 0; a.miss += r.miss || 0; a.profit += p.data.profit; a.mk += (p.data.plan.mk || []).length;
    if (r.closed) a.closed++; if (r.soldAt) { a.out++; const [h, m] = String(r.soldAt).split(':').map(Number); a.outAt += h * 60 + m; } if (run.day === 1) { a.d1 += cups; a.d1n++; } }
  a.end += Object.values(out.states).reduce((s, x) => s + x.cash, 0) / STANDS;
}
const f = x => x.toFixed(1), hh = m => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
console.log(`cash ₪${E.NB.START_CASH} · walkers ${E.NB.WALK} · cap ${E.NB.CAP.base}/${E.NB.CAP.station} · share ${E.NB.SHARE} · ${STANDS} stands · ${DAYS} days`);
console.log(`  a stand-day: ${f(a.cups / a.n)} cups made (day 1: ${f(a.d1 / a.d1n)}), ${f(a.sold / a.n)} sold, ${f(a.vis / a.n)} visitors, ${f(a.miss / a.n)} turned away, marketing ${f(a.mk / a.n)}, profit ₪${f(a.profit / a.n)}`);
console.log(`  sold out ${(100 * a.out / a.n).toFixed(0)}% of days, on average at ${a.out ? hh(a.outAt / a.out) : '-'} · closed ${(100 * a.closed / a.n).toFixed(0)}% · cash at the end ₪${(a.end / N).toFixed(0)}`);
