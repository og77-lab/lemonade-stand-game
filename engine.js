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
const buildWorld=(seed,len=DAYS)=>{const r=rng(seed);const days=[];let p={l:0.5,h:0.45,i:0.1};
 for(let d=0;d<=len+1;d++){const t=Math.round(13+r()*25);const w=t>=35?'heat':t>=30?(r()<0.5?'sunny':'hot'):t>=25?(r()<0.5?'sunny':'nice'):t>=21?['sunny','nice','cloudy'][Math.floor(r()*3)]:t>=18?(r()<0.5?'cloudy':'lRain'):['lRain','hRain','cold'][Math.floor(r()*3)];
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

// ───────── Neighborhood (multiplayer): up to 10 equal stands on one street, a real day from 08:00 to 17:00 ─────────
// The server runs the whole day at 08:00 and keeps every moment with its minute; players see each moment once its time has come.
const NB={OPEN:8,CLOSE:17,MAX:10,START_CASH:80,
 HOURS:[0.5,0.6,0.75,0.95,1.2,1.1,1.3,1.5,1.8], // crowd by hour, 08:00–16:00 (the peak comes after school and work)
 CROWD:0.85,  // the street's crowd grows with the stands on it, a little slower than their number
 STAY:0.75,   // share of walkers who only look at the stands in their own part of the street
 RETRY:0.6,   // a walker who found a stand sold out or closed tries another one
 SECURITY:[{lv:0,em:'👥',n:'בלי אבטחה',c:0,catch:0.05,know:0},{lv:1,em:'👀',n:'שומר',c:3,catch:0.3,know:0.5},
  {lv:2,em:'📹',n:'מצלמות',c:6,catch:0.55,know:0.8},{lv:3,em:'🕵️',n:'בלש',c:10,catch:0.8,know:1}],
 ESCALATE:0.05, // every dirty trick earlier in the game makes the next one easier to catch
 GENERAL:{cost:0.6,power:0.5}, // a trick against everyone: 60% of the price per rival, half the effect on each
 CAUGHT:{rep:[15,25],fine:[10,20]}, // caught: reputation and fine, targeted / against everyone
 SYMPATHY:3};
const hhmm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const nbCap=(ups,helper)=>(ups.includes('team')?CAP_TEAM:ups.includes('station')?CAP_STATION:CAP_BASE)+(helper?HELPER_B:0);
const newStand=()=>({cash:NB.START_CASH,lemons:[{q:40,d:1}],sugar:0,ice:0,rep:50,ups:[],loan:0,tot:0,tricks:0,paper:false});
const trickCost=(id,target,n)=>{const b=BLACK.find(x=>x.id===id);return target==='all'?Math.round(b.c*NB.GENERAL.cost*Math.max(1,n-1)):b.c;};
const nbAcAdj=(world,day)=>f=>Math.max(0.35,f.ac+((world[day-1].mev&&world[day-1].mev.acc)||0));
// A forecast for the coming day: everyone who buys the same level gets the same forecast
const nbForecast=(seed,world,day,lv)=>makeForecast({seed,day,world,acAdj:nbAcAdj(world,day)},FORECAST[lv-1]);

// The evening's choices become a plan for the day. Purchases go in a fixed order and stop where the cash runs out.
// dec: buy{l,h,i}, ups[], fc (forecast level), sec (security level), loan (amount to take), recipe, price, cups, loc, helper, mk[], bh[{id,target}]
const prepareStand=(st0,dec,world,day,n)=>{const st={...st0,lemons:st0.lemons.map(b=>({...b})),ups:[...st0.ups]},P=world[day-1].p,spent={},skipped=[];
 if(dec.loan>0&&st.loan===0){const a=Math.min(40,dec.loan);st.loan=a;st.cash+=a;}
 // the day's rent and helper are set aside first: without the rent the stand moves to the free corner, without the helper it works alone
 const recipe=dec.recipe||{l:3,h:1,i:1},mk=(dec.mk||[]).filter(id=>MKTG.some(m=>m.id===id));
 let loc=[0,1,2].includes(dec.loc)?dec.loc:1;if(LOC[loc].rent>st.cash){skipped.push('loc');loc=0;}
 let helper=!!dec.helper;if(helper&&LOC[loc].rent+HELPER_C>st.cash){skipped.push('helper');helper=false;}
 const reserve=LOC[loc].rent+(helper?HELPER_C:0);
 const pay=(k,c)=>{if(c>st.cash-reserve+1e-9){skipped.push(k);return false;}st.cash-=c;spent[k]=(spent[k]||0)+c;return true;};
 for(const id of dec.ups||[]){const u=ALL_UPS.find(x=>x.id===id);if(u&&!st.ups.includes(id)&&(!u.ad||u.ad<=day)&&pay('ups',u.c))st.ups.push(id);}
 const b={l:Math.max(0,Math.floor((dec.buy||{}).l||0)),h:Math.max(0,Math.floor((dec.buy||{}).h||0)),i:Math.max(0,Math.floor((dec.buy||{}).i||0))},want=b.l*P.l+b.h*P.h+b.i*P.i;
 if(want>0){const k=Math.max(0,Math.min(1,(st.cash-reserve)/want)),buy={l:Math.floor(b.l*k),h:Math.floor(b.h*k),i:Math.floor(b.i*k)};if(k<1)skipped.push('stock');
  if(pay('stock',Math.round((buy.l*P.l+buy.h*P.h+buy.i*P.i)*100)/100)){if(buy.l)st.lemons.push({q:buy.l,d:day});st.sugar+=buy.h;st.ice+=buy.i;}}
 const fc=dec.fc&&FORECAST[dec.fc-1]&&pay('intel',FORECAST[dec.fc-1].c)?dec.fc:0;
 const sec=dec.sec&&NB.SECURITY[dec.sec]&&pay('security',NB.SECURITY[dec.sec].c)?dec.sec:0;
 // marketing and tricks come out of what's left after the rent and helper
 let free=st.cash-reserve;
 const mkOk=mk.filter(id=>{const c=MKTG.find(m=>m.id===id).c;if(c>free){skipped.push(id);return false;}free-=c;return true;});
 const bh=(dec.bh||[]).filter(x=>BLACK.some(y=>y.id===x.id)).filter(x=>{const c=trickCost(x.id,x.target,n);if(c>free){skipped.push(x.id);return false;}free-=c;return true;});
 const lm=st.lemons.reduce((s,x)=>s+x.q,0),stockMax=Math.min(...[['l',lm],['h',st.sugar],['i',st.ice]].filter(([k])=>recipe[k]>0).map(([k,h])=>Math.floor(h/recipe[k])));
 const cups=Math.max(0,Math.min(dec.cups??stockMax,stockMax,nbCap(st.ups,helper)));
 return{st,plan:{recipe,price:Math.max(1,Math.min(20,Math.round(dec.price||6))),cups,loc,helper,mk:mkOk,bh,sec,fc},spent,skipped};};

// The street's day. stands: [{id, st (after prepareStand), plan}]. Returns each stand's day and the timeline.
const runNeighborhoodDay=({seed,world,day,stands})=>{
 const W=world[day],T=W.t,fm=WE[W.w].fm,evm=W.ev?.dm,r=rng(seed*31+day*977+7),n=stands.length,ev=[];PM_EV=(W.ev&&W.ev.pm)||1;
 const at=(m,o)=>ev.push({m,at:hhmm(m),...o}),OPEN=NB.OPEN*60,CLOSE=NB.CLOSE*60;
 const S=stands.map((s,k)=>{const sr=rng(seed*53+day*131+k*17),sick=day>=2&&sr()<0.025?OPEN+120+Math.floor(sr()*240):null,insp=day>=2&&sr()<0.12;
  const mix=mixOf(world,day,s.plan.loc).m,boost=s.plan.mk.reduce((m,id)=>m*(MKTG.find(x=>x.id===id)?.dm||1),1)*(s.st.ups.includes('sign')?1.15:1)*(s.st.ups.includes('shade')&&T>=28?1.2:1)*(s.st.paper?1.3:1);
  const closed=s.plan.cups<=0;
  return{k,id:s.id,st:s.st,plan:s.plan,mix,boost,closed,sick:closed?null:sick,insp,cups:s.plan.cups,sold:0,rev:0,miss:0,walk:0,vis:0,repD:0,byType:Object.fromEntries(TYPES.map(t=>[t,{vis:0,buy:0,miss:0}])),
   rumor:0,signs:1,steal:[],soldAt:null,vip:null,tricks:[],hits:[]};});
 // dirty tricks: each one against each of its targets, checked against that target's security at a moment of the day
 const tricks=[];S.forEach(a=>a.plan.bh.forEach(x=>{const vs=x.target==='all'?S.filter(v=>v!==a):S.filter(v=>v.id===x.target&&v!==a);if(!vs.length)return;
  const power=x.target==='all'?NB.GENERAL.power:1,tr={by:a,id:x.id,all:x.target==='all',power,vs,caughtAt:null,caughtBy:null};
  vs.forEach(v=>{const p=Math.min(0.95,NB.SECURITY[v.plan.sec].catch+NB.ESCALATE*a.st.tricks),m=OPEN+30+Math.floor(r()*(CLOSE-OPEN-60));
   if(r()<p&&(tr.caughtAt===null||m<tr.caughtAt)){tr.caughtAt=m;tr.caughtBy=v;}});
  tricks.push(tr);a.tricks.push(tr);}));
 const live=(tr,m)=>tr.caughtAt===null||m<tr.caughtAt;
 const repNow=(s,m)=>Math.max(0,s.st.rep-tricks.filter(t=>t.id==='rumor'&&t.vs.includes(s)&&live(t,m)).reduce((x,t)=>x+5*t.power,0));
 const attr=(s,m)=>standAttr(s.plan.recipe,s.plan.price,repNow(s,m),T)*s.boost*tricks.filter(t=>t.id==='signs'&&t.vs.includes(s)&&live(t,m)).reduce((x,t)=>x*(1-0.2*t.power),1);
 const open=(s,m)=>!s.closed&&(s.sick===null||m<s.sick);
 // the crowd: 60 people on an ordinary street, more with more stands and with everyone's marketing (the difficulty is only the bots' level)
 const mkLift=1+S.reduce((x,s)=>x+(s.boost-1),0)*0.3/Math.max(1,n),street=60*softEnv(T,fm,evm)*Math.pow(Math.max(1,n),NB.CROWD)*mkLift;
 const zw=LOC.map(l=>l.dm),zs=zw.reduce((a,b)=>a+b,0),walkers=[],HS=NB.HOURS.reduce((a,b)=>a+b,0);
 NB.HOURS.forEach((h,i)=>{const sur=W.sur&&i>=5?W.sur.f:1,cnt=Math.round(street*h/HS*sur);for(let j=0;j<cnt;j++)walkers.push(OPEN+i*60+Math.floor(r()*60));});
 walkers.sort((a,b)=>a-b);
 const vipAt=W.vip?OPEN+180+Math.floor(r()*240):null;let vipDone=!W.vip;
 const pick=(m,zone,not)=>{const roam=r()>=NB.STAY,ok=S.filter(s=>open(s,m)&&s!==not),here=ok.filter(s=>s.plan.loc===zone),pool=!roam&&here.length?here:ok;if(!pool.length)return null;
  const w=pool.map(s=>attr(s,m)*(s.plan.loc===zone?1:0.5)),tot=w.reduce((a,b)=>a+b,0);let x=r()*tot;for(let k=0;k<pool.length;k++){x-=w[k];if(x<=0)return pool[k];}return pool[pool.length-1];};
 const serve=(s,m,typ)=>{const c=CT[typ],sc=cSc(s.plan.recipe.l,s.plan.recipe.h,s.plan.recipe.i,T,c),wants=r()<buyProb(sc.sc,s.plan.price,repNow(s,m),c,T);s.vis++;s.byType[typ].vis++;
  if(!wants){s.walk++;return 'walk';}
  if(s.sold>=s.cups){s.miss++;s.byType[typ].miss++;if(s.soldAt===null){s.soldAt=m;at(m,{type:'soldout',stand:s.id});}return 'miss';}
  s.sold++;s.rev+=s.plan.price;s.byType[typ].buy++;s.repD+=sc.ts>35?c.rI[0]:sc.ts>20?1:sc.ts>10?0:-1;at(m,{type:'sale',stand:s.id,cust:typ,rx:sc.ts>35?'😊':sc.ts>20?'🙂':sc.ts>10?'😐':'😕'});
  if(s.sold>=s.cups){s.soldAt=m;at(m,{type:'soldout',stand:s.id});}return 'buy';};
 if(W.ev)at(OPEN,{type:'event',ev:W.ev.id,n:W.ev.n,d:W.ev.d});
 S.forEach(s=>{if(s.closed)at(OPEN,{type:'closed',stand:s.id});if(s.sick!==null)at(s.sick,{type:'sick',stand:s.id});});
 if(W.sur)at(OPEN+5*60,{type:'surprise',n:W.sur.n,f:W.sur.f});
 tricks.forEach(t=>{if(t.caughtAt!==null)at(t.caughtAt,{type:'caught',stand:t.by.id,trick:t.id,all:t.all,victim:t.caughtBy.id});});
 for(const m of walkers){
  if(!vipDone&&m>=vipAt){vipDone=true;const s=pick(m,2,null);if(s){const bought=s.sold<s.cups;if(bought){s.sold++;s.rev+=s.plan.price;s.vip=relQ(s.plan.recipe,T,s.mix)>=VIP_Q;}else s.vip=false;s.repD+=s.vip?8:-6;at(m,{type:'vip',stand:s.id,ok:s.vip,bought});}}
  const zone=(()=>{let x=r()*zs;for(let z=0;z<3;z++){x-=zw[z];if(x<=0)return z;}return 2;})();
  let s=pick(m,zone,null);if(!s)continue;
  // a stealing trick turns some of the victim's customers toward the one who ran it
  const st=tricks.find(t=>t.id==='ads'&&t.vs.includes(s)&&live(t,m)&&open(t.by,m)&&r()<0.18*t.power);if(st){st.by.steal.push(m);s=st.by;}
  let x=r(),typ='adult',cum=0;for(const t of TYPES){cum+=s.mix[t];if(x<cum){typ=t;break;}}
  if(serve(s,m,typ)==='miss'&&r()<NB.RETRY){const s2=pick(m,zone,s);if(s2)serve(s2,m,typ);}}
 // the day's accounts for each stand (reputation as in the regular game, plus tricks, the critic and the inspector)
 const results=S.map(s=>{const caughtMine=s.tricks.filter(t=>t.caughtAt!==null),costs={rent:s.closed?0:LOC[s.plan.loc].rent,helper:s.plan.helper?HELPER_C:0,
   mkt:s.plan.mk.reduce((x,id)=>x+MKTG.find(m=>m.id===id).c,0),bh:s.tricks.reduce((x,t)=>x+trickCost(t.id,t.all?'all':'one',n),0),
   fine:caughtMine.reduce((x,t)=>x+NB.CAUGHT.fine[t.all?1:0],0)+(s.insp?8:0)+((W.ev&&W.ev.cost)||0)};
  let repD=Math.max(-10,Math.min(10,s.repD))-Math.min(6,s.miss*2)+(s.st.ups.includes('cups')?1:0)+((W.ev&&W.ev.rep)||0)+(s.plan.mk.includes('taste')&&s.plan.recipe.l>=3&&s.sold>0?3:0)+(s.plan.mk.includes('social')&&r()<0.5?2:0);
  const hitBy=tricks.filter(t=>t.vs.includes(s));
  repD-=hitBy.filter(t=>t.id==='rumor'&&t.caughtAt===null).reduce((x,t)=>x+5*t.power,0);
  repD+=hitBy.filter(t=>t.caughtAt!==null).length?NB.SYMPATHY:0;
  repD-=caughtMine.reduce((x,t)=>x+NB.CAUGHT.rep[t.all?1:0],0);
  const rep=Math.max(0,Math.min(100,Math.round(s.st.rep+repD+(50-s.st.rep-repD)*0.06)));
  // what the stand's security tells it: the caught ones by name, the others maybe as "someone attacked you"
  const kr=rng(seed*71+day*13+s.k),attacks=hitBy.map(t=>t.caughtAt!==null?{trick:t.id,by:t.by.id,at:hhmm(t.caughtAt),caught:true}:kr()<NB.SECURITY[s.plan.sec].know?{trick:t.id,caught:false}:null).filter(Boolean);
  return{id:s.id,sold:s.sold,cups:s.cups,rev:s.rev,miss:s.miss,walk:s.walk,visitors:s.vis,byType:s.byType,price:s.plan.price,loc:s.plan.loc,closed:s.closed,sick:s.sick!==null?hhmm(s.sick):null,
   soldAt:s.soldAt!==null?hhmm(s.soldAt):null,vip:s.vip,insp:s.insp,stole:s.steal.length,costs,repD:rep-s.st.rep,rep,attacks,
   myTricks:s.tricks.map(t=>({trick:t.id,all:t.all,caught:t.caughtAt!==null,at:t.caughtAt!==null?hhmm(t.caughtAt):null}))};});
 at(CLOSE,{type:'close'});
 ev.sort((a,b)=>a.m-b.m);return{results,events:ev,weather:{t:T,w:W.w},ev:W.ev?W.ev.id:null};};

// After the day: stock used and spoiled, cash, loan interest, reputation, and the score (profit so far)
const settleStand=(st,plan,res,spent,day)=>{const n={...st,ups:[...st.ups]};
 const usedL=res.sold*plan.recipe.l-(st.ups.includes('juicer')?Math.floor(res.sold/10):0);
 let rem=Math.min(usedL,st.lemons.reduce((s,b)=>s+b.q,0));const nl=[];for(const b of st.lemons){if(rem<=0){nl.push(b);continue;}if(b.q<=rem)rem-=b.q;else{nl.push({...b,q:b.q-rem});rem=0;}}
 n.lemons=nl.filter(b=>day+1-b.d<3);const spoiled=nl.reduce((s,b)=>s+b.q,0)-n.lemons.reduce((s,b)=>s+b.q,0);
 n.sugar=Math.max(0,st.sugar-res.sold*plan.recipe.h);n.ice=st.ups.includes('cooler')?Math.floor(Math.max(0,st.ice-res.sold*plan.recipe.i)/2):0;
 const dayCost=Object.values(res.costs).reduce((a,b)=>a+b,0),interest=Math.round(st.loan*LOAN_INT*100)/100;
 n.cash=Math.round((st.cash+res.rev-dayCost-interest)*100)/100;n.loan=Math.round(st.loan*(1+LOAN_INT)*100)/100;
 // a loan is paid back by itself once there's 1.5 times its size in cash
 if(n.loan>0&&n.cash>=n.loan*1.5){n.cash=Math.round((n.cash-n.loan)*100)/100;n.loan=0;}
 const profit=Math.round((res.rev-dayCost-interest-Object.values(spent).reduce((a,b)=>a+b,0))*100)/100;
 n.tot=Math.round((st.tot+profit)*100)/100;n.rep=res.rep;n.tricks=st.tricks+res.myTricks.length;n.paper=res.vip===true;
 return{st:n,profit,spoiled};};
const nbScore=st=>Math.round((st.tot-st.loan)*100)/100;

// Stands without a player tonight: bots play by their character, a player who didn't decide gets yesterday's choices with fresh stock
// o: seed, world, day, diff (the bots' level), n (stands), board [{id,tot}] (the standings so far), me (this stand's id), k (its index), prev {dec,res} (its yesterday),
//    street [{id,price,loc}] (yesterday's prices and places, which every player sees too)
// The level is how well a bot plays: an easy one guesses its price, cup and stock and picks a place at random; a medium one fits its cup and place
// to the weather; a hard one works out its price and cups from yesterday's street, skips marketing that won't pay, and is careful with dirty tricks
const botDecision=(persona,st,o)=>{const {seed,world,day,diff,n,board,me,k,prev}=o,ai=AI[persona.id],S=SMART[diff],noise=1-S,y=prev&&prev.res,rr=rng(seed*13+day*101+k*7+1),w=world[day],P=world[day-1].p,dec={mk:[],bh:[],ups:[]};
 let cash=st.cash;const spend=c=>{if(c>cash-15)return false;cash-=c;return true;};
 const nx=ai.up.map(id=>ALL_UPS.find(u=>u.id===id)).find(u=>u&&!st.ups.includes(u.id)&&(!u.ad||u.ad<=day));
 if(nx&&cash>=nx.c+35&&rr()<0.45*S&&spend(nx.c))dec.ups.push(nx.id);
 const sharp=S>=1;let fc=null;if(rr()<ai.fc[0]*S){const lv=sharp&&cash>=60?Math.max(2,ai.fc[1]):ai.fc[1];if(spend(FORECAST[lv-1].c)){dec.fc=lv;fc=nbForecast(seed,world,day,lv);}}
 const Test=fc?fc.t:24,rec=persona.r?{...persona.r}:{l:2+Math.floor(rr()*3),h:Math.floor(rr()*3),i:Math.floor(rr()*3)};
 // the cup: a sharp bot adds ice on a hot day and takes it out on a cold one
 if(S>=0.8){if(Test>=30&&rec.l+rec.h+rec.i<CUP)rec.i++;else if(Test<20&&rec.i>0)rec.i--;}dec.recipe=rec;
 // the price: what people will pay, the character's taste, a guess (the easier, the wilder), and for a sharp bot yesterday's lesson
 const lesson=sharp&&y&&!y.closed?(y.soldAt&&y.soldAt<'14:00'?1:y.sold<y.cups*0.6?-1:0):0;
 dec.price=Math.max(2,Math.round(TYPES.reduce((s,t)=>s+CT[t].pct*pMt(CT[t],Test),0)*0.95+persona.pb+(persona.r?0:(rr()-0.5)*6)+noise*(rr()-0.5)*6+lesson));
 const busy=Test>=27||(fc&&fc.lv===3&&w.ev&&w.ev.dm>1);
 dec.loc=persona.id==='premium'?2:persona.id==='budget'?0:S>=0.8?(busy?2:1):Math.floor(rr()*3);
 const hype=(Test>=28?1.25:1)*(fc&&fc.ev&&w.ev&&w.ev.dm>1?1.4:1);
 const pre=60*softEnv(Test,WE[fc?fc.w:'nice'].fm,1)*Math.pow(n,NB.CROWD)/n*0.6;
 MKTG.forEach(m=>{if(rr()<(ai.mk[m.id]||0)*hype&&(!sharp||(m.id==='taste'?rec.l>=3:pre*(m.dm-1)*TYPES.reduce((s,t)=>s+CT[t].pct*pMt(CT[t],Test),0)>=m.c*0.8))&&spend(m.c))dec.mk.push(m.id);});
 // tricks go against the leader (or, now and then, against everyone); a sharp bot takes fewer risks, and almost never against everyone
 const lead=board.filter(b=>b.id!==me).sort((a,b)=>b.tot-a.tot)[0];
 Object.entries(ai.bh).forEach(([id,pp])=>{if(lead&&rr()<pp*(1.3-0.6*S)*0.7){const all=rr()<0.25*(1.5-S),c=trickCost(id,all?'all':lead.id,n);if(spend(c))dec.bh.push({id,target:all?'all':lead.id});}});
 const sec=board.length&&st.tot>=Math.max(...board.map(b=>b.tot))&&rr()<0.5*S?2:rr()<0.25*S?1:0;if(sec&&spend(NB.SECURITY[sec].c))dec.sec=sec;
 // a sharp bot works out its price and its cups like a careful player: yesterday's prices on the street, the forecast, and what each kind of customer pays
 let best=null;
 if(sharp){const T=Test,others=(o.street||[]).filter(x=>x.id!==me),walkers=60*softEnv(T,WE[fc?fc.w:'nice'].fm,fc&&fc.lv===3&&w.ev?w.ev.dm:1)*Math.pow(n,NB.CROWD);
  const mix=mixOf(world,day,dec.loc).m,boost=dec.mk.reduce((m,id)=>m*(MKTG.find(x=>x.id===id)?.dm||1),1)*(st.ups.includes('sign')?1.15:1)*(st.ups.includes('shade')&&T>=28?1.2:1);
  const usual=Math.round(TYPES.reduce((s,t)=>s+CT[t].pct*pMt(CT[t],T),0)),them=(others.length?others:Array.from({length:n-1},()=>({price:usual}))).reduce((s,x)=>s+standAttr({l:3,h:1,i:1},x.price,50,T),0);
  // no more cups than it can serve (a helper if it pays) or afford
  const unit=rec.l*P.l+rec.h*P.h+rec.i*P.i,most=Math.min(nbCap([...st.ups,...dec.ups],true),Math.floor(Math.max(0,cash-LOC[dec.loc].rent-HELPER_C)/Math.max(0.01,unit)));
  for(let p=2;p<=15;p++){const a=standAttr(rec,p,st.rep,T)*boost,br=TYPES.reduce((s,t)=>s+mix[t]*buyProb(cSc(rec.l,rec.h,rec.i,T,CT[t]).sc,p,st.rep,CT[t],T),0),buyers=walkers*a/(a+them)*br,gain=Math.min(buyers,most)*p-Math.min(buyers*1.15,most)*unit;
   if(!best||gain>best.gain)best={p,buyers,gain};}
  // never below what its character would ask: a price war hurts the bot more than its rivals
  dec.price=Math.max(2,Math.min(15,Math.max(best.p,Math.round(TYPES.reduce((s,t)=>s+CT[t].pct*pMt(CT[t],T),0)*0.95+persona.pb*0.5))));}
 // how many cups: their guess at their share of the street
 const share=60*softEnv(Test,WE[fc?fc.w:'nice'].fm,1)*Math.pow(n,NB.CROWD)/n*0.6;
 dec.helper=(best?best.buyers*1.1:share)>CAP_BASE*0.9&&rr()<ai.hp*S*1.5&&spend(HELPER_C);
 const cap=nbCap([...st.ups,...dec.ups],dec.helper),unit=rec.l*P.l+rec.h*P.h+rec.i*P.i,guess=sharp?(1.25+(y&&y.soldAt?0.2:y&&y.sold<y.cups*0.6?-0.2:0)):S>=0.8?1.15:0.8+rr()*0.6,cups=Math.max(0,Math.min(cap,Math.round(best?best.buyers*1.15:share*guess),Math.floor(Math.max(0,cash-LOC[dec.loc].rent)/Math.max(0.01,unit))));
 const lm=st.lemons.filter(b=>day-b.d<2).reduce((s,b)=>s+b.q,0);
 dec.buy={l:Math.max(0,cups*rec.l-lm),h:Math.max(0,cups*rec.h-st.sugar),i:Math.max(0,cups*rec.i-(st.ups.includes('cooler')?st.ice:0))};dec.cups=cups;
 return dec;};
const autopilot=(st,last,lastRes,world,day)=>{const P=world[day-1].p,rec=(last&&last.recipe)||{l:3,h:1,i:1},cups=Math.max(10,Math.round(((lastRes&&lastRes.sold)||15)*1.1));
 const lm=st.lemons.filter(b=>day-b.d<2).reduce((s,b)=>s+b.q,0);
 return{recipe:rec,price:(last&&last.price)||6,loc:(last&&last.loc)??1,helper:false,mk:[],bh:[],ups:[],cups,
  buy:{l:Math.max(0,cups*rec.l-lm),h:Math.max(0,cups*rec.h-st.sugar),i:Math.max(0,cups*rec.i-(st.ups.includes('cooler')?st.ice:0))}};};

// The server's step: runs every day of a neighborhood that is due by now (08:00 local time), and prepares the next evening's market.
// g: hood {seed, days, difficulty, last_day}, members [{id, slot, persona|null, state}], decisions {day:{member:dec}},
//    paid {day:{member:intel cost already taken}}, prev {member:{dec,res}} (yesterday, for the autopilot and bots), street [{id,price,loc}] (yesterday's prices),
//    now {day, minutes} (day 1 = the start date)
const nbIntel=(seed,world,day)=>{const M=world[day-1].mev;return{day,prices:world[day-1].p,mev:M?{id:M.id,n:M.n,d:M.d}:null,fc:{1:nbForecast(seed,world,day,1),2:nbForecast(seed,world,day,2),3:nbForecast(seed,world,day,3)}};};
const advanceHood=g=>{const {hood,now}=g,{seed,days,difficulty:diff}=hood,world=buildWorld(seed,days),n=g.members.length,runs=[],states={},prev={...(g.prev||{})};let street=g.street||[];
 g.members.forEach(m=>{states[m.id]=m.state;});
 let last=hood.last_day||0;
 const due=d=>d<=days&&(now.day>d||(now.day===d&&now.minutes>=NB.OPEN*60));
 while(due(last+1)){const day=last+1,board=g.members.map(m=>({id:m.id,tot:states[m.id].tot}));
  const decs=g.members.map(m=>{if(m.persona)return{dec:botDecision(PERSONAS.find(p=>p.id===m.persona)||PERSONAS[0],states[m.id],{seed,world,day,diff,n,board,me:m.id,k:m.slot,prev:prev[m.id],street}),auto:'bot'};
   const own=((g.decisions||{})[day]||{})[m.id];if(own)return{dec:{...own,fc:0},auto:null}; // a forecast was paid when bought
   const p=prev[m.id]||{};return{dec:autopilot(states[m.id],p.dec,p.res,world,day),auto:'autopilot'};});
  const prep=g.members.map((m,k)=>prepareStand(states[m.id],decs[k].dec,world,day,n));
  const out=runNeighborhoodDay({seed,world,day,stands:g.members.map((m,k)=>({id:m.id,st:prep[k].st,plan:prep[k].plan}))});
  const paid=(g.paid||{})[day]||{},open=[],results=[],privates=[];
  g.members.forEach((m,k)=>{const r=out.results[k],p=prep[k],spent={...p.spent};if(paid[m.id])spent.intel=(spent.intel||0)+paid[m.id];
   const set=settleStand(p.st,p.plan,r,spent,day);states[m.id]=set.st;prev[m.id]={dec:decs[k].dec,res:r};
   open.push({id:m.id,price:p.plan.price,loc:p.plan.loc,ups:p.st.ups,mk:p.plan.mk,helper:p.plan.helper,closed:r.closed});
   results.push({id:m.id,price:r.price,loc:r.loc,sold:r.sold,rev:r.rev,profit:set.profit,score:nbScore(set.st),rep:set.st.rep,closed:r.closed,sick:r.sick,soldAt:r.soldAt,vip:r.vip,insp:r.insp,
    caught:r.myTricks.filter(t=>t.caught).map(t=>({trick:t.trick,all:t.all,at:t.at})),auto:decs[k].auto});
   privates.push({member:m.id,data:{before:p.st,dec:decs[k].dec,plan:p.plan,spent,skipped:p.skipped,res:r,profit:set.profit,spoiled:set.spoiled,auto:decs[k].auto}});});
  street=open.map(x=>({id:x.id,price:x.price,loc:x.loc}));
  runs.push({day,open:{weather:out.weather,ev:out.ev,stands:open},events:out.events.map(({m,at,...e})=>({m,at,...e})),results,privates});
  last=day;}
 const intel=last<days?nbIntel(seed,world,last+1):null;
 const status=last>=days&&(now.day>days||now.minutes>=NB.CLOSE*60)?'done':last>0?'running':'open';
 return{runs,states,intel,last_day:last,status};};

const LemonEngine={CUP,DAYS,CAP_BASE,CAP_STATION,CAP_TEAM,HELPER_B,HELPER_C,LOAN_INT,TP,SR,SW,ITP,WTP,HFR,crP,CT,TYPES,WE,tM,softEnv,iFr,tSc,fSc,freshW,cSc,heatF,setPM,pMt,buyProb,rawQ,bestQ,relQ,VIP_Q,standAttr,rng,
 LOC,UPG_MKT,UPG_OPS,MKTG,BLACK,FORECAST,RESEARCH_C,SPY_C,DIFF,PRESETS,sameR,EVENTS,evGood,MEV,SUR,PERSONAS,AI,SMART,ALL_UPS,MK_EM,buildWorld,
 DOW,dowOf,mixOf,rivalsOf,dayCtx,hitOn,rivalDemand,planRivals,rivalsFor,visitorsFor,whyOf,perType,buyersFor,playerDay,settleDay,makeForecast,
 NB,hhmm,nbCap,newStand,trickCost,nbForecast,prepareStand,runNeighborhoodDay,settleStand,nbScore,botDecision,autopilot,nbIntel,advanceHood};
if(typeof module!=='undefined'&&module.exports)module.exports=LemonEngine;else root.LemonEngine=LemonEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
