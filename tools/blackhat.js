// The black hat on the street, in whole seasons of six medium "steady" stands (nobody else tricks).
// 1. Does a trick pay? Stand 0 runs one trick a day against the leader (or everyone); every rival runs the same security and,
//    when it catches stand 0, exposes it or keeps quiet. Shows stand 0's season profit against not tricking at all.
// 2. The catchers' dilemma: stand 0 runs a campaign against everyone every day; stands 1 and 2 run cameras and catch it often.
//    Stand 1's season profit for: it exposes and 2 keeps quiet (T), both quiet (R), both expose (P), it keeps quiet and 2 exposes (S).
//    A prisoner's dilemma needs T > R > P > S.
// usage: node tools/blackhat.js [seasons=300] ['{"HOLD":{"q":0.2}}' = settings merged into the engine's NB table]
const E = require('../engine.js');
const N = +process.argv[2] || 300;
const merge = (o, p) => { for (const [k, v] of Object.entries(p)) if (v && typeof v === 'object' && !Array.isArray(v) && o[k]) merge(o[k], v); else o[k] = v; };
if (process.argv[3]) merge(E.NB, JSON.parse(process.argv[3]));
if (process.env.NOCATCH) { E.NB.SECURITY[0].catch = 0; E.NB.ESCALATE = 0; }
const DAYS = 7, n = 6;
function season(seed, { trick, target, sec, expose }) {
  const world = E.buildWorld(seed, DAYS);
  let S = Array.from({ length: n }, (_, k) => ({ id: 's' + k, st: E.newStand(), prev: null })), street = [], caught = 0, tricks = 0;
  for (let day = 1; day <= DAYS; day++) {
    const board = S.map(s => ({ id: s.id, tot: s.st.tot }));
    const decs = S.map((s, k) => {
      const d = E.botDecision(E.PERSONAS[2], s.st, { seed, world, day, diff: 'medium', n, board, me: s.id, k, prev: s.prev, street });
      d.bh = []; d.sec = sec[k]; d.expose = expose[k] ? (s.st.caught || []).map(x => x.by) : []; return d; });
    if (trick) { const lead = board.filter(b => b.id !== 's0').sort((a, b) => b.tot - a.tot)[0]; decs[0].bh = [{ id: trick, target: target === 'all' ? 'all' : lead.id }];
      // a campaign brings customers: plan cups for them
      if (trick === 'ads') { const x = 1 + E.NB.EFFECT.ads * (target === 'all' ? 1 : 0.5); decs[0].cups = Math.round(decs[0].cups * x); for (const k of ['l', 'h', 'i']) decs[0].buy[k] = Math.round(decs[0].buy[k] * x); } }
    const states = Object.fromEntries(S.map(s => [s.id, s.st]));
    E.resolveCatches(states, Object.fromEntries(S.map((s, k) => [s.id, decs[k]])), day);
    S = S.map(s => ({ ...s, st: states[s.id] }));
    const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, day, n));
    const out = E.runNeighborhoodDay({ seed, world, day, stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
    street = out.results.map(r => ({ id: r.id, price: r.price, loc: r.loc }));
    tricks += out.results[0].myTricks.length; caught += out.results[0].myTricks.filter(t => t.caught).length;
    S = S.map((s, k) => ({ ...s, st: E.settleStand(prep[k].st, prep[k].plan, out.results[k], prep[k].spent, day).st, prev: { dec: decs[k], res: out.results[k] } }));
  }
  const score = S.map(s => E.nbScore(s.st));
  return { score, caught: tricks ? caught / tricks : 0, won: score[0] >= Math.max(...score) ? 1 : 0 };
}
const avg = cfg => { const t = Array(n).fill(0); let c = 0, w = 0; for (let g = 1; g <= N; g++) { const r = season(g * 7919 + 101, cfg); r.score.forEach((v, k) => { t[k] += v; }); c += r.caught; w += r.won; } return { score: t.map(v => v / N), caught: c / N, won: w / N }; };
const all = v => Array(n).fill(v), money = v => (v >= 0 ? '+' : '') + v.toFixed(0);

if (process.env.ONLY !== '2') {
console.log(`1. stand 0's season profit from one trick a day, against not tricking, and how often it wins the season (rivals' security · what a catcher does)`);
for (const s of (process.env.SEC || '0,1,2,3').split(',').map(Number)) {
  const b0 = avg({ sec: [0, ...all(s).slice(1)], expose: all(false) }), base = b0.score[0];
  const cells = [];
  for (const [trick, target] of [['ads', 'one'], ['ads', 'all'], ['rumor', 'one'], ['rumor', 'all']].filter(c => !process.env.CELL || c.join(' ') === process.env.CELL))
    for (const ex of [false, true]) { const r = avg({ trick, target, sec: [0, ...all(s).slice(1)], expose: [false, ...all(ex).slice(1)] }); cells.push(`${trick} ${target} ${ex ? 'exposed' : 'quiet'} ${money(r.score[0] - base)} (caught ${(100 * r.caught).toFixed(0)}%, wins ${(100 * r.won).toFixed(0)}%)`); }
  console.log(`  ${E.NB.SECURITY[s].n.padEnd(10)} base ₪${base.toFixed(0)}\n    ` + cells.join(' · '));
}
}
if (process.env.ONLY !== '1') {
console.log(`\n2. the catchers' dilemma (stand 1's season profit)`);
const sec = [0, 2, 2, 0, 0, 0], cfg = ex => ({ trick: 'ads', target: 'all', sec, expose: [false, ex[0], ex[1], false, false, false] });
const T = avg(cfg([true, false])).score[1], R = avg(cfg([false, false])).score[1], P = avg(cfg([true, true])).score[1], Sx = avg(cfg([false, true])).score[1];
console.log(`  T (I expose, the other keeps quiet) ₪${T.toFixed(0)}\n  R (both quiet)                       ₪${R.toFixed(0)}\n  P (both expose)                      ₪${P.toFixed(0)}\n  S (I keep quiet, the other exposes)  ₪${Sx.toFixed(0)}`);
console.log(T > R && R > P && P > Sx ? '  => a prisoner\'s dilemma' : `  => not a prisoner's dilemma (${[T > R ? '' : 'T ≤ R', R > P ? '' : 'R ≤ P', P > Sx ? '' : 'P ≤ S'].filter(Boolean).join(', ')})`);
}
