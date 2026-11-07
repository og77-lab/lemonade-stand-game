// The neighbors' coupons. 1. The deal in the real street: is no move always best, in shekels? 2. As a game by itself: can a player read the bots, and does any way of playing always win?
// usage: node tools/coupons.js [seasons=3000] [days=7] [stands=6] [level=medium]   (env BRING, LEAK try other strengths)
const E = require('../engine.js');
const [N = 3000, DAYS = 7, STANDS = 6, LEVEL = 'medium'] = process.argv.slice(2).map((x, i) => i === 3 ? x : +x);

// one ordinary day on a street of six: stands 0 and 1 are paired, the others stay out of it. Margin = revenue less the ingredients of the cups sold
function deal(gives0, gives1, seed) {
  const world = E.buildWorld(seed, 7), d = 3, n = 6, P = world[d - 1].p;
  const S = Array.from({ length: n }, (_, k) => ({ id: 's' + k, p: E.PERSONAS[2], st: { ...E.newStand(), cash: 150, lemons: [{ q: 90, d: 3 }], sugar: 40, ice: 0 } }));
  const decs = S.map((s, k) => { const x = E.botDecision(s.p, s.st, { seed, world, day: d, diff: 'medium', n, board: S.map(q => ({ id: q.id, tot: 0 })), me: s.id, k, prev: null, street: [] }); x.bh = []; x.sec = 0; x.autoStock = true; return x; });
  decs[0].coupon = gives0; decs[1].coupon = gives1;
  const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, d, n));
  const out = E.runNeighborhoodDay({ seed, world, day: d, pairs: gives0 === null ? [] : [['s0', 's1']], stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
  const r = out.results[0], p = prep[0].plan, unit = p.recipe.l * P.l + p.recipe.h * P.h + p.recipe.i * P.i;
  return r.rev + (r.prize || 0) - r.sold * unit - (r.costs.coupon || 0);
}
const avgDeal = (a, b) => { let s = 0; const M = Math.min(N, 1500); for (let g = 1; g <= M; g++) s += deal(a, b, g * 7919 + 29); return s / M; };
const base = avgDeal(null, null), T = avgDeal(false, true) - base, R = avgDeal(true, true) - base, Pn = avgDeal(false, false) - base, Sk = avgDeal(true, false) - base;
console.log(`the deal in the street (${JSON.stringify(E.NB.COUPON.pay)}), a day's margin against no deal at all:`);
console.log(`  T I throw, the neighbor hands out  ${T.toFixed(1)}\n  R both hand out                    ${R.toFixed(1)}\n  P both throw                       ${Pn.toFixed(1)}\n  S I hand out, the neighbor throws  ${Sk.toFixed(1)}`);
console.log(T > R && R > Pn && Pn > Sk ? '  => a prisoner\'s dilemma: throwing pays on the night, sharing pays together\n' : '  => something else is off\n');

const PAY = { T, R, P: Pn, S: Sk };
// ways a person might play stand 0. me: its own record; w: tonight's neighbor and its record
const PLAYERS = {
  'always hand out': () => true,
  'always throw': () => false,
  'coin flip': (me, r) => r() < 0.5,
  'tit for tat': me => !me.length || me[me.length - 1].o,
  'trust, then punish the betrayer only': (me, r, w) => { const m = me.filter(x => x.w === w); return !m.length || m[m.length - 1].o; },
  'read the street (share with sharers)': (me, r, w, cp) => !cp.length || cp.filter(x => x.m).length / cp.length >= 0.5,
  'the 57% rule (hand out if it has shared enough)': (me, r, w, cp) => (cp.filter(x => x.m).length + 1.2) / (cp.length + 2) >= 0.565,
  'nice, then betray at the end': (me, r, w, cp, d) => d < DAYS - 1,
  'reads each character (has found its rule)': (me, r, w, cp, d, ctx) => E.couponRule(ctx.cast[w - 1], { me: w, partner: 0, peers: ctx.peers, day: d, tot: ctx.tot, diff: LEVEL }) > 0.565,
  'reads each character and thinks a day ahead': (me, r, w, cp, d, ctx) => { const rule = (i, peers, day) => E.couponRule(ctx.cast[i - 1], { me: i, partner: 0, peers, day, tot: ctx.tot, diff: LEVEL }), best = q => Math.max(q * PAY.R + (1 - q) * PAY.S, q * PAY.T + (1 - q) * PAY.P), p = rule(w, ctx.peers, d);
    const pair = d < DAYS ? E.couponPairs(ctx.ids, d + 1).find(x => x.includes(0)) : null, nb = pair && (pair[0] === 0 ? pair[1] : pair[0]);
    const worth = m => (m ? p * PAY.R + (1 - p) * PAY.S : p * PAY.T + (1 - p) * PAY.P) + (nb ? best(rule(nb, { ...ctx.peers, 0: [...ctx.peers[0], { d, w, m, o: p > 0.5 }] }, d + 1)) : 0); return worth(true) >= worth(false); },
  'learns from the record who keeps their word': (me, r, w, cp, d, ctx) => { const said = cp.filter(x => typeof x.s === 'boolean'), h = (said.filter(x => x.s === x.m).length + 1) / (said.length + 2), p = ctx.said[w] ? h : 1 - h; return p >= 0.565; },
  'knows who lies, and thinks a day ahead': (me, r, w, cp, d, ctx) => { const rule = (i, peers, day) => E.couponRule(ctx.cast[i - 1], { me: i, partner: 0, peers, day, tot: ctx.tot, diff: LEVEL }), best = q => Math.max(q * PAY.R + (1 - q) * PAY.S, q * PAY.T + (1 - q) * PAY.P), id = ctx.cast[w - 1].id, s = ctx.said[w];
    const p = id === 'budget' ? rule(w, ctx.peers, d) : id === 'gambler' ? (s ? 0.05 : 0.95) : id === 'trendy' ? (rule(w, ctx.peers, d) + (s ? 0.75 : 0.25)) / 2 : s ? 0.95 : 0.05;
    const pair = d < DAYS ? E.couponPairs(ctx.ids, d + 1).find(x => x.includes(0)) : null, nb = pair && (pair[0] === 0 ? pair[1] : pair[0]);
    const worth = m => (m ? p * PAY.R + (1 - p) * PAY.S : p * PAY.T + (1 - p) * PAY.P) + (nb ? best(rule(nb, { ...ctx.peers, 0: [...ctx.peers[0], { d, w, m, o: p > 0.5 }] }, d + 1)) : 0); return worth(true) >= worth(false); },
  'believes what the neighbor says': (me, r, w, cp, d, ctx) => ctx.said[w] === true,
  'reads the record only (last move)': (me, r, w, cp) => !cp.length || cp[cp.length - 1].m,
};
const CAST = E.PERSONAS, stat = Object.fromEntries(CAST.map(c => [c.id, { n: 0, share: 0, best: 0, last: 0, maj: 0 }])), res = {};
for (const [name, play] of Object.entries(PLAYERS)) {
  let mine = 0, bots = 0, wins = 0;
  for (let g = 1; g <= N; g++) {
    const r = E.rng(g * 7919 + name.length * 131), cast = Array.from({ length: STANDS - 1 }, () => CAST[Math.floor(r() * CAST.length)]), ids = Array.from({ length: STANDS }, (_, i) => i), peers = Object.fromEntries(ids.map(i => [i, []])), tot = Array(STANDS).fill(0), seen = {};
    for (let day = 1; day <= DAYS; day++) { const moves = [];
      for (const [a, b] of E.couponPairs(ids, Math.ceil(day / (+process.env.STAY || 1)))) {
        const tots = Object.fromEntries(ids.map(i => [i, tot[i]])), night = i => E.couponNight(cast[i - 1], LEVEL, g, day, i, { me: i, partner: i === a ? b : a, peers, tot: tots }), said = {}; for (const i of [a, b]) if (i) said[i] = night(i).say;
        const move = (i, o) => i === 0 ? play(peers[0], r, o, peers[o], day, { cast, ids, peers, tot: tots, said }) : night(i).move;
        const am = move(a, b), bm = move(b, a); moves.push([a, b, am, bm, said[a], said[b]]);
        // the player's own guessing, per stand: its usual move, or its last one, whichever has been right more
        for (const [i, m] of [[a, am], [b, bm]]) if (i !== 0) { const s = stat[cast[i - 1].id], k = seen[i] = seen[i] || { ms: [], lastOk: 0, majOk: 0 };
          const last = k.ms.length ? k.ms[k.ms.length - 1] : true, maj = k.ms.filter(Boolean).length * 2 >= k.ms.length, guess = k.lastOk > k.majOk ? last : maj;
          s.n++; if (m) s.share++; if (guess === m) s.best++; if (last === m) s.last++; if (maj === m) s.maj++;
          if (last === m) k.lastOk++; if (maj === m) k.majOk++; k.ms.push(m); }
        const pay = (x, y) => x ? (y ? PAY.R : PAY.S) : (y ? PAY.T : PAY.P); tot[a] += pay(am, bm); tot[b] += pay(bm, am);
      }
      for (const [a, b, am, bm, sa, sb] of moves) { peers[a].push({ d: day, w: b, m: am, o: bm, s: sa }); peers[b].push({ d: day, w: a, m: bm, o: am, s: sb }); }
    }
    mine += tot[0]; bots += tot.slice(1).reduce((s, v) => s + v, 0) / (STANDS - 1); if (tot[0] >= Math.max(...tot)) wins++;
  }
  res[name] = { mine: mine / N, bots: bots / N, wins: wins / N };
}
console.log(`${N} seasons per way of playing · ${STANDS} stands · ${DAYS} days · ${LEVEL} bots\n`);
console.log('can a player read them? (a guess from what the stand did so far; 50% is a coin)');
for (const c of CAST) { const s = stat[c.id]; console.log(`  ${c.n.padEnd(14)} hands out ${(100 * s.share / s.n).toFixed(0).padStart(3)}% · guessed right ${(100 * s.best / s.n).toFixed(0)}%`); }
console.log('\nhow each way of playing does (season profit from the deal, the bots on that street, first place)');
for (const [k, v] of Object.entries(res).sort((a, b) => b[1].mine - a[1].mine)) console.log(`  ${k.padEnd(38)} ₪${v.mine.toFixed(0).padStart(4)} · bots ₪${v.bots.toFixed(0).padStart(4)} · first ${(100 * v.wins).toFixed(0)}%`);
