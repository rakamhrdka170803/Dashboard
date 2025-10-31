// REPLACE isi file ini
import React from "react";
import dayjs from "dayjs";
import { queryCWC, getCWCCategories } from "../../api/cwc";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from "recharts";

export default function CWCAnalytics() {
  const [start, setStart] = React.useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [end, setEnd] = React.useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [cats, setCats] = React.useState(null);
  const [totals, setTotals] = React.useState({}); // {cat:{sub:total}}
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { (async () => setCats(await getCWCCategories()))(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await queryCWC({ start, end });
      setTotals(res.totals_by_category || {});
    } finally { setLoading(false); }
  }
  React.useEffect(()=>{ if (cats) load(); }, [cats]);

  const S = {
    card: { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, padding:16 },
    input: { padding:"8px 10px", border:"1px solid #E5E7EB", borderRadius:10 },
    btn: { padding:"8px 12px", background:"#111827", color:"#fff", border:"none", borderRadius:10, cursor:"pointer" },
    small: { fontSize:12, color:"#6B7280" },
  };

  const top5 = (cat) => {
    const order = cats?.[cat] || [];
    const map = totals?.[cat] || {};
    // bentuk array {sub, total} lalu sort desc dan ambil 5
    return order
      .map(sub => ({ sub, total: map[sub] || 0 }))
      .sort((a,b)=>b.total - a.total)
      .slice(0, 5);
  };

  const CatTitle = ({cat}) => (
    <h3 style={{ margin:"4px 0 10px" }}>
      {cat === "COMPLAINT" ? "Complaint" : cat === "REQUEST" ? "Request" : "Informasi Umum"}
    </h3>
  );

  return (
    <div>
      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div><b>Rentang</b></div>
          <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} style={S.input}/>
          <span>—</span>
          <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} style={S.input}/>
          <button onClick={load} style={S.btn} disabled={loading}>{loading ? "Memuat..." : "Terapkan"}</button>
        </div>
      </div>

      {["COMPLAINT","REQUEST","INFO"].map(cat=>(
        <div key={cat} style={{ ...S.card, marginBottom:16 }}>
          <CatTitle cat={cat}/>
          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5(cat)} margin={{ top:10, right:10, left:0, bottom:40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                {/* Label sumbu X pakai sub-kategori, dimiringkan */}
                <XAxis dataKey="sub" interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip formatter={(value)=>[value, "Total"]} labelFormatter={(label)=>label} />
                <Legend />
                <Bar dataKey="total" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={S.small}>Hover batang untuk lihat sub-kategori & total.</div>
        </div>
      ))}
    </div>
  );
}
