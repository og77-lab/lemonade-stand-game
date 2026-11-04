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

// Reminders: at 19:00 and 07:00 (Israel time) a push notification goes to players who turned them on and haven't decided yet.
// The window is wider than the 5 minutes between runs, and each neighborhood's reminder is claimed in the database, so it goes out once.
const VAPID_PUBLIC = 'BKRiGHp03Wt8O9QhQ_D-1b1B1TNPFcCQhRaPhIyi5ejV9yLi3o5bWnsxVPUbH7x7DQ2zZzHM5hxINHws3ORpvjs', VAPID_SUB = 'https://github.com/og77-lab/lemonade-stand-game';
const REMIND = { evening: 19 * 60, morning: 7 * 60, window: 30 };
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)\//;
// which reminder a neighborhood is due now: the evening's is for tomorrow, the morning's for today
function reminderFor(h, now) {
  const inWindow = at => now.minutes >= at && now.minutes < at + REMIND.window;
  const slot = inWindow(REMIND.evening) ? 'evening' : inWindow(REMIND.morning) ? 'morning' : null;
  if (!slot) return null;
  const day = dayNumber(h.start_date, now.date) + (slot === 'evening' ? 1 : 0);
  return day >= 1 && day <= h.days && h.last_day < day ? { slot, day } : null;
}
const reminderText = (h, r) => ({ title: '🍋 ' + h.name, tag: 'lm-' + h.id, body: r.slot === 'evening' ? `מה התוכנית ליום ${r.day}? עוד לא החלטת, ויש לך עד 08:00.`
  : `נשארה שעה: עוד לא החלטת ליום ${r.day}. ב-08:00 הדוכנים נפתחים, ובלי החלטה הטייס האוטומטי יפעיל את שלך.` });
async function remind(db, now, send) {
  const sent = [];
  for (const h of await db.hoods(null)) {
    const r = reminderFor(h, now);
    if (!r || !(await db.claimReminder(h.id, r.day, r.slot))) continue;
    const text = JSON.stringify(reminderText(h, r)), to = await db.pushTargets(h.id, r.day, r.slot);
    for (const t of to) {
      const status = await send(t, text).catch(() => 0);
      if (status === 404 || status === 410) await db.dropPush(t.endpoint); // the device turned them off or is gone
    }
    sent.push({ hood: h.id, ...r, to: to.length });
  }
  return sent;
}

// A Web Push message (RFC 8291 encryption, RFC 8292 VAPID), with nothing but the platform's crypto
const b64u = { dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
  enc: b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
const joinBytes = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const utf8 = s => new TextEncoder().encode(s);
const hkdf = async (salt, ikm, info, bytes) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info },
  await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));
async function encryptPush(text, p256dh, auth) {
  const client = b64u.dec(p256dh), salt = crypto.getRandomValues(new Uint8Array(16)), keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const server = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey)), theirs = await crypto.subtle.importKey('raw', client, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, keys.privateKey, 256));
  const ikm = await hkdf(b64u.dec(auth), shared, joinBytes(utf8('WebPush: info\0'), client, server), 32);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16), iv = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']), joinBytes(utf8(text), new Uint8Array([2]))));
  return joinBytes(salt, new Uint8Array([0, 0, 16, 0, 65]), server, body); // the header: salt, record size 4096, key length, key
}
async function vapidAuth(endpoint, d, nowSec = Math.floor(Date.now() / 1000)) {
  const pub = b64u.dec(VAPID_PUBLIC), key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d, x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = o => b64u.enc(utf8(JSON.stringify(o))), head = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: VAPID_SUB });
  return `vapid t=${head}.${b64u.enc(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(head)))}, k=${VAPID_PUBLIC}`;
}
const pushSender = d => async (t, text) => {
  if (!PUSH_HOSTS.test(t.endpoint)) return 410;
  const r = await fetch(t.endpoint, { method: 'POST', signal: AbortSignal.timeout(8000), body: await encryptPush(text, t.p256dh, t.auth),
    headers: { Authorization: await vapidAuth(t.endpoint, d), TTL: '3600', Urgency: 'normal', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' } });
  return r.status;
};

// The database through Supabase's REST API, with the service key the Edge Function gets from its environment
function restDb(url, key) {
  const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const q = async (path, init = {}) => { const r = await fetch(url + '/rest/v1/' + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
    if (!r.ok) throw new Error(path.split('?')[0] + ': ' + r.status + ' ' + (await r.text())); const t = await r.text(); return t ? JSON.parse(t) : null; };
  const inList = ids => 'in.(' + ids.join(',') + ')';
  const upsert = (table, conflict, rows) => rows.length ? q(table + '?on_conflict=' + conflict, { method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }) : null;
  return {
    hoods: only => q('lm_hoods?select=id,name,seed,days,difficulty,start_date,last_day,status&status=neq.done' + (only ? '&id=eq.' + only : '')),
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
    claimReminder: async (hood, day, slot) => (await q('lm_reminders?on_conflict=hood,day,slot', { method: 'POST', body: JSON.stringify([{ hood, day, slot }]), headers: { Prefer: 'resolution=ignore-duplicates,return=representation' } })).length > 0,
    // the devices of players on this street who want this reminder and haven't decided for that day
    pushTargets: async (hood, day, slot) => { const people = await q(`lm_members?select=id,user_id&hood=eq.${hood}&user_id=not.is.null`);
      if (!people.length) return [];
      const done = new Set((await q(`lm_decisions?select=member&member=${inList(people.map(m => m.id))}&day=eq.${day}`)).map(d => d.member)), users = people.filter(m => !done.has(m.id)).map(m => m.user_id);
      return users.length ? q(`lm_push?select=endpoint,p256dh,auth&user_id=${inList(users)}&${slot}=is.true`) : []; },
    dropPush: endpoint => q('lm_push?endpoint=eq.' + encodeURIComponent(endpoint), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
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
      const now = israelNow(), report = await tick(db, globalThis.LemonEngine, now, only), key = Deno.env.get('VAPID_KEY');
      const reminders = !only && key ? await remind(db, now, pushSender(key)).catch(e => ({ error: String(e && e.message || e) })) : [];
      return new Response(JSON.stringify({ ok: true, report, reminders }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { tick, israelNow, dayNumber, restDb, reminderFor, remind, encryptPush, vapidAuth, VAPID_PUBLIC };
