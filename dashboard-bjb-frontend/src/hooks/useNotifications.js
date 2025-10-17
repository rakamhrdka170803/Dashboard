import { useEffect, useState } from "react";
import { listMyNotifications, markRead } from "../api/notifications";

export default function useNotifications(pollMs = 20000) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // hooks/useNotifications.js
const load = async () => {
  setLoading(true);
  try {
    const rows = await listMyNotifications({ unread: false, limit: 100 });
    const sorted = [...(rows || [])].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at) || (b.id - a.id)
    );
    setItems(sorted);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [pollMs]);

  const unreadCount = items.filter(i => !i.is_read).length;
  const setRead = async (id) => {
    await markRead(id);
    setItems(prev => prev.map(x => (x.id === id ? { ...x, is_read: true } : x)));
  };

  return { items, unreadCount, loading, reload: load, setRead };
}
