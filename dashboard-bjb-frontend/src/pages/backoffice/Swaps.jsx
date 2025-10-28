import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { listHolidaySwaps, boApproveHolidaySwap } from "../../api/holidaySwaps";
import { listSwaps } from "../../api/swaps";
import { listUsersMini } from "../../api/users";
import DateRangePicker from "../../components/DateRangePicker";

const STATUS_COLORS = {
  PENDING: "#f59e0b",
  PENDING_TARGET: "#f59e0b",
  PENDING_BO: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  CANCELLED: "#6b7280",
};

function Chip({ children, tone }) {
  const color =
    STATUS_COLORS[String(children).toUpperCase()] ||
    (tone === "kind" ? "#0ea5e9" : "#6b7280");
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        backgroundColor: `${color}22`,
        color,
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

const SectionTitle = ({ kind, title }) => (
  <div className="section-head" style={{ marginTop: 8, gap: 8 }}>
    <h3 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {title}
      <Chip tone="kind">{kind === "HOLIDAY" ? "TUKAR LIBUR" : "SWAP DINAS"}</Chip>
    </h3>
  </div>
);

export default function BackofficeSwaps() {
  const [tab, setTab] = useState("HOLIDAY"); // HOLIDAY | SWAP

  // users
  const [nameById, setNameById] = useState({});

  // HOLIDAY
  const [holidayRows, setHolidayRows] = useState([]);
  const [loadingHoliday, setLoadingHoliday] = useState(false);
  const [open, setOpen] = useState(null); // modal approve
  const [hStatus, setHStatus] = useState(""); // ALL
  const [hRange, setHRange] = useState({ from: "", to: "" });

  // SWAP DINAS
  const [swapRows, setSwapRows] = useState([]);
  const [swapPage, setSwapPage] = useState(1);
  const [swapSize, setSwapSize] = useState(100);
  const [swapTotal, setSwapTotal] = useState(0);
  const [loadingSwap, setLoadingSwap] = useState(false);
  const [sStatus, setSStatus] = useState("");
  const [sRange, setSRange] = useState({ from: "", to: "" });

  useEffect(() => {
    (async () => {
      const users = await listUsersMini({});
      const map = {};
      (users || []).forEach((u) => (map[u.id] = u.full_name || `Agent #${u.id}`));
      setNameById(map);
    })();
  }, []);

  // === HOLIDAY ===
  const loadHoliday = async () => {
    setLoadingHoliday(true);
    try {
      const { items } = await listHolidaySwaps({ page: 1, size: 500 });
      setHolidayRows(items || []);
    } finally {
      setLoadingHoliday(false);
    }
  };
  useEffect(() => { loadHoliday(); }, []);

  const pendingBO = useMemo(
    () => (holidayRows || []).filter((r) => r.status === "PENDING_BO"),
    [holidayRows]
  );

  const filteredHolidayHistory = useMemo(() => {
    const rows = (holidayRows || []).filter((r) => r.status !== "PENDING_BO"); // exclude pending list
    const { from, to } = hRange;
    return rows.filter((r) => {
      if (hStatus && String(r.status).toUpperCase() !== hStatus.toUpperCase()) return false;
      if (from && dayjs(r.off_date).isBefore(dayjs(from))) return false;
      if (to && dayjs(r.off_date).isAfter(dayjs(to))) return false;
      return true;
    });
  }, [holidayRows, hStatus, hRange]);

  const submitApprove = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const start_time = form.get("start_time");
    const channel = form.get("channel");
    const shift_name = form.get("shift_name") || null;
    const notes = form.get("notes") || null;
    await boApproveHolidaySwap(open.id, { start_time, channel, shift_name, notes });
    setOpen(null);
    await loadHoliday();
    alert("Tukar libur disetujui & jadwal dibuat.");
  };

  // === SWAP (riwayat) ===
  const loadSwap = async () => {
    setLoadingSwap(true);
    try {
      const { items, total } = await listSwaps({ page: swapPage, size: swapSize });
      setSwapRows(items || []);
      setSwapTotal(total || 0);
    } finally {
      setLoadingSwap(false);
    }
  };
  useEffect(() => { loadSwap(); }, [swapPage, swapSize]);

  const filteredSwapRows = useMemo(() => {
    const raw = swapRows || [];
    const { from, to } = sRange;
    return raw.filter((it) => {
      if (sStatus && String(it.status).toUpperCase() !== sStatus.toUpperCase()) return false;
      if (from && dayjs(it.start_at).isBefore(dayjs(from))) return false;
      if (to && dayjs(it.start_at).isAfter(dayjs(to))) return false;
      return true;
    });
  }, [swapRows, sStatus, sRange]);

  const dash = (v) => (v && String(v).trim() !== "" ? v : "—");

  return (
    <div className="card fluid">
      <div className="section-head" style={{ gap: 8 }}>
        <h3 className="section-title">Swap & Tukar Libur</h3>
        <div className="section-actions" style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${tab === "HOLIDAY" ? "" : "btn-secondary"}`} onClick={() => setTab("HOLIDAY")}>
            Tukar Libur (Pending & Riwayat)
          </button>
          <button className={`btn ${tab === "SWAP" ? "" : "btn-secondary"}`} onClick={() => setTab("SWAP")}>
            Riwayat Swap Dinas
          </button>
        </div>
      </div>

      {/* ===== TAB: HOLIDAY ===== */}
      {tab === "HOLIDAY" && (
        <>
          <SectionTitle kind="HOLIDAY" title="Menunggu Persetujuan Backoffice" />
          <div className="section-head">
            <div className="section-actions">
              <button className="btn btn-ghost" onClick={loadHoliday} disabled={loadingHoliday}>
                {loadingHoliday ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="list">
            {pendingBO.length === 0 && <div className="helper">Tidak ada permintaan menunggu persetujuan.</div>}
            {pendingBO.map((it) => (
              <div key={it.id} className="swap-item">
                <div className="swap-item__top">
                  <div className="title-row">
                    <b>HolidaySwap #{it.id}</b>
                    <Chip>TUKAR LIBUR</Chip>
                  </div>
                  <div className="actions">
                    <button className="btn" onClick={() => setOpen(it)}>
                      Approve & Buat Jadwal
                    </button>
                  </div>
                </div>
                <div className="meta">
                  <span>Tanggal:</span>
                  <b>{dayjs(it.off_date).format("dddd, DD MMM YYYY")}</b>
                </div>
                <div className="meta">
                  <span>Pengaju:</span>
                  <b>{nameById[it.requester_id] || `Agent #${it.requester_id}`}</b>
                </div>
                <div className="meta">
                  <span>Target:</span>
                  <b>{nameById[it.target_user_id] || `Agent #${it.target_user_id}`}</b>
                </div>
                {it.reason && (
                  <div className="meta">
                    <span>Alasan:</span>
                    <b>{it.reason}</b>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* modal approve */}
          {open && (
            <div className="modal-backdrop" onClick={() => setOpen(null)}>
              <div className="card modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
                <h3 style={{ marginTop: 0 }}>
                  Buat Jadwal untuk {nameById[open.target_user_id] || `Agent #${open.target_user_id}`}
                </h3>
                <div className="helper">
                  Tanggal: <b>{dayjs(open.off_date).format("DD MMM YYYY")}</b> — end otomatis +8 jam.
                </div>
                <form onSubmit={submitApprove} className="vstack-12">
                  <label className="label">Jam Masuk</label>
                  <input type="time" name="start_time" className="input" required defaultValue="09:00" />
                  <label className="label">Channel</label>
                  <select name="channel" className="input" required defaultValue="VOICE">
                    <option value="VOICE">VOICE</option>
                    <option value="SOSMED">SOSMED</option>
                  </select>
                  <input name="shift_name" className="input" placeholder="Shift (opsional)" />
                  <input name="notes" className="input" placeholder="Catatan (opsional)" />
                  <div className="actions-right">
                    <button className="btn">Approve & Create</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setOpen(null)}>
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Riwayat tukar libur */}
          <SectionTitle kind="HOLIDAY" title="Riwayat Tukar Libur (Semua Status)" />
          <div className="section-head" style={{ gap: 8 }}>
            <div className="section-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select className="input" value={hStatus} onChange={(e) => setHStatus(e.target.value)} style={{ width: 200 }}>
                <option value="">Status: SEMUA</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="PENDING_TARGET">PENDING_TARGET</option>
              </select>

              <DateRangePicker
                value={hRange}
                onChange={(r)=>setHRange(r)}     // preview (optional)
                onApply={(r)=>setHRange(r)}      // apply
                placeholder="dd/mm/yyyy – dd/mm/yyyy"
                buttonText="Update"
              />

              <button className="btn btn-secondary" onClick={() => { setHStatus(""); setHRange({from:"", to:""}); }}>
                Reset
              </button>
              <button className="btn btn-ghost" onClick={loadHoliday} disabled={loadingHoliday}>
                {loadingHoliday ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="list">
            {filteredHolidayHistory.length === 0 && <div className="helper">Tidak ada data.</div>}
            {filteredHolidayHistory.map((it) => (
              <div key={it.id} className="swap-item">
                <div className="swap-item__top">
                  <div className="title-row">
                    <b>HolidaySwap #{it.id}</b>
                    <Chip>TUKAR LIBUR</Chip>
                  </div>
                  <Chip>{it.status}</Chip>
                </div>
                <div className="meta">
                  <span>Tanggal OFF:</span>
                  <b>{dayjs(it.off_date).format("DD MMM YYYY")}</b>
                </div>
                <div className="meta">
                  <span>Pengaju:</span>
                  <b>{nameById[it.requester_id] || `Agent #${it.requester_id}`}</b>
                </div>
                <div className="meta">
                  <span>Target:</span>
                  <b>{nameById[it.target_user_id] || `Agent #${it.target_user_id}`}</b>
                </div>
                {it.reason && (
                  <div className="meta">
                    <span>Alasan:</span>
                    <b>{it.reason}</b>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== TAB: SWAP DINAS ===== */}
      {tab === "SWAP" && (
        <>
          <SectionTitle kind="SWAP" title="Riwayat Swap Dinas (All Users)" />
          <div className="section-head" style={{ gap: 8 }}>
            <div className="section-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select className="input" value={sStatus} onChange={(e) => setSStatus(e.target.value)} style={{ width: 200 }}>
                <option value="">Status: SEMUA</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              <DateRangePicker
                value={sRange}
                onChange={setSRange}
                onApply={setSRange}
                placeholder="dd/mm/yyyy – dd/mm/yyyy"
                buttonText="Update"
              />

              <button className="btn btn-secondary" onClick={() => { setSStatus(""); setSRange({from:"", to:""}); }}>
                Reset
              </button>
              <button className="btn btn-ghost" onClick={loadSwap} disabled={loadingSwap}>
                {loadingSwap ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="list">
            {filteredSwapRows.length === 0 && <div className="helper">Tidak ada data.</div>}
            {filteredSwapRows.map((sw) => (
              <div className="swap-item" key={sw.id}>
                <div className="swap-item__top">
                  <div className="title-row">
                    <b>Swap #{sw.id}</b>
                    <Chip>SWAP DINAS</Chip>
                  </div>
                  <Chip>{sw.status}</Chip>
                </div>
                <div className="meta">
                  <span>Requester:</span>
                  <b>{sw.requester_name || nameById[sw.requester_id] || `Agent #${sw.requester_id}`}</b>
                </div>
                {sw.counterparty_id && (
                  <div className="meta">
                    <span>Counterparty:</span>
                    <b>{sw.counterparty_name || nameById[sw.counterparty_id] || `Agent #${sw.counterparty_id}`}</b>
                  </div>
                )}
                {sw.target_user_id && (
                  <div className="meta">
                    <span>Ditujukan ke:</span>
                    <b>{nameById[sw.target_user_id] || `Agent #${sw.target_user_id}`}</b>
                  </div>
                )}
                <div className="meta">
                  <span>Window:</span>
                  <b>
                    {dayjs(sw.start_at).format("DD MMM YYYY HH:mm")} – {dayjs(sw.end_at).format("HH:mm")}
                  </b>
                </div>
                {sw.reason && (
                  <div className="meta">
                    <span>Alasan:</span>
                    <b>{sw.reason}</b>
                  </div>
                )}
                <div className="meta">
                  <span>Dibuat:</span>
                  <b>{dayjs(sw.created_at).format("DD MMM YYYY HH:mm")}</b>
                </div>
              </div>
            ))}
          </div>

          <div className="section-foot" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn btn-secondary" disabled={swapPage <= 1} onClick={() => setSwapPage((p) => p - 1)}>
              Prev
            </button>
            <span style={{ alignSelf: "center" }}>Page {swapPage}</span>
            <button
              className="btn"
              disabled={swapPage * swapSize >= swapTotal}
              onClick={() => setSwapPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
