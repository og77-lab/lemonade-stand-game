// lm-hood-tick: runs the neighborhood days that are due, and prepares each evening's market.
// pg_cron calls it every 5 minutes; the game also calls it right after a neighborhood is created. Calling it more often is harmless.
// Built into index.ts together with engine.js by tools/build-tick.js (the dashboard editor takes one file).

// Israel date and minute of the day, and the game day number (day 1 = the start date)
function israelNow(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
}
const dayNumber = (start, date) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 864e5) + 1;

// db: { hoods(only), members(hood), decisions(memberIds, fromDay, toDay), bought(memberIds, fromDay, toDay), memberDays(memberIds, day), lastOpen(hood, day),
//       hasIntel(hood, day), claim(hood, fromLastDay, toLastDay, status), saveDays(rows), saveMemberDays(rows), saveStates(rows), saveIntel(row), setStatus(hood, status) }
async function tick(db, E, now = israelNow(), only = null) {
  const report = [];
  for (const h of await db.hoods(only)) {
    const today = { day: dayNumber(h.start_date, now.date), minutes: now.minutes };
    const due = h.last_day < h.days && (today.day > h.last_day + 1 || (today.day === h.last_day + 1 && today.minutes >= E.NB.OPEN * 60));
    const needIntel = h.last_day < h.days && !(await db.hasIntel(h.id, h.last_day + 1));
    const ending = h.status !== 'done' && h.last_day >= h.days && (today.day > h.days || today.minutes >= E.NB.CLOSE * 60);
    if (!due && !needIntel && !ending) continue;
    const members = await db.members(h.id), ids = members.map(m => m.id);
    const decisions = {}, paid = {}, prev = {};
    let street = [];
    if (due) {
      for (const d of await db.decisions(ids, h.last_day + 1, today.day)) (decisions[d.day] = decisions[d.day] || {})[d.member] = d.dec;
      for (const b of await db.bought(ids, h.last_day + 1, today.day)) (paid[b.day] = paid[b.day] || {})[b.member] = +b.cost;
      if (h.last_day > 0) {
        for (const x of await db.memberDays(ids, h.last_day)) prev[x.member] = { dec: x.data.dec, res: x.data.res };
        street = ((await db.lastOpen(h.id, h.last_day)) || { stands: [] }).stands.map(x => ({ id: x.id, price: x.price, loc: x.loc }));
      }
    }
    const out = E.advanceHood({ hood: h, members, decisions, paid, prev, street, now: today });
    if (out.runs.length) {
      // claim the days first, so two calls at once never run the same day twice
      if (!(await db.claim(h.id, h.last_day, out.last_day, out.status))) { report.push({ hood: h.id, skipped: 'busy' }); continue; }
      await db.saveDays(out.runs.map(r => ({ hood: h.id, day: r.day, open: r.open, events: r.events, results: r.results })));
      await db.saveMemberDays(out.runs.flatMap(r => r.privates.map(p => ({ member: p.member, day: r.day, data: p.data }))));
      await db.saveStates(members.map(m => ({ id: m.id, state: out.states[m.id] })));
    } else if (out.status !== h.status) await db.setStatus(h.id, out.status);
    if (out.intel) await db.saveIntel({ hood: h.id, day: out.intel.day, data: out.intel });
    report.push({ hood: h.id, ran: out.runs.map(r => r.day), intel: out.intel && out.intel.day, status: out.status });
  }
  return report;
}

// The database through Supabase's REST API, with the service key the Edge Function gets from its environment
function restDb(url, key) {
  const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const q = async (path, init = {}) => { const r = await fetch(url + '/rest/v1/' + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
    if (!r.ok) throw new Error(path.split('?')[0] + ': ' + r.status + ' ' + (await r.text())); const t = await r.text(); return t ? JSON.parse(t) : null; };
  const inList = ids => 'in.(' + ids.join(',') + ')';
  const upsert = (table, conflict, rows) => rows.length ? q(table + '?on_conflict=' + conflict, { method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }) : null;
  return {
    hoods: only => q('lm_hoods?select=id,seed,days,difficulty,start_date,last_day,status&status=neq.done' + (only ? '&id=eq.' + only : '')),
    members: hood => q('lm_members?select=id,slot,persona,state&hood=eq.' + hood + '&order=slot'),
    decisions: (ids, a, b) => q(`lm_decisions?select=member,day,dec&member=${inList(ids)}&day=gte.${a}&day=lte.${b}`),
    bought: (ids, a, b) => q(`lm_bought?select=member,day,cost&member=${inList(ids)}&day=gte.${a}&day=lte.${b}`),
    memberDays: (ids, d) => q(`lm_member_days?select=member,data&member=${inList(ids)}&day=eq.${d}`),
    lastOpen: async (hood, d) => ((await q(`lm_days?select=open&hood=eq.${hood}&day=eq.${d}`))[0] || {}).open,
    hasIntel: async (hood, d) => (await q(`lm_intel?select=day&hood=eq.${hood}&day=eq.${d}`)).length > 0,
    claim: async (hood, from, to, status) => (await q(`lm_hoods?id=eq.${hood}&last_day=eq.${from}`, { method: 'PATCH', body: JSON.stringify({ last_day: to, status }), headers: { Prefer: 'return=representation' } })).length === 1,
    saveDays: rows => upsert('lm_days', 'hood,day', rows),
    saveMemberDays: rows => upsert('lm_member_days', 'member,day', rows),
    saveStates: rows => Promise.all(rows.map(r => q('lm_members?id=eq.' + r.id, { method: 'PATCH', body: JSON.stringify({ state: r.state }), headers: { Prefer: 'return=minimal' } }))),
    saveIntel: row => upsert('lm_intel', 'hood,day', [row]),
    setStatus: (hood, status) => q('lm_hoods?id=eq.' + hood, { method: 'PATCH', body: JSON.stringify({ status }), headers: { Prefer: 'return=minimal' } }),
  };
}

if (typeof Deno !== 'undefined') {
  Deno.serve(async req => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const only = typeof body.hood === 'string' && /^[0-9a-f-]{36}$/.test(body.hood) ? body.hood : null;
      const db = restDb(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
      const report = await tick(db, globalThis.LemonEngine, israelNow(), only);
      return new Response(JSON.stringify({ ok: true, report }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { tick, israelNow, dayNumber, restDb };
