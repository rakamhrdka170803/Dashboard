import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import minMax from "dayjs/plugin/minMax";

dayjs.extend(isoWeek);
dayjs.extend(minMax);

function cls(...xs){ return xs.filter(Boolean).join(" "); }

function sameDay(a,b){ return a && b && dayjs(a).isSame(b, "day"); }
function inRange(d, a, b){
  if(!a || !b) return false;
  const x = dayjs(d).startOf("day");
  const s = dayjs(a).startOf("day");
  const e = dayjs(b).startOf("day");
  return (x.isAfter(s) && x.isBefore(e)) || sameDay(x,s) || sameDay(x,e);
}

function MonthGrid({ baseMonth, from, to, hover, onPick }){
  const start = dayjs(baseMonth).startOf("month");
  const firstCell = start.startOf("isoWeek"); // minggu awal
  const cells = Array.from({length: 42}, (_,i)=> firstCell.add(i,"day"));

  return (
    <div className="drp-month">
      <div className="drp-weekhead">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
          <div key={d} className="drp-wh">{d}</div>
        ))}
      </div>
      <div className="drp-grid">
        {cells.map((d,i)=>{
          const isOut = d.month() !== start.month();
          const isStart = sameDay(d, from);
          const isEnd = sameDay(d, to);
          const isHoveredRange = (() => {
            if (from && !to && hover){
              const a = dayjs(from), b = dayjs(hover);
              const s = dayjs.min(a,b), e = dayjs.max(a,b);
              return inRange(d, s, e);
            }
            return inRange(d, from, to);
          })();
          return (
            <button
              key={i}
              type="button"
              className={cls(
                "drp-cell",
                isOut && "drp-out",
                isHoveredRange && "drp-inrange",
                (isStart||isEnd) && "drp-edge",
              )}
              onMouseEnter={()=>onPick?.(d, {preview:true})}
              onFocus={()=>onPick?.(d, {preview:true})}
              onClick={()=>onPick?.(d)}
            >
              {d.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({
  value,                // { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } | null
  onChange,             // (tmpRange) => void   — dipanggil saat user memilih (belum apply)
  onApply,              // (range) => void      — saat klik Update
  onCancel,             // () => void
  withTime = false,     // opsional: tambahkan jam:menit
  placement = "bottom", // 'bottom' | 'right'
  buttonText = "Update filter",
  placeholder = "dd/mm/yyyy – dd/mm/yyyy",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [tmpFrom, setTmpFrom] = useState(value?.from || "");
  const [tmpTo, setTmpTo] = useState(value?.to || "");
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(dayjs(tmpFrom || dayjs()).startOf("month"));
  const rootRef = useRef(null);

  // sync when external value changes
  useEffect(()=>{
    setTmpFrom(value?.from || "");
    setTmpTo(value?.to || "");
    if(value?.from) setView(dayjs(value.from).startOf("month"));
  }, [value?.from, value?.to]);

  useEffect(()=>{
    function handleClick(e){
      if(!rootRef.current) return;
      if(!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return ()=>document.removeEventListener("mousedown", handleClick);
  }, []);

  const label = useMemo(()=>{
    const f = tmpFrom ? dayjs(tmpFrom).format("DD/MM/YYYY") : "dd/mm/yyyy";
    const t = tmpTo ? dayjs(tmpTo).format("DD/MM/YYYY") : "dd/mm/yyyy";
    return `${f} – ${t}`;
  }, [tmpFrom, tmpTo]);

  function pickDate(d, opt={}){
    const dateStr = dayjs(d).format("YYYY-MM-DD");
    if(opt.preview){ setHover(d); return; }
    if(!tmpFrom || (tmpFrom && tmpTo)){
      // start new selection
      setTmpFrom(dateStr);
      setTmpTo("");
      setHover(null);
      onChange?.({ from: dateStr, to: "" });
      return;
    }
    // have from & no to yet
    const a = dayjs(tmpFrom), b = dayjs(dateStr);
    const from = dayjs.min(a,b).format("YYYY-MM-DD");
    const to   = dayjs.max(a,b).format("YYYY-MM-DD");
    setTmpFrom(from); setTmpTo(to);
    setHover(null);
    onChange?.({ from, to });
  }

  function apply(){
    if(!tmpFrom || !tmpTo){ setOpen(false); return; }
    onApply?.({ from: tmpFrom, to: tmpTo });
    setOpen(false);
  }
  function clear(){
    setTmpFrom(""); setTmpTo(""); setHover(null);
    onChange?.({ from: "", to: "" });
  }

  const next = ()=> setView((v)=>v.add(1,"month"));
  const prev = ()=> setView((v)=>v.subtract(1,"month"));

  return (
    <div className={cls("drp", className)} ref={rootRef}>
      <button type="button" className="input drp-trigger" onClick={()=>setOpen(v=>!v)}>
        {label}
        <span style={{opacity:.6, marginLeft:8}}>▼</span>
      </button>

      {open && (
        <div className={cls("drp-pop", placement==="right" ? "drp-right" : "drp-bottom")}>
          <div className="drp-head">
            <button className="btn btn-ghost" onClick={prev}>‹</button>
            <div className="drp-monthname">{view.format("MMMM YYYY")}</div>
            <button className="btn btn-ghost" onClick={next}>›</button>
          </div>

          <div className="drp-body">
            {/* single-month; duplikasi <MonthGrid> dua kali kalau mau 2 bulan */}
            <MonthGrid
              baseMonth={view}
              from={tmpFrom}
              to={tmpTo}
              hover={hover}
              onPick={pickDate}
            />
          </div>

          {withTime && (
            <div className="drp-time">
              <div className="helper">Add a time (opsional)</div>
              {/* Hook jam:menit bisa ditambah di sini bila dibutuhkan */}
            </div>
          )}

          <div className="drp-foot">
            <button className="btn btn-secondary" onClick={clear}>Clear</button>
            <div style={{flex:1}} />
            <button className="btn btn-ghost" onClick={()=>{ setTmpFrom(value?.from||""); setTmpTo(value?.to||""); setOpen(false); onCancel?.(); }}>
              Cancel
            </button>
            <button className="btn" onClick={apply} disabled={!tmpFrom || !tmpTo}>
              {buttonText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==== minimal styles (letak di bawah atau pindah ke .css kamu) ==== */
