import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import CalendarMonth from "../../components/CalendarMonth";
import {
  listMonthly,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "../../api/schedules";
import { listUsersMini } from "../../api/users";

export default function BackofficeSchedules() {
  // month picker
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));

  // dropdown agent
  const [agents, setAgents] = useState([]); // [{id, full_name}]
  const [selectedAgent, setSelectedAgent] = useState(""); // string id

  // kalender data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // form (buat / edit)
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [channel, setChannel] = useState("VOICE");
  const [shiftName, setShiftName] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  // label agent terpilih
  const pickedAgent = useMemo(
    () => agents.find((a) => String(a.id) === String(selectedAgent)) || null,
    [agents, selectedAgent]
  );

  // auto +8 jam setiap ubah start/date
  useEffect(() => {
    const st = dayjs(`${date}T${startTime}:00`);
    setEndTime(st.add(8, "hour").format("HH:mm"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, date]);

  // load agents dari /users/mini (semua login boleh)
  const loadAgents = async () => {
    const list = await listUsersMini({ page: 1, size: 2000 });
    // optional: filter hanya yang namanya ada (biar rapi)
    const cleaned = (list || []).filter((u) => !!u.full_name);
    setAgents(cleaned);
    if (!selectedAgent && cleaned.length) setSelectedAgent(String(cleaned[0].id));
  };

  // load schedules untuk agent terpilih
  const loadSchedules = async () => {
    if (!selectedAgent) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { items } = await listMonthly({
        month,
        userId: selectedAgent,
      });
      setItems(items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);
  useEffect(() => {
    loadSchedules();
  }, [month, selectedAgent]);

  const onDayClick = (d) => {
    // klik tanggal di kalender → set tanggal form & keluar dari mode edit
    setDate(d.format("YYYY-MM-DD"));
    setEditingId(null);
    setShiftName("");
    setNotes("");
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(dayjs().format("YYYY-MM-DD"));
    setStartTime("09:00");
    setEndTime("17:00");
    setChannel("VOICE");
    setShiftName("");
    setNotes("");
    setMsg("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgent) {
      setMsg("Pilih agent terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      const startISO = dayjs(`${date}T${startTime}:00`).toISOString();
      const endISO = dayjs(`${date}T${endTime}:00`).toISOString();

      if (editingId) {
        await updateSchedule(editingId, {
          user_id: Number(selectedAgent),
          start_at: startISO,
          end_at: endISO,
          channel,
          shift_name: shiftName || undefined,
          notes: notes || undefined,
        });
        setMsg("Jadwal berhasil diperbarui.");
      } else {
        await createSchedule({
          user_id: Number(selectedAgent),
          start_at: startISO,
          end_at: endISO,
          channel,
          shift_name: shiftName || undefined,
          notes: notes || undefined,
        });
        setMsg("Jadwal berhasil dibuat.");
      }
      await loadSchedules();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Gagal menyimpan jadwal.");
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (it) => {
    // isi form dari item
    setEditingId(it.id);
    setSelectedAgent(String(it.user_id)); // jaga2 kalau pindah agent
    setDate(dayjs(it.start_at).format("YYYY-MM-DD"));
    setStartTime(dayjs(it.start_at).format("HH:mm"));
    setEndTime(dayjs(it.end_at).format("HH:mm"));
    setChannel(it.channel);
    setShiftName(it.shift_name || "");
    setNotes(it.notes || "");
  };

  const onDelete = async (id) => {
    if (!confirm("Hapus jadwal ini?")) return;
    try {
      await deleteSchedule(id);
      if (editingId === id) resetForm();
      await loadSchedules();
    } catch (err) {
      alert(err?.response?.data?.error || "Gagal menghapus jadwal.");
    }
  };

  // komponen kecil untuk chip legend
  const chip = (bg, text) => (
    <span
      style={{
        background: bg,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 }}>
      {/* LEFT: Filter + Calendar */}
      <section>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="month"
              className="input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 170, padding: "8px 10px" }}
            />
            <select
              className="input"
              value={selectedAgent}
              onChange={(e) => {
                setSelectedAgent(e.target.value);
                setEditingId(null);
              }}
              style={{ minWidth: 280 }}
            >
              {!agents.length && <option value="">(Belum ada data agent)</option>}
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || `Agent #${a.id}`}
                </option>
              ))}
            </select>
            <button className="btn" style={{ width: 120 }} onClick={loadSchedules}>
              Refresh
            </button>
          </div>
        </div>

        {/* Kalender */}
        {loading ? (
          <p className="helper">Memuat jadwal…</p>
        ) : (
          <>
            <CalendarMonth
              monthStr={month}
              items={items}
              onDayClick={onDayClick}
              // Render compact: jam + channel + tombol Edit/Hapus terlihat jelas (tanpa scrollbar)
              renderItem={(it) => (
                <div
                  style={{
                    fontSize: 12,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {dayjs(it.start_at).format("HH:mm")}–{dayjs(it.end_at).format("HH:mm")} • {it.channel}
                  </div>
                  {it.shift_name && (
                    <div style={{ color: "#374151" }}>Shift: {it.shift_name}</div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" style={{ width: 64 }} onClick={() => onEdit(it)}>
                      Edit
                    </button>
                    <button
                      className="btn"
                      style={{
                        width: 74,
                        background: "linear-gradient(135deg,#9CA3AF,#6B7280)",
                      }}
                      onClick={() => onDelete(it.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            />

            {/* Legend */}
            <div style={{ marginTop: 12, fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {chip("#DBEAFE", "VOICE (biru)")}
              {chip("#DCFCE7", "SOSMED (hijau)")}
              {chip("#FEE2E2", "CUTI (merah)")}
              {chip("#FFE4F5", "Libur/Off (pink)")}
            </div>
          </>
        )}
      </section>

      {/* RIGHT: Form */}
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Buat Jadwal Agent</h3>
        <div className="helper" style={{ marginTop: -6, marginBottom: 8 }}>
          Agent terpilih: <b>{pickedAgent?.full_name || "—"}</b>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
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
              <select
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
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

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit" disabled={submitting || !selectedAgent}>
              {submitting ? "Menyimpan..." : editingId ? "Update Jadwal" : "Simpan Jadwal"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn"
                style={{ background: "linear-gradient(135deg,#9CA3AF,#6B7280)" }}
                onClick={resetForm}
              >
                Batal Edit
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
