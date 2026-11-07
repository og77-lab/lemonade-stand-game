// Does the street's day take every variable into account, in the right direction? Six identical stands on an ordinary day, then one thing changes.
// Each line: visitors and cups sold of the stand in question (or the whole street), before and after, over many days; it must move the way the rule says.
// Then the books: nobody sells more than they made, money and stock add up to the shekel, every walker is accounted for.
// usage: node tools/engine-check.js [days=400]
const E = require('../engine.js');
const N = +process.argv[2] || 400, n = 6, D = 3;
const plan0 = { recipe: { l: 3, h: 1, i: 1 }, price: 6, cups: 30, loc: 1, helper: false, mk: [], bh: [], sec: 0, buy: { l: 100, h: 40, i: 40 } };
function day(seed, { world: wf, dec: df, st: sf, pairs, fund, stands = n } = {}) {
  const world = E.buildWorld(seed, 7).map(x => ({ ...x }));
  world[D] = { ...world[D], t: 25, w: 'nice', ev: null, sur: null, vip: false, ...(wf || {}) };
  const S = Array.from({ length: stands }, (_, k) => ({ id: 's' + k, st: { ...E.newStand(), cash: 300, lemons: [{ q: 100, d: D }], sugar: 40, ice: 0, ...(sf ? sf(k) : {}) } }));
  const decs = S.map((s, k) => ({ ...plan0, ...(df ? df(k) : {}) }));
  const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, D, stands));
  const out = E.runNeighborhoodDay({ seed, world, day: D, pairs, fund, stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
  return { out, prep, S, world };
}
const avg = (o, pick) => { let v = 0, b = 0, m = 0, p = 0; for (let g = 1; g <= N; g++) { const rs = day(g * 7919 + 3, o).out.results, r = pick ? pick(rs) : [rs[0]]; r.forEach(x => { v += x.visitors; b += x.sold; m += x.miss; p += x.prize || 0; }); } return { v: v / N, b: b / N, m: m / N, p: p / N }; };
let fails = 0;
const check = (name, a, b, want, key = 'v') => { const up = b[key] > a[key] * 1.01, down = b[key] < a[key] * 0.99, good = want === 'up' ? up : want === 'down' ? down : !up && !down; if (!good) fails++;
  console.log(`  ${good ? 'ok  ' : 'FAIL'} ${name.padEnd(44)} ${a[key].toFixed(1).padStart(6)} → ${b[key].toFixed(1).padStart(6)}  (${want})`); };
const base = avg({}), all = rs => rs;
const baseAll = avg({}, all);
console.log(`an ordinary day: a stand gets ${base.v.toFixed(1)} visitors and sells ${base.b.toFixed(1)}\n\nthe street's crowd`);
check('hot day, 32° (whole street)', baseAll, avg({ world: { t: 32 } }, all), 'up');
check('cold day, 15° (whole street)', baseAll, avg({ world: { t: 15 } }, all), 'down');
check('heavy rain (whole street)', baseAll, avg({ world: { w: 'hRain' } }, all), 'down');
check('a festival ×1.8 (whole street)', baseAll, avg({ world: { ev: { id: 'x', n: 'x', d: 'x', dm: 1.8 } } }, all), 'up');
check('roadworks ×0.5 (whole street)', baseAll, avg({ world: { ev: { id: 'x', n: 'x', d: 'x', dm: 0.5 } } }, all), 'down');
check('a sudden shower (whole street)', baseAll, avg({ world: { sur: { id: 'shower', n: 'x', f: 0.35 } } }, all), 'down');
check('ten stands, not six (whole street)', baseAll, avg({ stands: 10 }, all), 'up');
{ const six = baseAll.v / 6, ten = avg({ stands: 10 }, all).v / 10; check('ten stands, not six (each stand)', { v: six }, { v: ten }, 'down'); }
console.log('\nsharing it: one stand differs from the five others');
check('dearer than the street, ₪9', base, avg({ dec: k => k ? {} : { price: 9 } }), 'down');
check('cheaper than the street, ₪4', base, avg({ dec: k => k ? {} : { price: 4 } }), 'up');
check('a much better cup, 4/1/1', base, avg({ dec: k => k ? {} : { recipe: { l: 4, h: 1, i: 1 } } }), 'up');
check('a poor cup, 1/0/0', base, avg({ dec: k => k ? {} : { recipe: { l: 1, h: 0, i: 0 } } }), 'down');
check('high reputation, 90', base, avg({ st: k => k ? {} : { rep: 90 } }), 'up');
check('low reputation, 15', base, avg({ st: k => k ? {} : { rep: 15 } }), 'down');
check('alone in the middle of the street', base, avg({ dec: k => k ? {} : { loc: 2 } }), 'up');
check('alone on the corner', base, avg({ dec: k => k ? {} : { loc: 0 } }), 'up');
check('the middle with three rivals, not alone', avg({ dec: k => k ? {} : { loc: 2 } }), avg({ dec: k => k < 4 ? { loc: 2 } : {} }), 'down');
check('flyers', base, avg({ dec: k => k ? {} : { mk: ['flyer'] } }), 'up');
check('balloons and signs', base, avg({ dec: k => k ? {} : { mk: ['banner'] } }), 'up');
check('a big sign', base, avg({ st: k => k ? {} : { ups: ['sign'] } }), 'up');
{ const hot = avg({ world: { t: 30 } }); check('shade on a hot day', hot, avg({ world: { t: 30 }, st: k => k ? {} : { ups: ['shade'] } }), 'up'); check('shade on a mild day does nothing', base, avg({ st: k => k ? {} : { ups: ['shade'] } }), 'same'); }
check('the newspaper piece after the critic', base, avg({ st: k => k ? {} : { paper: true } }), 'up');
console.log('\nwho buys');
check('dearer: fewer of the visitors buy', { v: base.b / base.v }, (() => { const a = avg({ dec: () => ({ price: 12 }) }); return { v: a.b / a.v }; })(), 'down');
check('hot day: people pay more at ₪9', (() => { const a = avg({ dec: () => ({ price: 9 }), world: { t: 18 } }); return { v: a.b / a.v }; })(), (() => { const a = avg({ dec: () => ({ price: 9 }), world: { t: 33 } }); return { v: a.b / a.v }; })(), 'up');
check('a richer cup: more visitors want one', { v: (base.b + base.m) / base.v }, (() => { const a = avg({ dec: () => ({ recipe: { l: 4, h: 1, i: 1 } }) }); return { v: (a.b + a.m) / a.v }; })(), 'up');
console.log('\nlimits');
check('only 10 cups: sells fewer', base, avg({ dec: k => k ? {} : { cups: 10 } }), 'down', 'b');
check('only 10 cups: more leave without a cup', base, avg({ dec: k => k ? {} : { cups: 10 } }), 'up', 'm');
check('a closed stand sends customers to the others', avg({}, rs => rs.slice(1)), avg({ dec: k => k ? {} : { cups: 0 } }, rs => rs.slice(1)), 'up');
console.log('\ntricks and deals');
check('a campaign against me', base, avg({ dec: k => k === 1 ? { bh: [{ id: 'ads', target: 's0' }] } : {} }), 'down');
check('my campaign against a rival', base, avg({ dec: k => k ? {} : { bh: [{ id: 'ads', target: 's1' }] } }), 'up');
check('a rumor about me', base, avg({ dec: k => k === 1 ? { bh: [{ id: 'rumor', target: 's0' }] } : {} }), 'down');
{ const P = [['s0', 's1']], D2 = (a, b) => ({ pairs: P, dec: k => k === 0 ? { coupon: a } : k === 1 ? { coupon: b } : {} }), both = avg(D2(true, true)), tempt = avg(D2(false, true)), none = avg(D2(false, false)), sucker = avg(D2(true, false));
  check('coupons: throwing on one who hands out pays more than sharing', both, tempt, 'up', 'p'); check('coupons: sharing pays more than both throwing', none, both, 'up', 'p'); check('coupons: handing out alone pays more than both throwing', none, sucker, 'up', 'p'); }
{ const F = { n: 'x', boost: 1.5, target: 30 }; check('fund met: the street fills', base, avg({ fund: F, dec: () => ({ fund: 5 }) }), 'up'); const miss = avg({ fund: F, dec: k => k ? {} : { fund: 5 } }); check('fund missed: the street stays the same', base, miss, 'same'); if (Math.abs(miss.p - 5 * E.NB.FUND.back) > 0.01) { fails++; console.log('  FAIL fund missed: part of the gift comes back'); }
  const met = avg({ fund: F, dec: k => k ? { fund: 6 } : {} }), gave = avg({ fund: F, dec: k => k ? { fund: 6 } : { fund: 6 } }); check('fund met: givers share the pot, others do not', met, gave, 'up', 'p'); }
// the books, over whole seasons with everything on
console.log('\nthe books: whole seasons, bots, every feature on');
let days = 0, bad = {}; const fail = k => { bad[k] = (bad[k] || 0) + 1; };
for (let g = 1; g <= 150; g++) { const seed = g * 104729 + 7, DAYS = 7, world = E.buildWorld(seed, DAYS); let S = Array.from({ length: 6 }, (_, k) => ({ id: 's' + k, p: E.PERSONAS[k], st: E.newStand(), prev: null })), street = [];
  for (let d = 1; d <= DAYS; d++) { const board = S.map(s => ({ id: s.id, tot: s.st.tot })), pairs = E.couponPairs(S.map(s => s.id), d), mate = Object.fromEntries(pairs.flatMap(([a, b]) => [[a, b], [b, a]])), peers = Object.fromEntries(S.map(s => [s.id, s.st.cp || []])), fund = E.fundOffer('h' + g, d, 6);
    const decs = S.map((s, k) => E.botDecision(s.p, s.st, { seed, world, day: d, diff: 'medium', n: 6, board, me: s.id, k, prev: s.prev, street, partner: mate[s.id], peers, days: DAYS, fund }));
    const prep = S.map((s, k) => E.prepareStand(s.st, decs[k], world, d, 6)), out = E.runNeighborhoodDay({ seed, world, day: d, pairs, fund, stands: S.map((s, k) => ({ id: s.id, st: prep[k].st, plan: prep[k].plan })) });
    days++; const stolen = out.results.reduce((a, r) => a + (r.fines || 0), 0);
    const paid = out.results.reduce((a, r) => a + (r.costs.fine || 0), 0), comp = out.results.reduce((a, r) => a + (r.comp || 0), 0); void stolen; void paid;
    const tricksCaught = out.results.filter(r => r.myTricks.some(t => t.caught)).length; if (Math.abs(comp - tricksCaught * E.NB.CAUGHT.fine) > 0.05) fail('damages paid = damages received');
    S = S.map((s, k) => { const r = out.results[k], p = prep[k], set = E.settleStand(p.st, p.plan, r, p.spent, d), cost = Object.values(r.costs).reduce((a, b) => a + b, 0), interest = Math.round(p.st.loan * E.LOAN_INT * 100) / 100;
      if (r.sold > r.cups) fail('sold more cups than made'); if (Math.abs(r.rev - r.sold * p.plan.price) > 0.01) fail('revenue = cups × price'); if (r.sold + r.walk + r.miss !== r.visitors + (r.vip !== null && r.vip !== undefined ? 1 : 0) && !(r.vip === false && r.sold + r.walk + r.miss === r.visitors)) fail('every visitor bought, walked on or missed');
      const paidBack = set.st.loan === 0 && p.st.loan > 0 ? Math.round(p.st.loan * (1 + E.LOAN_INT) * 100) / 100 : 0;
      if (Math.abs(set.st.cash - (p.st.cash + r.rev + (r.comp || 0) + (r.prize || 0) - cost - interest - paidBack)) > 0.02) fail('cash adds up');
      if (set.st.sugar < 0 || set.st.ice < 0 || set.st.lemons.some(b => b.q <= 0)) fail('no negative stock'); if (set.st.rep < 0 || set.st.rep > 100) fail('reputation stays 0–100');
      if (Object.values(set.st).some(v => typeof v === 'number' && !Number.isFinite(v))) fail('no broken numbers');
      return { ...s, st: set.st, prev: { dec: decs[k], res: r } }; });
    street = out.results.map(r => ({ id: r.id, price: r.price, loc: r.loc })); } }
const names = ['sold more cups than made', 'revenue = cups × price', 'every visitor bought, walked on or missed', 'cash adds up', 'damages paid = damages received', 'no negative stock', 'reputation stays 0–100', 'no broken numbers'];
for (const k of names) { if (bad[k]) fails++; console.log(`  ${bad[k] ? 'FAIL' : 'ok  '} ${k}${bad[k] ? ` (${bad[k]} times)` : ''}`); }
console.log(`\n${days} season days checked. ${fails ? fails + ' PROBLEMS' : 'all checks passed'}`);
if (fails) process.exitCode = 1;
