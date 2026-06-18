import { useEffect, useMemo, useState } from "react";

/* API */
import {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomBranches,
} from "../api/rooms.js";
import { getBranches } from "../api/branches.js";

/* UI */
import NeoRoomCard from "../ui/components/NeoRoomCard.jsx";
import NeoRoomTable from "../ui/components/NeoRoomTable.jsx";
import RoomSidePanel from "../ui/modals/RoomSidePanel.jsx";
import { useToast } from "../helpers/ToastContext.jsx";
import { SkeletonCardGrid } from "../ui/Skeleton.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { DoorOpen } from "lucide-react";
import NeoSegmented from "../ui/components/NeoSegmented.jsx";

export default function Rooms() {
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [branches, setBranches] = useState([]);

  const [view, setView] = useState("cards");
  const [loading, setLoading] = useState(true);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadRooms = async () => {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch (e) {
      console.error("Ошибка загрузки помещений", e);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data);
    } catch (e) {
      console.error("Ошибка загрузки филиалов (для помещений)", e);
    }
  };

  useEffect(() => {
    loadRooms();
    loadBranches();
  }, []);

  const filteredRooms = useMemo(() => {
    return rooms
      .filter(r => {
        const matchName = (r.name || "")
          .toLowerCase()
          .includes(search.toLowerCase());

        const matchStatus =
          !statusFilter ||
          (statusFilter === "active" && r.is_active === true) ||
          (statusFilter === "inactive" && r.is_active === false);

        return matchName && matchStatus;
      })
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "ru", { sensitivity: "base" })
      );
  }, [rooms, search, statusFilter]);

  const openCreate = () => {
    setSelectedRoom(null);
    setIsPanelOpen(true);
  };

  const openEdit = room => {
    setSelectedRoom(room);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedRoom(null);
  };

  const handleDelete = async room => {
    if (!window.confirm("Удалить помещение?")) return;

    try {
      await deleteRoom(room.id);
      loadRooms();
    } catch (e) {
      console.error("Ошибка удаления помещения", e);
    }
  };

  const getBranchNames = (room) => {
    const ids = Array.isArray(room.branch_ids) ? room.branch_ids : [];
    if (!ids.length && room.branch_id) ids.push(room.branch_id);
    const names = ids
      .map(id => branches.find(b => b.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(", ") : "—";
  };

  return (
    <div style={{ padding: 24 }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <NeoSegmented
          value={view}
          onChange={setView}
          options={[
            { value: "cards", label: "Карточки" },
            { value: "table", label: "Таблица" },
          ]}
        />

        <button
          onClick={openCreate}
          style={{
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            background: "#6C5CE7",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Добавить помещение
        </button>
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border-input)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
          }}
        />

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border-input)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
          }}
        >
          <option value="">Все статусы</option>
          <option value="active">Активно</option>
          <option value="inactive">Неактивно</option>
        </select>
      </div>

      {/* CONTENT */}
      {loading ? (
        <SkeletonCardGrid count={6} minW={260} gap={16} />
      ) : filteredRooms.length === 0 ? (
        rooms.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title="Пока нет помещений"
            subtitle="Добавьте помещения (залы, кабинеты, посты). Клиенты будут бронировать их на конкретное время."
            action={{ label: "+ Добавить помещение", onClick: openCreate }}
          />
        ) : (
          <EmptyState icon={DoorOpen} title="Ничего не нашлось" subtitle="Поменяйте поиск или фильтр статуса." />
        )
      ) : view === "cards" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {filteredRooms.map(room => (
            <NeoRoomCard
              key={room.id}
              room={room}
              branches={branches}
              getBranchNames={getBranchNames}
              onClick={() => openEdit(room)}
              onEdit={() => openEdit(room)}
              onDelete={() => handleDelete(room)}
            />
          ))}
        </div>
      )}

      {view === "table" && (
        <NeoRoomTable
          rooms={filteredRooms}
          getBranchNames={getBranchNames}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {isPanelOpen && (
        <RoomSidePanel
          room={selectedRoom}
          branches={branches}
          onClose={closePanel}
          onSaved={async form => {
            try {
              const branchIds = Array.isArray(form.branch_ids)
                ? form.branch_ids.map(Number).filter(Boolean)
                : [];

              if (!branchIds.length) {
                toast.warning("Выбери хотя бы один филиал");
                return;
              }

              const payload = {
                name: form.name,
                capacity: form.capacity ?? null,
                description: form.description ?? "",
                is_active: form.is_active ?? true,
                // primary branch
                branch_id: branchIds[0],
              };

              let saved;
              if (selectedRoom?.id) {
                saved = await updateRoom(selectedRoom.id, payload);
                await updateRoomBranches(selectedRoom.id, branchIds);
              } else {
                saved = await createRoom(payload);
                await updateRoomBranches(saved.id, branchIds);
              }

              closePanel();
              loadRooms();
            } catch (e) {
              console.error("Ошибка сохранения помещения", e);
              toast.error("Не удалось сохранить помещение");
            }
          }}
        />
      )}
    </div>
  );
}
