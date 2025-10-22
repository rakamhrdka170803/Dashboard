import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { listUsersMini } from "../../api/users";
import { createFinding, listFindings, deleteFinding } from "../../api/findings";

const CATEGORIES = ["Performa", "Kedisiplinan", "Sikap", "Kepatuhan SOP", "Lainnya"];

export default function BackofficeFindings(){
  const [agents, setAgents] = useState([]);
  const [nameById, setNameById] = useState({});
  const [agentId, setAgentId] = useState("");
  const [category, setCategory] = useState("");
  const [issuedDate, setIssuedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [notes, setNotes] = useState("");

  const [filterMonth, setFilterMonth] = useState(dayjs().format("YYYY-MM"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const issuedAtRFC3339 = useMemo(()=>{
    if (!issuedDate) return null;
    // jam default 09:00 lokal
    return dayjs(`${issuedDate} 09:00`).format();
  }, [issuedDate]);

  const loadAgents = async () => {
    const list = await listUsersMini({});
    setAgents(list || []);
    const map = {}; (list||[]).forEach(u => map[u.id] = u.full_name || `Agent #${u.id}`);
    setNameById(map);
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const { items } = await listFindings({ month: filterMonth, page:1, size:200 });
      setRows(items || []);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ loadAgents(); loadList(); }, []);
  useEffect(()=>{ loadList(); }, [filterMonth]);

  const submit = async (e) => {
    e.preventDefault();
    if (!agentId || !category) return;
    await createFinding({
      agent_id: Number(agentId),
      category,
      issued_at: issuedAtRFC3339,
      notes,
    });
    setNotes(""); setCategory(""); // keep agent/date
    await loadList();
    alert("Finding tersimpan & notifikasi dikirim.");
  };

  const onDelete = async (id) => {
    if (!window.confirm("Hapus finding ini?")) return;
    await deleteFinding(id);
    await loadList();
  };

  return (
    <div className="vstack-16">
      <section className="card fluid">
        <div className="section-head">
          <h3 className="section-title">Input Finding</h3>
        </div>
        <form onSubmit={submit} className="vstack-12">
          <div>
            <label className="label">Nama Agent</label>
            <select className="input" value={agentId} onChange={e=>setAgentId(e.target.value)} required>
              <option value="">— Pilih agent —</option>
              {(agents||[]).map(a=>(
                <option key={a.id} value={a.id}>{nameById[a.id] || `Agent #${a.id}`}</option>
              ))}
            </select>
          </div>

          <div className="row" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={category} onChange={e=>setCategory(e.target.value)} required>
                <option value="">— Pilih kategori —</option>
                {CATEGORIES.map(k=><option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tanggal Kejadian</label>
              <input type="date" className="input" value={issuedDate} onChange={e=>setIssuedDate(e.target.value)} required/>
            </div>
          </div>

          <div>
            <label className="label">Catatan (opsional)</label>
            <textarea className="input" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detail singkat…" />
          </div>

          <div className="actions-right">
            <button className="btn">Simpan Finding</button>
          </div>
        </form>
      </section>

      <section className="card fluid">
        <div className="section-head">
          <h3 className="section-title">Daftar Finding</h3>
          <div className="section-actions" style={{display:"flex", gap:8}}>
            <input type="month" className="input" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} />
            <button className="btn btn-ghost" disabled={loading} onClick={loadList}>{loading?"Loading…":"Refresh"}</button>
          </div>
        </div>
        <div className="list">
          {rows.length === 0 && <div className="helper">Tidak ada.</div>}
          {rows.map(it=>{
            // pecah kategori di [Kategori] awal (kalau ada)
            let cat = "—";
            let desc = it.description || "";
            const m = /^\s*\[([^\]]+)\]\s*/.exec(desc);
            if (m) { cat = m[1]; desc = desc.replace(m[0], ""); }
            return (
              <div key={it.id} className="swap-item">
                <div className="swap-item__top">
                  <div className="title-row"><b>Finding #{it.id}</b></div>
                  <div className="actions">
                    <button className="btn btn-secondary" onClick={()=>onDelete(it.id)}>Hapus</button>
                  </div>
                </div>
                <div className="meta"><span>Agent:</span><b>{nameById[it.agent_id] || `Agent #${it.agent_id}`}</b></div>
                <div className="meta"><span>Tanggal:</span><b>{dayjs(it.issued_at).format("DD MMM YYYY")}</b></div>
                <div className="meta"><span>Kategori:</span><b>{cat}</b></div>
                {desc && <div className="meta"><span>Catatan:</span><b>{desc}</b></div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
