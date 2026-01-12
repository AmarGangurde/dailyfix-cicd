import { useEffect, useState } from "react";
import { api } from "../api";

export default function AIPanel({ room }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!room) return;
    api.get(`/rooms/${encodeURIComponent(room)}/summary`)
      .then(r => setSummary(r.data.summary || ""));
  };

  useEffect(() => {
    load();
  }, [room]);

  const gen = async () => {
    setLoading(true);
    setSummary("Generating summary...");
    await api.post(`/rooms/${encodeURIComponent(room)}/summarise`);

    // Poll until summary appears
    const poll = setInterval(() => {
      api.get(`/rooms/${encodeURIComponent(room)}/summary`).then(r => {
        if (r.data.summary && !r.data.summary.includes("unavailable")) {
          setSummary(r.data.summary);
          setLoading(false);
          clearInterval(poll);
        }
      });
    }, 2000);
  };

  return (
    <div className="ai">
      <button onClick={gen} disabled={!room || loading}>
        {loading ? "Generating..." : "Generate Summary"}
      </button>
  
      <div className="summary-box">
        {summary || "No summary yet"}
      </div>
    </div>
  );
  
}
