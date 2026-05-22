import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#0b0b12", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.07)",
  gold: "#d4a853", green: "#5ba878", red: "#a85b5b",
  text: "#f0f0f8", dim: "rgba(240,240,248,0.45)", dimmer: "rgba(240,240,248,0.2)",
};
const F = { serif: "'Cormorant Garamond',serif", sans: "'Nunito',sans-serif" };
const num = { fontFamily: "'Nunito',sans-serif", fontWeight: 700 };

// ─── Categories ───────────────────────────────────────────────────────────────
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
const catColor = (name,i) => CAT_COLORS[name]||["#d4a853","#5b8fa8","#a8705b","#5ba878","#8a5ba8"][i%5];

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_STATEMENTS = [
  { id:"demo-1", savedAt:"2025-02-01T00:00:00.000Z", period:"February 2025", currency:"£",
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
      "Shopping spend of £341.80 was high — ASOS (£156.90) was the biggest driver.",
      "Your 8 subscriptions cost £67.97/month — that's £815.64/year. Worth auditing which you use.",
      "Savings rate of 12.6% is below the 20% target. Cutting shopping by £100 would close most of the gap.",
    ],
  },
  { id:"demo-2", savedAt:"2025-03-01T00:00:00.000Z", period:"March 2025", currency:"£",
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
      "Great improvement — shopping dropped £143 vs February, pushing savings rate to 19.8%.",
      "Transport rose £25 this month. A monthly travelcard could help.",
      "You're £4.40/month away from the 20% savings target.",
    ],
  },
];

// ─── AI prompt ────────────────────────────────────────────────────────────────
const PROMPT = `Analyse this bank statement and return ONLY valid JSON — no markdown, no fences, no explanation.

{"period":"e.g. March 2025","currency":"£","income":0,"totalSpent":0,"savings":0,"savingsRate":0,"categories":[{"name":"Category","amount":0,"count":0}],"topMerchants":[{"name":"Merchant","amount":0,"category":"Category"}],"insights":["insight 1","insight 2","insight 3"]}

Rules:
- Categories use ONLY: Food & Groceries, Transport, Shopping, Bills & Utilities, Subscriptions, Entertainment, Health & Wellness, Travel, Savings & Investments, Other
- Subscriptions: ALL recurring digital/membership — Netflix, Spotify, Amazon Prime, Disney+, Apple services, Xbox/PlayStation, gym memberships, cloud storage, software, news. Any regular monthly/annual service.
- Entertainment: one-off only — cinema, concerts, events, games bought outright
- Bills & Utilities: rent/mortgage, electricity, gas, water, council tax, broadband, phone contract, insurance
- income = salary/wages/money in (exclude own-account transfers)
- totalSpent = all debits (exclude savings transfers); savings = income - totalSpent
- savingsRate = savings/income*100 rounded 1dp; categories sorted by amount desc
- topMerchants: top 6 by spend; insights: 3 specific actionable with real numbers
- All amounts plain numbers`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const periodToMonthIdx = p => { const l=p.toLowerCase(); const f=MONTHS_FULL.findIndex(m=>l.includes(m)); return f!==-1?f:MONTHS.findIndex(m=>l.includes(m.toLowerCase())); };
const storageGet = k => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):null; } catch { return null; } };
const storageSet = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch(e) { console.error(e); } };
const fmt  = (n,c="£") => `${c}${Math.abs(n).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtK = (n,c="£") => Math.abs(n)>=1000?`${c}${(Math.abs(n)/1000).toFixed(1)}k`:fmt(n,c);
const readText = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsText(f);});
const readB64  = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});

function useIsMobile() {
  const [m,setM]=useState(window.innerWidth<700);
  useEffect(()=>{const h=()=>setM(window.innerWidth<700);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return m;
}

// ─── Health score ─────────────────────────────────────────────────────────────
function calcHealthScore(statements,budgets) {
  if(!statements.length) return null;
  const avgRate=statements.reduce((a,s)=>a+s.savingsRate,0)/statements.length;
  const latest=[...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
  const rateScore=Math.min(40,Math.max(0,(avgRate/20)*40));
  const bKeys=Object.entries(budgets).filter(([,v])=>v>0);
  let budgetScore=17.5;
  if(bKeys.length>0){
    const scores=bKeys.map(([cat,budget])=>{const a=latest.categories.find(c=>c.name===cat)?.amount||0;const r=a/budget;return r<=0.8?1:r<=1?0.5:0;});
    budgetScore=(scores.reduce((a,v)=>a+v,0)/scores.length)*35;
  }
  let trendScore=12.5;
  if(statements.length>1){const s=[...statements].sort((a,b)=>a.savedAt.localeCompare(b.savedAt));trendScore=Math.max(0,Math.min(25,12.5+(s[s.length-1].savingsRate-s[0].savingsRate)*1.5));}
  return Math.round(rateScore+budgetScore+trendScore);
}
function scoreToGrade(s){
  if(s>=80) return{grade:"A",color:C.green,label:"Excellent"};
  if(s>=65) return{grade:"B",color:"#7ab85b",label:"Good"};
  if(s>=50) return{grade:"C",color:C.gold,label:"Fair"};
  if(s>=35) return{grade:"D",color:"#c4883a",label:"Needs work"};
  return{grade:"F",color:C.red,label:"Action needed"};
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function Card({children,style={},onClick}){return <div onClick={onClick} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,...style}}>{children}</div>;}
function SectionLabel({children}){return <div style={{color:C.dim,fontFamily:F.sans,fontWeight:700,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>{children}</div>;}
function PBar({pct,color=C.gold,h=5}){return(<div style={{height:h,background:"rgba(255,255,255,0.06)",borderRadius:h/2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,pct))}%`,background:color,borderRadius:h/2,transition:"width 0.7s ease"}}/></div>);}
function Btn({children,onClick,variant="ghost",style={}}){
  const base={fontFamily:F.sans,fontWeight:700,fontSize:13,borderRadius:9,padding:"9px 18px",cursor:"pointer",border:"none",transition:"all 0.2s",...style};
  const v={primary:{background:C.gold,color:"#0b0b12"},ghost:{background:"none",border:`1px solid ${C.border}`,color:C.dim},danger:{background:"none",border:"1px solid rgba(168,91,91,0.35)",color:C.red}};
  return <button onClick={onClick} style={{...base,...v[variant]}}>{children}</button>;
}

// Shared inline input with optional prefix/suffix
function InlineInput({value,placeholder,onChange,prefix,suffix,width="100%"}){
  return(
    <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",width}}>
      {prefix&&<span style={{color:C.dim,fontFamily:F.sans,fontSize:13,padding:"0 4px 0 10px",userSelect:"none",flexShrink:0}}>{prefix}</span>}
      <input type="number" value={value} placeholder={placeholder} onChange={onChange}
        style={{flex:1,background:"none",border:"none",color:C.text,...num,fontSize:13,padding:prefix?"7px 8px 7px 2px":"7px 10px",outline:"none",minWidth:0}}/>
      {suffix&&<span style={{color:C.dim,fontFamily:F.sans,fontSize:13,padding:"0 10px 0 2px",userSelect:"none",flexShrink:0}}>{suffix}</span>}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({view,setView,isMobile}){
  const tabs=isMobile?[["overview","Home"],["upload","Upload"],["budget","Budget"],["goals","Goals"]]:[["overview","Overview"],["upload","Upload"],["budget","Budget"],["goals","Goals"]];
  return(
    <div style={{borderBottom:`1px solid ${C.border}`,padding:`0 ${isMobile?"14px":"28px"}`,display:"flex",justifyContent:"space-between",alignItems:"center",height:56}}>
      <div style={{fontFamily:F.serif,fontSize:isMobile?17:20,color:C.text}}><span style={{color:C.gold}}>◆</span> Fintrack</div>
      <div style={{display:"flex",gap:2}}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>setView(id)} style={{background:"none",border:"none",padding:isMobile?"6px 10px":"8px 16px",cursor:"pointer",fontFamily:F.sans,fontWeight:700,fontSize:isMobile?11:13,color:view===id?C.gold:C.dim,borderBottom:view===id?`2px solid ${C.gold}`:"2px solid transparent",marginBottom:-1,transition:"all 0.2s"}}>{label}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Category breakdown ───────────────────────────────────────────────────────
function CategoryBreakdown({categories,currency,limit=10,budgets={}}){
  const cur=currency||"£";
  const data=categories.slice(0,limit);
  const total=data.reduce((a,c)=>a+c.amount,0);
  const max=Math.max(...data.map(c=>c.amount),1);
  return(
    <div>
      {data.map((cat,i)=>{
        const color=catColor(cat.name,i);
        const budget=budgets[cat.name];
        const bp=budget?(cat.amount/budget)*100:null;
        const light=bp===null?null:bp>100?C.red:bp>80?C.gold:C.green;
        const pct=total>0?(cat.amount/total)*100:0;
        return(
          <div key={cat.name} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:10,height:10,borderRadius:3,background:color,flexShrink:0}}/>
                <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{cat.name}</span>
                {light&&<div style={{width:7,height:7,borderRadius:"50%",background:light,flexShrink:0}}/>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{color:C.dimmer,fontFamily:F.sans,fontSize:12}}>{pct.toFixed(1)}%</span>
                <span style={{...num,fontSize:13,color:C.gold,minWidth:76,textAlign:"right"}}>{fmt(cat.amount,cur)}</span>
              </div>
            </div>
            <div style={{height:7,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(cat.amount/max)*100}%`,background:color,borderRadius:4,transition:"width 0.8s ease"}}/>
            </div>
          </div>
        );
      })}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:C.dim,fontFamily:F.sans,fontSize:13}}>Total spent</span>
        <span style={{...num,fontSize:13,color:C.gold}}>{fmt(total,cur)}</span>
      </div>
    </div>
  );
}

// ─── Category detail page ─────────────────────────────────────────────────────
function CategoriesDetailPage({statements,budgets,onBack}){
  const isMobile=useIsMobile();
  if(!statements.length) return null;
  const cur=statements[0].currency||"£";
  const catMap={};
  statements.forEach(s=>s.categories.forEach(cat=>{
    if(!catMap[cat.name]) catMap[cat.name]={name:cat.name,total:0,count:0,months:[]};
    catMap[cat.name].total+=cat.amount;
    catMap[cat.name].count+=cat.count||0;
    catMap[cat.name].months.push({period:s.period,amount:cat.amount,savedAt:s.savedAt});
  }));
  const cats=Object.values(catMap).sort((a,b)=>b.total-a.total);
  const grandTotal=cats.reduce((a,c)=>a+c.total,0);
  const merchantsByCat={};
  statements.forEach(s=>(s.topMerchants||[]).forEach(m=>{
    if(!merchantsByCat[m.category]) merchantsByCat[m.category]={};
    merchantsByCat[m.category][m.name]=(merchantsByCat[m.category][m.name]||0)+m.amount;
  }));
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
      <div style={{marginBottom:32}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:13,cursor:"pointer",padding:0,marginBottom:20}}>← Back to overview</button>
        <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>
          {statements.length} month{statements.length!==1?"s":""} · {fmt(grandTotal,cur)} total
        </div>
        <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>Spending Breakdown</h2>
      </div>
      {cats.map((cat,i)=>{
        const color=catColor(cat.name,i);
        const pct=(cat.total/grandTotal)*100;
        const avgPerMonth=cat.total/statements.length;
        const budget=budgets[cat.name];
        const merchants=merchantsByCat[cat.name]?Object.entries(merchantsByCat[cat.name]).sort((a,b)=>b[1]-a[1]).slice(0,5):[];
        const monthsSorted=[...cat.months].sort((a,b)=>a.savedAt.localeCompare(b.savedAt));
        return(
          <Card key={cat.name} style={{padding:"22px 26px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:12,height:12,borderRadius:4,background:color,flexShrink:0}}/>
                <span style={{color:C.text,fontFamily:F.sans,fontWeight:700,fontSize:15}}>{cat.name}</span>
                {budget>0&&(()=>{const r=(avgPerMonth/budget)*100;const bc=r>100?C.red:r>80?C.gold:C.green;return<div style={{width:8,height:8,borderRadius:"50%",background:bc,flexShrink:0}}/>;})()}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{...num,fontSize:20,color:C.gold}}>{fmt(cat.total,cur)}</div>
                <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:3}}>
                  {fmt(avgPerMonth,cur)}/mo · {pct.toFixed(1)}% of spending
                  {budget>0&&<span style={{marginLeft:8}}>· budget {fmt(budget,cur)}</span>}
                </div>
              </div>
            </div>
            <div style={{height:9,background:"rgba(255,255,255,0.05)",borderRadius:5,overflow:"hidden",marginBottom:14}}>
              <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:color,borderRadius:5}}/>
            </div>
            {merchants.length>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:monthsSorted.length>1?12:0}}>
                {merchants.map(([name,amount])=>(
                  <div key={name} style={{background:`${color}18`,border:`1px solid ${color}33`,borderRadius:8,padding:"5px 12px",display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{color:C.text,fontFamily:F.sans,fontSize:12}}>{name}</span>
                    <span style={{...num,fontSize:12,color}}>{fmt(amount,cur)}</span>
                  </div>
                ))}
              </div>
            )}
            {monthsSorted.length>1&&(
              <div style={{display:"flex",gap:16,flexWrap:"wrap",paddingTop:merchants.length>0?10:0,borderTop:merchants.length>0?`1px solid ${C.border}`:"none"}}>
                {monthsSorted.map((m,mi,arr)=>{
                  const prev=mi>0?arr[mi-1].amount:null;
                  const diff=prev!==null?m.amount-prev:null;
                  return(
                    <div key={m.period} style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:C.dimmer,fontFamily:F.sans,fontSize:12}}>{m.period.slice(0,3)}</span>
                      <span style={{...num,fontSize:12,color:C.text}}>{fmt(m.amount,cur)}</span>
                      {diff!==null&&<span style={{fontFamily:F.sans,fontSize:11,color:diff>0?C.red:C.green,fontWeight:700}}>{diff>0?"▲":"▼"}{fmt(Math.abs(diff),cur)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Subscription panel ───────────────────────────────────────────────────────
function SubscriptionPanel({statements,currency}){
  const cur=currency||"£";
  if(!statements.length) return null;
  const latest=[...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0];
  const subCat=latest.categories.find(c=>c.name==="Subscriptions");
  if(!subCat||subCat.amount===0) return null;
  const monthly=subCat.amount;
  const subs=(latest.topMerchants||[]).filter(m=>m.category==="Subscriptions");
  return(
    <Card style={{padding:"24px 26px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <SectionLabel>Subscriptions</SectionLabel>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:F.serif,fontSize:28,fontWeight:300,color:CAT_COLORS["Subscriptions"],lineHeight:1}}>
            {fmt(monthly,cur)}<span style={{fontFamily:F.sans,fontSize:13,color:C.dim}}>/mo</span>
          </div>
          <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:4}}>{fmt(monthly*12,cur)} per year</div>
        </div>
      </div>
      {subs.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
          {subs.map((m,i)=>(
            <div key={i} style={{background:"rgba(138,91,168,0.1)",border:"1px solid rgba(138,91,168,0.22)",borderRadius:8,padding:"5px 12px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:C.text,fontFamily:F.sans,fontSize:12}}>{m.name}</span>
              <span style={{...num,fontSize:12,color:CAT_COLORS["Subscriptions"]}}>{fmt(m.amount,cur)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{padding:"10px 14px",background:"rgba(138,91,168,0.07)",borderRadius:9,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:15}}>💡</span>
        <span style={{color:C.dim,fontFamily:F.sans,fontSize:12,lineHeight:1.6}}>Cancelling one unused subscription could save {fmt(monthly*12,cur)} a year — it leaves your account quietly every month.</span>
      </div>
    </Card>
  );
}

// ─── Savings projection (editable projected months) ───────────────────────────
function SavingsProjection({statements,currency,projOverrides,onOverrideChange}){
  const cur=currency||"£";
  if(!statements.length) return null;
  const avgSavings=statements.reduce((a,s)=>a+s.savings,0)/statements.length;
  const avgIncome =statements.reduce((a,s)=>a+s.income,0)/statements.length;
  const ytdSaved  =statements.reduce((a,s)=>a+s.savings,0);
  const actualByIdx={};
  statements.forEach(s=>{const i=periodToMonthIdx(s.period);if(i!==-1)actualByIdx[i]=s.savings;});
  const getProjAmt=i=>projOverrides[i]!==undefined?Math.max(0,projOverrides[i]):Math.max(0,avgSavings);
  const projIdxs=MONTHS.map((_,i)=>i).filter(i=>actualByIdx[i]===undefined);
  const yearEnd=ytdSaved+projIdxs.reduce((a,i)=>a+getProjAmt(i),0);
  const chartData=MONTHS.map((name,i)=>({name,Actual:actualByIdx[i]!==undefined?Math.max(0,actualByIdx[i]):null,Projected:actualByIdx[i]===undefined?getProjAmt(i):null}));
  const Tip=({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    const item=payload.find(p=>p.value!=null);if(!item) return null;
    return(<div style={{background:"#1a1a28",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px"}}><div style={{color:C.gold,fontFamily:F.sans,fontSize:12,marginBottom:4}}>{label}</div><div style={{...num,fontSize:12,color:item.fill}}>{item.name}: {fmt(item.value,cur)}</div>{item.name==="Projected"&&<div style={{color:C.dimmer,fontFamily:F.sans,fontSize:11,marginTop:2}}>editable below</div>}</div>);
  };
  return(
    <Card style={{padding:"26px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <SectionLabel>Savings Projection · Full Year</SectionLabel>
          <div style={{color:C.dim,fontFamily:F.sans,fontSize:13}}>Avg {fmt(avgSavings,cur)}/mo · {fmt(avgIncome,cur)}/mo income</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:4}}>year-end forecast</div>
          <div style={{fontFamily:F.serif,fontSize:34,fontWeight:300,color:yearEnd>=0?C.green:C.red,lineHeight:1}}>{yearEnd>=0?"":"−"}{fmtK(Math.abs(yearEnd),cur)}</div>
          <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:4}}>{projIdxs.length>0?`${projIdxs.length} months projected`:"full year tracked"}</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={chartData} barGap={2} barCategoryGap="28%">
          <XAxis dataKey="name" tick={{fontFamily:F.sans,fontSize:10,fill:C.dim}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontFamily:F.sans,fontSize:10,fill:C.dim}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v,cur)} width={52}/>
          <Tooltip content={<Tip/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
          <Bar dataKey="Actual"    fill={C.green}              radius={[3,3,0,0]}/>
          <Bar dataKey="Projected" fill="rgba(91,168,120,0.22)"radius={[3,3,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
      {projIdxs.length>0&&(
        <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
          <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:12}}>Adjust projected months — override the estimate with your own figure:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {projIdxs.map(i=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:11}}>{MONTHS[i]}</div>
                <InlineInput value={projOverrides[i]!==undefined?projOverrides[i]:""} placeholder={Math.round(avgSavings)} prefix={cur} width={90} onChange={e=>onOverrideChange(i,e.target.value)}/>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:20,marginTop:16,justifyContent:"flex-end"}}>
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
function MonthComparison({statements,currency}){
  const cur=currency||"£";
  if(!statements.length) return null;
  const sorted=[...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
  const current=sorted[0],previous=sorted[1]||null;
  const catNames=[...new Set([...current.categories.map(c=>c.name),...(previous?.categories.map(c=>c.name)||[])])];
  const rows=catNames.map(name=>{
    const ca=current.categories.find(c=>c.name===name)?.amount||0;
    const pa=previous?.categories.find(c=>c.name===name)?.amount||0;
    const diff=ca-pa,pct=pa>0?(diff/pa)*100:null;
    const next=statements.reduce((a,s)=>a+(s.categories.find(c=>c.name===name)?.amount||0),0)/statements.length;
    return{name,ca,pa,diff,pct,next};
  }).filter(r=>r.ca>0||r.pa>0).sort((a,b)=>b.ca-a.ca);
  const nextTotal=rows.reduce((a,r)=>a+r.next,0);
  const hasPrev=!!previous;
  const cols=`1fr 110px${hasPrev?" 110px":""} 110px`;
  const cell={fontFamily:F.sans,fontWeight:700,fontSize:12,textAlign:"right",paddingTop:9};
  return(
    <Card style={{padding:"26px",marginBottom:20}}>
      <SectionLabel>Monthly Breakdown · {current.period}{previous?` vs ${previous.period}`:""}</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:cols,gap:"0 4px",marginBottom:8}}>
        {["Category",current.period.slice(0,3),hasPrev&&previous.period.slice(0,3),"Next est."].filter(Boolean).map((h,i)=>(
          <div key={i} style={{color:C.dimmer,fontFamily:F.sans,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.07em",textAlign:i===0?"left":"right"}}>{h}</div>
        ))}
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,marginBottom:4}}/>
      {rows.slice(0,9).map((row,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:cols,gap:"0 4px",alignItems:"center"}}>
          <div style={{color:C.text,fontFamily:F.sans,fontSize:13,paddingTop:9,paddingBottom:2}}>{row.name}</div>
          <div style={{...cell,color:C.gold}}>{fmt(row.ca,cur)}</div>
          {hasPrev&&<div style={{...cell,color:C.dim}}>{row.pa>0?fmt(row.pa,cur):<span style={{color:C.dimmer}}>—</span>}{row.pct!==null&&<span style={{marginLeft:5,fontSize:10,fontFamily:F.sans,fontWeight:700,color:row.diff>0?C.red:C.green}}>{row.diff>0?"▲":"▼"}{Math.abs(row.pct).toFixed(0)}%</span>}</div>}
          <div style={{...cell,color:C.dimmer}}>{fmt(row.next,cur)}</div>
        </div>
      ))}
      <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,display:"grid",gridTemplateColumns:cols,gap:"0 4px"}}>
        <div style={{color:C.text,fontFamily:F.sans,fontWeight:700,fontSize:13}}>Total</div>
        <div style={{...cell,color:C.gold}}>{fmt(current.totalSpent,cur)}</div>
        {hasPrev&&<div style={{...cell,color:C.dim}}>{fmt(previous.totalSpent,cur)}{(()=>{const d=current.totalSpent-previous.totalSpent;const p=(d/previous.totalSpent)*100;return<span style={{marginLeft:5,fontSize:10,fontFamily:F.sans,fontWeight:700,color:d>0?C.red:C.green}}>{d>0?"▲":"▼"}{Math.abs(p).toFixed(0)}%</span>;})()}</div>}
        <div style={{...cell,color:C.dimmer}}>{fmt(nextTotal,cur)}</div>
      </div>
      {!hasPrev&&<div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:14,textAlign:"center"}}>Upload another month to see the comparison</div>}
    </Card>
  );
}

// ─── Compound / What-if calculator ───────────────────────────────────────────
function CompoundCalculator({currency}){
  const isMobile=useIsMobile();
  const cur=currency||"£";
  const [monthly,setMonthly]=useState("");
  const [rate,setRate]=useState("5");
  const [years,setYears]=useState("10");
  const m=parseFloat(monthly)||0,r=parseFloat(rate)||0,y=Math.max(1,parseFloat(years)||1);
  const mr=r/100/12;
  const fv=months=>mr===0?m*months:m*((Math.pow(1+mr,months)-1)/mr);
  const finalVal=fv(y*12),contributed=m*y*12,interest=Math.max(0,finalVal-contributed);
  const milestones=[1,2,3,5,10,15,20].filter(yr=>yr<=y);
  if(!milestones.includes(Math.floor(y))) milestones.push(Math.floor(y));
  milestones.sort((a,b)=>a-b);
  const chartData=milestones.map(yr=>({name:`${yr}y`,Balance:Math.round(fv(yr*12)),Contributed:Math.round(m*yr*12)}));
  const Tip=({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return(<div style={{background:"#1a1a28",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px"}}><div style={{color:C.gold,fontFamily:F.sans,fontSize:12,marginBottom:4}}>{label}</div>{payload.map(p=><div key={p.name} style={{...num,fontSize:12,color:p.fill,marginBottom:2}}>{p.name}: {fmtK(p.value,cur)}</div>)}</div>);
  };
  return(
    <Card style={{padding:"26px",marginBottom:20}}>
      <SectionLabel>What If Calculator</SectionLabel>
      <div style={{color:C.dim,fontFamily:F.sans,fontSize:13,marginBottom:20,lineHeight:1.6}}>See what regular saving or investing adds up to — including compound growth.</div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:14,marginBottom:24}}>
        <div>
          <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,marginBottom:8}}>Monthly amount</div>
          <InlineInput value={monthly} placeholder="200" prefix={cur} onChange={e=>setMonthly(e.target.value)}/>
        </div>
        <div>
          <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,marginBottom:8}}>Annual return</div>
          <InlineInput value={rate} placeholder="5" suffix="%" onChange={e=>setRate(e.target.value)}/>
        </div>
        <div style={isMobile?{gridColumn:"1 / -1"}:{}}>
          <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,marginBottom:8}}>Over how long</div>
          <InlineInput value={years} placeholder="10" suffix="yrs" onChange={e=>setYears(e.target.value)}/>
        </div>
      </div>
      {m>0?(
        <>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:12,marginBottom:24}}>
            <Card style={{padding:"16px 18px",border:`1px solid rgba(91,168,120,0.2)`}}>
              <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:6}}>Final balance</div>
              <div style={{fontFamily:F.serif,fontSize:isMobile?22:28,fontWeight:300,color:C.green}}>{fmtK(finalVal,cur)}</div>
            </Card>
            <Card style={{padding:"16px 18px"}}>
              <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:6}}>You put in</div>
              <div style={{fontFamily:F.serif,fontSize:isMobile?22:28,fontWeight:300,color:C.text}}>{fmtK(contributed,cur)}</div>
            </Card>
            <Card style={{padding:"16px 18px",border:`1px solid rgba(212,168,83,0.2)`,gridColumn:isMobile?"1 / -1":"auto"}}>
              <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:6}}>{r>0?"Interest / growth":"Total saved"}</div>
              <div style={{fontFamily:F.serif,fontSize:isMobile?22:28,fontWeight:300,color:C.gold}}>{fmtK(interest,cur)}</div>
            </Card>
          </div>
          {milestones.length>1&&(
            <>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:700,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Growth over time</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barGap={2} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{fontFamily:F.sans,fontSize:10,fill:C.dim}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontFamily:F.sans,fontSize:10,fill:C.dim}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v,cur)} width={52}/>
                  <Tooltip content={<Tip/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                  <Bar dataKey="Contributed" fill="rgba(91,143,168,0.45)" radius={[3,3,0,0]}/>
                  <Bar dataKey="Balance"     fill="rgba(91,168,120,0.65)" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:18,marginTop:8,justifyContent:"flex-end"}}>
                {[["Contributed","rgba(91,143,168,0.7)"],["Balance",C.green]].map(([l,col])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:8,height:8,borderRadius:2,background:col}}/>
                    <span style={{color:C.dim,fontFamily:F.sans,fontSize:12}}>{l}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{marginTop:20,display:"flex",flexWrap:"wrap",gap:10}}>
            {milestones.map(yr=>(
              <div key={yr} style={{flex:"1 1 80px",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
                <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:11,marginBottom:4}}>{yr} yr{yr!==1?"s":""}</div>
                <div style={{...num,fontSize:15,color:C.green}}>{fmtK(fv(yr*12),cur)}</div>
              </div>
            ))}
          </div>
        </>
      ):(
        <div style={{textAlign:"center",padding:"24px 0",color:C.dimmer,fontFamily:F.sans,fontSize:13}}>Enter a monthly amount above to see what it grows to</div>
      )}
    </Card>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewPage({statements,goals,budgets,setView,onViewDetail,onLoadDemo,projOverrides,onOverrideChange}){
  const isMobile=useIsMobile();
  const score=calcHealthScore(statements,budgets);
  if(!statements.length) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",gap:24,textAlign:"center",padding:40}}>
      <div style={{fontSize:44,opacity:0.15}}>◈</div>
      <div>
        <div style={{fontFamily:F.serif,fontSize:isMobile?28:36,fontWeight:300,color:C.text,marginBottom:10}}>No statements yet</div>
        <div style={{color:C.dim,fontFamily:F.sans,fontSize:14,lineHeight:1.8}}>Upload a bank statement to see exactly where<br/>your money is going, and start planning.</div>
      </div>
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12,alignItems:"center"}}>
        <Btn variant="primary" onClick={()=>setView("upload")} style={{fontSize:14,padding:"12px 28px"}}>Upload a statement →</Btn>
        <Btn onClick={onLoadDemo} style={{fontSize:13}}>Try with demo data</Btn>
      </div>
    </div>
  );
  const cur=statements[0].currency||"£";
  const ytdIncome=statements.reduce((a,s)=>a+s.income,0);
  const ytdSpent =statements.reduce((a,s)=>a+s.totalSpent,0);
  const ytdSaved =statements.reduce((a,s)=>a+s.savings,0);
  const avgRate  =statements.reduce((a,s)=>a+s.savingsRate,0)/statements.length;
  const allCats={};
  statements.forEach(s=>s.categories.forEach(cat=>{allCats[cat.name]=(allCats[cat.name]||0)+cat.amount;}));
  const aggregatedCats=Object.entries(allCats).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);
  const sortedByDate=[...statements].sort((a,b)=>a.savedAt.localeCompare(b.savedAt));
  const chartData=sortedByDate.map(s=>({name:s.period.slice(0,3),Income:Math.round(s.income),Spent:Math.round(s.totalSpent),Saved:Math.max(0,Math.round(s.savings))}));
  const getGoalProgress=g=>{
    if(g.type==="savings_total"){const p=(ytdSaved/g.target)*100;return{pct:p,label:`${fmt(ytdSaved,cur)} of ${fmt(g.target,cur)}`,color:p>=100?C.green:p>=50?C.gold:C.dim};}
    if(g.type==="savings_rate"){const p=(avgRate/g.target)*100;return{pct:p,label:`${avgRate.toFixed(1)}% avg vs ${g.target}% target`,color:p>=100?C.green:p>=60?C.gold:C.dim};}
    if(g.type==="category_limit"){const avg=statements.reduce((a,s)=>a+(s.categories.find(c=>c.name===g.category)?.amount||0),0)/statements.length;const p=(avg/g.target)*100;return{pct:p,label:`${fmt(avg,cur)} avg/mo vs ${fmt(g.target,cur)} limit`,color:p>100?C.red:p>80?C.gold:C.green,inverted:true};}
    return{pct:0,label:"",color:C.dim};
  };
  const Tip=({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return(<div style={{background:"#1a1a28",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px"}}><div style={{color:C.gold,fontFamily:F.sans,fontSize:12,marginBottom:6}}>{label}</div>{payload.map(p=><div key={p.name} style={{...num,fontSize:12,color:p.fill,marginBottom:2}}>{p.name}: {fmt(p.value,cur)}</div>)}</div>);
  };
  return(
    <div style={{maxWidth:1000,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32,flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Year to date · {statements.length} month{statements.length!==1?"s":""}</div>
          <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>Financial Overview</h2>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          {score!==null&&(()=>{const{grade,color,label}=scoreToGrade(score);return(<div style={{textAlign:"right"}}><div style={{fontFamily:F.serif,fontSize:isMobile?40:52,fontWeight:300,color,lineHeight:1}}>{grade}</div><div style={{color,fontFamily:F.sans,fontWeight:700,fontSize:12,marginTop:2}}>{score}/100 · {label}</div></div>);})()}
          {!isMobile&&<Btn variant="primary" onClick={()=>setView("upload")}>+ Add month</Btn>}
        </div>
      </div>
      {isMobile&&<div style={{marginBottom:16}}><Btn variant="primary" onClick={()=>setView("upload")} style={{width:"100%"}}>+ Add month</Btn></div>}

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[
          {label:"YTD Income",value:fmtK(ytdIncome,cur),sub:"money received",acc:null},
          {label:"YTD Spent", value:fmtK(ytdSpent,cur), sub:"total outgoings",acc:null},
          {label:"YTD Saved", value:fmtK(ytdSaved,cur), sub:ytdSaved>=0?"positive trend":"overspent",acc:ytdSaved>=0?C.green:C.red},
          {label:"Avg Rate",  value:`${avgRate.toFixed(1)}%`,sub:avgRate>=20?"excellent":avgRate>=10?"on track":"below target",acc:avgRate>=20?C.green:avgRate>=10?C.gold:C.red},
        ].map((c,i)=>(
          <Card key={i} style={{padding:"18px 20px"}}>
            <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>{c.label}</div>
            <div style={{fontFamily:F.serif,fontSize:isMobile?24:30,fontWeight:300,color:c.acc||C.text,lineHeight:1}}>{c.value}</div>
            <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:7}}>{c.sub}</div>
          </Card>
        ))}
      </div>

      {/* Breakdown + trend */}
      <div style={{display:"grid",gridTemplateColumns:(!isMobile&&chartData.length>1)?"1.1fr 0.9fr":"1fr",gap:16,marginBottom:20}}>
        {aggregatedCats.length>0&&(
          <Card style={{padding:"26px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <SectionLabel>Where Your Money Goes</SectionLabel>
              <button onClick={()=>setView("categories")} style={{background:"none",border:"none",color:C.gold,fontFamily:F.sans,fontWeight:700,fontSize:12,cursor:"pointer",padding:0}}>Full breakdown →</button>
            </div>
            <CategoryBreakdown categories={aggregatedCats} currency={cur} budgets={budgets}/>
          </Card>
        )}
        {!isMobile&&chartData.length>1&&(
          <Card style={{padding:"26px"}}>
            <SectionLabel>Monthly Trend</SectionLabel>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={3} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{fontFamily:F.sans,fontSize:11,fill:C.dim}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:F.sans,fontSize:10,fill:C.dim}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v,cur)} width={52}/>
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

      <SubscriptionPanel statements={statements} currency={cur}/>
      <SavingsProjection statements={statements} currency={cur} projOverrides={projOverrides} onOverrideChange={onOverrideChange}/>
      <MonthComparison statements={statements} currency={cur}/>

      {/* Goals + history */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:20}}>
        <Card style={{padding:"26px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <SectionLabel>Goals</SectionLabel>
            <button onClick={()=>setView("goals")} style={{background:"none",border:"none",color:C.gold,fontFamily:F.sans,fontWeight:700,fontSize:12,cursor:"pointer",padding:0}}>Manage →</button>
          </div>
          {goals.length===0?(
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:13,marginBottom:14}}>No goals set yet</div>
              <Btn onClick={()=>setView("goals")} style={{fontSize:12}}>Set a goal →</Btn>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              {goals.map(g=>{
                const{pct,label,color,inverted}=getGoalProgress(g);
                return(<div key={g.id}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                    <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{g.label}</span>
                    <span style={{color,fontFamily:F.sans,fontWeight:700,fontSize:12}}>{inverted?`${Math.round(100-pct)}% headroom`:`${Math.round(pct)}% done`}</span>
                  </div>
                  <PBar pct={Math.min(100,Math.max(0,pct))} color={color}/>
                  <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:5}}>{label}</div>
                </div>);
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
                <div style={{...num,fontSize:13,color:s.savings>=0?C.green:C.red}}>{s.savings>=0?"+":"−"}{fmt(Math.abs(s.savings),s.currency||"£")}</div>
                <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12,marginTop:2}}>view →</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* What-if compound calculator */}
      <CompoundCalculator currency={cur}/>
    </div>
  );
}

// ─── Budget planner ───────────────────────────────────────────────────────────
function BudgetPage({statements,budgets,setBudgets}){
  const isMobile=useIsMobile();
  const cur=statements[0]?.currency||"£";
  const latest=statements.length?[...statements].sort((a,b)=>b.savedAt.localeCompare(a.savedAt))[0]:null;
  const [cuts,setCuts]=useState({});
  const totalCuts=Object.values(cuts).reduce((a,v)=>a+(parseFloat(v)||0),0);
  const avgIncome =statements.length?statements.reduce((a,s)=>a+s.income,0)/statements.length:0;
  const avgSavings=statements.length?statements.reduce((a,s)=>a+s.savings,0)/statements.length:0;
  const newRate   =avgIncome>0?((avgSavings+totalCuts)/avgIncome)*100:0;
  return(
    <div style={{maxWidth:780,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
      <div style={{marginBottom:32}}>
        <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Monthly spending limits</div>
        <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>Budget Planner</h2>
        {latest&&<div style={{color:C.dim,fontFamily:F.sans,fontSize:13,marginTop:6}}>Comparing against {latest.period}</div>}
      </div>

      <Card style={{marginBottom:24,overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 90px 106px 90px",gap:"0 10px",padding:"10px 22px",borderBottom:`1px solid ${C.border}`,background:"rgba(255,255,255,0.02)"}}>
          {["Category","Spent","Budget","Left"].map((h,i)=>(
            <div key={h} style={{color:C.dimmer,fontFamily:F.sans,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.07em",textAlign:i===0?"left":"right"}}>{h}</div>
          ))}
        </div>
        {CATEGORIES.filter(c=>c!=="Savings & Investments").map((cat,idx)=>{
          const actual=latest?.categories.find(c=>c.name===cat)?.amount||0;
          const budget=budgets[cat]||0;
          const pct=budget>0?(actual/budget)*100:0;
          const status=budget>0?(pct>100?"red":pct>80?"amber":"green"):"none";
          const sColor={green:C.green,amber:C.gold,red:C.red,none:C.border};
          const left=budget>0?budget-actual:null;
          const color=catColor(cat,idx);
          return(
            <div key={cat} style={{borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 90px 106px 90px",gap:"0 10px",alignItems:"center",padding:"11px 22px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:9,height:9,borderRadius:3,background:color,flexShrink:0}}/>
                  <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{cat}</span>
                </div>
                <div style={{...num,fontSize:13,color:actual>0?C.dim:C.dimmer,textAlign:"right"}}>{actual>0?fmt(actual,cur):"—"}</div>
                <InlineInput value={budgets[cat]||""} placeholder="—" prefix={cur} onChange={e=>setBudgets({...budgets,[cat]:parseFloat(e.target.value)||0})}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5}}>
                  {status!=="none"&&<div style={{width:8,height:8,borderRadius:"50%",background:sColor[status],flexShrink:0}}/>}
                  <span style={{...num,fontSize:12,color:left===null?C.dimmer:left>=0?C.green:C.red}}>{left===null?"—":left>=0?`+${fmt(left,cur)}`:fmt(left,cur)}</span>
                </div>
              </div>
              {budget>0&&latest&&(
                <div style={{paddingLeft:39,paddingRight:22,paddingBottom:10}}>
                  <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:sColor[status],borderRadius:2,transition:"width 0.7s ease"}}/>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {!latest&&<div style={{color:C.dim,fontFamily:F.sans,fontSize:13,textAlign:"center",marginBottom:24,lineHeight:1.7}}>Set your limits above — they'll track against real spending once you upload a statement.</div>}

      {/* Spending cut calculator */}
      {latest&&(
        <Card style={{padding:"26px"}}>
          <SectionLabel>Spending Cut Calculator</SectionLabel>
          <div style={{color:C.dim,fontFamily:F.sans,fontSize:13,marginBottom:20,lineHeight:1.6}}>Enter a monthly reduction per category to see the impact on your savings.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 100px 106px",gap:"0 10px",marginBottom:8}}>
            {["Category","Avg/month","Cut by"].map((h,i)=>(
              <div key={h} style={{color:C.dimmer,fontFamily:F.sans,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.07em",textAlign:i===0?"left":"right"}}>{h}</div>
            ))}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,marginBottom:4}}/>
          {latest.categories.slice(0,8).map((cat,i)=>(
            <div key={cat.name} style={{display:"grid",gridTemplateColumns:"1fr 100px 106px",gap:"0 10px",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:3,background:catColor(cat.name,i),flexShrink:0}}/>
                <span style={{color:C.text,fontFamily:F.sans,fontSize:13}}>{cat.name}</span>
              </div>
              <div style={{...num,fontSize:12,color:C.dim,textAlign:"right"}}>{fmt(cat.amount,cur)}</div>
              <InlineInput value={cuts[cat.name]||""} placeholder="0" prefix={cur} onChange={e=>setCuts({...cuts,[cat.name]:e.target.value})}/>
            </div>
          ))}
          {totalCuts>0&&(
            <div style={{marginTop:20,padding:"18px 20px",background:"rgba(91,168,120,0.07)",border:"1px solid rgba(91,168,120,0.18)",borderRadius:12}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:16}}>
                {[{label:"Monthly saving",value:fmt(totalCuts,cur),color:C.green},{label:"Annual saving",value:fmt(totalCuts*12,cur),color:C.green},{label:"New savings rate",value:`${Math.max(0,newRate).toFixed(1)}%`,color:newRate>=20?C.green:newRate>=10?C.gold:C.red}].map(({label,value,color})=>(
                  <div key={label}>
                    <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,marginBottom:6}}>{label}</div>
                    <div style={{fontFamily:F.serif,fontSize:isMobile?20:26,fontWeight:300,color}}>{value}</div>
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
function UploadPage({onSave,onComplete}){
  const isMobile=useIsMobile();
  const [phase,setPhase]=useState("upload");
  const [drag,setDrag]=useState(false);
  const [fileName,setFile]=useState("");
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const [step,setStep]=useState(0);
  const inputRef=useRef(),stepTimer=useRef();
  const steps=["Reading statement…","Categorising transactions…","Calculating savings rate…","Generating insights…"];
  const processFile=async file=>{
    setFile(file.name);setPhase("analyzing");setError(null);setStep(0);
    stepTimer.current=setInterval(()=>setStep(s=>(s+1)%steps.length),1400);
    try{
      let messages;
      if(file.type==="application/pdf"){const b64=await readB64(file);messages=[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:PROMPT}]}];}
      else{const text=await readText(file);messages=[{role:"user",content:`Bank statement:\n\n${text}\n\n${PROMPT}`}];}
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});
      const data=await res.json();
      const raw=data.content?.map(c=>c.text||"").join("")||"";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      const full={...parsed,id:Date.now().toString(),savedAt:new Date().toISOString()};
      onSave(full);setResult(full);setPhase("result");
    }catch{setError("Couldn't parse this file. Try exporting as CSV from your bank app.");setPhase("upload");}
    finally{clearInterval(stepTimer.current);}
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
          <div style={{color:C.green,fontFamily:F.sans,fontWeight:700,fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>✓ Saved to your tracker</div>
          <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>{result.period}</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {[{label:"Income",value:fmt(result.income,cur),acc:null},{label:"Spent",value:fmt(result.totalSpent,cur),acc:null},{label:"Saved",value:fmt(result.savings,cur),acc:result.savings>=0?C.green:C.red},{label:"Savings Rate",value:`${result.savingsRate}%`,acc:result.savingsRate>=20?C.green:result.savingsRate>=10?C.gold:C.red}].map(c=>(
            <Card key={c.label} style={{padding:"16px 20px"}}>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{c.label}</div>
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
              <span style={{color:C.gold,fontFamily:F.sans,fontWeight:700,fontSize:12,flexShrink:0}}>0{i+1}</span>
              <span style={{color:"rgba(240,240,248,0.7)",fontFamily:F.sans,fontSize:13,lineHeight:1.7}}>{ins}</span>
            </div>
          ))}
        </Card>
        <div style={{display:"flex",gap:12}}>
          <Btn onClick={()=>{setPhase("upload");setResult(null);}}>← Upload another</Btn>
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
      <div onDrop={handleDrop} onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onClick={()=>inputRef.current.click()}
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
function GoalsPage({goals,setGoals,statements}){
  const isMobile=useIsMobile();
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({type:"savings_total",label:"",target:"",category:CATEGORIES[0]});
  const cur=statements[0]?.currency||"£";
  const ytdSaved=statements.reduce((a,s)=>a+s.savings,0);
  const avgRate=statements.length?statements.reduce((a,s)=>a+s.savingsRate,0)/statements.length:0;
  const getProgress=g=>{
    if(g.type==="savings_total"){const p=(ytdSaved/g.target)*100;return{pct:p,label:`${fmt(ytdSaved,cur)} of ${fmt(g.target,cur)} YTD`,color:p>=100?C.green:p>=50?C.gold:C.dim};}
    if(g.type==="savings_rate"){const p=(avgRate/g.target)*100;return{pct:p,label:`${avgRate.toFixed(1)}% avg vs ${g.target}% target`,color:p>=100?C.green:p>=60?C.gold:C.dim};}
    if(g.type==="category_limit"){const avg=statements.length?statements.reduce((a,s)=>a+(s.categories.find(c=>c.name===g.category)?.amount||0),0)/statements.length:0;const p=(avg/g.target)*100;return{pct:p,label:`${fmt(avg,cur)} avg/mo vs ${fmt(g.target,cur)} limit`,color:p>100?C.red:p>80?C.gold:C.green,inverted:true};}
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
          <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Financial targets</div>
          <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>Goals</h2>
        </div>
        {!adding&&<Btn variant="primary" onClick={()=>setAdding(true)}>+ New goal</Btn>}
      </div>
      {adding&&(
        <Card style={{padding:"26px",marginBottom:24}}>
          <SectionLabel>New Goal</SectionLabel>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {Object.entries(typeConfig).map(([t,l])=>(
              <button key={t} onClick={()=>updateForm({type:t})} style={{background:form.type===t?"rgba(212,168,83,0.12)":"none",border:`1px solid ${form.type===t?C.gold:C.border}`,borderRadius:7,padding:"8px 15px",color:form.type===t?C.gold:C.dim,fontFamily:F.sans,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
            ))}
          </div>
          {form.type==="category_limit"&&(
            <div style={{marginBottom:14}}>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Category</div>
              <select value={form.category} onChange={e=>updateForm({category:e.target.value})} style={{...inp}}>{CATEGORIES.map(c=><option key={c} value={c} style={{background:"#1a1a28"}}>{c}</option>)}</select>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
            <div>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{form.type==="savings_rate"?"Target (%)": `Target (${cur})`}</div>
              <input type="number" value={form.target} placeholder={form.type==="savings_rate"?"20":"5000"} onChange={e=>updateForm({target:e.target.value})} style={inp}/>
            </div>
            <div>
              <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Label</div>
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
            const dl=inverted?(pct>100?`Over by ${Math.round(pct-100)}%`:`${Math.round(100-pct)}% headroom`):pct>=100?"🎯 Goal reached!":`${Math.round(pct)}% there`;
            return(
              <Card key={g.id} style={{padding:"22px 26px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div style={{color:C.text,fontFamily:F.sans,fontSize:14,fontWeight:700,marginBottom:4}}>{g.label}</div>
                    <div style={{color:C.dim,fontFamily:F.sans,fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>{typeConfig[g.type]}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{color,fontFamily:F.serif,fontSize:32,fontWeight:300,lineHeight:1}}>{Math.round(dp)}%</div>
                    <button onClick={()=>setGoals(goals.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:C.dimmer,cursor:"pointer",fontSize:16,padding:"4px 6px"}} onMouseEnter={e=>e.target.style.color=C.red} onMouseLeave={e=>e.target.style.color=C.dimmer}>✕</button>
                  </div>
                </div>
                <PBar pct={dp} color={color} h={6}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:9}}>
                  <div style={{color:C.dimmer,fontFamily:F.sans,fontSize:12}}>{label}</div>
                  <div style={{color,fontFamily:F.sans,fontWeight:700,fontSize:12}}>{dl}</div>
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
function DetailPage({statement:s,onBack,onDelete,budgets}){
  const isMobile=useIsMobile();
  const cur=s.currency||"£";
  return(
    <div style={{maxWidth:840,margin:"0 auto",padding:`40px ${isMobile?"16px":"24px"} 80px`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:32}}>
        <Btn onClick={onBack}>← Back</Btn>
        <Btn variant="danger" onClick={()=>{onDelete(s.id);onBack();}}>Delete</Btn>
      </div>
      <div style={{marginBottom:32}}>
        <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Statement detail</div>
        <h2 style={{fontFamily:F.serif,fontSize:isMobile?28:38,fontWeight:300,color:C.text,margin:0}}>{s.period}</h2>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[{label:"Income",value:fmt(s.income,cur),acc:null},{label:"Spent",value:fmt(s.totalSpent,cur),acc:null},{label:"Saved",value:fmt(s.savings,cur),acc:s.savings>=0?C.green:C.red},{label:"Rate",value:`${s.savingsRate}%`,acc:s.savingsRate>=20?C.green:s.savingsRate>=10?C.gold:C.red}].map(c=>(
          <Card key={c.label} style={{padding:"16px 18px"}}>
            <div style={{color:C.dim,fontFamily:F.sans,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{c.label}</div>
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
              <span style={{color:C.gold,fontFamily:F.sans,fontWeight:700,fontSize:12,flexShrink:0,marginTop:2}}>0{i+1}</span>
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
            <div style={{fontFamily:F.serif,fontSize:24,fontWeight:400,color:C.gold}}>{fmt(m.amount,cur)}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [view,setView]             = useState("overview");
  const [statements,setStatements] = useState([]);
  const [goals,setGoals]           = useState([]);
  const [budgets,setBudgets]       = useState({});
  const [projOverrides,setProjOverrides] = useState({});
  const [selected,setSelected]     = useState(null);
  const [loaded,setLoaded]         = useState(false);
  const isMobile                   = useIsMobile();

  useEffect(()=>{
    const link=document.createElement("link");
    link.href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Nunito:wght@300;400;500;600;700&display=swap";
    link.rel="stylesheet";document.head.appendChild(link);
    setStatements(storageGet("fin-statements")||[]);
    setGoals(storageGet("fin-goals")||[]);
    setBudgets(storageGet("fin-budgets")||{});
    setProjOverrides(storageGet("fin-proj-overrides")||{});
    setLoaded(true);
  },[]);

  const saveStatements  = s=>{setStatements(s);storageSet("fin-statements",s);};
  const saveGoals       = g=>{setGoals(g);     storageSet("fin-goals",g);};
  const saveBudgets     = b=>{setBudgets(b);   storageSet("fin-budgets",b);};
  const saveProjOverride= (idx,val)=>{const next={...projOverrides,[idx]:parseFloat(val)||0};setProjOverrides(next);storageSet("fin-proj-overrides",next);};
  const loadDemo        = ()=>{saveStatements([...statements,...DEMO_STATEMENTS.filter(d=>!statements.find(s=>s.id===d.id))]);setView("overview");};

  if(!loaded) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:C.dimmer,fontFamily:F.sans,fontSize:14}}>Loading…</div></div>;

  if(view==="categories") return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text}}>
      <Nav view={view} setView={setView} isMobile={isMobile}/>
      <CategoriesDetailPage statements={statements} budgets={budgets} onBack={()=>setView("overview")}/>
    </div>
  );

  if(selected) return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text}}>
      <DetailPage statement={selected} budgets={budgets} onBack={()=>setSelected(null)} onDelete={id=>{saveStatements(statements.filter(s=>s.id!==id));setSelected(null);}}/>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text}}>
      <Nav view={view} setView={setView} isMobile={isMobile}/>
      {view==="overview"&&<OverviewPage statements={statements} goals={goals} budgets={budgets} setView={setView} onViewDetail={setSelected} onLoadDemo={loadDemo} projOverrides={projOverrides} onOverrideChange={saveProjOverride}/>}
      {view==="upload"  &&<UploadPage onSave={s=>saveStatements([...statements,s])} onComplete={()=>setView("overview")}/>}
      {view==="budget"  &&<BudgetPage statements={statements} budgets={budgets} setBudgets={saveBudgets}/>}
      {view==="goals"   &&<GoalsPage goals={goals} setGoals={saveGoals} statements={statements}/>}
    </div>
  );
}
