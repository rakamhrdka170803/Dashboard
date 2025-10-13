import { useEffect, useState } from "react";
import dayjs from "dayjs";
import CalendarMonth from "../../components/CalendarMonth";
import { listMonthly, createSchedule, deleteSchedule } from "../../api/schedules";
import { listUsers } from "../../api/users";

export default function BackofficeSchedules() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // dropdown agent
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(""); // user_id (string)

  // form create
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [channel, setChannel] = useState("VOICE");
  const [shiftName, setShiftName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  // Auto +8 jam saat mengubah start
  useEffect(() => {
    const st = dayjs(`${date}T${startTime}:00`);
    setEndTime(st.add(8, "hour").format("HH:mm"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, date]);

  // === FIX: fungsi async yang benar untuk load users ===
  const loadUsers = async () => {
    const res = await listUsers({ page: 1, size: 1000 });
    const all = res.items || [];

    // roles dari backend = array of strings, contoh ["AGENT","..."]
    const onlyAgents = all.filter(
      (u) => Array.isArray(u.roles) && u.roles.includes("AGENT")
    );

    if (onlyAgents.length > 0) {
      setAgents(onlyAgents);
      if (!selectedAgent) setSelectedAgent(String(onlyAgents[0].id));
    } else {
      // fallback supaya bisa tes walau belum ada AGENT
      setAgents(all);
      if (!selectedAgent && all.length) setSelectedAgent(String(all[0].id));
    }
  };

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const params = { month };
      if (selectedAgent) params.userId = selectedAgent;
      const { items } = await listMonthly(params);
      setItems(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []); // sekali saat mount
  useEffect(() => {
    loadSchedules();
  }, [month, selectedAgent]);

  const onDayClick = (d) => {
    setDate(d.format("YYYY-MM-DD"));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgent) {
      setMsg("Pilih agent terlebih dahulu");
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      const startISO = dayjs(`${date}T${startTime}:00`).toISOString();
      const endISO = dayjs(`${date}T${endTime}:00`).toISOString();
      await createSchedule({
        user_id: Number(selectedAgent),
        start_at: startISO,
        end_at: endISO,
        channel,
        shift_name: shiftName || undefined,
        notes: notes || undefined,
      });
      setMsg("Jadwal berhasil dibuat.");
      await loadSchedules();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Gagal membuat jadwal.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Hapus jadwal ini?")) return;
    try {
      await deleteSchedule(id);
      await loadSchedules();
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal menghapus jadwal.");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 16 }}>
      {/* LEFT: Calendar */}
      <section>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="month"
              className="input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 160, padding: "8px 10px" }}
            />
            <select
              className="input"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{ minWidth: 240 }}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.id} • {a.full_name || a.email}
                  {Array.isArray(a.roles) && !a.roles.includes("AGENT") ? " (non-agent)" : ""}
                </option>
              ))}
            </select>
            <button className="btn" style={{ width: 120 }} onClick={loadSchedules}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="helper">Memuat jadwal…</p>
        ) : (
          <CalendarMonth
            monthStr={month}
            items={items}
            onDayClick={onDayClick}
            renderItem={(it) => (
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 700 }}>
                  {dayjs(it.start_at).format("HH:mm")}–{dayjs(it.end_at).format("HH:mm")} ({it.channel})
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button className="btn" style={{ width: 80 }} onClick={() => onDelete(it.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </section>

      {/* RIGHT: Create form */}
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Buat Jadwal Agent</h3>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label className="label">Agent</label>
            <select
              className="input"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              required
            >
              <option value="" disabled>
                Pilih agent…
              </option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.id} • {a.full_name || a.email}
                  {Array.isArray(a.roles) && !a.roles.includes("AGENT") ? " (non-agent)" : ""}
                </option>
              ))}
            </select>
            {agents.length === 0 && (
              <div className="helper" style={{ marginTop: 6 }}>
                Belum ada user tampil. Pastikan ada user ber-role <b>AGENT</b>.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Tanggal</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Channel</label>
              <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="VOICE">VOICE</option>
                <option value="SOSMED">SOSMED</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Jam Mulai</label>
              <input
                type="time"
                className="input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Jam Selesai</label>
              <input
                type="time"
                className="input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
              <div className="helper">Otomatis +8 jam dari jam mulai (bisa diubah)</div>
            </div>
          </div>

          <div>
            <label className="label">Shift Name (opsional)</label>
            <input
              className="input"
              placeholder="Pagi / Siang / Malam"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Notes (opsional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Catatan…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {msg && <div className="helper">{msg}</div>}
          <button className="btn" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan Jadwal"}
          </button>
        </form>
      </section>
    </div>
  );
}
