// The expert traders (the hard level's bots) against the characters. Whole seasons with every feature on (coupons, the fund, the black hat):
// some stands are experts, the others play their character at another level. Prints what each side earns, how often an expert wins, and how the experts play.
// usage: node tools/experts.js [seasons=200] [stands=6] [days=7] [experts=1] [others=medium]
const E = require('../engine.js');
const [N = 200, STANDS = 6, DAYS = 7, XN = 1, OTHER = 'medium'] = process.argv.slice(2).map((x, i) => i === 4 ? x : +x);
const sum = { x: 0, o: 0, xn: 0, on: 0, win: 0, tricks: 0, caught: 0, xDays: 0, price: 0, cups: 0, sold: 0, miss: 0, coupon: 0, cpN: 0, cpCash: 0, oCpCash: 0, fund: 0, fundN: 0, fundOk: 0, ups: {}, loc: [0, 0, 0], mk: 0, helper: 0, sec: 0, byDay: [] };
function season(seed, g) {
  const world = E.buildWorld(seed, DAYS);
  // the experts sit in different slots each season, so no seat is favored
  let S = Array.from({ length: STANDS }, (_, k) => ({ id: 's' + k, p: E.PERSONAS[k % E.PERSONAS.length], x: (k + g) % STANDS < XN, st: E.newStand(), prev: null })), street = [];
  for (let d = 1; d <= DAYS; d++) {
    const board = S.map(s => ({ id: s.id, tot: s.st.tot, rep: s.st.rep })), pairs = E.couponPairs(S.map(s => s.id), d), mate = Object.fromEntries(pairs.flatMap(([a, b]) => [[a, b], [b, a]])),
      peers = Object.fromEntries(S.map(s => [s.id, s.st.cp || []])), fund = E.fundOffer('h' + g, d, STANDS);
    const caught = S.filter(s => ((s.prev && s.prev.res.myTricks) || []).some(t => t.caught)).map(s => s.id);
    const decs = S.map((s, k) => { const dec = E.botDecision(s.p, s.st, { seed, world, day: d, diff: s.x ? 'hard' : OTHER, n: STANDS, board, me: s.id, k, prev: s.prev, street, partner: mate[s.id], peers, days: DAYS, fund, caught }); return dec.fund ? { ...dec, fund: fund.ticket } : dec; });
    const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, d, STANDS)), out = E.runNeighborhoodDay({ seed, world, day: d, pairs, fund, stands: S.map((s, k) => ({ id: s.id, bot: true, st: prep[k].st, plan: prep[k].plan })) });
    S = S.map((s, k) => { const r = out.results[k], p = prep[k], set = E.settleStand(p.st, p.plan, r, p.spent, d);
      if (s.x) { sum.xDays++; sum.price += p.plan.price; sum.cups += r.cups; sum.sold += r.sold; sum.miss += r.miss; sum.tricks += r.myTricks.length; sum.caught += r.myTricks.filter(t => t.caught).length; sum.loc[p.plan.loc]++; sum.mk += p.plan.mk.length; sum.helper += p.plan.helper ? 1 : 0; sum.sec += p.plan.sec ? 1 : 0;
        (decs[k].ups || []).forEach(u => { if (p.st.ups.includes(u)) sum.ups[u] = (sum.ups[u] || 0) + 1; });
        if (r.coupon) { sum.cpN++; sum.coupon += r.coupon.gave ? 1 : 0; sum.cpCash += r.coupon.cash; } if (r.fund) { sum.fundN++; sum.fund += r.fund.gave ? 1 : 0; sum.fundOk += r.fund.ok ? 1 : 0; }
        (sum.byDay[d] = sum.byDay[d] || { p: 0, n: 0 }).p += set.profit; sum.byDay[d].n++; } else if (r.coupon) sum.oCpCash += r.coupon.cash;
      return { ...s, st: set.st, prev: { dec: decs[k], res: r } }; });
    street = out.results.map(r => ({ id: r.id, price: r.price, loc: r.loc }));
  }
  const sc = S.map(s => ({ x: s.x, v: E.nbScore(s.st) })), bestV = Math.max(...sc.map(s => s.v));
  sc.forEach(s => { if (s.x) { sum.x += s.v; sum.xn++; } else { sum.o += s.v; sum.on++; } }); if (sc.some(s => s.x && s.v === bestV)) sum.win++;
}
const t0 = Date.now(); for (let g = 1; g <= N; g++) season(g * 7919 + 11, g);
const f = (a, b, d = 1) => (a / Math.max(1, b)).toFixed(d), pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + '%';
console.log(`${N} seasons · ${STANDS} stands (${XN} experts, the rest ${OTHER}) · ${DAYS} days · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`season's profit: an expert ₪${f(sum.x, sum.xn, 0)}${sum.on ? ` · another stand ₪${f(sum.o, sum.on, 0)}` : ''} · an expert wins ${pc(sum.win, N)} of seasons (by chance: ${pc(Math.min(XN, STANDS), STANDS)})`);
console.log(`an expert's day: price ₪${f(sum.price, sum.xDays)} · made ${f(sum.cups, sum.xDays)} cups, sold ${f(sum.sold, sum.xDays)}, ${f(sum.miss, sum.xDays)} customers left without one · marketing ${f(sum.mk, sum.xDays, 2)} · helper ${pc(sum.helper, sum.xDays)} · security ${pc(sum.sec, sum.xDays)}`);
console.log(`  place: corner ${pc(sum.loc[0], sum.xDays)} · side ${pc(sum.loc[1], sum.xDays)} · middle ${pc(sum.loc[2], sum.xDays)} · upgrades a season: ${Object.entries(sum.ups).map(([k, v]) => k + ' ' + f(v, sum.xn, 2)).join(', ') || 'none'}`);
console.log(`  profit by day: ${sum.byDay.slice(1).map(x => Math.round(x.p / x.n)).join(' · ')}`);
console.log(`  tricks a season ${f(sum.tricks, sum.xn, 2)} (caught ${pc(sum.caught, sum.tricks)}) · coupons handed out ${pc(sum.coupon, sum.cpN)}, ₪${f(sum.cpCash, sum.cpN)} a night (the others ₪${f(sum.oCpCash, Math.max(1, sum.on) * DAYS)}) · fund tickets ${pc(sum.fund, sum.fundN)}, the event happened ${pc(sum.fundOk, sum.fundN)}`);
