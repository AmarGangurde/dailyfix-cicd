import { useEffect, useState } from "react";
import { api } from "../api";

export default function ChatView({ room }) {
  const [msgs, setMsgs] = useState([]);

  useEffect(() => {
    if (!room) return;
    const load = () =>
      api.get(`/rooms/${encodeURIComponent(room)}/messages`).then(r => setMsgs(r.data));
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [room]);

  if (!room) return <div className="chat">Select a room</div>;

  return (
    <div className="chat">
      {msgs.map(m => (
        <div key={m.id} className="msg">
          <b>{m.sender}</b>: {m.body}
        </div>
      ))}
    </div>
  );
}
