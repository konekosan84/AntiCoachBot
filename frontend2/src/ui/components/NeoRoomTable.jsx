import useSortable, { SortIcon } from "../../hooks/useSortable.jsx";
import CardActions from "../CardActions.jsx";

export default function NeoRoomTable({ rooms, branches, onEdit, onDelete }) {
  const { sortedData, sortKey, sortDir, toggle } = useSortable(rooms, "name");

  return (
    <table className="neo-table">
      <thead>
        <tr>
          <Th onClick={() => toggle("name")}      active={sortKey === "name"}      dir={sortDir}>Название</Th>
          <Th onClick={() => toggle("capacity")}  active={sortKey === "capacity"}  dir={sortDir}>Вместимость</Th>
          <th>Филиалы</th>
          <Th onClick={() => toggle("is_active")} active={sortKey === "is_active"} dir={sortDir}>Статус</Th>
          <th style={{ width: 96 }} />
        </tr>
      </thead>

      <tbody>
        {sortedData.map(room => {
          const branchIds = Array.isArray(room.branch_ids)
            ? room.branch_ids
            : (room.branch_id ? [room.branch_id] : []);
          const branchNames = branchIds
            .map(id => branches?.find(b => Number(b.id) === Number(id))?.name)
            .filter(Boolean);

          return (
            <tr key={room.id} onClick={() => onEdit(room)} style={{ cursor: "pointer" }}>
              <td>{room.name}</td>
              <td>{room.capacity ?? "—"}</td>
              <td style={{ opacity: 0.85 }}>{branchNames.length ? branchNames.join(", ") : "—"}</td>
              <td>{room.is_active ? "Активно" : "Неактивно"}</td>
              <td onClick={e => e.stopPropagation()}>
                <CardActions onEdit={() => onEdit(room)} onDelete={() => onDelete(room)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Th({ children, onClick, active, dir }) {
  return (
    <th onClick={onClick} style={{ cursor: "pointer", userSelect: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {children}
        <SortIcon active={active} dir={dir} />
      </span>
    </th>
  );
}
