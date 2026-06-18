import useSortable, { SortIcon } from "../../hooks/useSortable.jsx";
import CardActions from "../CardActions.jsx";

function renderBranches(branches = []) {
  if (!branches.length) return "—";
  const names = branches.map(b => b.name);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export default function NeoEmployeeTable({ employees, onEdit, onDelete }) {
  const { sortedData, sortKey, sortDir, toggle } = useSortable(employees, "name");

  return (
    <table className="neo-table">
      <thead>
        <tr>
          <Th onClick={() => toggle("name")}     active={sortKey === "name"}     dir={sortDir}>ФИО</Th>
          <Th onClick={() => toggle("position")} active={sortKey === "position"} dir={sortDir}>Должность</Th>
          <th>Филиалы</th>
          <Th onClick={() => toggle("status")}   active={sortKey === "status"}   dir={sortDir}>Статус</Th>
          <th style={{ width: 96 }}></th>
        </tr>
      </thead>

      <tbody>
        {sortedData.map(emp => (
          <tr key={emp.id} onClick={() => onEdit(emp)} style={{ cursor: "pointer" }}>
            <td>{emp.name || "—"}</td>
            <td>{emp.position || "—"}</td>
            <td style={{ opacity: 0.8 }}>{renderBranches(emp.branches)}</td>
            <td>{emp.status || "—"}</td>
            <td onClick={e => e.stopPropagation()}>
              <CardActions onEdit={() => onEdit(emp)} onDelete={() => onDelete(emp)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, onClick, active, dir }) {
  return (
    <th
      onClick={onClick}
      style={{ cursor: "pointer", userSelect: "none" }}
      title="Кликни для сортировки"
    >
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {children}
        <SortIcon active={active} dir={dir} />
      </span>
    </th>
  );
}
