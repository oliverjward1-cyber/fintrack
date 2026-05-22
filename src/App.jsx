import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#0b0b12", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.07)",
  gold: "#d4a853", green: "#5ba878", red: "#a85b5b",
  text: "#f0f0f8", dim: "rgba(240,240,248,0.45)", dimmer: "rgba(240,240,248,0.2)",
};
const F = { serif: "'Cormorant Garamond',serif", sans: "'Inter',sans-serif", mono: "'DM Mono',monospace" };

// ─── Categories & colours ─────────────────────────────────────────────────────
const CATEGORIES = [
  "Food & Groceries","Transport","Shopping","Bills & Utilities",
  "Subscriptions","Entertainment","Health & Wellness",
  "Travel","Savings & Investments","Other",
];
const CAT_COLORS = {
  "Food & Groceries":"#5ba878","Transport":"#5b8fa8","Shopping":"#d4a853",
  "Bills & Utilities":"#a8705b","Subscriptions":"#8a5ba8","Entertainment":"#a85b7a",
  "Health & Wellness":"#5b8a78","Travel":"#4e7db5","Savings & Investments":"#6a8a5b","Other":"#7a7080",
};
const catColor = (name, i) => CAT_COLORS[name] || ["#d4a853","#5b8fa8","#a8705b","#5ba878","#8a5ba8"][i % 5];

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_STATEMENTS = [
  {
    id:"demo-1", savedAt:"2025-02-01T00:00:00.000Z", period:"February 2025", currency:"£",
    income:2200, totalSpent:1923.40, savings:276.60, savingsRate:12.6,
    categories:[
      {name:"Food & Groceries",amount:438.20,count:24},{name:"Bills & Utilities",amount:387.00,count:7},
      {name:"Shopping",amount:341.80,count:11},{name:"Subscriptions",amount:67.97,count:8},
      {name:"Transport",amount:143.20,count:14},{name:"Entertainment",amount:94.60,count:6},
      {name:"Health & Wellness",amount:45.00,count:2},{name:"Other",amount:405.63,count:19},
    ],
    topMerchants:[
      {name:"Tesco",amount:198.40,category:"Food & Groceries"},{name:"British Gas",amount:124.00,category:"Bills & Utilities"},
      {name:"ASOS",amount:156.90,category:"Shopping"},{name:"Netflix",amount:17.99,category:"Subscriptions"},
      {name:"TfL",amount:87.40,category:"Transport"},{name:"Spotify",amount:11.99,category:"Subscriptions"},
    ],
    insights:[
      "Shopping spend of £341.80 was high this month — ASOS (£156.90) was the biggest driver.",
      "Your 8 subscriptions cost £67.97/month — that's £815.64/year. Worth auditing which you actually use.",
      "Your savings rate of 12.6% is below the 20% target. Cutting shopping by £100 would close most of the gap.",
    ],
  },
  {
    id:"demo-2", savedAt:"2025-03-01T00:00:00.000Z", period:"March 2025", currency:"£",
    income:2200, totalSpent:1764.80, savings:435.20, savingsRate:19.8,
    categories:[
      {name:"Food & Groceries",amount:398.60,count:21},{name:"Bills & Utilities",amount:387.00,count:7},
      {name:"Transport",amount:168.40,count:16},{name:"Shopping",amount:198.40,count:7},
      {name:"Subscriptions",amount:67.97,count:8},{name:"Entertainment",amount:62.30,count:4},
      {name:"Health & Wellness",amount:85.00,count:3},{name:"Other",amount:397.13,count:17},
    ],
    topMerchants:[
      {name:"Tesco",amount:187.40,category:"Food & Groceries"},{name:"British Gas",amount:124.00,category:"Bills & Utilities"},
      {name:"TfL",amount:98.60,category:"Transport"},{name:"Netflix",amount:17.99,category:"Subscriptions"},
      {name:"Amazon Prime",amount:8.99,category:"Subscriptions"},{name:"Spotify",amount:11.99,category:"Subscriptions"},
    ],
    insights:[
      "Great progress — shopping dropped by £143 vs February, pushing savings rate to 19.8%.",
      "Transport rose £25 this month. A monthly travelcard could reduce this.",
      "You're £4.40/month away from the 20% savings target. Almost there.",
    ],
  },
];

// ─── AI prompt ────────────────────────────────────────────────────────────────
const PROMPT = `Analyse this bank statement and return ONLY valid JSON — no markdown, no fences, no explanation.

{
  "period": "e.g. March 2025",
  "currency": "£",
  "income": 0,
  "totalSpent": 0,
  "savings": 0,
  "savingsRate": 0,
  "categories": [{ "name": "Category", "amount": 0, "count": 0 }],
  "topMerchants": [{ "name": "Merchant", "amount": 0, "category": "Category" }],
  "insights": ["insight 1", "insight 2", "insight 3"]
}

Rules:
- Categories — use ONLY these: Food & Groceries, Transport, Shopping, Bills & Utilities, Subscriptions, Entertainment, Health & Wellness, Travel, Savings & Investments, Other
- Subscriptions: ALL recurring digital/membership charges — Netflix, Spotify, Amazon Prime, Disney+, Apple services, Xbox/PlayStation, gym memberships, cloud storage, software, news subscriptions, any regular monthly/annual service
- Entertainment: one-off only — cinema, concerts, events, games bought outright
- Bills & Utilities: rent/mortgage, electricity, gas, water, council tax, broadband, phone contract, insurance
- income = salary/wages/money received (exclude transfers between own accounts)
- totalSpent = sum of all debits (exclude savings transfers)
- savings = income - totalSpent
- savingsRate = (savings / income) * 100, rounded to 1 decimal
- Only include categories with at least one transaction; sort by amount descending
- topMerchants: top 6 by total spend
- insights: 3 specific, actionable observations with real numbers
- Default currency £; all amounts as plain numbers`;

// ─── Month helpers ────────────────────────────────────────────────────────────
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const periodToMonthIdx = p => { const l = p.toLowerCase(); const f = MONTHS_FULL.findIndex(m => l.includes(m)); return f !== -1 ? f : MONTHS.findIndex(m => l.includes(m.toLowerCase())); };

// ─── Storage ──────────────────────────────────────────────────────────────────
const storageGet = key => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };
const storageSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.error(e); } };

// ─── Format ───────────────────────────────────────────────────────────────────
const fmt  = (n, c="£") => `${c}${Math.abs(n).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtK = (n, c="£") => Math.abs(n)>=1000 ? `${c}${(Math.abs(n)/1000).toFixed(1)}k` : fmt(n,c);
const readText = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsText(f);});
const readB64  = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 700);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 700);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

// ─── Health score ─────────────────────────────────────────────────────────────
function calcHealthScore(statements, budgets) {
  if (!statements.length) return null;
  const avgRate = statements.reduce((a,s) => a + s.savingsRate, 0) / statements.length;
  const latest  = [...statements].sort((a,b) => b.savedAt.localeCompare(a.savedAt))[0];
  // Savings rate: 40 pts (20%+ = full)
  const rateScore = Math.min(40, Math.max(0, (avgRate / 20) * 40));
  // Budget adherence: 35 pts
  const bKeys = Object.entries(budgets).filter(([,v]) => v > 0);
  let budgetScore = 17.5;
  if (bKeys.length > 0) {
    const scores = bKeys.map(([cat, budget]) => {
      const actual = latest.categories.find(c => c.name === cat)?.amount || 0;
      const r = actual / budget;
      return r <= 0.8 ? 1 : r <= 1.0 ? 0.5 : 0;
    });
    budgetScore = (scores.reduce((a,v) => a+v, 0) / scores.length) * 35;
  }
  // Trend: 25 pts
  let trendScore = 12.5;
  if (statements.length > 1) {
    const s = [...statements].sort((a,b) => a.savedAt.localeCompare(b.savedAt));
    trendScore = Math.max(0, Math.min(25, 12.5 + (s[s.length-1].savingsRate - s[0].savingsRate) * 1.5));
  }
  return Math.round(rateScore + budgetScore + trendScore);
}
function scoreToGrade(score) {
  if (score >= 80) return { grade:"A", color:C.green,   label:"Excellent" };
  if (score >= 65) return { grade:"B", color:"#7ab85b", label:"Good" };
  if (score >= 50) return { grade:"C", color:C.gold,    label:"Fair" };
  if (score >= 35) return { grade:"D", color:"#c4883a", label:"Needs work" };
  return               { grade:"F", color:C.red,     label:"Action needed" };
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function Card({ children, style={}, onClick }) {
  return <div onClick={onClick} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,...style}}>{children}</div>;
}
function SectionLabel({ children }) {
  return <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>{children}</div>;
}
function ProgressBar({ pct, color=C.gold, h=5 }) {
  return (
    <div style={{height:h,background:"rgba(255,255,255,0.06)",borderRadius:h/2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,Math.max(0,pct))}%`,background:color,borderRadius:h/2,transition:"width 0.7s ease"}} />
    </div>
  );
}
function Btn({ children, onClick, variant="ghost", style={} }) {
  const base = {fontFamily:F.sans,fontWeight:500,fontSize:13,borderRadius:9,padding:"10px 18px",cursor:"pointer",border:"none",transition:"all 0.2s",...style};
  const v = { primary:{background:C.gold,color:"#0b0b12"}, ghost:{background:"none",border:`1px solid ${C.border}`,color:C.dim}, danger:{background:"none",border:"1px solid rgba(168,91,91,0.35)",color:C.red} };
  return <button onClick={onClick} style={{...base,...v[variant]}}>{children}</button>;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ view, setView, isMobile }) {
  const tabs = isMobile
    ? [["overview","Home"],["upload","Upload"],["budget","Budget"],["goals","Goals"]]
    : [["overview","Overview"],["upload","Upload"],["budget","Budget"],["goals","Goals"]];
  return (
    <div style={{borderBottom:`1px solid ${C.border}`,padding:`0 ${isMobile?"14px":"28px"}`,display:"flex",justifyContent:"space-between",alignItems:"center",height:56}}>
      <div style={{fontFamily:F.serif,fontSize:isMobile?17:20,color:C.text}}>
        <span style={{color:C.gold}}>◆</span> Fintrack
      </div>
      <div style={{display:"flex",gap:2}}>
        {tabs.map(([id,label]) => (
          <button key={id} onClick={()=>setView(id)} style={{
            background:"none",border:"none",padding:isMobile?"6px 10px":"8px 16px",cursor:"pointer",
            fontFamily:F.sans,fontWeight:500,fontSize:isMobile?11:13,
            color:view===id?C.gold:C.dim,
            borderBottom:view===id?`1px solid ${C.gold}`:"1px solid transparent",
            marginBottom:-1,transition:"all 0.2s",
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Category breakdown with traffic lights ───────────────────────────────────
function CategoryBreakdown({ categories, currency, limit=10, budgets={} }) {
  const cur  = currency||"£";
  const data  = categories.slice(0,limit);
  const total = data.reduce((a,c)=>a+c.amount,0);
  const max   = Math.max(...data.map(c=>c.amount),1);
  return (
    <div>
      {data.map((cat,i) => {
        const color  = catColor(cat.name,i);
        const budget = budgets[cat.name];
        const budgetPct = budget ? (cat.amount/budget)*100 : null;
        const light  = budgetPct===null ? null : budgetPct>100 ? C.red : budgetPct>80 ? C.gold : C.green;
        const pct    = total>0 ? (cat.amount/total)*100 : 0;
        const barPct = (cat.amount/max)*100;
        return (
          <div key={cat.name} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:10,height:10,borderRadius:3,background:color,flexShrink:0}} />
                <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{cat.name}</span>
                {light && <div title={budgetPct>100?"Over budget":budgetPct>80?"Near limit":"On track"} style={{width:7,height:7,borderRadius:"50%",background:light,flexShrink:0}} />}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{color:C.dimmer,fontFamily:F.sans,fontSize:12}}>{pct.toFixed(1)}%</span>
                <span style={{color:C.gold,fontFamily:F.mono,fontSize:12,minWidth:76,textAlign:"right"}}>{fmt(cat.amount,cur)}</span>
              </div>
            </div>
            <div style={{height:7,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${barPct}%`,background:color,borderRadius:4,transition:"width 0.8s ease"}} />
            </div>
          </div>
        );
      })}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:C.dim,fontFamily:F.sans,fontSize:13}}>Total spent</span>
        <span style={{color:C.gold,fontFamily:F.mono,fontSize:13}}>{fmt(total,cur)}</span>
      </div>
    </div>
  );
}

// ─── Subscription panel ───────────────────────────────────────────────────────
function SubscriptionPanel({ statements, currency }) {
  const cur = currency||"£";
  if (!statements.length) return null;
  const latest  = [...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
  const subCat  = latest.categories.find(c=>c.name==="Subscriptions");
  if (!subCat||subCat.amount===0) return null;
  const monthly = subCat.amount;
  const subMerchants = (latest.topMerchants||[]).filter(m=>m.category==="Subscriptions");
  return (
    <Card style={{padding:"26px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <SectionLabel>Subscriptions</SectionLabel>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:F.serif,fontSize:30,fontWeight:300,color:CAT_COLORS["Subscriptions"],lineHeight:1}}>
            {fmt(monthly,cur)}<span style={{fontFamily:F.sans,fontSize:13,color:C.dim}}>/mo</span>
          </div>
          <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:4}}>{fmt(monthly*12,cur)} per year</div>
        </div>
      </div>
      {subMerchants.length>0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
          {subMerchants.map((m,i)=>(
            <div key={i} style={{background:"rgba(138,91,168,0.1)",border:"1px solid rgba(138,91,168,0.22)",borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:C.text,fontFamily:F.sans,fontSize:12}}>{m.name}</span>
              <span style={{color:CAT_COLORS["Subscriptions"],fontFamily:F.mono,fontSize:11}}>{fmt(m.amount,cur)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{padding:"10px 14px",background:"rgba(138,91,168,0.07)",borderRadius:9,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:15}}>💡</span>
        <span style={{color:C.dim,fontFamily:F.sans,fontSize:12,lineHeight:1.6}}>
          Cancelling one unused subscription saves more than you think — {fmt(monthly*12,cur)} a year is already leaving your account quietly.
        </span>
      </div>
    </Card>
  );
}

// ─── Savings projection ───────────────────────────────────────────────────────
function SavingsProjection({ statements, currency }) {
  const cur = currency||"£";
  if (!statements.length) return null;
  const avgSavings = statements.reduce((a,s)=>a+s.savings,0)/statements.length;
  const avgIncome  = statements.reduce((a,s)=>a+s.income,0)/statements.length;
  const ytdSaved   = statements.reduce((a,s)=>a+s.savings,0);
  const monthsLeft = Math.max(0,12-statements.length);
  const yearEnd    = ytdSaved+avgSavings*monthsLeft;
  const actualByIdx={};
  statements.forEach(s=>{const i=periodToMonthIdx(s.period);if(i!==-1)actualByIdx[i]=s.savings;});
  const chartData = MONTHS.map((name,i)=>({
    name,
    Actual:   actualByIdx[i]!==undefined ? Math.max(0,actualByIdx[i]) : null,
    Projected:actualByIdx[i]===undefined ? Math.max(0,avgSavings) : null,
  }));
  const Tip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    const item=payload.find(p=>p.value!=null);
    if(!item) return null;
    return(
      <div style={{background:"#1a1a28",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px"}}>
        <div style={{color:C.gold,fontFamily:F.sans,fontSize:11,marginBottom:4}}>{label}</div>
        <div style={{color:item.fill,fontFamily:F.mono,fontSize:12}}>{item.name}: {fmt(item.value,cur)}</div>
        {item.name==="Projected"&&<div style={{color:C.dimmer,fontFamily:F.sans,fontSize:11,marginTop:2}}>estimated from average</div>}
      </div>
    );
  };
  return (
    <Card style={{padding:"26px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <SectionLabel>Savings Projection · Full Year</SectionLabel>
          <div style={{color:C.dim,fontFamily:F.sans,fontSize:13}}>Avg {fmt(avgSavings,cur)}/mo · {fmt(avgIncome,cur)}/mo income</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:4}}>year-end forecast</div>
          <div style={{fontFamily:F.serif,fontSize:34,fontWeight:300,color:yearEnd>=0?C.green:C.red,lineHeight:1}}>
            {yearEnd>=0?"":"−"}{fmtK(Math.abs(yearEnd),cur)}
          </div>
          <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:4}}>
            {monthsLeft>0?`${monthsLeft} months projected`:"full year tracked"}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={chartData} barGap={2} barCategoryGap="28%">
          <XAxis dataKey="name" tick={{fontFamily:F.sans,fontSize:10,fill:C.dim}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontFamily:F.mono,fontSize:9,fill:C.dim}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v,cur)} width={50}/>
          <Tooltip content={<Tip/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
          <Bar dataKey="Actual"    fill={C.green}             radius={[3,3,0,0]}/>
          <Bar dataKey="Projected" fill="rgba(91,168,120,0.2)"radius={[3,3,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:20,marginTop:10,justifyContent:"flex-end"}}>
        {[["Actual saved",C.green],["Projected","rgba(91,168,120,0.5)"]].map(([l,col])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:2,background:col}}/>
            <span style={{color:C.dim,fontFamily:F.sans,fontSize:12}}>{l}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Month comparison ─────────────────────────────────────────────────────────
function MonthComparison({ statements, currency }) {
  const cur = currency||"£";
  if (!statements.length) return null;
  const sorted  = [...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
  const current  = sorted[0];
  const previous = sorted[1]||null;
  const catNames = [...new Set([...current.categories.map(c=>c.name),...(previous?.categories.map(c=>c.name)||[])])];
  const rows = catNames.map(name=>{
    const currAmt = current.categories.find(c=>c.name===name)?.amount||0;
    const prevAmt = previous?.categories.find(c=>c.name===name)?.amount||0;
    const diff=currAmt-prevAmt;
    const pct=prevAmt>0?(diff/prevAmt)*100:null;
    const nextEst=statements.reduce((a,s)=>a+(s.categories.find(c=>c.name===name)?.amount||0),0)/statements.length;
    return{name,currAmt,prevAmt,diff,pct,nextEst};
  }).filter(r=>r.currAmt>0||r.prevAmt>0).sort((a,b)=>b.currAmt-a.currAmt);
  const nextTotalEst=rows.reduce((a,r)=>a+r.nextEst,0);
  const hasPrev=!!previous;
  const cols=`1fr 110px${hasPrev?" 110px":""} 110px`;
  const cell={fontFamily:F.mono,fontSize:12,textAlign:"right",paddingTop:9};
  return (
    <Card style={{padding:"26px",marginBottom:20}}>
      <SectionLabel>Monthly Breakdown · {current.period}{previous?` vs ${previous.period}`:""}</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:cols,gap:"0 4px",marginBottom:8}}>
        {["Category",current.period.slice(0,3),hasPrev&&previous.period.slice(0,3),"Next est."].filter(Boolean).map((h,i)=>(
          <div key={i} style={{color:C.dimmer,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:i===0?"left":"right"}}>{h}</div>
        ))}
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,marginBottom:4}}/>
      {rows.slice(0,9).map((row,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:cols,gap:"0 4px",alignItems:"center"}}>
          <div style={{color:C.text,fontFamily:F.sans,fontSize:13,paddingTop:9,paddingBottom:2}}>{row.name}</div>
          <div style={{...cell,color:C.gold}}>{fmt(row.currAmt,cur)}</div>
          {hasPrev&&(
            <div style={{...cell,color:C.dim}}>
              {row.prevAmt>0?fmt(row.prevAmt,cur):<span style={{color:C.dimmer}}>—</span>}
              {row.pct!==null&&<span style={{marginLeft:5,fontSize:10,fontFamily:F.sans,color:row.diff>0?C.red:C.green}}>{row.diff>0?"▲":"▼"}{Math.abs(row.pct).toFixed(0)}%</span>}
            </div>
          )}
          <div style={{...cell,color:C.dimmer}}>{fmt(row.nextEst,cur)}</div>
        </div>
      ))}
      <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,display:"grid",gridTemplateColumns:cols,gap:"0 4px"}}>
        <div style={{color:C.text,fontFamily:F.sans,fontWeight:600,fontSize:13}}>Total</div>
        <div style={{...cell,color:C.gold}}>{fmt(current.totalSpent,cur)}</div>
        {hasPrev&&(
          <div style={{...cell,color:C.dim}}>
            {fmt(previous.totalSpent,cur)}
            {(()=>{const d=current.totalSpent-previous.totalSpent;const p=(d/previous.totalSpent)*100;return<span style={{marginLeft:5,fontSize:10,fontFamily:F.sans,color:d>0?C.red:C.green}}>{d>0?"▲":"▼"}{Math.abs(p).toFixed(0)}%</span>;})()}
          </div>
        )}
        <div style={{...cell,color:C.dimmer}}>{fmt(nextTotalEst,cur)}</div>
      </div>
      {!hasPrev&&<div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:14,textAlign:"center"}}>Upload another month to see the comparison</div>}
    </Card>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewPage({ statements, goals, budgets, setView, onViewDetail, onLoadDemo }) {
  const isMobile = useIsMobile();
  const score    = calcHealthScore(statements, budgets);

  if (!statements.length) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",gap:24,textAlign:"center",padding:40}}>
      <div style={{fontSize:44,opacity:0.15}}>◈</div>
      <div>
        <div style={{fontFamily:F.serif,fontSize:isMobile?28:36,fontWeight:300,color:C.text,marginBottom:10}}>No statements yet</div>
        <div style={{color:C.dim,fontFamily:F.sans,fontSize:14,lineHeight:1.8}}>Upload your first bank statement to see<br/>exactly where your money is going.</div>
      </div>
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12,alignItems:"center"}}>
        <Btn variant="primary" onClick={()=>setView("upload")} style={{fontSize:14,padding:"12px 28px"}}>Upload a statement →</Btn>
        <Btn onClick={onLoadDemo} style={{fontSize:13}}>Try with demo data</Btn>
      </div>
    </div>
  );

  const cur       = statements[0].currency||"£";
  const ytdIncome = statements.reduce((a,s)=>a+s.income,0);
  const ytdSpent  = statements.reduce((a,s)=>a+s.totalSpent,0);
  const ytdSaved  = statements.reduce((a,s)=>a+s.savings,0);
  const avgRate   = statements.reduce((a,s)=>a+s.savingsRate,0)/statements.length;

  const allCats={};
  statements.forEach(s=>s.categories.forEach(cat=>{allCats[cat.name]=(allCats[cat.name]||0)+cat.amount;}));
  const aggregatedCats=Object.entries(allCats).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);

  const sorted    = [...statements].sort((a,b)=>a.savedAt.localeCompare(b.savedAt));
  const chartData = sorted.map(s=>({name:s.period.slice(0,3),Income:Math.round(s.income),Spent:Math.round(s.totalSpent),Saved:Math.max(0,Math.round(s.savings))}));

  const getGoalProgress = g => {
    if(g.type==="savings_total"){const pct=(ytdSaved/g.target)*100;return{pct,label:`${fmt(ytdSaved,cur)} of ${fmt(g.target,cur)}`,color:pct>=100?C.green:pct>=50?C.gold:C.dim};}
    if(g.type==="savings_rate"){const pct=(avgRate/g.target)*100;return{pct,label:`${avgRate.toFixed(1)}% avg vs ${g.target}% target`,color:pct>=100?C.green:pct>=60?C.gold:C.dim};}
    if(g.type==="category_limit"){const avg=statements.reduce((a,s)=>a+(s.categories.find(c=>c.name===g.category)?.amount||0),0)/statements.length;const pct=(avg/g.target)*100;return{pct,label:`${fmt(avg,cur)} avg/mo vs ${fmt(g.target,cur)} limit`,color:pct>100?C.red:pct>80?C.gold:C.green,inverted:true};}
    return{pct:0,label:"",color:C.dim};
  };

  const Tip=({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return(
      <div style={{background:"#1a1a28",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px"}}>
        <div style={{color:C.gold,fontFamily:F.sans,fontSize:12,marginBottom:6}}>{label}</div>
        {payload.map(p=><div key={p.name} style={{color:p.fill,fontFamily:F.mono,fontSize:12,marginBottom:2}}>{p.name}: {fmt(p.value,cur)}</div>)}
      </div>
    );
  };

  const statCards = [
    {label:"YTD Income",  value:fmtK(ytdIncome,cur), sub:"money received",  acc:null},
    {label:"YTD Spent",   value:fmtK(ytdSpent,cur),  sub:"total outgoings", acc:null},
    {label:"YTD Saved",   value:fmtK(ytdSaved,cur),  sub:ytdSaved>=0?"positive trend":"overspent", acc:ytdSaved>=0?C.green:C.red},
    {label:"Avg Rate",    value:`${avgRate.toFixed(1)}%`, sub:avgRate>=20?"excellent":avgRate>=10?"on track":"below target", acc:avgRate>=20?C.green:avgRate>=10?C.gold:C.red},
  ];

  return (
    <div style={{maxWidth:1000,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32,flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>
            Year to date · {statements.length} month{statements.length!==1?"s":""}
          </div>
          <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0,letterSpacing:"-0.02em"}}>Financial Overview</h2>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          {score!==null&&(()=>{const{grade,color,label}=scoreToGrade(score);return(
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:F.serif,fontSize:isMobile?40:52,fontWeight:300,color,lineHeight:1}}>{grade}</div>
              <div style={{color,fontFamily:F.sans,fontSize:12,marginTop:2}}>{score}/100 · {label}</div>
            </div>
          );})()}
          {!isMobile&&<Btn variant="primary" onClick={()=>setView("upload")}>+ Add month</Btn>}
        </div>
      </div>
      {isMobile&&<div style={{marginBottom:16}}><Btn variant="primary" onClick={()=>setView("upload")} style={{width:"100%",justifyContent:"center"}}>+ Add month</Btn></div>}

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {statCards.map((c,i)=>(
          <Card key={i} style={{padding:"18px 20px"}}>
            <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>{c.label}</div>
            <div style={{fontFamily:F.serif,fontSize:isMobile?24:30,fontWeight:300,color:c.acc||C.text,lineHeight:1}}>{c.value}</div>
            <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:7}}>{c.sub}</div>
          </Card>
        ))}
      </div>

      {/* Category breakdown + trend */}
      <div style={{display:"grid",gridTemplateColumns:(!isMobile&&chartData.length>1)?"1.1fr 0.9fr":"1fr",gap:16,marginBottom:20}}>
        {aggregatedCats.length>0&&(
          <Card style={{padding:"26px"}}>
            <SectionLabel>Where Your Money Goes</SectionLabel>
            <CategoryBreakdown categories={aggregatedCats} currency={cur} budgets={budgets}/>
          </Card>
        )}
        {!isMobile&&chartData.length>1&&(
          <Card style={{padding:"26px"}}>
            <SectionLabel>Monthly Trend</SectionLabel>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={3} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{fontFamily:F.sans,fontSize:11,fill:C.dim}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:F.mono,fontSize:10,fill:C.dim}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v,cur)} width={52}/>
                <Tooltip content={<Tip/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                <Bar dataKey="Income" fill="rgba(91,143,168,0.55)" radius={[3,3,0,0]}/>
                <Bar dataKey="Spent"  fill="rgba(168,112,91,0.55)" radius={[3,3,0,0]}/>
                <Bar dataKey="Saved"  fill="rgba(91,168,120,0.65)" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:18,marginTop:10,justifyContent:"center"}}>
              {[["Income","rgba(91,143,168,0.8)"],["Spent","rgba(168,112,91,0.8)"],["Saved","rgba(91,168,120,0.9)"]].map(([l,col])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:2,background:col}}/>
                  <span style={{color:C.dim,fontFamily:F.sans,fontSize:12}}>{l}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Subscription panel */}
      <SubscriptionPanel statements={statements} currency={cur}/>

      {/* Savings projection */}
      <SavingsProjection statements={statements} currency={cur}/>

      {/* Month comparison */}
      <MonthComparison statements={statements} currency={cur}/>

      {/* Goals + history */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
        <Card style={{padding:"26px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <SectionLabel>Goals</SectionLabel>
            <button onClick={()=>setView("goals")} style={{background:"none",border:"none",color:C.gold,fontFamily:F.sans,fontWeight:500,fontSize:12,cursor:"pointer",padding:0}}>Manage →</button>
          </div>
          {goals.length===0?(
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:13,marginBottom:14}}>No goals set yet</div>
              <Btn onClick={()=>setView("goals")} style={{fontSize:12}}>Set a goal →</Btn>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {goals.map(g=>{
                const{pct,label,color,inverted}=getGoalProgress(g);
                return(
                  <div key={g.id}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                      <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{g.label}</span>
                      <span style={{color,fontFamily:F.sans,fontSize:12}}>{inverted?`${Math.round(100-pct)}% headroom`:`${Math.round(pct)}% done`}</span>
                    </div>
                    <ProgressBar pct={Math.min(100,Math.max(0,pct))} color={color}/>
                    <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:5}}>{label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card style={{padding:"26px"}}>
          <SectionLabel>Statement History</SectionLabel>
          {[...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt)).slice(0,8).map((s,i,arr)=>(
            <div key={s.id} onClick={()=>onViewDetail(s)}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none",cursor:"pointer",transition:"opacity 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.6"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <div>
                <div style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{s.period}</div>
                <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:2}}>{s.savingsRate}% rate · {fmt(s.totalSpent,s.currency||"£")} spent</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:s.savings>=0?C.green:C.red,fontFamily:F.mono,fontSize:13}}>{s.savings>=0?"+":"−"}{fmt(Math.abs(s.savings),s.currency||"£")}</div>
                <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:2}}>view →</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── Budget planner ───────────────────────────────────────────────────────────
function BudgetPage({ statements, budgets, setBudgets }) {
  const isMobile = useIsMobile();
  const cur    = statements[0]?.currency||"£";
  const latest = statements.length ? [...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0] : null;
  const [cuts, setCuts] = useState({});

  const totalCuts        = Object.values(cuts).reduce((a,v)=>a+(parseFloat(v)||0),0);
  const annualSavings    = totalCuts*12;
  const avgIncome        = statements.length ? statements.reduce((a,s)=>a+s.income,0)/statements.length : 0;
  const avgSavings       = statements.length ? statements.reduce((a,s)=>a+s.savings,0)/statements.length : 0;
  const newMonthlySaved  = avgSavings+totalCuts;
  const newRate          = avgIncome>0 ? (newMonthlySaved/avgIncome)*100 : 0;

  const inp = {background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 11px",color:C.text,fontFamily:F.mono,fontSize:13,outline:"none",width:isMobile?80:100,textAlign:"right"};

  return (
    <div style={{maxWidth:800,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
      <div style={{marginBottom:36}}>
        <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Monthly spending limits</div>
        <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>Budget Planner</h2>
      </div>

      <Card style={{padding:"26px",marginBottom:24}}>
        <SectionLabel>Set your monthly limits{latest?` · Latest: ${latest.period}`:""}</SectionLabel>
        {!latest&&<div style={{color:C.dim,fontFamily:F.sans,fontSize:13,marginBottom:16}}>Set budgets now — they'll show progress once you upload a statement.</div>}

        {/* Header row */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto auto":"1fr auto auto auto",gap:"0 12px",marginBottom:8,alignItems:"center"}}>
          {["Category","Spent","Budget",!isMobile&&"Status"].filter(Boolean).map((h,i)=>(
            <div key={i} style={{color:C.dimmer,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",textAlign:i===0?"left":"right"}}>{h}</div>
          ))}
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,marginBottom:4}}/>

        {CATEGORIES.filter(c=>c!=="Savings & Investments").map(cat=>{
          const actual  = latest?.categories.find(c=>c.name===cat)?.amount||0;
          const budget  = budgets[cat]||0;
          const pct     = budget>0 ? (actual/budget)*100 : 0;
          const status  = budget>0 ? (pct>100?"red":pct>80?"amber":"green") : "none";
          const sColor  = {green:C.green,amber:C.gold,red:C.red,none:"transparent"};
          const color   = catColor(cat,CATEGORIES.indexOf(cat));
          const remaining = budget>0 ? budget-actual : null;
          return (
            <div key={cat} style={{borderBottom:`1px solid ${C.border}`,paddingTop:12,paddingBottom:12}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto auto":"1fr auto auto auto",gap:"0 12px",alignItems:"center",marginBottom:budget>0&&latest?8:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:9,height:9,borderRadius:3,background:color,flexShrink:0}}/>
                  <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{cat}</span>
                </div>
                <div style={{color:actual>0?C.gold:C.dimmer,fontFamily:F.mono,fontSize:13,textAlign:"right"}}>{actual>0?fmt(actual,cur):"—"}</div>
                <input type="number" value={budgets[cat]||""} placeholder="Limit" onChange={e=>setBudgets({...budgets,[cat]:parseFloat(e.target.value)||0})} style={inp}/>
                {!isMobile&&(
                  <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6}}>
                    {status!=="none"&&<div style={{width:9,height:9,borderRadius:"50%",background:sColor[status]}}/>}
                    {remaining!==null&&<span style={{color:remaining>=0?C.green:C.red,fontFamily:F.mono,fontSize:12,minWidth:70,textAlign:"right"}}>{remaining>=0?`+${fmt(remaining,cur)}`:fmt(remaining,cur)}</span>}
                  </div>
                )}
              </div>
              {budget>0&&latest&&(
                <div style={{paddingLeft:17}}>
                  <div style={{height:5,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:sColor[status]||color,borderRadius:3,transition:"width 0.7s ease"}}/>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* What if calculator */}
      {latest&&(
        <Card style={{padding:"26px"}}>
          <SectionLabel>What If Calculator</SectionLabel>
          <div style={{color:C.dim,fontFamily:F.sans,fontSize:13,marginBottom:20,lineHeight:1.6}}>
            Enter a monthly reduction for any category to see the impact on your savings.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0 12px",marginBottom:8}}>
            {["Category","Current avg","Cut by /mo"].map((h,i)=>(
              <div key={i} style={{color:C.dimmer,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",textAlign:i===0?"left":"right"}}>{h}</div>
            ))}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,marginBottom:4}}/>
          {latest.categories.slice(0,8).map((cat,i)=>(
            <div key={cat.name} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0 12px",alignItems:"center",paddingTop:11,borderBottom:`1px solid ${C.border}`,paddingBottom:11}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:3,background:catColor(cat.name,i),flexShrink:0}}/>
                <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{cat.name}</span>
              </div>
              <div style={{color:C.dim,fontFamily:F.mono,fontSize:12,textAlign:"right"}}>{fmt(cat.amount,cur)}</div>
              <input type="number" value={cuts[cat.name]||""} placeholder="0" min="0" max={cat.amount}
                onChange={e=>setCuts({...cuts,[cat.name]:e.target.value})} style={{...inp,width:isMobile?72:90}}/>
            </div>
          ))}
          {totalCuts>0&&(
            <div style={{marginTop:20,padding:"20px",background:"rgba(91,168,120,0.07)",border:"1px solid rgba(91,168,120,0.18)",borderRadius:12}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:16}}>
                {[
                  {label:"Monthly saving",    value:fmt(totalCuts,cur),      color:C.green},
                  {label:"Annual saving",     value:fmt(annualSavings,cur),  color:C.green},
                  {label:"New savings rate",  value:`${Math.max(0,newRate).toFixed(1)}%`, color:newRate>=20?C.green:newRate>=10?C.gold:C.red},
                ].map(({label,value,color})=>(
                  <div key={label}>
                    <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:6}}>{label}</div>
                    <div style={{color,fontFamily:F.serif,fontSize:isMobile?22:26,fontWeight:300}}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Upload ───────────────────────────────────────────────────────────────────
function UploadPage({ onSave, onComplete }) {
  const isMobile = useIsMobile();
  const [phase,setPhase]=useState("upload");
  const [drag,setDrag]=useState(false);
  const [fileName,setFile]=useState("");
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const [step,setStep]=useState(0);
  const inputRef=useRef();
  const stepTimer=useRef();
  const steps=["Reading statement…","Categorising transactions…","Calculating savings rate…","Generating insights…"];

  const processFile = async file => {
    setFile(file.name); setPhase("analyzing"); setError(null); setStep(0);
    stepTimer.current=setInterval(()=>setStep(s=>(s+1)%steps.length),1400);
    try {
      let messages;
      if(file.type==="application/pdf"){
        const b64=await readB64(file);
        messages=[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:PROMPT}]}];
      } else {
        const text=await readText(file);
        messages=[{role:"user",content:`Bank statement:\n\n${text}\n\n${PROMPT}`}];
      }
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});
      const data=await res.json();
      const raw=data.content?.map(c=>c.text||"").join("")||"";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      const full={...parsed,id:Date.now().toString(),savedAt:new Date().toISOString()};
      onSave(full);
      setResult(full); setPhase("result");
    } catch {
      setError("Couldn't parse this file. Try exporting as CSV from your bank app.");
      setPhase("upload");
    } finally { clearInterval(stepTimer.current); }
  };

  const handleDrop=e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)processFile(f);};
  const handleDrag=e=>{e.preventDefault();setDrag(e.type==="dragenter"||e.type==="dragover");};

  if(phase==="analyzing") return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",gap:28}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{width:52,height:52,borderRadius:"50%",border:`1px solid ${C.border}`,borderTop:`1px solid ${C.gold}`,animation:"spin 1.2s linear infinite"}}/>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:F.serif,fontSize:28,fontWeight:300,color:C.text,marginBottom:8}}>Analysing {fileName}</div>
        <div style={{color:C.gold,fontFamily:F.sans,fontSize:13}}>{steps[step]}</div>
      </div>
    </div>
  );

  if(phase==="result"&&result){
    const cur=result.currency||"£";
    return(
      <div style={{maxWidth:680,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
        <div style={{marginBottom:28}}>
          <div style={{color:C.green,fontFamily:F.sans,fontWeight:600,fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>✓ Saved to your tracker</div>
          <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>{result.period}</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {[{label:"Income",value:fmt(result.income,cur),acc:null},{label:"Spent",value:fmt(result.totalSpent,cur),acc:null},{label:"Saved",value:fmt(result.savings,cur),acc:result.savings>=0?C.green:C.red},{label:"Savings Rate",value:`${result.savingsRate}%`,acc:result.savingsRate>=20?C.green:result.savingsRate>=10?C.gold:C.red}].map(c=>(
            <Card key={c.label} style={{padding:"16px 20px"}}>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{c.label}</div>
              <div style={{fontFamily:F.serif,fontSize:isMobile?22:28,fontWeight:300,color:c.acc||C.text}}>{c.value}</div>
            </Card>
          ))}
        </div>
        <Card style={{padding:"22px 26px",marginBottom:16}}>
          <SectionLabel>Spending Breakdown</SectionLabel>
          <CategoryBreakdown categories={result.categories} currency={cur}/>
        </Card>
        <Card style={{padding:"22px 26px",marginBottom:28}}>
          <SectionLabel>Insights</SectionLabel>
          {result.insights.map((ins,i)=>(
            <div key={i} style={{display:"flex",gap:14,marginBottom:14}}>
              <span style={{color:C.gold,fontFamily:F.mono,fontSize:12,flexShrink:0}}>0{i+1}</span>
              <span style={{color:"rgba(240,240,248,0.7)",fontFamily:F.sans,fontSize:13,lineHeight:1.7}}>{ins}</span>
            </div>
          ))}
        </Card>
        <div style={{display:"flex",gap:12}}>
          <Btn onClick={()=>{setPhase("upload");setResult(null);}} style={{flex:1}}>← Upload another</Btn>
          <Btn variant="primary" onClick={onComplete} style={{flex:2,fontSize:14,padding:"12px 20px"}}>View in dashboard →</Btn>
        </div>
      </div>
    );
  }

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",padding:isMobile?20:40}}>
      <div style={{textAlign:"center",marginBottom:44}}>
        <h2 style={{fontFamily:F.serif,fontSize:isMobile?32:44,fontWeight:300,color:C.text,margin:"0 0 12px"}}>Upload a statement</h2>
        <p style={{color:C.dim,fontFamily:F.sans,fontSize:14,margin:0}}>CSV, PDF or TXT export from your bank</p>
      </div>
      <div onDrop={handleDrop} onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag}
        onClick={()=>inputRef.current.click()}
        style={{width:"100%",maxWidth:500,border:`1px dashed ${drag?C.gold:"rgba(255,255,255,0.15)"}`,borderRadius:18,padding:isMobile?"36px 24px":"54px 40px",textAlign:"center",cursor:"pointer",transition:"all 0.25s",background:drag?"rgba(212,168,83,0.04)":"rgba(255,255,255,0.02)"}}>
        <div style={{fontSize:36,opacity:0.4,marginBottom:14}}>↑</div>
        <div style={{color:C.text,fontFamily:F.serif,fontSize:22,marginBottom:8}}>Drop your statement here</div>
        <div style={{color:C.dim,fontFamily:F.sans,fontSize:13}}>or click to browse</div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.pdf,.txt,.ofx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])processFile(e.target.files[0]);}}/>
      {error&&<div style={{marginTop:20,padding:"14px 22px",borderRadius:10,background:"rgba(200,80,80,0.1)",border:"1px solid rgba(200,80,80,0.25)",color:"#e07878",fontFamily:F.sans,fontSize:13,maxWidth:500,textAlign:"center"}}>{error}</div>}
    </div>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────
function GoalsPage({ goals, setGoals, statements }) {
  const isMobile = useIsMobile();
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({type:"savings_total",label:"",target:"",category:CATEGORIES[0]});
  const cur=statements[0]?.currency||"£";
  const ytdSaved=statements.reduce((a,s)=>a+s.savings,0);
  const avgRate=statements.length?statements.reduce((a,s)=>a+s.savingsRate,0)/statements.length:0;

  const getProgress=g=>{
    if(g.type==="savings_total"){const pct=(ytdSaved/g.target)*100;return{pct,label:`${fmt(ytdSaved,cur)} of ${fmt(g.target,cur)} saved YTD`,color:pct>=100?C.green:pct>=50?C.gold:C.dim};}
    if(g.type==="savings_rate"){const pct=(avgRate/g.target)*100;return{pct,label:`${avgRate.toFixed(1)}% avg vs ${g.target}% target`,color:pct>=100?C.green:pct>=60?C.gold:C.dim};}
    if(g.type==="category_limit"){const avg=statements.length?statements.reduce((a,s)=>a+(s.categories.find(c=>c.name===g.category)?.amount||0),0)/statements.length:0;const pct=(avg/g.target)*100;return{pct,label:`${fmt(avg,cur)} avg/month vs ${fmt(g.target,cur)} limit`,color:pct>100?C.red:pct>80?C.gold:C.green,inverted:true};}
    return{pct:0,label:"",color:C.dim};
  };

  const autoLabel=(type,target,category)=>{
    if(type==="savings_total") return target?`Save ${fmt(target,cur)} this year`:"";
    if(type==="savings_rate")  return target?`Maintain ${target}% savings rate`:"";
    if(type==="category_limit") return(target&&category)?`Keep ${category} under ${fmt(target,cur)}/mo`:"";
    return "";
  };
  const updateForm=patch=>{const next={...form,...patch};setForm({...next,label:autoLabel(next.type,next.target,next.category)||next.label});};
  const addGoal=()=>{
    if(!form.label.trim()||!form.target) return;
    setGoals([...goals,{id:Date.now().toString(),type:form.type,label:form.label.trim(),target:parseFloat(form.target),category:form.category}]);
    setAdding(false);setForm({type:"savings_total",label:"",target:"",category:CATEGORIES[0]});
  };

  const inp={width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 13px",color:C.text,fontFamily:F.sans,fontSize:13,outline:"none"};
  const typeConfig={savings_total:"Total savings target",savings_rate:"Monthly savings rate",category_limit:"Category spend cap"};

  return(
    <div style={{maxWidth:700,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:36}}>
        <div>
          <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Financial targets</div>
          <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>Goals</h2>
        </div>
        {!adding&&<Btn variant="primary" onClick={()=>setAdding(true)}>+ New goal</Btn>}
      </div>

      {adding&&(
        <Card style={{padding:"26px",marginBottom:24}}>
          <SectionLabel>New Goal</SectionLabel>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {Object.entries(typeConfig).map(([t,l])=>(
              <button key={t} onClick={()=>updateForm({type:t})} style={{background:form.type===t?"rgba(212,168,83,0.12)":"none",border:`1px solid ${form.type===t?C.gold:C.border}`,borderRadius:7,padding:"8px 15px",color:form.type===t?C.gold:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:12,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
            ))}
          </div>
          {form.type==="category_limit"&&(
            <div style={{marginBottom:14}}>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Category</div>
              <select value={form.category} onChange={e=>updateForm({category:e.target.value})} style={{...inp}}>
                {CATEGORIES.map(c=><option key={c} value={c} style={{background:"#1a1a28"}}>{c}</option>)}
              </select>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
            <div>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{form.type==="savings_rate"?"Target (%)": `Target (${cur})`}</div>
              <input type="number" value={form.target} placeholder={form.type==="savings_rate"?"20":"5000"} onChange={e=>updateForm({target:e.target.value})} style={inp}/>
            </div>
            <div>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Label</div>
              <input type="text" value={form.label} placeholder="e.g. Emergency fund" onChange={e=>setForm({...form,label:e.target.value})} style={inp}/>
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>setAdding(false)} style={{flex:1}}>Cancel</Btn>
            <Btn variant="primary" onClick={addGoal} style={{flex:2,fontSize:13,padding:"12px 20px"}}>Create goal</Btn>
          </div>
        </Card>
      )}

      {goals.length===0&&!adding?(
        <div style={{textAlign:"center",padding:"60px 0",color:C.dim,fontFamily:F.sans,fontSize:14}}>No goals yet. Create a target to start tracking progress.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {goals.map(g=>{
            const{pct,label,color,inverted}=getProgress(g);
            const dp=Math.min(100,Math.max(0,pct));
            const dl=inverted?(pct>100?`Over budget by ${Math.round(pct-100)}%`:`${Math.round(100-pct)}% headroom remaining`):pct>=100?"🎯 Goal reached!":`${Math.round(pct)}% of the way there`;
            return(
              <Card key={g.id} style={{padding:"22px 26px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div style={{color:C.text,fontFamily:F.sans,fontSize:14,fontWeight:500,marginBottom:4}}>{g.label}</div>
                    <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>{typeConfig[g.type]}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{color,fontFamily:F.serif,fontSize:32,fontWeight:300,lineHeight:1}}>{Math.round(dp)}%</div>
                    <button onClick={()=>setGoals(goals.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:C.dimmer,cursor:"pointer",fontSize:16,padding:"4px 6px"}} onMouseEnter={e=>e.target.style.color=C.red} onMouseLeave={e=>e.target.style.color=C.dimmer}>✕</button>
                  </div>
                </div>
                <ProgressBar pct={dp} color={color} h={6}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:9}}>
                  <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12}}>{label}</div>
                  <div style={{color,fontFamily:F.sans,fontSize:12}}>{dl}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────
function DetailPage({ statement:s, onBack, onDelete, budgets }) {
  const isMobile = useIsMobile();
  const cur=s.currency||"£";
  return(
    <div style={{maxWidth:840,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:32}}>
        <Btn onClick={onBack}>← Back</Btn>
        <Btn variant="danger" onClick={()=>{onDelete(s.id);onBack();}}>Delete</Btn>
      </div>
      <div style={{marginBottom:32}}>
        <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Statement detail</div>
        <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>{s.period}</h2>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[{label:"Income",value:fmt(s.income,cur),acc:null},{label:"Spent",value:fmt(s.totalSpent,cur),acc:null},{label:"Saved",value:fmt(s.savings,cur),acc:s.savings>=0?C.green:C.red},{label:"Rate",value:`${s.savingsRate}%`,acc:s.savingsRate>=20?C.green:s.savingsRate>=10?C.gold:C.red}].map(c=>(
          <Card key={c.label} style={{padding:"16px 18px"}}>
            <div style={{color:C.dim,fontFamily:F.sans,fontWeight:500,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{c.label}</div>
            <div style={{fontFamily:F.serif,fontSize:isMobile?22:26,fontWeight:300,color:c.acc||C.text}}>{c.value}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:16}}>
        <Card style={{padding:"22px 26px"}}>
          <SectionLabel>Spending Breakdown</SectionLabel>
          <CategoryBreakdown categories={s.categories} currency={cur} budgets={budgets}/>
        </Card>
        <Card style={{padding:"22px 26px"}}>
          <SectionLabel>Insights</SectionLabel>
          {s.insights.map((ins,i)=>(
            <div key={i} style={{display:"flex",gap:14,marginBottom:14}}>
              <span style={{color:C.gold,fontFamily:F.mono,fontSize:11,flexShrink:0,marginTop:2}}>0{i+1}</span>
              <span style={{color:"rgba(240,240,248,0.7)",fontFamily:F.sans,fontSize:13,lineHeight:1.7}}>{ins}</span>
            </div>
          ))}
        </Card>
      </div>
      <Card style={{padding:"22px 26px"}}>
        <SectionLabel>Top Merchants</SectionLabel>
        {s.topMerchants.map((m,i,arr)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
            <div>
              <div style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{m.name}</div>
              <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12}}>{m.category}</div>
            </div>
            <div style={{color:C.gold,fontFamily:F.serif,fontSize:24,fontWeight:400}}>{fmt(m.amount,cur)}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,setView]               = useState("overview");
  const [statements,setStatements]   = useState([]);
  const [goals,setGoals]             = useState([]);
  const [budgets,setBudgets]         = useState({});
  const [selected,setSelected]       = useState(null);
  const [loaded,setLoaded]           = useState(false);
  const isMobile                     = useIsMobile();

  useEffect(()=>{
    const link=document.createElement("link");
    link.href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Inter:wght@300;400;500;600&family=DM+Mono:wght@300;400&display=swap";
    link.rel="stylesheet";
    document.head.appendChild(link);
    setStatements(storageGet("fin-statements")||[]);
    setGoals(storageGet("fin-goals")||[]);
    setBudgets(storageGet("fin-budgets")||{});
    setLoaded(true);
  },[]);

  const saveStatements = s=>{setStatements(s);storageSet("fin-statements",s);};
  const saveGoals      = g=>{setGoals(g);     storageSet("fin-goals",g);};
  const saveBudgets    = b=>{setBudgets(b);   storageSet("fin-budgets",b);};
  const loadDemo       = ()=>{saveStatements([...statements,...DEMO_STATEMENTS.filter(d=>!statements.find(s=>s.id===d.id))]);setView("overview");};

  if(!loaded) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:14}}>Loading…</div>
    </div>
  );

  if(selected) return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text}}>
      <DetailPage statement={selected} budgets={budgets} onBack={()=>setSelected(null)}
        onDelete={id=>{saveStatements(statements.filter(s=>s.id!==id));setSelected(null);}}/>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text}}>
      <Nav view={view} setView={setView} isMobile={isMobile}/>
      {view==="overview"&&<OverviewPage statements={statements} goals={goals} budgets={budgets} setView={setView} onViewDetail={setSelected} onLoadDemo={loadDemo}/>}
      {view==="upload"  &&<UploadPage onSave={s=>saveStatements([...statements,s])} onComplete={()=>setView("overview")}/>}
      {view==="budget"  &&<BudgetPage statements={statements} budgets={budgets} setBudgets={saveBudgets}/>}
      {view==="goals"   &&<GoalsPage goals={goals} setGoals={saveGoals} statements={statements}/>}
    </div>
  );
}
