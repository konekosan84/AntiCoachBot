import { useEffect, useMemo, useState } from "react";

/* API */
import {
  getServices,
  createService,
  updateService,
  deleteService,
} from "../api/services.js";
import { getBranches } from "../api/branches.js";

/* UI */
import NeoServiceCard from "../ui/components/NeoServiceCard.jsx";
import NeoServiceTable from "../ui/components/NeoServiceTable.jsx";
import ServiceSidePanel from "../ui/modals/ServiceSidePanel.jsx";
import NeoSegmented from "../ui/components/NeoSegmented.jsx";
import { useToast } from "../helpers/ToastContext.jsx";
import { SkeletonCardGrid } from "../ui/Skeleton.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { Sparkles } from "lucide-react";

export default function Services() {
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [view, setView] = useState("cards");
  const [loading, setLoading] = useState(true);

  const [selectedService, setSelectedService] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadServices = async () => {
    try {
      const data = await getServices();
      setServices(data);
    } catch (e) {
      console.error("Ошибка загрузки услуг", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
    getBranches().then(d => setBranches(Array.isArray(d) ? d : [])).catch(() => setBranches([]));
  }, []);

  const filteredServices = useMemo(() => {
    return services
      .filter(s => {
        const matchName = s.name?.toLowerCase().includes(search.toLowerCase());

        // В services статус обычно is_active boolean.
        // Фильтр держим строковый, чтобы UI не менять.
        const matchStatus =
          !statusFilter ||
          (statusFilter === "active" && s.is_active === true) ||
          (statusFilter === "inactive" && s.is_active === false);

        return matchName && matchStatus;
      })
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "ru", {
          sensitivity: "base",
        })
      );
  }, [services, search, statusFilter]);

  const openCreate = () => {
    setSelectedService(null);
    setIsPanelOpen(true);
  };

  const openEdit = service => {
    setSelectedService(service);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedService(null);
  };

  const handleDelete = async service => {
    if (!window.confirm("Удалить услугу?")) return;

    try {
      await deleteService(service.id);
      loadServices();
    } catch (e) {
      console.error("Ошибка удаления услуги", e);
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
          + Добавить услугу
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
          <option value="active">Активна</option>
          <option value="inactive">Неактивна</option>
        </select>
      </div>

      {/* CONTENT */}
      {loading ? (
        <SkeletonCardGrid count={6} minW={260} gap={16} />
      ) : filteredServices.length === 0 ? (
        services.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Пока нет услуг"
            subtitle="Добавьте услуги — стрижка, маникюр, консультация. Они появятся при создании записи клиента."
            action={{ label: "+ Добавить услугу", onClick: openCreate }}
          />
        ) : (
          <EmptyState icon={Sparkles} title="Ничего не нашлось" subtitle="Поменяйте поиск или фильтр статуса." />
        )
      ) : view === "cards" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {filteredServices.map(service => (
            <NeoServiceCard
              key={service.id}
              service={service}
              branches={branches}
              onClick={() => openEdit(service)}
              onEdit={() => openEdit(service)}
              onDelete={() => handleDelete(service)}
            />
          ))}
        </div>
      )}

      {view === "table" && (
        <NeoServiceTable
          services={filteredServices}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {isPanelOpen && (
        <ServiceSidePanel
          service={selectedService}
          onClose={closePanel}
          onSaved={async form => {
            try {
              if (selectedService?.id) {
                await updateService(selectedService.id, form);
              } else {
                await createService(form);
              }

              closePanel();
              loadServices();
            } catch (e) {
              console.error("Ошибка сохранения услуги", e);
              toast.error("Не удалось сохранить услугу");
            }
          }}
        />
      )}
    </div>
  );
}

