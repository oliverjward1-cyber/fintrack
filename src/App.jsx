import { useState, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from "recharts";

// ─── Palette & constants ──────────────────────────────────────────────────────
const C = {
  bg: "#0b0b12", card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.07)",
  gold: "#d4a853", green: "#5ba878", red: "#a85b5b", blue: "#5b8fa8",
  text: "#f0f0f8", dim: "rgba(240,240,248,0.4)", dimmer: "rgba(240,240,248,0.18)",
};

const CAT_COLORS = ["#d4a853","#5b8fa8","#a8705b","#5ba878","#8a5ba8","#5b7aa8","#a8a85b","#7a6a6a"];
const CATEGORIES = ["Food & Groceries","Transport","Shopping","Bills & Utilities","Entertainment","Health & Wellness","Travel","Savings & Investments","Other"];
const MONTHS     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["january","february","march","april","may","june","july","august","september","october","november","december"];

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
- Categories (use only these): Food & Groceries, Transport, Shopping, Bills & Utilities, Entertainment, Health & Wellness, Travel, Savings & Investments, Other
- income = salary / wages / money received (exclude transfers between own accounts)
- totalSpent = sum of all debits (exclude savings transfers)
- savings = income - totalSpent (can be negative)
- savingsRate = (savings / income) * 100, rounded to 1 decimal place
- Only include categories that have at least one transaction; sort by amount descending
- topMerchants: top 6 by total spend
- insights: 3 specific, actionable observations with real numbers from the data
- Use currency symbol found in statement; default £
- All amounts as plain numbers, no currency symbols inside values`;

// ─── Storage helpers ──────────────────────────────────────────────────────────
function storageGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch(e) { console.error(e); }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
const readB64  = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
const fmt  = (n, c = "£") => `${c}${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (n, c = "£") => Math.abs(n) >= 1000 ? `${c}${(Math.abs(n)/1000).toFixed(1)}k` : fmt(n, c);

function periodToMonthIdx(period) {
  const lower = period.toLowerCase();
  const full = MONTHS_FULL.findIndex(m => lower.includes(m));
  if (full !== -1) return full;
  return MONTHS.findIndex(m => lower.includes(m.toLowerCase()));
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>{children}</div>;
}

function ProgressBar({ pct, color = C.gold, h = 4 }) {
  return (
    <div style={{ height: h, background: "rgba(255,255,255,0.06)", borderRadius: h/2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: h/2, transition: "width 0.7s ease" }} />
    </div>
  );
}

function Btn({ children, onClick, variant = "ghost", style = {} }) {
  const base = { fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.05em", borderRadius: 8, padding: "10px 18px", cursor: "pointer", border: "none", transition: "all 0.2s", ...style };
  const variants = {
    primary: { background: C.gold, color: "#0b0b12", fontWeight: 500 },
    ghost:   { background: "none", border: `1px solid ${C.border}`, color: C.dim },
    danger:  { background: "none", border: `1px solid rgba(168,91,91,0.35)`, color: C.red },
  };
  return <button onClick={onClick} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ view, setView }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 54 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: C.text, letterSpacing: "-0.01em" }}>
        <span style={{ color: C.gold }}>◆</span> Fintrack
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {[["overview","Overview"],["upload","Upload"],["goals","Goals"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            background: "none", border: "none", padding: "8px 14px", cursor: "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.06em",
            color: view === id ? C.gold : C.dim,
            borderBottom: view === id ? `1px solid ${C.gold}` : "1px solid transparent",
            marginBottom: -1, transition: "all 0.2s",
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Spending pie ─────────────────────────────────────────────────────────────
function SpendingPie({ categories, currency }) {
  const [active, setActive] = useState(null);
  const cur = currency || "£";
  const data = categories.slice(0, 6);
  const total = data.reduce((a, c) => a + c.amount, 0);

  const CustomLabel = ({ cx, cy }) => {
    const cat = active != null ? data[active] : null;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        <tspan x={cx} dy="-0.4em" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fill: C.gold }}>
          {cat ? fmt(cat.amount, cur) : fmt(total, cur)}
        </tspan>
        <tspan x={cx} dy="1.6em" style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fill: C.dim }}>
          {cat ? cat.name.split(" ")[0] : "total spent"}
        </tspan>
      </text>
    );
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={82}
            dataKey="amount" paddingAngle={2}
            onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}
            labelLine={false} label={<CustomLabel />}>
            {data.map((_, i) => (
              <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]}
                opacity={active == null || active === i ? 1 : 0.35}
                style={{ cursor: "pointer", transition: "opacity 0.2s" }} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((cat, i) => (
          <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 8, opacity: active == null || active === i ? 1 : 0.35, transition: "opacity 0.2s" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
            <span style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{cat.name}</span>
            <span style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10, marginLeft: "auto" }}>
              {Math.round((cat.amount / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Savings projection ───────────────────────────────────────────────────────
function SavingsProjection({ statements, currency }) {
  const cur = currency || "£";
  if (!statements.length) return null;

  const avgSavings   = statements.reduce((a, s) => a + s.savings, 0) / statements.length;
  const avgIncome    = statements.reduce((a, s) => a + s.income,  0) / statements.length;
  const ytdSaved     = statements.reduce((a, s) => a + s.savings, 0);
  const monthsWithData = statements.length;
  const monthsLeft   = Math.max(0, 12 - monthsWithData);
  const yearEndTotal = ytdSaved + avgSavings * monthsLeft;
  const yearEndPositive = yearEndTotal >= 0;

  // Map actual statements to month slots
  const actualByIdx = {};
  statements.forEach(s => {
    const idx = periodToMonthIdx(s.period);
    if (idx !== -1) actualByIdx[idx] = s.savings;
  });

  // Build 12-month chart data
  const chartData = MONTHS.map((name, i) => {
    if (actualByIdx[i] !== undefined) {
      return { name, Actual: Math.max(0, actualByIdx[i]), Projected: null };
    }
    return { name, Actual: null, Projected: Math.max(0, avgSavings) };
  });

  const CustomTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const item = payload.find(p => p.value != null);
    if (!item) return null;
    return (
      <div style={{ background: "#1a1a28", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'DM Mono',monospace" }}>
        <div style={{ color: C.gold, fontSize: 10, marginBottom: 4 }}>{label}</div>
        <div style={{ color: item.fill, fontSize: 11 }}>{item.name}: {fmt(item.value, cur)}</div>
        {item.name === "Projected" && <div style={{ color: C.dimmer, fontSize: 9, marginTop: 2 }}>estimated from avg</div>}
      </div>
    );
  };

  return (
    <Card style={{ padding: "24px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <SectionLabel>Savings Projection · Full Year</SectionLabel>
          <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>
            Avg {fmt(avgSavings, cur)}/mo · {fmt(avgIncome, cur)}/mo income
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, marginBottom: 4 }}>year-end forecast</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 300, color: yearEndPositive ? C.green : C.red, lineHeight: 1 }}>
            {yearEndPositive ? "" : "−"}{fmtK(Math.abs(yearEndTotal), cur)}
          </div>
          <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 4 }}>
            {monthsLeft > 0 ? `${monthsLeft} months projected` : "full year tracked"}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} barGap={2} barCategoryGap="28%">
          <XAxis dataKey="name" tick={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fill: C.dim }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v, cur)} width={50} />
          <Tooltip content={<CustomTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="Actual"    fill={C.green}                  radius={[3,3,0,0]} />
          <Bar dataKey="Projected" fill="rgba(91,168,120,0.22)"    radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 20, marginTop: 10, justifyContent: "flex-end" }}>
        {[["Actual saved", C.green],["Projected", "rgba(91,168,120,0.45)"]].map(([l, col]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
            <span style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{l}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Month comparison ─────────────────────────────────────────────────────────
function MonthComparison({ statements, currency }) {
  const cur = currency || "£";
  if (!statements.length) return null;

  const sorted  = [...statements].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const current  = sorted[0];
  const previous = sorted[1] || null;

  // All category names across both months
  const catNames = [...new Set([
    ...current.categories.map(c => c.name),
    ...(previous?.categories.map(c => c.name) || []),
  ])];

  const rows = catNames.map(name => {
    const currAmt = current.categories.find(c => c.name === name)?.amount || 0;
    const prevAmt = previous?.categories.find(c => c.name === name)?.amount || 0;
    const diff    = currAmt - prevAmt;
    const pct     = prevAmt > 0 ? (diff / prevAmt) * 100 : null;

    // Next month estimate: rolling average across all statements
    const nextEst = statements.reduce((a, s) => {
      return a + (s.categories.find(c => c.name === name)?.amount || 0);
    }, 0) / statements.length;

    return { name, currAmt, prevAmt, diff, pct, nextEst };
  })
    .filter(r => r.currAmt > 0 || r.prevAmt > 0)
    .sort((a, b) => b.currAmt - a.currAmt);

  const nextTotalEst = rows.reduce((a, r) => a + r.nextEst, 0);
  const col = { fontFamily: "'DM Mono',monospace", fontSize: 11, textAlign: "right", paddingTop: 8 };

  return (
    <Card style={{ padding: "24px", marginBottom: 20 }}>
      <SectionLabel>
        Spending Breakdown · {current.period}{previous ? ` vs ${previous.period}` : ""}
      </SectionLabel>

      {/* Table header */}
      <div style={{ display: "grid", gridTemplateColumns: `1fr 110px${previous ? " 110px" : ""} 110px`, gap: "0 4px", marginBottom: 8 }}>
        <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 9, textTransform: "uppercase" }}>Category</div>
        <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 9, textTransform: "uppercase", textAlign: "right" }}>
          {current.period.slice(0, 3)}
        </div>
        {previous && (
          <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 9, textTransform: "uppercase", textAlign: "right" }}>
            {previous.period.slice(0, 3)}
          </div>
        )}
        <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 9, textTransform: "uppercase", textAlign: "right" }}>Next (est.)</div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 4 }} />

      {/* Rows */}
      {rows.slice(0, 8).map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: `1fr 110px${previous ? " 110px" : ""} 110px`, gap: "0 4px", alignItems: "center" }}>
          <div style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 11, paddingTop: 8, paddingBottom: 2 }}>{row.name}</div>
          <div style={{ ...col, color: C.gold }}>{fmt(row.currAmt, cur)}</div>
          {previous && (
            <div style={{ ...col, color: C.dim }}>
              {row.prevAmt > 0 ? fmt(row.prevAmt, cur) : <span style={{ color: C.dimmer }}>—</span>}
              {row.pct !== null && (
                <span style={{ marginLeft: 5, fontSize: 9, color: row.diff > 0 ? C.red : C.green }}>
                  {row.diff > 0 ? "▲" : "▼"}{Math.abs(row.pct).toFixed(0)}%
                </span>
              )}
            </div>
          )}
          <div style={{ ...col, color: C.dimmer }}>{fmt(row.nextEst, cur)}</div>
        </div>
      ))}

      {/* Total row */}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 10,
        display: "grid", gridTemplateColumns: `1fr 110px${previous ? " 110px" : ""} 110px`, gap: "0 4px" }}>
        <div style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 500 }}>Total spent</div>
        <div style={{ ...col, color: C.gold }}>{fmt(current.totalSpent, cur)}</div>
        {previous && (
          <div style={{ ...col, color: C.dim }}>
            {fmt(previous.totalSpent, cur)}
            {(() => { const d = current.totalSpent - previous.totalSpent; const p = (d/previous.totalSpent)*100; return (
              <span style={{ marginLeft: 5, fontSize: 9, color: d > 0 ? C.red : C.green }}>
                {d > 0 ? "▲" : "▼"}{Math.abs(p).toFixed(0)}%
              </span>
            ); })()}
          </div>
        )}
        <div style={{ ...col, color: C.dimmer }}>{fmt(nextTotalEst, cur)}</div>
      </div>

      {!previous && (
        <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 12, textAlign: "center" }}>
          Upload another month to see the comparison
        </div>
      )}
    </Card>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewPage({ statements, goals, setView, onViewDetail }) {
  if (!statements.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 24, textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 44, opacity: 0.2 }}>◈</div>
      <div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontWeight: 300, color: C.text, marginBottom: 8 }}>No statements yet</div>
        <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 12, lineHeight: 1.8 }}>Upload your first bank statement to start tracking<br />your spending and saving habits.</div>
      </div>
      <Btn variant="primary" onClick={() => setView("upload")} style={{ fontSize: 12, padding: "12px 28px" }}>Upload first statement →</Btn>
    </div>
  );

  const cur        = statements[0].currency || "£";
  const sorted     = [...statements].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const ytdIncome  = statements.reduce((a, s) => a + s.income, 0);
  const ytdSpent   = statements.reduce((a, s) => a + s.totalSpent, 0);
  const ytdSaved   = statements.reduce((a, s) => a + s.savings, 0);
  const avgRate    = statements.reduce((a, s) => a + s.savingsRate, 0) / statements.length;
  const rateColor  = avgRate >= 20 ? C.green : avgRate >= 10 ? C.gold : C.red;
  const savedColor = ytdSaved >= 0 ? C.green : C.red;

  // Aggregate categories
  const allCats = {};
  statements.forEach(s => s.categories.forEach(cat => {
    allCats[cat.name] = (allCats[cat.name] || 0) + cat.amount;
  }));
  const aggregatedCats = Object.entries(allCats)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const chartData = sorted.map(s => ({
    name: s.period.slice(0, 3),
    Income: Math.round(s.income),
    Spent:  Math.round(s.totalSpent),
    Saved:  Math.max(0, Math.round(s.savings)),
  }));

  const getGoalProgress = g => {
    if (g.type === "savings_total") {
      const pct = (ytdSaved / g.target) * 100;
      return { pct, label: `${fmt(ytdSaved, cur)} of ${fmt(g.target, cur)}`, color: pct >= 100 ? C.green : pct >= 50 ? C.gold : C.dim };
    }
    if (g.type === "savings_rate") {
      const pct = (avgRate / g.target) * 100;
      return { pct, label: `${avgRate.toFixed(1)}% avg vs ${g.target}% target`, color: pct >= 100 ? C.green : pct >= 60 ? C.gold : C.dim };
    }
    if (g.type === "category_limit") {
      const avg = statements.reduce((a, s) => { const cat = s.categories.find(c => c.name === g.category); return a + (cat?.amount || 0); }, 0) / statements.length;
      const pct = (avg / g.target) * 100;
      return { pct, label: `${fmt(avg, cur)} avg/mo vs ${fmt(g.target, cur)} limit`, color: pct > 100 ? C.red : pct > 80 ? C.gold : C.green, inverted: true };
    }
    return { pct: 0, label: "", color: C.dim };
  };

  const CustomTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#1a1a28", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'DM Mono',monospace" }}>
        <div style={{ color: C.gold, fontSize: 10, marginBottom: 6 }}>{label}</div>
        {payload.map(p => <div key={p.name} style={{ color: p.fill, fontSize: 11, marginBottom: 2 }}>{p.name}: {fmt(p.value, cur)}</div>)}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 80px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Year to date · {statements.length} month{statements.length !== 1 ? "s" : ""}</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 300, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>Financial Overview</h2>
        </div>
        <Btn variant="primary" onClick={() => setView("upload")} style={{ fontSize: 11 }}>+ Add month</Btn>
      </div>

      {/* YTD cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "YTD Income",       value: fmtK(ytdIncome, cur), sub: "money received",  acc: null },
          { label: "YTD Spent",        value: fmtK(ytdSpent, cur),  sub: "total outgoings", acc: null },
          { label: "YTD Saved",        value: fmtK(ytdSaved, cur),  sub: ytdSaved >= 0 ? "positive trend" : "overspent", acc: savedColor },
          { label: "Avg Savings Rate", value: `${avgRate.toFixed(1)}%`, sub: avgRate >= 20 ? "excellent" : avgRate >= 10 ? "on track" : "below target", acc: rateColor },
        ].map((c, i) => (
          <Card key={i} style={{ padding: "20px 22px" }}>
            <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, fontWeight: 300, color: c.acc || C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{c.value}</div>
            <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 7 }}>{c.sub}</div>
          </Card>
        ))}
      </div>

      {/* Charts row: pie + monthly trend */}
      <div style={{ display: "grid", gridTemplateColumns: statements.length > 1 ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
        {aggregatedCats.length > 0 && (
          <Card style={{ padding: "24px" }}>
            <SectionLabel>Spending by Category</SectionLabel>
            <SpendingPie categories={aggregatedCats} currency={cur} />
          </Card>
        )}
        {chartData.length > 1 && (
          <Card style={{ padding: "24px" }}>
            <SectionLabel>Monthly Trend</SectionLabel>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barGap={3} barCategoryGap="32%">
                <XAxis dataKey="name" tick={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fill: C.dim }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fill: C.dim }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v, cur)} width={52} />
                <Tooltip content={<CustomTip />} />
                <Bar dataKey="Income" fill="rgba(91,143,168,0.55)" radius={[3,3,0,0]} />
                <Bar dataKey="Spent"  fill="rgba(168,112,91,0.55)" radius={[3,3,0,0]} />
                <Bar dataKey="Saved"  fill="rgba(91,168,120,0.65)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 20, marginTop: 10, justifyContent: "center" }}>
              {[["Income","rgba(91,143,168,0.7)"],["Spent","rgba(168,112,91,0.7)"],["Saved","rgba(91,168,120,0.8)"]].map(([l,col]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: col }} />
                  <span style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{l}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Savings projection */}
      <SavingsProjection statements={statements} currency={cur} />

      {/* Month comparison */}
      <MonthComparison statements={statements} currency={cur} />

      {/* Goals + history */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SectionLabel>Goals</SectionLabel>
            <button onClick={() => setView("goals")} style={{ background: "none", border: "none", color: C.gold, fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer", padding: 0 }}>Manage →</button>
          </div>
          {goals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 11, marginBottom: 12 }}>No goals set yet</div>
              <Btn onClick={() => setView("goals")} style={{ fontSize: 10 }}>Set a goal →</Btn>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {goals.map(g => {
                const { pct, label, color, inverted } = getGoalProgress(g);
                return (
                  <div key={g.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{g.label}</span>
                      <span style={{ color, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>
                        {inverted ? `${Math.round(100 - pct)}% headroom` : `${Math.round(pct)}% done`}
                      </span>
                    </div>
                    <ProgressBar pct={Math.min(100, Math.max(0, pct))} color={color} h={5} />
                    <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 5 }}>{label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card style={{ padding: "24px" }}>
          <SectionLabel>Statement History</SectionLabel>
          {[...statements].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 8).map((s, i, arr) => (
            <div key={s.id} onClick={() => onViewDetail(s)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.65"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              <div>
                <div style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{s.period}</div>
                <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 2 }}>Rate: {s.savingsRate}% · {fmt(s.totalSpent, s.currency || "£")} spent</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: s.savings >= 0 ? C.green : C.red, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                  {s.savings >= 0 ? "+" : "−"}{fmt(Math.abs(s.savings), s.currency || "£")}
                </div>
                <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 2 }}>→</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── Upload page ───────────────────────────────────────────────────────────────
// Auto-saves on analysis complete so navigating away never loses data
function UploadPage({ onSave, onComplete }) {
  const [phase, setPhase]   = useState("upload");
  const [drag, setDrag]     = useState(false);
  const [fileName, setFile] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);
  const [step, setStep]     = useState(0);
  const inputRef            = useRef();
  const stepTimer           = useRef();

  const steps = ["Reading statement…","Categorising transactions…","Calculating savings rate…","Generating insights…"];

  const processFile = async file => {
    setFile(file.name);
    setPhase("analyzing");
    setError(null);
    setStep(0);
    stepTimer.current = setInterval(() => setStep(s => (s + 1) % steps.length), 1400);
    try {
      let messages;
      if (file.type === "application/pdf") {
        const b64 = await readB64(file);
        messages = [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }, { type: "text", text: PROMPT }] }];
      } else {
        const text = await readText(file);
        messages = [{ role: "user", content: `Bank statement:\n\n${text}\n\n${PROMPT}` }];
      }
      const res    = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
      const data   = await res.json();
      const raw    = data.content?.map(c => c.text || "").join("") || "";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      const full   = { ...parsed, id: Date.now().toString(), savedAt: new Date().toISOString() };

      // ── Auto-save immediately so navigating away never loses it ──
      onSave(full);
      setResult(full);
      setPhase("result");
    } catch {
      setError("Couldn't parse this file. Try exporting as CSV from your bank app.");
      setPhase("upload");
    } finally {
      clearInterval(stepTimer.current);
    }
  };

  const handleDrop = e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); };
  const handleDrag = e => { e.preventDefault(); setDrag(e.type === "dragenter" || e.type === "dragover"); };

  // ── Analyzing ─────────────────────────────────────────────────────────────
  if (phase === "analyzing") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 28 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 52, height: 52, borderRadius: "50%", border: `1px solid ${C.border}`, borderTop: `1px solid ${C.gold}`, animation: "spin 1.2s linear infinite" }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 300, color: C.text, marginBottom: 6 }}>Analysing {fileName}</div>
        <div style={{ color: C.gold, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{steps[step]}</div>
      </div>
    </div>
  );

  // ── Result ────────────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    const cur = result.currency || "£";
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: C.green, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>✓ Saved to tracker</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 300, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>{result.period}</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Income",       value: fmt(result.income, cur),      acc: null },
            { label: "Spent",        value: fmt(result.totalSpent, cur),  acc: null },
            { label: "Saved",        value: fmt(result.savings, cur),     acc: result.savings >= 0 ? C.green : C.red },
            { label: "Savings Rate", value: `${result.savingsRate}%`,     acc: result.savingsRate >= 20 ? C.green : result.savingsRate >= 10 ? C.gold : C.red },
          ].map(c => (
            <Card key={c.label} style={{ padding: "16px 20px" }}>
              <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 300, color: c.acc || C.text }}>{c.value}</div>
            </Card>
          ))}
        </div>

        <Card style={{ padding: "20px 24px", marginBottom: 16 }}>
          <SectionLabel>Spending Breakdown</SectionLabel>
          <SpendingPie categories={result.categories} currency={cur} />
        </Card>

        <Card style={{ padding: "20px 24px", marginBottom: 28 }}>
          <SectionLabel>Insights</SectionLabel>
          {result.insights.map((ins, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <span style={{ color: C.gold, fontFamily: "'DM Mono',monospace", fontSize: 11, flexShrink: 0 }}>0{i + 1}</span>
              <span style={{ color: "rgba(240,240,248,0.65)", fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7 }}>{ins}</span>
            </div>
          ))}
        </Card>

        <div style={{ display: "flex", gap: 12 }}>
          <Btn onClick={() => { setPhase("upload"); setResult(null); }} style={{ flex: 1 }}>← Upload another</Btn>
          <Btn variant="primary" onClick={onComplete} style={{ flex: 2, fontSize: 12, padding: "12px 20px" }}>View in dashboard →</Btn>
        </div>
      </div>
    );
  }

  // ── Dropzone ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 42, fontWeight: 300, color: C.text, letterSpacing: "-0.02em", margin: "0 0 10px" }}>Upload a statement</h2>
        <p style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 12, margin: 0 }}>CSV, PDF or TXT export from your bank</p>
      </div>
      <div onDrop={handleDrop} onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag}
        onClick={() => inputRef.current.click()}
        style={{ width: "100%", maxWidth: 500, border: `1px dashed ${drag ? C.gold : "rgba(255,255,255,0.15)"}`, borderRadius: 16, padding: "52px 40px", textAlign: "center", cursor: "pointer", transition: "all 0.25s", background: drag ? "rgba(212,168,83,0.04)" : "rgba(255,255,255,0.02)" }}>
        <div style={{ fontSize: 36, opacity: 0.5, marginBottom: 14 }}>↑</div>
        <div style={{ color: C.text, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, marginBottom: 8 }}>Drop your statement here</div>
        <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>or click to browse</div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,.pdf,.txt,.ofx" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]); }} />
      {error && (
        <div style={{ marginTop: 20, padding: "12px 20px", borderRadius: 8, background: "rgba(200,80,80,0.1)", border: "1px solid rgba(200,80,80,0.25)", color: "#e07878", fontFamily: "'DM Mono',monospace", fontSize: 12, maxWidth: 500, textAlign: "center" }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Goals page ───────────────────────────────────────────────────────────────
function GoalsPage({ goals, setGoals, statements }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: "savings_total", label: "", target: "", category: CATEGORIES[0] });
  const cur = statements[0]?.currency || "£";

  const ytdSaved = statements.reduce((a, s) => a + s.savings, 0);
  const avgRate  = statements.length ? statements.reduce((a, s) => a + s.savingsRate, 0) / statements.length : 0;

  const getProgress = g => {
    if (g.type === "savings_total") {
      const pct = (ytdSaved / g.target) * 100;
      return { pct, label: `${fmt(ytdSaved, cur)} of ${fmt(g.target, cur)} saved YTD`, color: pct >= 100 ? C.green : pct >= 50 ? C.gold : C.dim };
    }
    if (g.type === "savings_rate") {
      const pct = (avgRate / g.target) * 100;
      return { pct, label: `${avgRate.toFixed(1)}% average vs ${g.target}% target`, color: pct >= 100 ? C.green : pct >= 60 ? C.gold : C.dim };
    }
    if (g.type === "category_limit") {
      const avg = statements.length
        ? statements.reduce((a, s) => { const c = s.categories.find(c => c.name === g.category); return a + (c?.amount || 0); }, 0) / statements.length : 0;
      const pct = (avg / g.target) * 100;
      return { pct, label: `${fmt(avg, cur)} avg/month vs ${fmt(g.target, cur)} limit`, color: pct > 100 ? C.red : pct > 80 ? C.gold : C.green, inverted: true };
    }
    return { pct: 0, label: "", color: C.dim };
  };

  const autoLabel = (type, target, category) => {
    if (type === "savings_total") return target ? `Save ${fmt(target, cur)} this year` : "";
    if (type === "savings_rate") return target ? `Maintain ${target}% savings rate` : "";
    if (type === "category_limit") return (target && category) ? `Keep ${category} under ${fmt(target, cur)}/mo` : "";
    return "";
  };

  const updateForm = patch => {
    const next = { ...form, ...patch };
    const auto = autoLabel(next.type, next.target, next.category);
    setForm({ ...next, label: auto || next.label });
  };

  const addGoal = () => {
    if (!form.label.trim() || !form.target) return;
    setGoals([...goals, { id: Date.now().toString(), type: form.type, label: form.label.trim(), target: parseFloat(form.target), category: form.category }]);
    setAdding(false);
    setForm({ type: "savings_total", label: "", target: "", category: CATEGORIES[0] });
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" };
  const typeConfig = { savings_total: "Total savings target", savings_rate: "Monthly savings rate", category_limit: "Category spend cap" };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
        <div>
          <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Financial targets</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 300, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>Goals</h2>
        </div>
        {!adding && <Btn variant="primary" onClick={() => setAdding(true)}>+ New goal</Btn>}
      </div>

      {adding && (
        <Card style={{ padding: "24px", marginBottom: 24 }}>
          <SectionLabel>New Goal</SectionLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {Object.entries(typeConfig).map(([t, l]) => (
              <button key={t} onClick={() => updateForm({ type: t })} style={{
                background: form.type === t ? "rgba(212,168,83,0.12)" : "none",
                border: `1px solid ${form.type === t ? C.gold : C.border}`,
                borderRadius: 6, padding: "8px 14px",
                color: form.type === t ? C.gold : C.dim,
                fontFamily: "'DM Mono',monospace", fontSize: 10, cursor: "pointer", transition: "all 0.15s",
              }}>{l}</button>
            ))}
          </div>
          {form.type === "category_limit" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, marginBottom: 6 }}>CATEGORY</div>
              <select value={form.category} onChange={e => updateForm({ category: e.target.value })} style={{ ...inputStyle }}>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background: "#1a1a28" }}>{c}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, marginBottom: 6 }}>
                {form.type === "savings_rate" ? "TARGET (%)" : `TARGET (${cur})`}
              </div>
              <input type="number" value={form.target} placeholder={form.type === "savings_rate" ? "20" : "5000"}
                onChange={e => updateForm({ target: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, marginBottom: 6 }}>LABEL</div>
              <input type="text" value={form.label} placeholder="e.g. Emergency fund"
                onChange={e => setForm({ ...form, label: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setAdding(false)} style={{ flex: 1 }}>Cancel</Btn>
            <Btn variant="primary" onClick={addGoal} style={{ flex: 2, fontSize: 12, padding: "12px 20px" }}>Create goal</Btn>
          </div>
        </Card>
      )}

      {goals.length === 0 && !adding ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
          No goals yet. Create a target to start measuring progress.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {goals.map(g => {
            const { pct, label, color, inverted } = getProgress(g);
            const displayPct = Math.min(100, Math.max(0, pct));
            const displayLabel = inverted
              ? (pct > 100 ? `Over budget by ${Math.round(pct - 100)}%` : `${Math.round(100 - pct)}% headroom remaining`)
              : pct >= 100 ? "🎯 Goal reached!" : `${Math.round(pct)}% of the way there`;
            return (
              <Card key={g.id} style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 13, marginBottom: 4 }}>{g.label}</div>
                    <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>{typeConfig[g.type]}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ color, fontFamily: "'Cormorant Garamond',serif", fontSize: 30, fontWeight: 300, lineHeight: 1 }}>
                      {Math.round(Math.min(100, pct))}%
                    </div>
                    <button onClick={() => setGoals(goals.filter(x => x.id !== g.id))}
                      style={{ background: "none", border: "none", color: C.dimmer, cursor: "pointer", fontSize: 15, padding: "4px 6px", lineHeight: 1 }}
                      onMouseEnter={e => e.target.style.color = C.red}
                      onMouseLeave={e => e.target.style.color = C.dimmer}>✕</button>
                  </div>
                </div>
                <ProgressBar pct={displayPct} color={color} h={6} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{label}</div>
                  <div style={{ color, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{displayLabel}</div>
                </div>
                {!statements.length && (
                  <div style={{ color: "rgba(212,168,83,0.45)", fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 8 }}>Upload a statement to start tracking</div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Detail page ──────────────────────────────────────────────────────────────
function DetailPage({ statement: s, onBack, onDelete }) {
  const cur = s.currency || "£";
  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <Btn onClick={onBack}>← Back</Btn>
        <Btn variant="danger" onClick={() => { onDelete(s.id); onBack(); }}>Delete statement</Btn>
      </div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Statement detail</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 300, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>{s.period}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Income", value: fmt(s.income, cur), acc: null },
          { label: "Spent", value: fmt(s.totalSpent, cur), acc: null },
          { label: "Saved", value: fmt(s.savings, cur), acc: s.savings >= 0 ? C.green : C.red },
          { label: "Rate", value: `${s.savingsRate}%`, acc: s.savingsRate >= 20 ? C.green : s.savingsRate >= 10 ? C.gold : C.red },
        ].map(c => (
          <Card key={c.label} style={{ padding: "16px 18px" }}>
            <div style={{ color: C.dim, fontFamily: "'DM Mono',monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 300, color: c.acc || C.text }}>{c.value}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: "20px 24px" }}>
          <SectionLabel>Categories</SectionLabel>
          <SpendingPie categories={s.categories} currency={cur} />
        </Card>
        <Card style={{ padding: "20px 24px" }}>
          <SectionLabel>Insights</SectionLabel>
          {s.insights.map((ins, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <span style={{ color: C.gold, fontFamily: "'DM Mono',monospace", fontSize: 10, flexShrink: 0, marginTop: 1 }}>0{i + 1}</span>
              <span style={{ color: "rgba(240,240,248,0.65)", fontFamily: "'DM Mono',monospace", fontSize: 11, lineHeight: 1.7 }}>{ins}</span>
            </div>
          ))}
        </Card>
      </div>
      <Card style={{ padding: "20px 24px" }}>
        <SectionLabel>Top Merchants</SectionLabel>
        {s.topMerchants.map((m, i, arr) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div>
              <div style={{ color: C.text, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{m.name}</div>
              <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{m.category}</div>
            </div>
            <div style={{ color: C.gold, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 400 }}>{fmt(m.amount, cur)}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]             = useState("overview");
  const [statements, setStatements] = useState([]);
  const [goals, setGoals]           = useState([]);
  const [selected, setSelected]     = useState(null);
  const [loaded, setLoaded]         = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Mono:wght@300;400&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const s = storageGet("fin-statements") || [];
    const g = storageGet("fin-goals")      || [];
    setStatements(s);
    setGoals(g);
    setLoaded(true);
  }, []);

  const saveStatements = s => { setStatements(s); storageSet("fin-statements", s); };
  const saveGoals      = g => { setGoals(g);      storageSet("fin-goals",      g); };

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.dimmer, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>Loading…</div>
    </div>
  );

  if (selected) return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <DetailPage
        statement={selected}
        onBack={() => setSelected(null)}
        onDelete={id => { saveStatements(statements.filter(s => s.id !== id)); setSelected(null); }}
      />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <Nav view={view} setView={setView} />
      {view === "overview" && <OverviewPage statements={statements} goals={goals} setView={setView} onViewDetail={setSelected} />}
      {view === "upload"   && (
        <UploadPage
          onSave={s => saveStatements([...statements, s])}
          onComplete={() => setView("overview")}
        />
      )}
      {view === "goals" && <GoalsPage goals={goals} setGoals={saveGoals} statements={statements} />}
    </div>
  );
}
