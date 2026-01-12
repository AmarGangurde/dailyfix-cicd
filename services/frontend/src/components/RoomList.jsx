export default function RoomList({ rooms, onSelect, active }) {
    return (
      <div className="rooms">
        {rooms.map(r => (
          <div
            key={r}
            className={active === r ? "room active" : "room"}
            onClick={() => onSelect(r)}
          >
            {r}
          </div>
        ))}
      </div>
    );
  }
  