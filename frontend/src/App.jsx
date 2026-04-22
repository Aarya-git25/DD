import { useState, useRef, useEffect } from "react";
import { db }            from "./firebase.js";
import { sendAckEmail }  from "./email.js";
import { predictVideo, getHealth } from "./api.js";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";

// ─── STYLES ────────────────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#070b12;--surface:#111827;--panel:#0f1724;
    --border-lt:#4a6f9c;--border-dk:#0a1525;--border-md:#1f3a5f;
    --accent:#00ff9f;--accent2:#00cfff;--danger:#ff3b5c;--warn:#ffb800;
    --text:#b8d4e8;--text-dim:#4a6880;--inset:#080f1a;--scanline:rgba(0,255,159,.025);
  }
  body{background:var(--bg);color:var(--text);font-family:'Share Tech Mono',monospace;font-size:13px;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,var(--scanline) 2px,var(--scanline) 4px);pointer-events:none;z-index:9999}
  @keyframes flicker{0%,100%{opacity:1}93%{opacity:.97}95%{opacity:1}97%{opacity:.98}}
  body{animation:flicker 10s infinite}
  .win{background:var(--panel);border:2px solid;border-color:var(--border-lt) var(--border-dk) var(--border-dk) var(--border-lt);box-shadow:inset 1px 1px 0 rgba(255,255,255,.05),2px 2px 0 rgba(0,0,0,.6)}
  .win-inset{background:var(--inset);border:2px solid;border-color:var(--border-dk) var(--border-lt) var(--border-lt) var(--border-dk);box-shadow:inset 1px 1px 4px rgba(0,0,0,.7)}
  .titlebar{background:linear-gradient(90deg,#071428 0%,#0d2d52 40%,#071428 100%);padding:3px 6px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-md);user-select:none}
  .titlebar-title{font-family:'VT323',monospace;font-size:15px;color:#fff;letter-spacing:1px;display:flex;align-items:center;gap:6px}
  .win-btns{display:flex;gap:2px}
  .win-btn{width:16px;height:14px;background:var(--surface);border:1px solid;border-color:var(--border-lt) var(--border-dk) var(--border-dk) var(--border-lt);font-size:9px;color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer}
  .win-btn:active{border-color:var(--border-dk) var(--border-lt) var(--border-lt) var(--border-dk)}
  .btn{background:var(--surface);border:2px solid;border-color:var(--border-lt) var(--border-dk) var(--border-dk) var(--border-lt);color:var(--text);font-family:'Share Tech Mono',monospace;font-size:12px;padding:4px 12px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;display:inline-flex;align-items:center;gap:6px}
  .btn:hover{background:#1a2d4a;color:var(--accent2)}
  .btn:active{border-color:var(--border-dk) var(--border-lt) var(--border-lt) var(--border-dk);padding:5px 11px 3px 13px}
  .btn:disabled{opacity:.35;cursor:not-allowed}
  .btn-primary{color:var(--accent);border-color:var(--accent) var(--border-dk) var(--border-dk) var(--accent)}
  .btn-danger{color:var(--danger);border-color:var(--danger) var(--border-dk) var(--border-dk) var(--danger)}
  .field{background:var(--inset);border:2px solid;border-color:var(--border-dk) var(--border-lt) var(--border-lt) var(--border-dk);color:var(--accent);font-family:'Share Tech Mono',monospace;font-size:12px;padding:4px 8px;width:100%;outline:none}
  .field:focus{border-color:var(--accent2) var(--border-dk) var(--border-dk) var(--accent2)}
  .field::placeholder{color:var(--text-dim)}
  textarea.field{resize:vertical;min-height:60px}
  .progress-track{background:var(--inset);border:2px solid;border-color:var(--border-dk) var(--border-lt) var(--border-lt) var(--border-dk);height:18px;width:100%;overflow:hidden}
  .progress-fill{height:100%;background:repeating-linear-gradient(90deg,var(--accent) 0,var(--accent) 10px,rgba(0,255,159,.35) 10px,rgba(0,255,159,.35) 14px);transition:width .3s}
  @keyframes march{from{background-position:0}to{background-position:28px 0}}
  .progress-fill.active{animation:march .5s linear infinite}
  .tab-strip{display:flex;gap:2px;padding:4px 4px 0}
  .tab{padding:3px 14px;font-family:'Share Tech Mono',monospace;font-size:12px;cursor:pointer;border:2px solid;border-bottom:none;border-color:var(--border-lt) var(--border-dk) transparent var(--border-lt);background:var(--surface);color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;position:relative;top:2px}
  .tab.active{background:var(--panel);color:var(--accent);top:0;padding-bottom:5px}
  .statusbar{background:var(--surface);border-top:2px solid;border-color:var(--border-lt) transparent transparent;padding:2px 8px;display:flex;gap:12px;font-size:11px;color:var(--text-dim)}
  .status-cell{border-right:1px solid var(--border-md);padding-right:12px;display:flex;align-items:center;gap:4px}
  @keyframes blink{50%{opacity:0}}
  .blink{animation:blink 1s step-end infinite}
  .result-fake{color:var(--danger);text-shadow:0 0 12px var(--danger),0 0 24px rgba(255,59,92,.3)}
  .result-real{color:var(--accent);text-shadow:0 0 12px var(--accent),0 0 24px rgba(0,255,159,.3)}
  .gauge-wrap{position:relative;width:140px;height:140px}
  .gauge-svg{transform:rotate(-90deg)}
  .gauge-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'VT323',monospace}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .dropzone{border:2px dashed var(--border-md);background:var(--inset);padding:32px;text-align:center;cursor:pointer;transition:border-color .15s}
  .dropzone.over,.dropzone:hover{border-color:var(--accent);background:rgba(0,255,159,.03)}
  .frame-strip{display:flex;gap:3px;overflow-x:auto;padding:4px}
  .frame-cell{min-width:32px;height:32px;background:var(--inset);border:1px solid var(--border-md);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-dim);flex-shrink:0;position:relative}
  .frame-bar{position:absolute;bottom:0;left:0;right:0;transition:height .3s}
  .label{color:var(--text-dim);font-size:11px;letter-spacing:1px;margin-bottom:3px}
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-track{background:var(--inset)}
  ::-webkit-scrollbar-thumb{background:var(--border-md)}
  .chart-bar-wrap{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .chart-bar-label{width:90px;font-size:11px;color:var(--text-dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .chart-bar-track{flex:1;background:var(--inset);height:14px;border:1px solid var(--border-dk)}
  .chart-bar-fill{height:100%;background:linear-gradient(90deg,var(--danger),rgba(255,59,92,.4));transition:width .6s}
  .chart-bar-val{width:36px;text-align:right;font-size:11px;color:var(--danger)}
  @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .slide-in{animation:slideIn .25s ease}
`;

// ─── SMALL COMPONENTS ──────────────────────────────────────────────────────
function TitleBar({ title, icon = "🔍", color = "#00ff9f" }) {
  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <span style={{ width:8,height:8,borderRadius:"50%",background:color,display:"inline-block" }}/>
        {icon} {title}
      </div>
      <div className="win-btns">
        <div className="win-btn">_</div><div className="win-btn">□</div>
        <div className="win-btn" style={{color:"#ff3b5c"}}>✕</div>
      </div>
    </div>
  );
}

function Gauge({ value }) {
  const R = 56, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, value ?? 0));
  const color = pct > 0.6 ? "#ff3b5c" : pct > 0.35 ? "#ffb800" : "#00ff9f";
  return (
    <div className="gauge-wrap">
      <svg className="gauge-svg" width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#0a1420" strokeWidth="14"/>
        <circle cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${pct*C} ${C}`} strokeLinecap="butt"
          style={{filter:`drop-shadow(0 0 6px ${color})`,transition:"stroke-dasharray .6s"}}/>
      </svg>
      <div className="gauge-label">
        <div style={{fontSize:30,color,lineHeight:1}}>{Math.round(pct*100)}%</div>
        <div style={{fontSize:11,color:"#4a6880",letterSpacing:1}}>FAKE PROB</div>
      </div>
    </div>
  );
}

function FrameTimeline({ scores }) {
  if (!scores?.length) return null;
  return (
    <div>
      <div className="label">▶ FRAME-LEVEL SUSPICION [15 FRAMES]</div>
      <div className="frame-strip win-inset" style={{padding:6}}>
        {scores.map((s,i) => (
          <div key={i} className="frame-cell" title={`Frame ${i+1}: ${(s*100).toFixed(1)}%`}>
            <div className="frame-bar" style={{height:`${s*100}%`,opacity:.85,
              background:s>0.6?"var(--danger)":s>0.35?"var(--warn)":"var(--accent)"}}/>
            <span style={{position:"relative",zIndex:1,fontSize:8,color:"#4a6880"}}>{i+1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: ANALYZER ─────────────────────────────────────────────────────────
function AnalyzerTab({ onNewResult, backendOk }) {
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [status,   setStatus]   = useState("IDLE");
  const [progress, setProgress] = useState(0);
  const [progMsg,  setProgMsg]  = useState("");
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [over,     setOver]     = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f || !f.type.startsWith("video/")) return;
    setFile(f); setPreview(URL.createObjectURL(f));
    setResult(null); setError(null); setStatus("READY"); setProgress(0);
  };

  const analyze = async () => {
    if (!file) return;
    setStatus("RUNNING"); setProgress(0); setResult(null); setError(null);
    try {
      const res = await predictVideo(file, (pct, msg) => {
        setProgress(pct); setProgMsg(msg);
      });
      setResult(res); setStatus("DONE");
      onNewResult?.({ file, result: res });
    } catch (e) {
      setStatus("ERROR"); setError(e.message);
    }
  };

  const clear = () => {
    setFile(null); setPreview(null); setResult(null);
    setError(null); setStatus("IDLE"); setProgress(0);
  };

  const isFake = result?.label === "FAKE";

  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      {!backendOk && (
        <div className="win-inset" style={{padding:8,borderColor:"var(--warn)"}}>
          <span style={{color:"var(--warn)",fontSize:11}}>
            ⚠ Backend not reachable. Check VITE_API_URL in .env.local and ensure FastAPI is running.
          </span>
        </div>
      )}

      {/* Drop zone */}
      <div>
        <div className="label">◈ VIDEO INPUT</div>
        <div className={`dropzone${over?" over":""}`}
          onDragOver={e=>{e.preventDefault();setOver(true)}}
          onDragLeave={()=>setOver(false)}
          onDrop={e=>{e.preventDefault();setOver(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>inputRef.current.click()}>
          <input ref={inputRef} type="file" accept="video/*" style={{display:"none"}}
            onChange={e=>handleFile(e.target.files[0])}/>
          {file ? (
            <div style={{color:"var(--accent)",fontSize:13}}>
              ▶ {file.name}<br/>
              <span style={{color:"var(--text-dim)",fontSize:11}}>{(file.size/1e6).toFixed(2)} MB</span>
            </div>
          ) : (
            <div style={{color:"var(--text-dim)"}}>
              <div style={{fontSize:36,marginBottom:8}}>📼</div>
              <div>DRAG & DROP VIDEO FILE</div>
              <div style={{fontSize:11,marginTop:4}}>or click to browse · MP4 AVI MOV WEBM</div>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="win-inset" style={{padding:4}}>
          <video src={preview} style={{width:"100%",maxHeight:160,display:"block",background:"#000"}} controls muted/>
        </div>
      )}

      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button className="btn btn-primary" onClick={analyze} disabled={!file||status==="RUNNING"}>
          {status==="RUNNING"?"⏳ ANALYZING…":"▶ RUN ANALYSIS"}
        </button>
        <button className="btn" onClick={clear}>✕ CLEAR</button>
        <div style={{marginLeft:"auto",color:"var(--text-dim)",fontSize:11}}>
          STATUS: <span style={{color:status==="DONE"?"var(--accent)":status==="RUNNING"?"var(--warn)":status==="ERROR"?"var(--danger)":"var(--text-dim)"}}>{status}</span>
        </div>
      </div>

      {(status==="RUNNING"||status==="DONE") && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span className="label">▶ {progMsg}</span>
            <span className="label">{progress}%</span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill${status==="RUNNING"?" active":""}`} style={{width:`${progress}%`}}/>
          </div>
        </div>
      )}

      {error && (
        <div className="win-inset" style={{padding:8}}>
          <span style={{color:"var(--danger)",fontSize:12}}>✕ {error}</span>
        </div>
      )}

      {result && (
        <div className="slide-in" style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div className="win" style={{padding:16,flex:"0 0 auto"}}>
            <Gauge value={result.confidence}/>
          </div>
          <div style={{flex:1,minWidth:200,display:"flex",flexDirection:"column",gap:8}}>
            <div className="win-inset" style={{padding:12}}>
              <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:4}}>VERDICT</div>
              <div className={`result-${isFake?"fake":"real"}`}
                style={{fontSize:44,fontFamily:"'VT323',monospace",lineHeight:1}}>{result.label}</div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginTop:4}}>
                CONFIDENCE: {(result.confidence*100).toFixed(2)}%<br/>
                FRAMES ANALYZED: {result.frame_count ?? 15}<br/>
                INFERENCE: {result.processing_time_ms ?? "—"}ms
              </div>
            </div>
            <div className="win-inset" style={{padding:8}}>
              <div className="label" style={{marginBottom:6}}>◈ MODEL</div>
              <div style={{fontSize:11,color:"var(--text-dim)",lineHeight:1.8}}>
                ResNet50 → LSTM(128) → FC<br/>
                INPUT: 15 frames @ 224×224<br/>
                THRESHOLD: 0.50
              </div>
            </div>
          </div>
        </div>
      )}

      {result && <FrameTimeline scores={result.frame_scores}/>}

      {result && isFake && (
        <div className="win slide-in" style={{padding:10,borderColor:"var(--danger) var(--border-dk) var(--border-dk) var(--danger)"}}>
          <div style={{color:"var(--danger)",fontSize:13,marginBottom:4}}>⚠ DEEPFAKE DETECTED</div>
          <div style={{color:"var(--text-dim)",fontSize:11}}>
            Switch to the REPORT tab to log this video to the threat database and notify platform moderators.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: REPORT ───────────────────────────────────────────────────────────
const PLATFORMS = ["instagram","tiktok","facebook","twitter/x","youtube","reddit","telegram","whatsapp","other"];
const INSTA_REPORT_URL = "https://help.instagram.com/contact/723586364339719";

function ReportTab({ lastResult }) {
  const [form,       setForm]       = useState({ email:"",url:"",site:"instagram",description:"",screenshot:null });
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportId,   setReportId]   = useState(null);
  const [err,        setErr]        = useState(null);
  const ssRef = useRef();

  const handleSS = (f) => { if (f?.type.startsWith("image/")) setForm(p=>({...p,screenshot:f})); };

  const submit = async () => {
    if (!form.email||!form.url) return;
    setSubmitting(true); setErr(null);
    const payload = {
      email:          form.email,
      url:            form.url,
      site:           form.site,
      description:    form.description,
      has_screenshot: !!form.screenshot,
      confidence:     lastResult?.result?.confidence ?? null,
      verdict:        lastResult?.result?.label ?? "UNKNOWN",
    };
    try {
      let rid = null;
      if (db) {
        const ref = await addDoc(collection(db,"reports"), {
          ...payload, timestamp: serverTimestamp()
        });
        rid = ref.id;
      }
      setReportId(rid);
      await sendAckEmail({
        email:      form.email,
        verdict:    payload.verdict,
        confidence: payload.confidence ?? 0,
        url:        form.url,
        site:       form.site,
        report_id:  rid,
      });
      setSubmitted(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return (
    <div style={{padding:24,textAlign:"center"}} className="slide-in">
      <div style={{fontSize:64,marginBottom:12}}>📡</div>
      <div className="result-real" style={{fontSize:34,fontFamily:"'VT323',monospace"}}>REPORT SUBMITTED</div>
      {reportId && <div style={{color:"var(--text-dim)",fontSize:11,marginTop:4}}>ID: {reportId}</div>}
      <div style={{color:"var(--text-dim)",fontSize:12,marginTop:8,marginBottom:20}}>
        Logged to threat database. Acknowledgement sent to <span style={{color:"var(--accent2)"}}>{form.email}</span>.
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
        <button className="btn btn-danger" onClick={()=>window.open(INSTA_REPORT_URL,"_blank")}>
          📷 REPORT TO INSTAGRAM
        </button>
        <button className="btn" onClick={()=>{setSubmitted(false);setForm({email:"",url:"",site:"instagram",description:"",screenshot:null});}}>
          ↩ NEW REPORT
        </button>
      </div>
    </div>
  );

  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      {lastResult?.result && (
        <div className="win-inset" style={{padding:8,display:"flex",gap:12,alignItems:"center"}}>
          <div style={{fontSize:11,color:"var(--text-dim)"}}>LINKED ANALYSIS:</div>
          <div className={`result-${lastResult.result.label==="FAKE"?"fake":"real"}`}
            style={{fontFamily:"'VT323',monospace",fontSize:18}}>{lastResult.result.label}</div>
          <div style={{fontSize:11,color:"var(--text-dim)"}}>
            {(lastResult.result.confidence*100).toFixed(1)}% · {lastResult.file?.name}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div>
          <div className="label">◈ YOUR EMAIL *</div>
          <input className="field" type="email" placeholder="reporter@domain.com"
            value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
        </div>
        <div>
          <div className="label">◈ PLATFORM *</div>
          <select className="field" value={form.site}
            onChange={e=>setForm(p=>({...p,site:e.target.value}))} style={{cursor:"pointer"}}>
            {PLATFORMS.map(s=><option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="label">◈ DEEPFAKE URL *</div>
        <input className="field" type="url" placeholder="https://..."
          value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))}/>
      </div>

      <div>
        <div className="label">◈ ANALYSIS SCREENSHOT (optional)</div>
        <div className="win-inset" style={{padding:6,display:"flex",gap:8,alignItems:"center"}}>
          <button className="btn" onClick={()=>ssRef.current.click()}>📷 ATTACH</button>
          <input ref={ssRef} type="file" accept="image/*" style={{display:"none"}}
            onChange={e=>handleSS(e.target.files[0])}/>
          <span style={{color:form.screenshot?"var(--accent)":"var(--text-dim)",fontSize:11}}>
            {form.screenshot?`✓ ${form.screenshot.name}`:"No file attached"}
          </span>
        </div>
      </div>

      <div>
        <div className="label">◈ ADDITIONAL CONTEXT (optional)</div>
        <textarea className="field" placeholder="Where found, who posted, other context…"
          value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
      </div>

      {err && <div style={{color:"var(--danger)",fontSize:11}}>✕ {err}</div>}

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="btn btn-primary" onClick={submit}
          disabled={!form.email||!form.url||submitting}>
          {submitting?"⏳ SUBMITTING…":"📤 SUBMIT REPORT"}
        </button>
        <button className="btn btn-danger" onClick={()=>window.open(INSTA_REPORT_URL,"_blank")}>
          📷 REPORT TO INSTAGRAM
        </button>
      </div>

      {!db && (
        <div className="win-inset" style={{padding:8}}>
          <div style={{fontSize:11,color:"var(--text-dim)"}}>
            ℹ Firebase not configured — reports will not persist. Add VITE_FIREBASE_* vars to .env.local.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: DASHBOARD ────────────────────────────────────────────────────────
function DashboardTab({ refreshKey }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db,"reports"), orderBy("timestamp","desc"));
    getDocs(q).then(snap => {
      setReports(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [refreshKey]);

  const fakes   = reports.filter(r=>r.verdict==="FAKE").length;
  const avgConf = reports.filter(r=>r.confidence).length
    ? (reports.filter(r=>r.confidence).reduce((s,r)=>s+r.confidence,0)
       / reports.filter(r=>r.confidence).length * 100).toFixed(1)
    : "—";

  const siteCounts = reports.reduce((acc,r)=>{
    if (r.verdict==="FAKE") acc[r.site]=(acc[r.site]||0)+1;
    return acc;
  },{});
  const siteList = Object.entries(siteCounts).sort((a,b)=>b[1]-a[1]);
  const maxSite  = siteList[0]?.[1]||1;

  if (!db) return (
    <div style={{padding:24,textAlign:"center",color:"var(--text-dim)"}}>
      <div style={{fontSize:36,marginBottom:12}}>🔌</div>
      <div>Firebase not configured.</div>
      <div style={{fontSize:11,marginTop:8}}>Add VITE_FIREBASE_* variables to frontend/.env.local to enable the dashboard.</div>
    </div>
  );
  if (loading) return <div style={{padding:24,color:"var(--text-dim)",textAlign:"center"}}>QUERYING DATABASE…</div>;

  return (
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      <div className="grid-3">
        {[
          {label:"TOTAL REPORTS", val:reports.length, color:"var(--accent2)"},
          {label:"DEEPFAKES",      val:fakes,          color:"var(--danger)"},
          {label:"AVG CONFIDENCE", val:avgConf+(avgConf!=="—"?"%":""), color:"var(--warn)"},
        ].map(s=>(
          <div key={s.label} className="win-inset" style={{padding:12,textAlign:"center"}}>
            <div style={{fontSize:34,fontFamily:"'VT323',monospace",color:s.color}}>{s.val}</div>
            <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {siteList.length>0 && (
        <div>
          <div className="label">◈ DEEPFAKES BY PLATFORM</div>
          <div className="win-inset" style={{padding:10}}>
            {siteList.map(([site,count])=>(
              <div key={site} className="chart-bar-wrap">
                <div className="chart-bar-label">{site.toUpperCase()}</div>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{width:`${(count/maxSite)*100}%`}}/>
                </div>
                <div className="chart-bar-val">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="label">◈ REPORT LOG</div>
        <div className="win-inset" style={{maxHeight:260,overflowY:"auto"}}>
          {reports.length===0 ? (
            <div style={{padding:16,color:"var(--text-dim)",textAlign:"center",fontSize:12}}>
              NO REPORTS YET
            </div>
          ) : reports.slice(0,50).map(r=>(
            <div key={r.id} style={{padding:"6px 10px",borderBottom:"1px solid var(--border-dk)",
              display:"flex",gap:10,alignItems:"center",fontSize:11}}>
              <span className={r.verdict==="FAKE"?"result-fake":"result-real"}
                style={{fontFamily:"'VT323',monospace",fontSize:14,minWidth:40}}>{r.verdict}</span>
              <span style={{color:"var(--text-dim)",minWidth:72}}>{r.site?.toUpperCase()}</span>
              <span style={{color:"var(--accent2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.url}</span>
              <span style={{color:"var(--text-dim)",minWidth:80,textAlign:"right"}}>
                {r.timestamp?.toDate?.()?.toLocaleDateString() ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,        setTab]        = useState("analyze");
  const [lastResult, setLastResult] = useState(null);
  const [dashKey,    setDashKey]    = useState(0);
  const [backendOk,  setBackendOk]  = useState(null);
  const [time,       setTime]       = useState(new Date());

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); },[]);
  useEffect(()=>{
    getHealth().then(()=>setBackendOk(true)).catch(()=>setBackendOk(false));
  },[]);

  return (
    <>
      <style>{STYLE}</style>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",padding:12,gap:8}}>

        {/* Header */}
        <div className="win">
          <div style={{background:"linear-gradient(90deg,#030810 0%,#071e3d 50%,#030810 100%)",
            padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",
            borderBottom:"1px solid var(--border-md)"}}>
            <div>
              <div style={{fontFamily:"'VT323',monospace",fontSize:30,color:"var(--accent)",
                textShadow:"0 0 18px var(--accent),0 0 36px rgba(0,255,159,.25)",letterSpacing:3}}>
                TEMPORAL FORGERY DETECTOR
              </div>
              <div style={{fontSize:10,color:"var(--text-dim)",letterSpacing:2}}>
                CNN+LSTM DEEPFAKE ANALYSIS SYSTEM · v0.9.1
                <span style={{marginLeft:12,color:backendOk===null?"var(--text-dim)":backendOk?"var(--accent)":"var(--danger)"}}>
                  ● API {backendOk===null?"CONNECTING…":backendOk?"ONLINE":"OFFLINE"}
                </span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'VT323',monospace",fontSize:22,color:"var(--accent2)"}}>
                {time.toLocaleTimeString()}
              </div>
              <div style={{fontSize:10,color:"var(--text-dim)"}}>
                {time.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
              </div>
            </div>
          </div>
        </div>

        {/* Main window */}
        <div className="win" style={{flex:1,display:"flex",flexDirection:"column"}}>
          <TitleBar title="ANALYSIS CONSOLE" icon="🎞" />
          <div style={{background:"var(--surface)",borderBottom:"2px solid var(--border-md)",padding:"0 8px"}}>
            <div className="tab-strip" style={{padding:"4px 0 0"}}>
              {[{id:"analyze",label:"▶ ANALYZE"},{id:"report",label:"⚠ REPORT"},{id:"dashboard",label:"📊 DASHBOARD"}]
                .map(t=>(
                  <div key={t.id} className={`tab${tab===t.id?" active":""}`}
                    onClick={()=>{ setTab(t.id); if(t.id==="dashboard") setDashKey(k=>k+1); }}>
                    {t.label}
                  </div>
                ))}
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {tab==="analyze"   && <AnalyzerTab onNewResult={setLastResult} backendOk={backendOk}/>}
            {tab==="report"    && <ReportTab lastResult={lastResult}/>}
            {tab==="dashboard" && <DashboardTab refreshKey={dashKey}/>}
          </div>
          <div className="statusbar">
            <div className="status-cell">
              <span className="blink" style={{color:"var(--accent)",fontSize:9}}>●</span>SYSTEM ONLINE
            </div>
            <div className="status-cell">MODEL: ResNet50+LSTM</div>
            <div className="status-cell">FRAMES: 15 @ 224×224</div>
            <div style={{marginLeft:"auto",color:"var(--text-dim)"}}>
              {lastResult?`LAST: ${lastResult.result.label} (${(lastResult.result.confidence*100).toFixed(1)}%)`:"AWAITING INPUT"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
