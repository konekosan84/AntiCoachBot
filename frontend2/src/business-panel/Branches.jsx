import { useEffect, useMemo, useState } from "react";

/* API */
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../api/branches.js";

/* UI */
import NeoBranchCard from "../ui/components/NeoBranchCard.jsx";
import NeoBranchTable from "../ui/components/NeoBranchTable.jsx";
import BranchSidePanel from "../ui/modals/BranchSidePanel.jsx";
import NeoSegmented from "../ui/components/NeoSegmented.jsx";
import { useToast } from "../helpers/ToastContext.jsx";
import { SkeletonCardGrid } from "../ui/Skeleton.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { Building2 } from "lucide-react";

export default function Branches() {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [view, setView] = useState("cards");
  const [loading, setLoading] = useState(true);

  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data);
    } catch (e) {
      console.error("Ошибка загрузки филиалов", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const filteredBranches = useMemo(() => {
    return branches
      .filter(b => {
        const matchName = b.name
          ?.toLowerCase()
          .includes(search.toLowerCase());

        const matchStatus =
          !statusFilter || b.status === statusFilter;

        return matchName && matchStatus;
      })
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "ru", {
          sensitivity: "base",
        })
      );
  }, [branches, search, statusFilter]);

  const openCreate = () => {
    setSelectedBranch(null);
    setIsPanelOpen(true);
  };

  const openEdit = branch => {
    setSelectedBranch(branch);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedBranch(null);
  };

  const handleDelete = async branch => {
    if (!window.confirm("Удалить филиал?")) return;

    try {
      await deleteBranch(branch.id);
      loadBranches();
    } catch (e) {
      console.error("Ошибка удаления филиала", e);
    }
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
          + Добавить филиал
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
          <option value="active">Активен</option>
          <option value="inactive">Неактивен</option>
        </select>
      </div>

      {/* CONTENT */}
      {loading ? (
        <SkeletonCardGrid count={6} minW={260} gap={16} />
      ) : filteredBranches.length === 0 ? (
        branches.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Пока нет филиалов"
            subtitle="Добавьте первый филиал — это место, где вы принимаете клиентов. Дальше к нему привяжете сотрудников и услуги."
            action={{ label: "+ Добавить филиал", onClick: openCreate }}
          />
        ) : (
          <EmptyState icon={Building2} title="Ничего не нашлось" subtitle="Поменяйте поиск или фильтр статуса." />
        )
      ) : view === "cards" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {filteredBranches.map(branch => (
            <NeoBranchCard
              key={branch.id}
              branch={branch}
              onClick={() => openEdit(branch)}
              onEdit={() => openEdit(branch)}
              onDelete={() => handleDelete(branch)}
            />
          ))}
        </div>
      )}

      {view === "table" && (
        <NeoBranchTable
          branches={filteredBranches}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {isPanelOpen && (
        <BranchSidePanel
          branch={selectedBranch}
          onClose={closePanel}
          onSaved={async form => {
            try {
              if (selectedBranch?.id) {
                await updateBranch(selectedBranch.id, form);
              } else {
                await createBranch(form);
              }

              closePanel();
              loadBranches();
            } catch (e) {
              console.error("Ошибка сохранения филиала", e);
              toast.error("Не удалось сохранить филиал");
            }
          }}
        />
      )}
    </div>
  );
}
