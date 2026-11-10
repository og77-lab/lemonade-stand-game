// The street fund over whole seasons: streets of different sizes, with some human players who each keep one way of playing the fund, and bots for the rest.
// Does the event happen because of the street as a whole, not because of one player? Does any way of playing always win?
// usage: node tools/fund.js [seasons=300] [days=7] [level=medium]
const E = require('../engine.js');
const [N = 300, DAYS = 7, LEVEL = 'medium'] = process.argv.slice(2).map((x, i) => i === 2 ? x : +x);
const CAST = ['steady', 'gambler', 'budget', 'veteran', 'trendy', 'premium'];
// how a human might play the fund: always buy, never, a coin, or buy again only after an event that happened
const WAYS = { always: () => true, never: () => false, coin: r => r() < 0.5, 'after a success': (r, last) => !last || last.ok };

function season(seed, n, humans) {
  const members = Array.from({ length: n }, (_, k) => ({ id: 'm' + k, slot: k, persona: k < humans.length ? null : CAST[(k + seed) % CAST.length], nick: 'x', em: 'x', state: E.newStand() }));
  let g = { hood: { id: 'h' + seed, seed, days: DAYS, difficulty: LEVEL, last_day: 0 }, members, decisions: {}, paid: {}, prev: {}, street: [] };
  const r = E.rng(seed * 31 + 7), happened = [], bought = { human: 0, humanN: 0, bot: 0, botN: 0 };
  for (let day = 1; day <= DAYS; day++) {
    const world = E.buildWorld(seed, DAYS), board = g.members.map(m => ({ id: m.id, tot: m.state.tot })), decisions = {};
    humans.forEach((way, k) => {
      const m = g.members[k], d = E.botDecision(E.PERSONAS.find(p => p.id === 'steady'), m.state, { seed, world, day, diff: LEVEL, n, board, me: m.id, k, prev: g.prev[m.id], street: g.street });
      decisions[m.id] = { ...d, bh: [], fund: WAYS[way](r, happened[happened.length - 1]) ? 1 : 0 };
    });
    const out = E.advanceHood({ ...g, decisions: { [day]: decisions }, now: { day, minutes: 18 * 60 } }), run = out.runs[out.runs.length - 1];
    if (run.open.fund) happened.push({ ok: run.open.fund.ok });
    run.privates.forEach(p => { const k = +p.member.slice(1), gave = ((p.data.res || {}).fund || {}).gave > 0; if (k < humans.length) { bought.human += gave; bought.humanN++; } else { bought.bot += gave; bought.botN++; } });
    g = { ...g, members: g.members.map(m => ({ ...m, state: out.states[m.id] })), hood: { ...g.hood, last_day: out.last_day }, street: run.results.map(q => ({ id: q.id, price: q.price, loc: q.loc })),
      prev: Object.fromEntries(g.members.map(m => { const p = run.privates.find(x => x.member === m.id); return [m.id, { dec: p.data.dec, res: p.data.res }]; })) };
  }
  const sc = g.members.map(m => E.nbScore(m.state)), top = Math.max(...sc);
  return { sc, first: sc.map(v => v >= top ? 1 : 0), ok: happened.filter(x => x.ok).length / Math.max(1, happened.length), bought };
}

function street(label, n, humans) {
  const per = {}, add = (k, s, f) => { const a = per[k] = per[k] || { s: 0, f: 0, c: 0 }; a.s += s; a.f += f; a.c++; };
  let ok = 0, hb = 0, hn = 0, bb = 0, bn = 0;
  for (let i = 1; i <= N; i++) {
    const res = season(i * 7919 + 13, n, humans); ok += res.ok; hb += res.bought.human; hn += res.bought.humanN; bb += res.bought.bot; bn += res.bought.botN;
    res.sc.forEach((v, k) => add(k < humans.length ? 'human: ' + humans[k] : 'bot', v, res.first[k]));
  }
  console.log(`\n${label} (${n} stands, ${E.fundOffer('x', 1, n).need} tickets needed)`);
  console.log(`  the event happened on ${(ok / N * 100).toFixed(0)}% of the days · bots bought ${(bb / Math.max(1, bn) * 100).toFixed(0)}% of the time` + (hn ? ` · humans ${(hb / hn * 100).toFixed(0)}%` : ''));
  for (const [k, a] of Object.entries(per)) console.log(`  ${k.padEnd(26)} season ₪${(a.s / a.c).toFixed(0).padStart(4)}   first in ${(a.f / a.c * 100).toFixed(0)}% of seasons`);
}

street('only bots', 6, []);
street('one human, each way of playing', 6, ['always', 'never', 'coin', 'after a success'].slice(0, 1));
street('one human who never buys', 6, ['never']);
street('only bots', 10, []);
street('three humans who always buy', 10, ['always', 'always', 'always']);
street('three humans who never buy', 10, ['never', 'never', 'never']);
street('three humans, mixed', 10, ['always', 'never', 'after a success']);
