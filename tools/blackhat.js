// The black hat on the street, in whole seasons of six medium "steady" stands (nobody else tricks).
// Does a trick pay? Stand 0 runs one trick a day against the leader (or everyone); every rival runs the same security;
//    a catch is public at once. Shows stand 0's season profit against not tricking at all, and how often it wins.
// usage: node tools/blackhat.js [seasons=300] ['{"CAUGHT":{"fine":20}}' = settings merged into the engine's NB table]
const E = require('../engine.js');
const N = +process.argv[2] || 300;
const merge = (o, p) => { for (const [k, v] of Object.entries(p)) if (v && typeof v === 'object' && !Array.isArray(v) && o[k]) merge(o[k], v); else o[k] = v; };
if (process.argv[3]) merge(E.NB, JSON.parse(process.argv[3]));
if (process.env.NOCATCH) { E.NB.SECURITY[0].catch = 0; E.NB.ESCALATE = 0; }
const DAYS = 7, n = 6;
function season(seed, { trick, target, sec }) {
  const world = E.buildWorld(seed, DAYS);
  let S = Array.from({ length: n }, (_, k) => ({ id: 's' + k, st: E.newStand(), prev: null })), street = [], caught = 0, tricks = 0;
  for (let day = 1; day <= DAYS; day++) {
    const board = S.map(s => ({ id: s.id, tot: s.st.tot }));
    const decs = S.map((s, k) => {
      const d = E.botDecision(E.PERSONAS[2], s.st, { seed, world, day, diff: 'medium', n, board, me: s.id, k, prev: s.prev, street });
      d.bh = []; d.sec = sec[k]; return d; });
    if (trick) { const lead = board.filter(b => b.id !== 's0').sort((a, b) => b.tot - a.tot)[0]; decs[0].bh = [{ id: trick, target: target === 'all' ? 'all' : lead.id }];
      // a campaign brings customers: plan cups for them
      if (trick === 'ads') { const x = 1 + E.NB.EFFECT.ads * (target === 'all' ? 1 : 0.5); decs[0].cups = Math.round(decs[0].cups * x); for (const k of ['l', 'h', 'i']) decs[0].buy[k] = Math.round(decs[0].buy[k] * x); } }
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

console.log(`stand 0's season profit from one trick a day, against not tricking, and how often it wins the season (by the rivals' security)`);
for (const s of [0, 1, 2, 3]) {
  const b0 = avg({ sec: [0, ...all(s).slice(1)] }), cells = [];
  for (const [trick, target] of [['ads', 'one'], ['ads', 'all'], ['rumor', 'one'], ['rumor', 'all']]) { const r = avg({ trick, target, sec: [0, ...all(s).slice(1)] }); cells.push(`${trick} ${target} ${money(r.score[0] - b0.score[0])} (caught ${(100 * r.caught).toFixed(0)}%, wins ${(100 * r.won).toFixed(0)}%)`); }
  console.log(`  ${E.NB.SECURITY[s].n.padEnd(10)} base ₪${b0.score[0].toFixed(0)}, wins ${(100 * b0.won).toFixed(0)}%\n    ` + cells.join(' · '));
}
