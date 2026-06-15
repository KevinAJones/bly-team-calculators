/* The Bly Team — Business Plan Calculator v2
   Same plan math (BlyPlan), redesigned in the Bly brand system
   from the Mortgage & PITI calculator. Loaded as text/babel. */
const { useState, useEffect, useMemo, useRef } = React;
const P = window.BlyPlan;
const { fmtCurrency, fmtInt, fmtNum1 } = P;

/* ---------- atoms ---------- */
function Slider({ label, value, min, max, step, onChange, format, fill, note }) {
  const c = fill || "var(--royal)";
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sld">
      <div className="sld-head">
        <span className="sld-label">{label}</span>
        <span className="sld-val">{format ? format(value) : value}</span>
      </div>
      <input type="range" className="rng" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ "--fill": c, "--pct": pct + "%" }} />
      {note && <div className="sld-note">{note}</div>}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }) {
  return (
    <div className={"toggle-row" + (checked ? " on" : "")} onClick={() => onChange(!checked)}>
      <span className="tg"></span>
      <span className="tg-label">{label}{sub && <small>{sub}</small>}</span>
    </div>
  );
}

/* ---------- inputs panel ---------- */
function Inputs({ s, set }) {
  const w = P.sourceWeights(s);
  const fc = (v) => fmtCurrency(v);
  const fp = (v) => v + "%";
  return (
    <div className="panel panel-pad inputs-col">
      <div className="block" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <h3 className="section-label"><b>01</b> Timeframe &amp; Goal</h3>
        <div className="seg cols-4" style={{ marginBottom: "16px" }}>
          {[[12, "12 mo"], [6, "6 mo"], [3, "90 day"], [1, "1 mo"]].map(([v, l]) => (
            <button key={v} className={"seg-btn" + (s.timeframe === v ? " active" : "")}
              onClick={() => set("timeframe", v)}>{l}</button>
          ))}
        </div>
        <Slider label="Take-home income goal" value={s.incomeGoal} min={50000} max={500000} step={5000}
          onChange={(v) => set("incomeGoal", v)} format={fc} fill="#1d7d54"
          note="What you keep after splits & eXp fees — before your own business expenses." />
      </div>

      <div className="block">
        <h3 className="section-label"><b>02</b> Your Deal</h3>
        <Slider label="Average sale price" value={s.avgPrice} min={100000} max={1500000} step={10000}
          onChange={(v) => set("avgPrice", v)} format={fc} />
        <Slider label="Commission rate" value={s.commissionPct} min={1} max={5} step={0.1}
          onChange={(v) => set("commissionPct", v)} format={(v) => v.toFixed(1) + "%"} />
        <div className="sld" style={{ marginBottom: 0 }}>
          <div className="sld-head"><span className="sld-label">Your level / tier</span></div>
          <div className="select-wrap">
            <select value={s.level} onChange={(e) => set("level", e.target.value)}>
              <option value="3">Level 3</option>
              <option value="2">Level 2</option>
              <option value="1">Level 1</option>
              <option value="new5">Brand-new — first 5 deals</option>
              <option value="exp3">Experienced — first 3 deals</option>
            </select>
          </div>
        </div>
      </div>

      <div className="block">
        <h3 className="section-label"><b>03</b> Business Mix</h3>
        <Slider label="Listing side" value={s.listingPct} min={0} max={100} step={5}
          onChange={(v) => set("listingPct", v)} format={(v) => `${v}% / ${100 - v}%`} />
      </div>

      <div className="block">
        <h3 className="section-label"><b>04</b> Lead Sources</h3>
        <div className="alloc-bar">
          <span style={{ width: w.soi * 100 + "%", background: "#123461" }} title="Sphere / SOI" />
          <span style={{ width: w.office * 100 + "%", background: "#4f8bcf" }} title="Office" />
          <span style={{ width: w.zillow * 100 + "%", background: "#c79a3e" }} title="Zillow" />
        </div>
        <Slider label="Sphere / SOI" value={s.mixSOI} min={0} max={100} step={5}
          onChange={(v) => set("mixSOI", v)} format={() => Math.round(w.soi * 100) + "%"} fill="#123461" />
        <Slider label="Office generated" value={s.mixOffice} min={0} max={100} step={5}
          onChange={(v) => set("mixOffice", v)} format={() => Math.round(w.office * 100) + "%"} fill="#4f8bcf" />
        <Slider label="Zillow Preferred" value={s.mixZillow} min={0} max={100} step={5}
          onChange={(v) => set("mixZillow", v)} format={() => Math.round(w.zillow * 100) + "%"} fill="#c79a3e" />
      </div>

      <div className="block">
        <h3 className="section-label"><b>05</b> Conversion Rates</h3>
        <Slider label="Appt set → held" value={s.setHeldPct} min={20} max={100} step={5}
          onChange={(v) => set("setHeldPct", v)} format={fp} />
        <Slider label="Held → taken (signed)" value={s.heldTakenPct} min={20} max={100} step={5}
          onChange={(v) => set("heldTakenPct", v)} format={fp} />
        <Slider label="Taken → closed" value={s.takenClosePct} min={20} max={100} step={5}
          onChange={(v) => set("takenClosePct", v)} format={fp} />
      </div>

      <div className="block">
        <h3 className="section-label"><b>06</b> Adjustments</h3>
        <Toggle label="ISA-converted leads" sub="Inside sales agent set the appointment" checked={s.isaConverted} onChange={(v) => set("isaConverted", v)} />
        <Toggle label="Mentor on deals" sub="eXp mentor program deduction" checked={s.mentor} onChange={(v) => set("mentor", v)} />
        <Toggle label="Model annual cap" sub="$4,000 team cap — split stops once met" checked={s.modelCap} onChange={(v) => set("modelCap", v)} />
      </div>
    </div>
  );
}

/* ---------- results ---------- */
function ResultHero({ plan, s }) {
  const months = s.timeframe;
  return (
    <div className="result-hero">
      <div className="rh-inner">
        <div className="rh-label">Closings needed</div>
        <div className="rh-amount">{plan.unreachable ? "—" : fmtInt(plan.units)} <span className="per">closings</span></div>
        <div className="rh-sub">
          to take home <em>{fmtCurrency(s.incomeGoal)}</em> over {months === 12 ? "the next 12 months" : months === 1 ? "one month" : `${months} months`}
        </div>
        <div className="rh-chips">
          <div className="rh-chip">Gross commission<b>{fmtCurrency(plan.gci)}</b></div>
          <div className="rh-chip">Avg take-home / deal<b>{fmtCurrency(plan.avgTakePerDeal)}</b></div>
          <div className="rh-chip">{plan.cap.modeled
            ? (plan.cap.capDeal ? <>You cap at deal<b>#{plan.cap.capDeal}</b></> : <>Annual cap<b>Not reached</b></>)
            : <>Cap modeling<b>Off</b></>}</div>
        </div>
      </div>
    </div>
  );
}

function Breakdown({ plan }) {
  const b = plan.breakdown;
  const tot = Math.max(b.gross, 1);
  const segs = [
    { key: "take", color: "var(--seg-keep)", name: "You keep", sub: "after every split & fee", val: b.take },
    { key: "exp", color: "var(--seg-exp)", name: "eXp Realty", sub: "company split + transaction fees", val: b.expFees },
    { key: "office", color: "var(--seg-office)", name: "Team / office", sub: "Bly Team split" + (b.gross && plan.breakdown.office > 0 ? "" : ""), val: b.office },
    { key: "ref", color: "var(--seg-ref)", name: "Zillow referral", sub: "35–40% off the top on Zillow deals", val: b.referral },
  ];
  const visible = segs.filter((x) => x.val > 0.5);
  return (
    <div className="panel panel-pad" style={{ borderRadius: "0 0 var(--radius) var(--radius)", borderTop: "none" }}>
      <div className="sc-head" style={{ marginBottom: "12px" }}>
        <div className="sc-title">Where your commission <em>goes</em></div>
        <div className="sc-tag">across {fmtInt(plan.units)} closings</div>
      </div>
      <div className="split-bar">
        {visible.map((x) => (
          <div key={x.key} className="split-seg" style={{ width: (x.val / tot) * 100 + "%", background: x.color }} />
        ))}
      </div>
      <div className="breakdown">
        {visible.map((x) => (
          <div key={x.key} className="bd-row">
            <span className="bd-dot" style={{ background: x.color }}></span>
            <span className="bd-name">{x.name}<small>{x.sub}</small></span>
            <span className="bd-val">{fmtCurrency(x.val)}</span>
          </div>
        ))}
        <div className="bd-row total">
          <span className="bd-dot" style={{ background: "var(--navy-700)" }}></span>
          <span className="bd-name">Total gross commission</span>
          <span className="bd-val">{fmtCurrency(b.gross)}</span>
        </div>
      </div>
    </div>
  );
}

function Funnels({ plan, s }) {
  const conv = [
    ["Appointments set", null],
    ["Appointments held", s.setHeldPct],
    ["Taken / signed", s.heldTakenPct],
    ["Closed", s.takenClosePct],
  ];
  const sides = [
    { tone: "navy", label: "Listing side", pct: s.listingPct, d: plan.listings },
    { tone: "royal", label: "Buyer side", pct: 100 - s.listingPct, d: plan.buyers },
  ];
  return (
    <div className="panel panel-pad" style={{ marginTop: "20px" }}>
      <div className="sc-head">
        <div className="sc-title">Production <em>funnel</em></div>
        <div className="sc-tag">{s.timeframe === 12 ? "12-month plan" : s.timeframe + "-month plan"}</div>
      </div>
      <div className="funnel-grid">
        {sides.map((side) => {
          const vals = [side.d.set, side.d.held, side.d.take, side.d.close];
          return (
            <div key={side.tone} className={"fun " + side.tone}>
              <div className="fun-head">
                <div>
                  <div className="fh-side">{side.label}</div>
                  <div className="fh-pct">{side.pct}% of business</div>
                </div>
                <div className="fh-gci">{fmtCurrency(side.d.gci)}<small>gross commission</small></div>
              </div>
              <div className="fun-rows">
                {conv.map(([label, rate], i) => (
                  <div key={i} className={"frow" + (i === 3 ? " hl" : "")}>
                    <span className="frl">{label}{rate ? <small>{rate}% convert from previous</small> : <small>top of funnel</small>}</span>
                    <span className="frv">{fmtInt(vals[i])}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cadence({ plan, s }) {
  const m = plan.monthly, wk = plan.weekly;
  return (
    <div className="panel panel-pad" style={{ marginTop: "20px" }}>
      <div className="sc-head">
        <div className="sc-title">Your <em>rhythm</em></div>
        <div className="sc-tag">monthly &amp; weekly pace</div>
      </div>
      <div className="cad-grid">
        <div className="cad">
          <div className="cad-title">Monthly · Listing side</div>
          <div className="cad-row"><span>Closed</span><strong>{fmtNum1(m.lClose)}</strong></div>
          <div className="cad-row"><span>Taken</span><strong>{fmtNum1(m.lTake)}</strong></div>
          <div className="cad-row"><span>Held</span><strong>{fmtNum1(m.lHeld)}</strong></div>
          <div className="cad-row hl"><span>Set</span><strong>{fmtNum1(m.lSet)}</strong></div>
        </div>
        <div className="cad">
          <div className="cad-title">Monthly · Buyer side</div>
          <div className="cad-row"><span>Closed</span><strong>{fmtNum1(m.bClose)}</strong></div>
          <div className="cad-row"><span>Taken</span><strong>{fmtNum1(m.bTake)}</strong></div>
          <div className="cad-row"><span>Held</span><strong>{fmtNum1(m.bHeld)}</strong></div>
          <div className="cad-row hl"><span>Set</span><strong>{fmtNum1(m.bSet)}</strong></div>
        </div>
      </div>
      <div className="grand-total">
        <div className="gt-l">
          <span>Weekly target</span>
          <small>{fmtNum1(wk.totalHeld)} held · {fmtNum1(wk.totalTaken)} taken per week</small>
        </div>
        <b>{fmtNum1(wk.totalSet)} <span className="per">appts set / wk</span></b>
      </div>
    </div>
  );
}

function MetaBar({ plan }) {
  const items = [
    {
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
      t: "Real split math", b: "Bly Team schedule",
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
      t: "$4,000 team cap", b: plan.cap.capDeal ? `Met at deal #${plan.cap.capDeal}` : "Modeled deal-by-deal",
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>,
      t: "Live plan", b: "Every slider re-balances",
    },
  ];
  return (
    <div className="meta-bar">
      {items.map((x, i) => (
        <div key={i} className="meta-item">
          <span className="meta-ic">{x.icon}</span>
          <span className="mt"><b>{x.t}</b>{x.b}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- state: URL + localStorage (same keys as v1) ---------- */
const STORAGE_KEY = "bly-business-plan-v1";
const KEYMAP = {
  timeframe: "tf", incomeGoal: "g", avgPrice: "p", commissionPct: "c", level: "lv",
  listingPct: "ls", mixSOI: "so", mixOffice: "of", mixZillow: "zi",
  setHeldPct: "sh", heldTakenPct: "ht", takenClosePct: "tc",
  isaConverted: "isa", mentor: "m", modelCap: "cap",
};
const NUM_KEYS = ["timeframe", "incomeGoal", "avgPrice", "commissionPct", "listingPct", "mixSOI", "mixOffice", "mixZillow", "setHeldPct", "heldTakenPct", "takenClosePct"];
const BOOL_KEYS = ["isaConverted", "mentor", "modelCap"];

function loadState() {
  const base = { ...P.STATE_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  const q = new URLSearchParams(location.search);
  if ([...q.keys()].length) {
    Object.keys(KEYMAP).forEach((k) => {
      const v = q.get(KEYMAP[k]);
      if (v === null) return;
      if (NUM_KEYS.includes(k)) base[k] = parseFloat(v);
      else if (BOOL_KEYS.includes(k)) base[k] = v === "1";
      else base[k] = v;
    });
  }
  return base;
}
function encodeState(s) {
  const q = new URLSearchParams();
  Object.keys(KEYMAP).forEach((k) => {
    let v = s[k];
    if (BOOL_KEYS.includes(k)) v = v ? 1 : 0;
    q.set(KEYMAP[k], v);
  });
  return location.origin + location.pathname + "?" + q.toString();
}

function App() {
  const [s, setS] = useState(loadState);
  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));
  const plan = useMemo(() => P.computePlan(s), [s]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }, [s]);

  const showToast = (msg) => {
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove("show"), 1900);
  };
  const onShare = () => {
    const url = encodeState(s);
    history.replaceState(null, "", url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => showToast("Link copied to clipboard"), () => showToast("Copy this URL from the address bar"));
    else showToast("Copy this URL from the address bar");
  };

  return (
    <div className="app-wrap">
      <header className="app-head">
        <div className="brand-lockup">
          <img className="logo" src={(window.__resources && window.__resources.blyLogoWhite) || "assets/bly-white.png"} alt="The Bly Team" />
          <div className="brand-div"></div>
          <div className="brand-exp">
            <span className="ex1">eXp</span>
            <span className="ex2">Realty</span>
          </div>
        </div>
        <div className="head-titles">
          <div className="he-eye">Goal Setting · The Bly Team</div>
          <div className="he-title">Business Plan <em>calculator</em></div>
        </div>
      </header>

      <div className="grid">
        <Inputs s={s} set={set} />
        <div>
          <ResultHero plan={plan} s={s} />
          <Breakdown plan={plan} />
          <Funnels plan={plan} s={s} />
          <Cadence plan={plan} s={s} />
          <MetaBar plan={plan} />
          <p className="disclaim">
            Estimates only, based on The Bly Team commission schedule and standard eXp Realty fees ($4,000 team company-dollar cap, $40 risk-management &amp; $25 broker-review per transaction). Actual results vary with cap status, conversion, market conditions, and brokerage policy. This is a planning tool, not a guarantee of compensation.
          </p>
        </div>
      </div>

      <div className="sticky-cta">
        <div className="scta-text">
          <b>{plan.unreachable ? "—" : fmtInt(plan.units)} closings → {fmtCurrency(s.incomeGoal)}</b>
          <span>{fmtNum1(plan.weekly.totalSet)} appointments set per week</span>
        </div>
        <button className="scta-ghost" onClick={() => window.print()}>PDF</button>
        <button className="scta-btn" onClick={onShare}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
          Share plan
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
