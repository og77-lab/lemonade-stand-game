// לימונדה בע״מ — the game engine: rules, formulas, the world and the day's simulation, with no screen code.
// The same file runs in the browser (window.LemonEngine, used by index.html) and on a server (module.exports).
(function(root){
const CUP=6,DAYS=10,CAP_BASE=30,CAP_STATION=70,CAP_TEAM=999,HELPER_B=20,HELPER_C=8,LOAN_INT=0.08;
const TP=[0,10,22,34,44,50,54],SR=[0,0,3,7,12,18,24],SW=[0,10,18,25,30,33,35];
const ITP=[0,0,-1,-3,-6,-12,-20],WTP=[0,0,-4,-10,-20,-32,-46],HFR=[0,-2,3,0,-3,-5,-5];
const crP=r=>r<=0.34?0:r<=0.5?0.05:r<=0.75?0.15:r<=1?0.3:0.5;
const CT={
 child:{nm:"ילדים",one:"ילד",em:"👦",tW:0.55,fW:0.45,sTh:8,sP:1.5,swI:[18,28],swP:0.5,pM:5,rI:[1,-1],pct:0.25},
 adult:{nm:"מבוגרים",one:"מבוגר",em:"🧑",tW:0.65,fW:0.35,sTh:15,sP:1,swI:[10,22],swP:1,pM:8,rI:[2,-2],pct:0.4},
 athlete:{nm:"ספורטאים",one:"ספורטאי",em:"🏃",tW:0.5,fW:0.5,sTh:12,sP:1,swI:[5,18],swP:1,pM:10,rI:[2,-2],pct:0.2},
 foodie:{nm:"שפים",one:"שף",em:"🧑‍🍳",tW:0.75,fW:0.25,sTh:25,sP:0.5,swI:[8,18],swP:1.5,pM:12,rI:[4,-5],pct:0.15},
};
const TYPES=Object.keys(CT);
const WE={sunny:{n:"שמש",em:"☀️",fm:1.1},nice:{n:"נעים",em:"🌤️",fm:1.2},cloudy:{n:"עננים",em:"☁️",fm:0.8},lRain:{n:"גשם קל",em:"🌦️",fm:0.5},
 hRain:{n:"גשם חזק",em:"🌧️",fm:0.2},hot:{n:"חם",em:"🥵",fm:1.05},heat:{n:"שרב",em:"🔥",fm:0.95},cold:{n:"קר",em:"🥶",fm:0.3}};
const tM=t=>t<15?0.25:t<18?0.4:t<21?0.65:t<25?0.9:t<29?1.2:t<32?1.45:t<35?1.65:1.55;
const softEnv=(t,fm,ev)=>Math.max(0.15,1+(tM(t)*fm-1)*0.9)*(ev||1);
const iFr=(ic,t)=>{const tb=t>=33?[0,0,12,22,30,35,38]:t>=28?[0,5,15,24,30,32,33]:t>=20?[0,15,22,27,28,28,28]:[0,25,27,24,18,12,8];return tb[Math.min(ic,5)];};
const tSc=(l,h,ic,wa,ct)=>{const tp=TP[l]*(1-crP(l>0?h/l:99))+ITP[ic]+WTP[wa];const sw=SW[h],sour=Math.max(0,SR[l]-0.5*sw),[lo,hi]=ct.swI;
 const sweet=sw<lo?-(lo-sw)*0.8*ct.swP:sw>hi?-(sw-hi)*ct.swP:6;return Math.max(0,Math.min(60,tp-Math.max(0,sour-ct.sTh)*ct.sP+sweet));};
const fSc=(ic,h,t)=>Math.min(40,Math.max(0,iFr(ic,t)+HFR[h]));
const freshW=t=>0.5+1.1*Math.min(1,Math.max(0,(t-16)/18));
const cSc=(l,h,ic,t,ct)=>{const wa=Math.max(0,CUP-l-h-ic),ts=tSc(l,h,ic,wa,ct),fr=fSc(ic,h,t),fw=ct.fW*freshW(t);return{sc:Math.round((ts*ct.tW+fr*fw)/(60*ct.tW+40*fw)*100),ts,fr};};
const heatF=t=>0.7+0.55*Math.min(1,Math.max(0,(t-14)/20));
let PM_EV=1;const setPM=v=>{PM_EV=v;}; // the day's event changes what people will pay
const pMt=(ct,t)=>ct.pM*heatF(t)*PM_EV;
const buyProb=(sc,pr,rep,ct,t)=>{const pM=pMt(ct,t);let pen=(pr/pM)*0.2;if(pr>pM)pen+=((pr-pM)/pM)*0.9;return Math.min(0.95,Math.max(0.03,(sc/100)*0.6+(rep/100)*0.15+0.35-pen));};
const rawQ=(r,T,mix)=>TYPES.reduce((s,k)=>s+mix[k]*cSc(r.l,r.h,r.i,T,CT[k]).sc,0);
const bestQ=(T,mix)=>{let b=1;for(let l=1;l<=CUP;l++)for(let h=0;l+h<=CUP;h++)for(let i=0;l+h+i<=CUP;i++)b=Math.max(b,rawQ({l,h,i},T,mix));return b;};
const relQ=(r,T,mix)=>Math.min(100,Math.round(rawQ(r,T,mix)/bestQ(T,mix)*100));
const VIP_Q=85;
const standAttr=(r,pr,rep,t)=>{const q=TYPES.reduce((s,k)=>s+CT[k].pct*cSc(r.l,r.h,r.i,t,CT[k]).sc,0),pM=TYPES.reduce((s,k)=>s+CT[k].pct*pMt(CT[k],t),0);
 return(0.5+q/100)*Math.exp(-1.2*(pr/pM-1))*(0.6+rep/100*0.8);};
const rng=s=>{let x=((s%2147483647)+2147483647)%2147483647;if(x===0)x=1;x=(x*16807)%2147483647;x=(x*16807)%2147483647;return()=>{x=(x*16807)%2147483647;return(x-1)/2147483646;};};

const LOC=[{id:0,n:"פינת רחוב",em:"🏚️",dm:0.65,rent:0,d:"שקט · ×0.65 מבקרים · חינם"},{id:1,n:"צד הרחוב",em:"🏠",dm:1.0,rent:3,d:"רגיל · ₪3 ליום"},{id:2,n:"מרכז הרחוב",em:"🏙️",dm:1.4,rent:8,d:"עמוס · ×1.4 מבקרים · ₪8 ליום"}];
const UPG_MKT=[{id:"sign",em:"🪧",n:"שלט גדול",c:15,d:"+15% מבקרים, כל יום"},{id:"shade",em:"⛱️",n:"סוכך",c:20,d:"+20% מבקרים בימים חמים"},{id:"cups",em:"🥤",n:"כוסות ממותגות",c:12,d:"+1 מוניטין כל יום"}];
const UPG_OPS=[{id:"juicer",em:"🔧",n:"מסחטה",c:25,d:"חוסכת לימון אחד לכל 10 כוסות",ad:2},{id:"cooler",em:"❄️",n:"מיכל קירור",c:18,d:"חצי מהקרח שורד ללילה",ad:2},
 {id:"station",em:"🏪",n:"עמדה נוספת",c:30,d:"מגישים עד 70 כוסות ביום",ad:3},{id:"team",em:"👥",n:"צוות מלא",c:50,d:"בלי הגבלת כוסות",ad:4}];
const MKTG=[{id:"flyer",em:"📄",n:"פליירים",c:5,dm:1.10,d:"+10% מבקרים היום"},{id:"banner",em:"🎈",n:"בלונים ושלטים",c:10,dm:1.18,d:"+18% מבקרים היום"},
 {id:"social",em:"📱",n:"פוסט ברשתות",c:7,dm:1.08,d:"+8% מבקרים, סיכוי ל-+2 מוניטין"},{id:"taste",em:"🎁",n:"טעימות חינם",c:3,dm:1,d:"+3 מוניטין אם הטעם טוב"}];
const BLACK=[{id:"ads",em:"📢",n:"קמפיין נגד המתחרה",c:8,d:"גונב 18% מהלקוחות שלו",risk:0},{id:"rumor",em:"🗣️",n:"הפצת שמועות",c:4,d:"−5 מוניטין למתחרה",risk:30},{id:"signs",em:"🚫",n:"הסרת השלטים שלו",c:6,d:"פחות חשיפה למתחרה",risk:40}];
const FORECAST=[{lv:1,em:"👂",n:"שמועות מהשכונה",c:2,ac:0.65,d:"מזג אוויר וטמפרטורה"},{lv:2,em:"📡",n:"תחזית מקצועית",c:5,ac:0.8,d:"מזג אוויר + האם יהיה אירוע"},{lv:3,em:"🛰️",n:"לווין",c:10,ac:0.95,d:"מזג אוויר + פרטי האירוע"}];
const RESEARCH_C=4,SPY_C=3;
const DIFF={easy:{n:'קלה',em:'🌱',d:'יותר לקוחות, מתחרה חלש',dm:1.3,npc:0.45,par:[1980,1620,1320,1080]},medium:{n:'בינונית',em:'⚖️',d:'מאוזן',dm:1,npc:0.65,par:[1620,1020,720,540]},hard:{n:'קשה',em:'🔥',d:'פחות לקוחות, מתחרה חזק',dm:0.8,npc:0.85,par:[1260,660,420,300]}};
const PRESETS=[{id:'classic',n:'קלאסי',r:{l:3,h:1,i:1},fit:'כולם'},{id:'kids',n:'מתוק לילדים',r:{l:2,h:2,i:1},fit:'👦 ילדים'},{id:'sport',n:'רענן לספורטאים',r:{l:3,h:0,i:3},fit:'🏃 ספורטאים'},
 {id:'chef',n:'עשיר לשפים',r:{l:4,h:1,i:1},fit:'🧑‍🍳 שפים'},{id:'hot',n:'קפוא ליום חם',r:{l:3,h:1,i:2},fit:'☀️ ימים חמים'}];
const sameR=(a,b)=>a.l===b.l&&a.h===b.h&&a.i===b.i;

// Street events: they hit every stand the same way (crowd, who comes, what they'll pay, fees, reputation)
const EVENTS=[
 {id:'fest',n:'🎪 פסטיבל ברחוב',dm:1.8,mix:{child:2.2},anim:'parade',fx:['🎪','🎈','🤹','🎠'],d:'המון משפחות ברחוב'},
 {id:'marathon',n:'🏃 מרתון בשכונה',dm:1.6,mix:{athlete:3.5},anim:'run',fx:['🏃‍♀️','🏃','🏃‍♂️','🏅'],d:'המון ספורטאים צמאים'},
 {id:'roadworks',n:'🚧 עבודות בכביש',dm:0.5,anim:'shake',fx:['🚧','👷','🚜'],d:'הרחוב חסום חלקית: חצי מהעוברים ושבים'},
 {id:'concert',n:'🎵 הופעה בפארק',dm:1.7,mix:{adult:1.7},anim:'pop',fx:['🎵','🎸','🎤','🎶'],d:'הרבה מבוגרים בדרך להופעה'},
 {id:'blackout',n:'⚡ הפסקת חשמל',dm:0.6,anim:'flicker',fx:['💡','⚡','🔦'],d:'החנויות סגורות ופחות אנשים יוצאים'},
 {id:'trip',n:'🚌 טיול שנתי',dm:1.5,mix:{child:3},pm:0.85,anim:'drive',fx:['🚌'],d:'אוטובוסים של ילדים, עם מעט כסף בכיס'},
 {id:'tourists',n:'📸 קבוצת תיירים',dm:1.4,mix:{adult:1.4,foodie:1.6},pm:1.3,anim:'drive',fx:['🚐','📸','🗺️'],d:'תיירים שמוכנים לשלם יותר'},
 {id:'foodfest',n:'🍽️ פסטיבל אוכל',dm:1.3,mix:{foodie:3},pm:1.2,anim:'pop',fx:['🍽️','🧑‍🍳','🥘','🍰'],d:'המון שפים: רוצים כוס מעולה ומשלמים עליה'},
 {id:'football',n:'⚽ משחק באצטדיון',dm:1.6,mix:{adult:1.4,athlete:1.4},anim:'bounce',fx:['⚽','📣','🏟️'],d:'אוהדים צמאים בדרך למשחק'},
 {id:'market',n:'🛍️ יום שוק',dm:1.3,pm:0.9,anim:'pop',fx:['🛍️','🧺','🍅','🥖'],d:'הרבה קונים, כולם מחפשים מציאות'},
 {id:'healthy',n:'📰 כתבה: לימונדה בריאה!',dm:1.15,rep:3,anim:'spin',fx:['📰','🍋','💪'],d:'+3 מוניטין לכל הדוכנים, ועוד קצת קונים'},
 {id:'flu',n:'🤧 גל שפעת',dm:0.7,mix:{child:0.5},anim:'shake',fx:['🤧','🌡️','💊'],d:'הרבה נשארים בבית, בעיקר ילדים'},
 {id:'graduation',n:'🎓 טקס סיום',dm:1.4,mix:{child:1.8,adult:1.2},anim:'pop',fx:['🎓','🎉','📜'],d:'משפחות חוגגות ברחוב'},
 {id:'beach',n:'🏖️ כולם בים',dm:0.6,anim:'drive',fx:['🏖️'],d:'השכונה מתרוקנת'},
 {id:'fire',n:'🚒 תרגיל כבאות',dm:0.7,anim:'drive',fx:['🚒'],d:'הרחוב סגור לכמה שעות'},
 {id:'payday',n:'💸 יום משכורת',dm:1.1,pm:1.25,anim:'rain',fx:['💸','💰','🪙'],d:'לכולם יש כסף בכיס: מוכנים לשלם יותר'},
 {id:'tax',n:'🧾 ביקורת מס ברחוב',cost:5,anim:'stamp',fx:['🧾'],d:'כל דוכן משלם אגרה של ₪5'},
 {id:'movie',n:'🎬 צילומי סרט ברחוב',dm:1.3,mix:{adult:1.3},rep:2,anim:'pop',fx:['🎬','🎥','⭐'],d:'סקרנים ברחוב, ו-+2 מוניטין לכולם'},
 {id:'bike',n:'🚴 יום אופניים עירוני',dm:1.3,mix:{athlete:2.5},anim:'run',fx:['🚴','🚴‍♀️','🚲'],d:'רוכבים צמאים ברחוב'},
 {id:'scare',n:'🦠 שמועה על הרעלת מזון',dm:0.75,rep:-3,anim:'shake',fx:['🦠','😷'],d:'אנשים חוששים: −3 מוניטין לכל הדוכנים'}];
const evGood=e=>e.good!==undefined?e.good:(e.dm||1)>=1&&(e.rep||0)>=0&&!e.cost;
// Evening market events: tonight's prices or tonight's intel, the same for every stand
const MEV=[{id:'lshort',n:'🍋 מחסור בלימונים',m:{l:1.7},d:'לימונים יקרים הלילה: ×1.7',anim:'shake',fx:['🍋','📉','😱'],good:false},
 {id:'ltruck',n:'🚚 משאית לימונים הגיעה',m:{l:0.6},d:'לימונים בזול הלילה: −40%',anim:'drive',fx:['🚚','🍋','🍋'],good:true},
 {id:'sugar',n:'🍬 מבצע סוכר',m:{h:0.55},d:'סוכר כמעט בחצי מחיר הלילה',anim:'rain',fx:['🍬','🏷️'],good:true},
 {id:'icebreak',n:'🧊 מכונת הקרח התקלקלה',m:{i:2.5},d:'קרח יקר פי 2.5 הלילה',anim:'flicker',fx:['🧊','🔧','💥'],good:false},
 {id:'farmers',n:'🌾 שוק איכרים',m:{l:0.75,h:0.75,i:0.75},d:'הכל זול ב-25% הלילה',anim:'parade',fx:['🌾','🧺','🍋','🥕'],good:true},
 {id:'prices',n:'📈 עליית מחירים',m:{l:1.3,h:1.3,i:1.3},d:'הכל יקר ב-30% הלילה',anim:'shake',fx:['📈','💸'],good:false},
 {id:'solar',n:'🛰️ סערה סולארית',acc:-0.2,d:'הלוויינים משתבשים: כל התחזיות הלילה פחות מדויקות (−20%)',anim:'flicker',fx:['🛰️','⚡','📡'],good:false},
 {id:'survey',n:'📋 מבצע בחברת הסקרים',res:2,d:'סקר שוק מחר בבוקר ב-₪2 בלבד',anim:'pop',fx:['📋','🏷️','📊'],good:true}];

// Midday surprises: the weather turns in the afternoon (a good forecast can warn you); a stand owner can fall ill and close early
const SUR={shower:{id:'shower',n:'🌧️ ממטר פתאומי אחר הצהריים',f:0.35,wx:'lRain'},heat:{id:'heat',n:'🔥 גל חום פתאומי אחר הצהריים',f:1.5,wx:'heat'}};
const PERSONAS=[{id:'budget',n:'אבי הזול',em:'💸',tag:'קונה לימונים בסיטונאות ומוכר הכי זול ברחוב',pb:-1.6,r:{l:2,h:1,i:1}},{id:'premium',n:'שף מוריס',em:'👨‍🍳',tag:'עזב מסעדה ופתח דוכן גורמה: לימונדה עשירה ויקרה',pb:2.4,r:{l:4,h:1,i:1}},
 {id:'steady',n:'דוד יוסי',em:'🧓',tag:'מוכר לימונדה באותה פינה 20 שנה: קלאסי, בלי הפתעות',pb:0,r:{l:3,h:1,i:1}},{id:'trendy',n:'נועה הטרנדית',em:'😎',tag:'לימונדה קפואה עם הרבה קרח, הכל לאינסטגרם, קצת יקרה',pb:0.6,r:{l:3,h:1,i:2}},
 {id:'gambler',n:'מוטי המהמר',em:'🎲',tag:'משנה מחיר ומתכון כל יום, אף פעם לא יודעים מה יהיה',pb:0,r:null},{id:'veteran',n:'סבתא רחל',em:'👵',tag:'מכינה לפי המתכון של סבתא שלה: עשירה בלימון ואיכותית',pb:0.3,r:{l:4,h:1,i:2}}];

// Rival strategies: chance to use each option (scaled by difficulty), and the order they buy upgrades in
const AI={budget:{fc:[0.45,1],rs:0.1,spy:0.6,mk:{flyer:0.55,banner:0.05,social:0.1,taste:0},bh:{ads:0.12,rumor:0.15,signs:0.1},up:['juicer','cups'],hp:0.1},
 premium:{fc:[0.9,3],rs:0.8,spy:0.2,mk:{flyer:0.1,banner:0.2,social:0.3,taste:0.6},bh:{},up:['shade','cups','station','sign'],hp:0.4},
 steady:{fc:[0.8,2],rs:0.2,spy:0.1,mk:{flyer:0.4,banner:0.1,social:0,taste:0.1},bh:{},up:['sign','juicer'],hp:0.2},
 trendy:{fc:[0.6,2],rs:0.3,spy:0.4,mk:{flyer:0.2,banner:0.5,social:0.9,taste:0.2},bh:{ads:0.3},up:['sign','cups','shade','station'],hp:0.3},
 gambler:{fc:[0.4,1],rs:0.2,spy:0.3,mk:{flyer:0.3,banner:0.4,social:0.3,taste:0.2},bh:{ads:0.3,rumor:0.4,signs:0.35},up:['sign','team'],hp:0.3},
 veteran:{fc:[0.9,2],rs:0.5,spy:0.2,mk:{flyer:0.3,banner:0.15,social:0.05,taste:0.4},bh:{},up:['shade','cups','juicer','station'],hp:0.5}};
const SMART={easy:0.55,medium:0.8,hard:1};
const ALL_UPS=[...UPG_MKT,...UPG_OPS],MK_EM=Object.fromEntries([...MKTG,...BLACK].map(x=>[x.id,x.em]));

// The 10-day world: weather, prices and events, fixed by a seed
const buildWorld=seed=>{const r=rng(seed);const days=[];let p={l:0.5,h:0.45,i:0.1};
 for(let d=0;d<=DAYS+1;d++){const t=Math.round(13+r()*25);const w=t>=35?'heat':t>=30?(r()<0.5?'sunny':'hot'):t>=25?(r()<0.5?'sunny':'nice'):t>=21?['sunny','nice','cloudy'][Math.floor(r()*3)]:t>=18?(r()<0.5?'cloudy':'lRain'):['lRain','hRain','cold'][Math.floor(r()*3)];
  const dr=(v,b,mn,mx)=>Math.round(Math.max(mn,Math.min(mx,v+(r()-0.5)*0.3*b))*100)/100;p={l:dr(p.l,0.5,0.3,0.8),h:dr(p.h,0.45,0.3,0.6),i:dr(p.i,0.1,0.05,0.2)};
  const ev=d>0&&r()<0.4?EVENTS[Math.floor(r()*EVENTS.length)]:null;const vip=d>=2&&r()<0.28,insp=d>=2&&!vip&&r()<0.12;
  const mev=d>=1&&r()<0.22?MEV[Math.floor(r()*MEV.length)]:null,pm=mev&&mev.m||{},pp={l:Math.round(p.l*(pm.l||1)*100)/100,h:Math.round(p.h*(pm.h||1)*100)/100,i:Math.round(p.i*(pm.i||1)*100)/100};
  const dry=!['lRain','hRain','cold'].includes(w),sr=r(),sur=d>=2&&dry&&sr<0.09?(t<=33&&sr<0.05?SUR.shower:t>=22&&t<=34?SUR.heat:null):null;
  const sick=[0,1,2,3].map(()=>d>=2&&r()<0.025);
  days.push({t,w,p:pp,ev,vip,insp,mev,sur,sick});}
 return days;};

// ───────── The day: rival stands, the street's demand, your stand, and the evening's accounts ─────────
// Every function takes a day context (dayCtx) built from the game state, so the screen and the server run the same code.
const DOW=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'],dowOf=d=>DOW[(d-1)%7];
const mixOf=(world,d,l)=>{const w=world[d],m={child:.25,adult:.4,athlete:.2,foodie:.15},why=[];
 if((d-1)%7>=5){m.child*=2.2;why.push(`${dowOf(d)} — הרבה ילדים בחוץ`);}
 if(l===2){m.foodie*=2;m.adult*=1.2;why.push('מרכז הרחוב — יותר שפים');}else if(l===0){m.child*=1.5;m.foodie*=0.5;why.push('פינת רחוב — יותר ילדים, פחות שפים');}
 if(w.ev){if(w.ev.mix)Object.entries(w.ev.mix).forEach(([k,x])=>{m[k]*=x;});why.push(w.ev.n+' — '+w.ev.d);}
 if(w.t>=30){m.athlete*=1.4;why.push('חם — יותר ספורטאים צמאים');}
 const s=TYPES.reduce((x,k)=>x+m[k],0);TYPES.forEach(k=>m[k]=m[k]/s);return{m,why};};
// Which characters run the other stands (fixed for the whole game)
const rivalsOf=seed=>{const r=rng(seed*7+3),p=[...PERSONAS];for(let k=p.length-1;k>0;k--){const j=Math.floor(r()*(k+1));[p[k],p[j]]=[p[j],p[k]];}return p;};
// g: seed, world, day, diff, nComp, loc, recipe, price, rep, acts, ups, helper, vipBoost, rv (the rival stands' state), myTot, myLastPrice
const dayCtx=g=>{const W=g.world[g.day],MV=g.world[g.day-1].mev;PM_EV=(W.ev&&W.ev.pm)||1;
 return{...g,W,tP:g.world[g.day-1].p,MV,RES_C:(MV&&MV.res)||RESEARCH_C,acAdj:f=>Math.max(0.35,f.ac+((MV&&MV.acc)||0)),
  temp:W.t,wInfo:WE[W.w],MIX:mixOf(g.world,g.day,g.loc).m,comps:rivalsOf(g.seed).slice(0,g.nComp),withComp:g.nComp>0,
  rvS:i=>g.rv[i]||{cash:80,rep:50,ups:[],tot:0}};};

// ── Rival stands: each one has its own cash, reputation and upgrades, and decides every day by its character ──
const hitOn=(all,who,id)=>all.filter(o=>o.i!==who&&o.bh.some(x=>x.id===id&&!x.caught&&x.target===who));
const rivalAttr=(c,b,all,T)=>standAttr(b.rec,b.pr,b.st.rep,T)*(c.acts.includes('signs')?0.8:1)*Math.pow(0.8,hitOn(all,b.i,'signs').length);
const rivalBoost=(b,T)=>b.mk.reduce((m,id)=>m*(MKTG.find(x=>x.id===id)?.dm||1),1)*(b.ups.includes('sign')?1.15:1)*(b.ups.includes('shade')&&T>=28?1.2:1)*(0.7+b.st.rep/100*0.6)*(b.st.boost?1.3:1);
const myAttr=(c,r,pr,T,all)=>standAttr(r,pr,c.rep,T)*Math.pow(0.8,hitOn(all,'me','signs').length);
const rivalDemand=(c,b,all,T,fm,evm,meOff)=>{const street=60*softEnv(T,fm,evm)*LOC[c.loc].dm*DIFF[c.diff].dm,npc=DIFF[c.diff].npc;
 const den=Math.max(0.01,(meOff?0:myAttr(c,c.recipe,c.price,T,all))+npc*all.reduce((s,o)=>s+rivalAttr(c,o,all,T),0));
 const steal=hitOn(all,b.i,'ads').length+(c.acts.includes('ads')?1:0);
 const vis=street*rivalBoost(b,T)*npc*rivalAttr(c,b,all,T)/den*Math.pow(0.82,steal);
 const br=TYPES.reduce((s,k)=>s+c.MIX[k]*buyProb(cSc(b.rec.l,b.rec.h,b.rec.i,T,CT[k]).sc,b.pr,b.st.rep,CT[k],T),0);
 return{vis:Math.round(vis),br,sold:Math.round(vis*br)};};
const planRivals=c=>{const {seed,world,day,diff,nComp,loc,comps,rvS,acAdj,RES_C,myTot,myLastPrice}=c;const S=SMART[diff],w=world[day],T=w.t,P=world[day-1].p;
 const all=comps.map((p,i)=>{const st=rvS(i),ai=AI[p.id],rr=rng(seed*13+day*101+i*7),fee=((w.ev&&w.ev.cost)||0)+(w.insp?8:0),cost={rent:LOC[loc].rent,fine:fee},news=[];let cash=st.cash-LOC[loc].rent-fee;
  const spend=(k,c)=>{if(c>cash)return false;cash-=c;cost[k]=(cost[k]||0)+c;return true;};
  const ups=[...st.ups],nx=ai.up.map(id=>ALL_UPS.find(u=>u.id===id)).find(u=>u&&!ups.includes(u.id)&&(!u.ad||u.ad<=day));
  if(nx&&cash>=nx.c+35&&rr()<0.45*S&&spend('ups',nx.c)){ups.push(nx.id);news.push(nx.id);}
  let fc=null;if(rr()<ai.fc[0]*S){const f=FORECAST[ai.fc[1]-1];if(cash>=f.c+20&&spend('intel',f.c))fc=f;}
  const Test=fc?Math.round(T+(rr()-0.5)*2*(1-acAdj(fc))*12):24,wEst=fc?w.w:'nice',evEst=fc&&fc.lv>=2&&w.ev?w.ev.dm:1;
  const rs=rr()<ai.rs*S&&cash>=RES_C+20&&spend('intel',RES_C),spy=rr()<ai.spy*S&&cash>=SPY_C+20&&spend('intel',SPY_C);
  const rec=p.r?{...p.r}:{l:2+Math.floor(rr()*3),h:Math.floor(rr()*3),i:Math.floor(rr()*3)},Tk=rs?T:Test;
  if(rs&&Tk>=30&&rec.l+rec.h+rec.i<CUP)rec.i++;
  let pr=TYPES.reduce((s,k)=>s+CT[k].pct*pMt(CT[k],Tk),0)*0.95+(rs?p.pb*0.5:p.pb)+(p.r?0:(rr()-0.5)*6);
  if(spy){if(p.id==='budget')pr=Math.min(pr,myLastPrice-1);else if(p.id!=='premium')pr=(pr*2+myLastPrice)/3;}
  pr=Math.max(2,Math.round(pr));
  const hype=(Test>=28?1.25:1)*(evEst>1?1.4:1),mk=[];
  const pre=60*softEnv(Test,WE[wEst].fm,evEst)*LOC[loc].dm*DIFF[diff].dm*DIFF[diff].npc/(1+DIFF[diff].npc*Math.max(1,nComp))*0.55; // cups they expect to sell
  const worth=m=>m.id==='taste'?rec.l>=3:pre*(m.dm-1)*pr>=m.c*0.8; // smart rivals skip what won't pay back
  MKTG.forEach(m=>{if(rr()<(ai.mk[m.id]||0)*hype&&(worth(m)||rr()>S)&&cash>=m.c+20&&spend('mkt',m.c))mk.push(m.id);});
  const bh=[];Object.entries(ai.bh).forEach(([id,pp])=>{const b=BLACK.find(x=>x.id===id);if(rr()<pp*(0.6+0.4*S)&&cash>=b.c+20&&spend('bh',b.c))bh.push({id,caught:rr()*100<b.risk});});
  const baseCap=ups.includes('team')?999:ups.includes('station')?70:30;
  const helper=pre*1.1>baseCap*0.85&&rr()<ai.hp*S*((Test>=28||evEst>1)?1.6:0.6)+0.3*(1-S)&&cash>=HELPER_C+20&&spend('helper',HELPER_C);
  return{...p,i,st:{...st},ups,news,fc,rs,spy,rec,pr,mk,bh,helper,Test,wEst,evEst,cash,cost};});
 // dirty tricks go against whoever leads (you included)
 const totals=[{who:'me',tot:myTot},...all.map(b=>({who:b.i,tot:b.st.tot}))];
 all.forEach(b=>b.bh.forEach(x=>{x.target=totals.filter(t=>t.who!==b.i).sort((p,q)=>q.tot-p.tot)[0].who;}));
 // cups: from what they think the day looks like (a forecast makes this much better)
 all.forEach(b=>{b.cap=(b.ups.includes('team')?999:b.ups.includes('station')?70:30)+(b.helper?HELPER_B:0);
  b.unit=b.rec.l*P.l*(b.ups.includes('juicer')?0.9:1)+b.rec.h*P.h+b.rec.i*P.i*(b.ups.includes('cooler')?0.75:1);
  const est=rivalDemand(c,b,all,b.Test,WE[b.wEst].fm,b.evEst);if(w.sur&&b.fc&&b.fc.lv>=2){const k=b.fc.lv===3?0.5:0.25;est.sold=Math.round(est.sold*(1-k+k*w.sur.f));}
  b.cups=Math.max(0,Math.min(b.cap,Math.round(est.sold*1.1),Math.floor(Math.max(0,b.cash)/Math.max(0.01,b.unit))));
  b.cost.stock=Math.round(b.cups*b.unit*10)/10;b.cash-=b.cost.stock;});
 return all;};
const rivalsFor=(c,plans,T=c.temp)=>plans.map(b=>({...b,attr:rivalAttr(c,b,plans,T)}));

// ── Your stand: how many come, who buys, and why ──
const visitorsFor=(c,plans,r,pr,T=c.temp,fm=c.wInfo.fm,evm=c.W.ev?.dm,o={})=>{const {acts,rep,loc,ups,vipBoost,diff,withComp,temp}=c;const boost=acts.reduce((m,id)=>m*(MKTG.find(a=>a.id===id)?.dm||1),1);
 const dm=60*softEnv(T,fm,evm)*boost*(0.7+rep/100*0.6)*LOC[loc].dm*(ups.includes('sign')?1.15:1)*(ups.includes('shade')&&T>=28?1.2:1)*(vipBoost&&T===temp?1.3:1)*DIFF[diff].dm*(o.wx||1);
 const my=myAttr(c,r,pr,T,plans),them=rivalsFor(c,plans,T).filter((x,i)=>!(o.sickR&&o.sickR[i])).reduce((s,x)=>s+x.attr,0);
 const share=withComp?1/(1+DIFF[diff].npc*them/my):1;return Math.max(3,Math.round((dm*share+(withComp&&acts.includes('ads')?dm*(1-share)*0.18:0))*Math.pow(0.82,hitOn(plans,'me','ads').length)));};
const whyOf=(c,ct,r,pr,T=c.temp)=>{const w=CUP-r.l-r.h-r.i,sw=SW[r.h],sour=Math.max(0,SR[r.l]-0.5*sw),ratio=pr/pMt(ct,T),fr=fSc(r.i,r.h,T);
 if(ratio>1.2)return['יקר להם','bad'];if(w>=3)return['מימי מדי','bad'];if(sour>ct.sTh)return['חמוץ להם','bad'];if(sw>ct.swI[1])return['מתוק מדי','warn'];
 if(sw<ct.swI[0])return['רוצים מתוק יותר','warn'];if(T>=28&&fr<20)return['רוצים יותר קרח','warn'];if(ratio>1)return['קצת יקר','warn'];if(r.l<=2)return['טעם חלש','warn'];return['אוהבים ✓','good'];};
const perType=(c,plans,r,pr,T=c.temp,fm,evm)=>{const v=visitorsFor(c,plans,r,pr,T,fm,evm);return TYPES.map(k=>{const ct=CT[k],s=cSc(r.l,r.h,r.i,T,ct),p=buyProb(s.sc,pr,c.rep,ct,T),vis=Math.round(v*c.MIX[k]);return{k,c:ct,p,vis,buy:Math.round(vis*p),why:whyOf(c,ct,r,pr,T)};});};
const buyersFor=(c,plans,r,pr,T,fm,evm)=>perType(c,plans,r,pr,T,fm,evm).reduce((s,x)=>s+x.buy,0);

// Your day, customer by customer (the street scene plays this list)
const playerDay=(c,plans,closed,cups,quality)=>{const {seed,day,acts,W,comps,temp,wInfo,recipe,price,rep,ups,MIX}=c;
 const r=rng(seed+day*977);const list=[];let sold=0,rev=0,repD=0,walk=0,miss=0;
 const byType=Object.fromEntries(TYPES.map(k=>[k,{vis:0,buy:0,miss:0}])),whys=Object.fromEntries(perType(c,plans,recipe,price).map(x=>[x.k,x.why]));
 const ro=rng(seed+day*55),rumor=acts.includes('rumor')?(ro()<0.3?'caught':'ok'):null,signs=acts.includes('signs')?(ro()<0.4?'caught':'ok'):null;
 const sur=W.sur,sick=W.sick||[],sickR=comps.map((_,i)=>!!sick[i+1]),meSick=!!sick[0]&&!closed,rf=rumor==='ok'?1.06:1;
 const vA=closed?0:Math.round(visitorsFor(c,plans,recipe,price)*rf*0.5),vB=closed?0:Math.round(visitorsFor(c,plans,recipe,price,temp,wInfo.fm,W.ev?.dm,{wx:sur?sur.f:1,sickR})*rf*0.5),v=vA+vB,c0=closed?0:cups;
 let vip=null;const vipAt=W.vip&&!closed?Math.floor(vA/2):-1;
 for(let i=0;i<v;i++){if(i===vipAt){if(sold<c0){sold++;rev+=price;vip=quality>=VIP_Q;repD+=vip?8:-6;list.push({id:9999,type:'foodie',em:'🎩',buys:true,rx:vip?'🌟':'😤',isVip:true,sp:''});}
   else{vip=false;repD-=6;list.push({id:9999,type:'foodie',em:'🎩',buys:false,rx:'💨',isVip:true,sp:'נגמרו הכוסות'});}}
  let roll=r(),k='adult',cum=0;for(const t of TYPES){cum+=MIX[t];if(roll<cum){k=t;break;}}
  const ct=CT[k],s=cSc(recipe.l,recipe.h,recipe.i,temp,ct),wants=r()<buyProb(s.sc,price,rep,ct,temp),shut=i>=vA&&meSick,buys=wants&&sold<c0&&!shut;byType[k].vis++;
  let rx='🚶';if(buys){sold++;rev+=price;byType[k].buy++;rx=s.ts>35?'😊':s.ts>20?'🙂':s.ts>10?'😐':'😕';repD+=s.ts>35?ct.rI[0]:s.ts>20?1:s.ts>10?0:-1;}else if(wants&&!shut){rx='💨';miss++;byType[k].miss++;}else walk++;
  list.push({id:i,type:k,em:ct.em,buys,rx,isVip:false,sp:shut?'סגור':''});}
 repD=Math.max(-10,Math.min(10,repD))-Math.min(6,miss*2)+(ups.includes('cups')?1:0);
 let fine=0;if(rumor==='caught'){repD-=8;fine+=10;}if(signs==='caught'){repD-=15;fine+=15;}
 const usedL=c0*recipe.l-(ups.includes('juicer')?Math.floor(c0/10):0);
 return{list,shown:[],sold:0,rev:0,walk:0,done:closed,mid:closed?null:vA+(vipAt>=0?1:0),midSur:sur&&!closed?sur:null,meSick,sickR,result:{sold,rev,repD,walk,miss,visitors:v,usedL,cups:c0,byType,whys,vip,rumor,signs,fine,closed:!!closed,sur:closed?null:sur,meSick}};};

// The evening's accounts: stock left, the rivals' day (same rules and costs as yours), and reputation
// s: lemons, lm, sugar, ice, loan, spentToday, actCost
const settleDay=(c,plans,R,s)=>{const {seed,day,W,temp,wInfo,MIX,recipe,ups,loc,helper,rep}=c;
 let rem=Math.min(R.usedL,s.lm);const nl=[];for(const b of s.lemons){if(rem<=0){nl.push(b);continue;}if(b.q<=rem)rem-=b.q;else{nl.push({...b,q:b.q-rem});rem=0;}}
 const kept=nl.filter(b=>day+1-b.d<3),spoiled=nl.reduce((x,b)=>x+b.q,0)-kept.reduce((x,b)=>x+b.q,0);
 const sugar=Math.max(0,s.sugar-R.cups*recipe.h),ice=ups.includes('cooler')?Math.floor(Math.max(0,s.ice-R.cups*recipe.i)/2):0;
 const dayCash=(R.closed?0:s.actCost+LOC[loc].rent)+(helper?HELPER_C:0)+R.fine+((W.ev&&W.ev.cost)||0),interest=s.loan*LOAN_INT;
 const profit=R.rev-s.spentToday-dayCash-interest;
 const myRumorOn=R.rumor==='ok'&&plans.length?plans.slice().sort((p,q)=>q.st.tot-p.st.tot)[0].i:null;
 const rres=plans.map(b=>{const d0=b.cups>0?rivalDemand(c,b,plans,temp,wInfo.fm,W.ev?.dm,R.closed):{vis:0,br:0,sold:0},sickB=!!(W.sick||[])[b.i+1],aft=0.5+0.5*(sickB?0:(W.sur?W.sur.f:1));
  const d={...d0,vis:Math.round(d0.vis*aft),sold:Math.round(d0.sold*aft)};
  const sold=Math.min(d.sold,b.cups),miss=Math.max(0,d.sold-b.cups),fines=b.bh.filter(x=>x.caught).reduce((x,y)=>x+(y.id==='rumor'?10:y.id==='signs'?15:0),0);
  const rev=sold*b.pr,spent=Object.values(b.cost).reduce((x,y)=>x+y,0)+fines,profit=Math.round((rev-spent)*10)/10,rr=rng(seed*17+day*31+b.i);
  const vipT=W.vip&&sold>0?relQ(b.rec,temp,MIX)>=VIP_Q:null;
  let rd=((W.ev&&W.ev.rep)||0)+(vipT===true?8:vipT===false?-6:0)+Math.max(-6,Math.min(6,Math.round(sold*(d.br-0.45)*0.4)))-Math.min(6,miss)+(b.ups.includes('cups')?1:0)+(b.mk.includes('taste')&&b.rec.l>=3?3:0)+(b.mk.includes('social')&&rr()<0.5?2:0)
   -5*hitOn(plans,b.i,'rumor').length-(myRumorOn===b.i?5:0)-b.bh.filter(x=>x.caught).reduce((x,y)=>x+(y.id==='rumor'?8:y.id==='signs'?15:0),0);
  const nrep=Math.max(0,Math.min(100,Math.round(b.st.rep+rd+(50-b.st.rep-rd)*0.06)));
  return{b,sold,vis:d.vis,miss,rev,profit,fines,nrep,vipT,sickB,cash:Math.round((b.cash+rev-fines)*10)/10};});
 const rv=rres.map(x=>({cash:x.cash,rep:x.nrep,ups:x.b.ups,tot:x.b.st.tot+x.profit,boost:x.vipT===true}));
 const onMe=id=>plans.filter(b=>b.bh.some(x=>x.id===id&&x.target==='me'));
 const rumorsOnMe=onMe('rumor').filter(b=>!b.bh.find(x=>x.id==='rumor').caught).length;
 const newRep=Math.max(0,Math.min(100,rep+R.repD-5*rumorsOnMe+((W.ev&&W.ev.rep)||0)+Math.round((50-rep-R.repD)*0.06)));
 return{lemons:kept,spoiled,sugar,ice,dayCash,interest,profit,rres,rv,onMe,newRep};};

// A forecast bought tonight for tomorrow: right with the forecast's accuracy, and when wrong it still fits the temperature
const makeForecast=(c,f)=>{const {seed,day,world,acAdj}=c;
 const r=rng(seed+day*31+f.lv),ac=acAdj(f),S0=world[day].sur;const ok=r()<ac;const mag=f.lv===1?4+Math.floor(r()*7):f.lv===2?2+Math.floor(r()*4):1+Math.floor(r()*2);
 const tt=ok?world[day].t:Math.max(10,Math.min(40,world[day].t+(r()<0.5?-1:1)*mag)),keys=Object.keys(WE);
 const surTxt=S0&&f.lv===3?S0.n:S0&&f.lv===2?'מזג אוויר הפכפך אחר הצהריים':null;
 return{lv:f.lv,ac,surTxt,t:tt,w:ok?world[day].w:f.lv===1?keys[Math.floor(r()*keys.length)]:(tt>=30?'hot':tt>=25?'sunny':tt>=21?'nice':tt>=18?'cloudy':'lRain'),ev:f.lv>=2?(world[day].ev?(f.lv===3?world[day].ev.n:'צפוי אירוע מיוחד'):'לא צפוי אירוע')+(surTxt?' · '+surTxt:''):null};};

const LemonEngine={CUP,DAYS,CAP_BASE,CAP_STATION,CAP_TEAM,HELPER_B,HELPER_C,LOAN_INT,TP,SR,SW,ITP,WTP,HFR,crP,CT,TYPES,WE,tM,softEnv,iFr,tSc,fSc,freshW,cSc,heatF,setPM,pMt,buyProb,rawQ,bestQ,relQ,VIP_Q,standAttr,rng,
 LOC,UPG_MKT,UPG_OPS,MKTG,BLACK,FORECAST,RESEARCH_C,SPY_C,DIFF,PRESETS,sameR,EVENTS,evGood,MEV,SUR,PERSONAS,AI,SMART,ALL_UPS,MK_EM,buildWorld,
 DOW,dowOf,mixOf,rivalsOf,dayCtx,hitOn,rivalDemand,planRivals,rivalsFor,visitorsFor,whyOf,perType,buyersFor,playerDay,settleDay,makeForecast};
if(typeof module!=='undefined'&&module.exports)module.exports=LemonEngine;else root.LemonEngine=LemonEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
