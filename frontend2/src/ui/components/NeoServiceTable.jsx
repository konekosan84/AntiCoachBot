import useSortable, { SortIcon } from "../../hooks/useSortable.jsx";
import CardActions from "../CardActions.jsx";

export default function NeoServiceTable({ services, onEdit, onDelete }) {
  const { sortedData, sortKey, sortDir, toggle } = useSortable(services, "name");

  return (
    <table className="neo-table">
      <thead>
        <tr>
          <Th onClick={() => toggle("name")}     active={sortKey === "name"}     dir={sortDir}>Название</Th>
          <Th onClick={() => toggle("price")}    active={sortKey === "price"}    dir={sortDir}>Цена</Th>
          <Th onClick={() => toggle("duration")} active={sortKey === "duration"} dir={sortDir}>Длительность</Th>
          <Th onClick={() => toggle("is_active")} active={sortKey === "is_active"} dir={sortDir}>Статус</Th>
          <th style={{ width: 96 }} />
        </tr>
      </thead>

      <tbody>
        {sortedData.map((service) => {
          const isActive = !!service.is_active;
          return (
            <tr key={service.id} onClick={() => onEdit(service)} style={{ cursor: "pointer" }}>
              <td>{service.name}</td>
              <td>{service.price != null ? `${service.price} ₽` : "—"}</td>
              <td>{service.duration ? `${service.duration} мин` : "—"}</td>
              <td>{isActive ? "Активна" : "Неактивна"}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <CardActions onEdit={() => onEdit(service)} onDelete={() => onDelete(service)} />
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
