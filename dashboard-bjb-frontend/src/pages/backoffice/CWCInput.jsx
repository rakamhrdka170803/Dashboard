// REPLACE file CWCInput.jsx
import React from "react";
import dayjs from "dayjs";
import { getCWCCategories, upsertCWCDaily, getCWCDaily, deleteCWCDaily } from "../../api/cwc";
import toast, { Toaster } from "react-hot-toast";

export default function CWCInput() {
  const [date, setDate] = React.useState(dayjs().format("YYYY-MM-DD"));
  const [cats, setCats] = React.useState(null);
  const [raw, setRaw] = React.useState({ COMPLAINT:"", REQUEST:"", INFO:"" });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { (async () => setCats(await getCWCCategories()))(); }, []);

  const S = {
    card: { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, padding:16 },
    input: { width:"100%", padding:"10px 12px", border:"1px solid #E5E7EB", borderRadius:10, marginTop:6 },
    label: { fontSize:13, fontWeight:600 },
    h3: { fontWeight:800, margin:"8px 0 12px" },
    ta: { width:"100%", minHeight:220, padding:12, border:"1px solid #E5E7EB", borderRadius:10, fontFamily:"monospace", lineHeight:1.4 },
    btn: { padding:"10px 16px", background:"#111827", color:"#fff", border:"none", borderRadius:10, cursor:"pointer" },
    btnGhost: { padding:"10px 16px", background:"#fff", color:"#DC2626", border:"1px solid #DC2626", borderRadius:10, cursor:"pointer" },
  };

  function parseNums(txt){ return txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(n=>parseInt(n,10)||0); }
  function joinNums(arr){ return (arr||[]).map(n=>String(n||0)).join("\n"); }

  async function onLoad() {
    if (!cats) return;
    setLoading(true);
    try {
      const d = await getCWCDaily(date); // {complaint,request,info}
      setRaw({
        COMPLAINT: joinNums(d.complaint),
        REQUEST:   joinNums(d.request),
        INFO:      joinNums(d.info),
      });
      toast.success("Data dimuat");
    } catch (e) {
      // kalau belum ada data, kosongkan
      setRaw({ COMPLAINT:"", REQUEST:"", INFO:"" });
      toast("Belum ada data untuk tanggal ini", { icon:"ℹ️" });
    } finally { setLoading(false); }
  }

  async function onSave(e) {
    e.preventDefault();
    const need = { COMPLAINT: cats.COMPLAINT.length, REQUEST: cats.REQUEST.length, INFO: cats.INFO.length };
    const got  = { COMPLAINT: parseNums(raw.COMPLAINT).length, REQUEST: parseNums(raw.REQUEST).length, INFO: parseNums(raw.INFO).length };
    for (const k of ["COMPLAINT","REQUEST","INFO"]) {
      if (got[k] !== need[k]) { toast.error(`${k}: jumlah baris harus ${need[k]}, sekarang ${got[k]}.`); return; }
    }
    setLoading(true);
    try {
      await upsertCWCDaily({
        date,
        complaint: parseNums(raw.COMPLAINT),
        request:   parseNums(raw.REQUEST),
        info:      parseNums(raw.INFO),
      });
      toast.success("CWC tersimpan ✅");
    } catch (ex) {
      toast.error(ex?.response?.data?.error || "Gagal menyimpan CWC");
    } finally { setLoading(false); }
  }

  async function onDelete() {
    if (!confirm(`Hapus semua data CWC untuk ${date}?`)) return;
    setLoading(true);
    try {
      await deleteCWCDaily(date);
      setRaw({ COMPLAINT:"", REQUEST:"", INFO:"" });
      toast.success("CWC dihapus");
    } catch (ex) {
      toast.error(ex?.response?.data?.error || "Gagal hapus");
    } finally { setLoading(false); }
  }

  if (!cats) return <p>Memuat kategori…</p>;

  return (
    <div>
      <Toaster position="top-right" />
      <h2 style={{ fontWeight:800, marginBottom:12 }}>CWC Harian (Input & Kelola)</h2>

      <div style={{ ...S.card, marginBottom:16, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <div style={S.label}>Tanggal</div>
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} style={S.input}/>
        <button onClick={onLoad} style={S.btn} disabled={loading}>Load</button>
        <button onClick={onDelete} style={S.btnGhost} disabled={loading}>Hapus</button>
      </div>

      <form onSubmit={onSave} style={{ display:"grid", gap:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          <Section title="Complaint" count={cats.COMPLAINT.length} value={raw.COMPLAINT} setValue={(v)=>setRaw(r=>({...r, COMPLAINT:v}))}/>
          <Section title="Request"   count={cats.REQUEST.length}   value={raw.REQUEST}   setValue={(v)=>setRaw(r=>({...r, REQUEST:v}))}/>
          <Section title="Informasi Umum" count={cats.INFO.length} value={raw.INFO} setValue={(v)=>setRaw(r=>({...r, INFO:v}))}/>
        </div>
        <div><button type="submit" style={S.btn} disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</button></div>
      </form>
    </div>
  );
}

function Section({ title, count, value, setValue }) {
  const S = {
    card: { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, padding:16 },
    h3: { fontWeight:800, margin:"8px 0 12px" },
    ta: { width:"100%", minHeight:220, padding:12, border:"1px solid #E5E7EB", borderRadius:10, fontFamily:"monospace", lineHeight:1.4 },
    hint:{ fontSize:12, color:"#6B7280", marginBottom:6 }
  };
  return (
    <div style={S.card}>
      <h3 style={S.h3}>{title}</h3>
      <div style={S.hint}>Masukkan <b>{count}</b> angka (1 baris = 1 angka) sesuai urutan definisi.</div>
      <textarea value={value} onChange={(e)=>setValue(e.target.value)} style={S.ta}/>
    </div>
  );
}
