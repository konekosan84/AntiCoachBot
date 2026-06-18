import useSortable, { SortIcon } from "../../hooks/useSortable.jsx";
import CardActions from "../CardActions.jsx";

export default function NeoBranchTable({ branches = [], onEdit, onDelete }) {
  const { sortedData, sortKey, sortDir, toggle } = useSortable(branches, "name");
  return (
    <table className="neo-table">
      <thead>
        <tr>
          <Th onClick={() => toggle("name")}    active={sortKey === "name"}    dir={sortDir}>Название</Th>
          <Th onClick={() => toggle("address")} active={sortKey === "address"} dir={sortDir}>Адрес</Th>
          <Th onClick={() => toggle("phone")}   active={sortKey === "phone"}   dir={sortDir}>Телефон</Th>
          <Th onClick={() => toggle("status")}  active={sortKey === "status"}  dir={sortDir}>Статус</Th>
          <th style={{ width: 96 }}></th>
        </tr>
      </thead>

      <tbody>
        {sortedData.map(branch => (
          <tr key={branch.id} onClick={() => onEdit(branch)} style={{ cursor: "pointer" }}>
            <td>{branch.name || "—"}</td>
            <td style={{ opacity: 0.8 }}>{branch.address || "—"}</td>
            <td style={{ opacity: 0.7 }}>{branch.phone || "—"}</td>
            <td>{branch.status || "—"}</td>
            <td onClick={e => e.stopPropagation()}>
              <CardActions onEdit={() => onEdit(branch)} onDelete={() => onDelete(branch)} />
            </td>
          </tr>
        ))}
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
