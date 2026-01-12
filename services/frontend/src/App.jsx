import { useEffect, useState } from "react";
import { api } from "./api";
import RoomList from "./components/RoomList";
import ChatView from "./components/ChatView";
import AIPanel from "./components/AIPanel";

import "./styles.css";

export default function App() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);

  useEffect(() => {
    api.get("/rooms").then(r => setRooms(r.data));
    const i = setInterval(() => api.get("/rooms").then(r => setRooms(r.data)), 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="app">
      <RoomList rooms={rooms} onSelect={setActiveRoom} active={activeRoom} />
      <ChatView room={activeRoom} />
      <AIPanel room={activeRoom} />
    </div>
  );
}
