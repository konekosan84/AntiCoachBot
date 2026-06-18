import { useEffect, useMemo, useState } from "react";
import PhoneInput from "../ui/PhoneInput.jsx";
import CardActions from "../ui/CardActions.jsx";
import ExportBtn from "../ui/ExportBtn.jsx";
import { useToast } from "../helpers/ToastContext.jsx";
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} from "../api/clients";
import { getBranches } from "../api/branches";
import { getBookings } from "../api/bookings";

const VIEW_MODES = [
  { value: "cards", label: "Карточки" },
  { value: "table", label: "Таблица" },
];

const SOURCE_OPTIONS = [
  { value: "yandex", label: "Яндекс" },
  { value: "avito", label: "Авито" },
  { value: "site", label: "Сайт" },
  { value: "raf", label: "RAF / рекомендация" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "walkin", label: "Зашёл с улицы" },
  { value: "call", label: "Звонок" },
  { value: "other", label: "Другое" },
  { value: "custom", label: "Свой источник" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "new" },
  { value: "active", label: "active" },
  { value: "archive", label: "archive" },
];

const BRANCH_MODE_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "created", label: "Создан филиалом" },
  { value: "visited", label: "Был в филиале" },
];

const EMPTY_FORM = {
  full_name: "",
  phoneDigits: "",
  email: "",
  birthday: "",
  notes: "",
  status: "new",
  source: "",
  custom_source: "",
};

function normalizePhoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("8")) digits = digits.slice(1);
  if (digits.startsWith("7")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function phoneFromDigits(digits) {
  const normalized = normalizePhoneDigits(digits);
  return normalized ? `+7${normalized}` : "";
}

function digitsFromPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("8")) return digits.slice(1, 11);
  if (digits.startsWith("7")) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

function normalizedPhoneForCompare(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits;
}

function formatPhoneForView(phone) {
  const digits = digitsFromPhone(phone);
  if (!digits) return "—";

  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 8);
  const p4 = digits.slice(8, 10);

  let out = "+7";
  if (p1) out += ` (${p1}`;
  if (p1.length === 3) out += ")";
  if (p2) out += ` ${p2}`;
  if (p3) out += `-${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

function validateFullName(value) {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  const parts = clean.split(" ").filter(Boolean);
  return parts.length >= 2;
}

function getSourceLabel(value) {
  if (!value) return "—";
  const found = SOURCE_OPTIONS.find((item) => item.value === value);
  return found ? found.label : value;
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU");
  } catch {
    return String(value);
  }
}



function formatYmdToRu(value) {
  if (!value) return "—";
  const ymd = String(value).slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatTimeShort(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function formatBookingDateRange(booking) {
  if (!booking) return "—";
  const date = formatYmdToRu(booking.date);
  const start = formatTimeShort(booking.start_time);
  const end = formatTimeShort(booking.end_time);
  if (start && end) return `${date} • ${start}–${end}`;
  if (start) return `${date} • ${start}`;
  return date;
}

function normalizeBookingItem(item) {
  if (!item) return null;
  const date = String(item.date || item.booking_date || "").slice(0, 10);
  const start_time = formatTimeShort(item.start_time || item.time_from || item.start || "");
  const end_time = formatTimeShort(item.end_time || item.time_to || item.end || "");
  return {
    ...item,
    id: item.id ?? item.booking_id ?? null,
    client_id: item.client_id ?? item.client?.id ?? null,
    date,
    start_time,
    end_time,
    phone: item.phone || item.client_phone || item.client?.phone || "",
    client_name: item.client_name || item.full_name || item.client?.full_name || "",
    status: item.status || "booked",
  };
}

function normalizeBookingsList(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeBookingItem)
    .filter(Boolean)
    .filter((item) => item.date);
}

function bookingSortKey(item) {
  return `${String(item?.date || "").slice(0, 10)} ${formatTimeShort(item?.start_time || "00:00")}`;
}

function dedupeBookings(list) {
  const map = new Map();
  for (const raw of normalizeBookingsList(list)) {
    const key = raw.id != null
      ? `id:${raw.id}`
      : `fallback:${raw.client_id || ''}:${raw.date}:${raw.start_time}:${raw.end_time}:${raw.service_id || raw.service_name || ''}:${raw.employee_id || ''}:${raw.branch_id || ''}`;
    const prev = map.get(key);
    if (!prev || bookingSortKey(raw) >= bookingSortKey(prev)) {
      map.set(key, raw);
    }
  }
  return Array.from(map.values()).sort((a, b) => (bookingSortKey(a) < bookingSortKey(b) ? 1 : -1));
}

function getClientHistoryStats(bookings) {
  const list = dedupeBookings(bookings);
  return {
    total: list.length,
    booked: list.filter((x) => x.status === "booked").length,
    completed: list.filter((x) => x.status === "completed").length,
    cancelled: list.filter((x) => x.status === "cancelled").length,
    noShow: list.filter((x) => x.status === "no_show").length,
  };
}

function getLastVisitBooking(bookings) {
  const list = dedupeBookings(bookings);
  const completed = list.find((x) => x.status === "completed");
  if (completed) return completed;
  return list.find((x) => x.status !== "cancelled") || list[0] || null;
}

function escapeCsv(value) {
  let text = value == null ? "" : String(value);
  text = text.replace(/\r?\n/g, " ");
  text = text.replace(/"/g, '""');
  return `"${text}"`;
}

function downloadCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const csv = rows.map((row) => row.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getStatusBadgeStyle(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    border: "1px solid var(--border)",
    whiteSpace: "nowrap",
  };

  if (status === "active") {
    return {
      ...base,
      background: "rgba(16, 185, 129, 0.18)",
      color: "#7ef7c5",
      border: "1px solid rgba(16, 185, 129, 0.25)",
    };
  }

  if (status === "archive") {
    return {
      ...base,
      background: "rgba(148, 163, 184, 0.16)",
      color: "#d4dbe5",
      border: "1px solid rgba(148, 163, 184, 0.2)",
    };
  }

  return {
    ...base,
    background: "rgba(59, 130, 246, 0.18)",
    color: "#8fd1ff",
    border: "1px solid rgba(59, 130, 246, 0.24)",
  };
}

const actionBtnStyle = {
  width: 40,
  height: 40,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: 16,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function extractBranchId(branch) {
  return branch?.id ?? branch?.branch_id ?? branch?.value ?? "";
}

function extractBranchName(branch) {
  return (
    branch?.name ??
    branch?.title ??
    branch?.branch_name ??
    branch?.label ??
    `Филиал ${extractBranchId(branch)}`
  );
}

export default function Clients() {
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const [viewMode, setViewMode] = useState("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchMode, setBranchMode] = useState("all");
  const [branchId, setBranchId] = useState("");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientBookings, setClientBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadBranches();
    loadClients();
  }, []);

  async function loadBranches() {
    try {
      setBranchesLoading(true);
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Ошибка загрузки филиалов:", err);
      setBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  }

  async function loadClients(params = {}) {
    try {
      setLoading(true);
      const data = await getClients({
        search: params.search ?? search,
        status: params.status ?? statusFilter,
        branch_mode: params.branch_mode ?? branchMode,
        branch_id: params.branch_id ?? branchId,
        limit: 300,
      });
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Ошибка загрузки клиентов:", err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadClientDetails(clientId) {
    try {
      setBookingsLoading(true);
      setHistoryExpanded(false);

      const result = await getClient(clientId);
      const client = result?.data || result?.client || null;
      if (client) setSelectedClient(client);

      const detailsBookings = normalizeBookingsList(
        result?.bookings || result?.history || result?.visits || result?.data?.bookings || []
      );

      let apiBookings = [];
      try {
        const phone = client?.phone || selectedClient?.phone || "";
        const fullName = client?.full_name || selectedClient?.full_name || "";
        const searchValue = phone || fullName || undefined;
        const response = await getBookings(searchValue ? { search: searchValue, limit: 500 } : { limit: 500 });
        apiBookings = normalizeBookingsList(Array.isArray(response) ? response : response?.data || response?.items || []);
      } catch (apiErr) {
        console.warn("Не удалось догрузить историю из bookings:", apiErr);
      }

      const selectedPhone = normalizedPhoneForCompare(client?.phone || selectedClient?.phone || "");
      const selectedName = String(client?.full_name || selectedClient?.full_name || "").trim().toLowerCase();

      const merged = dedupeBookings([
        ...detailsBookings,
        ...apiBookings.filter((item) => {
          const sameClientId = clientId && String(item.client_id || "") === String(clientId);
          const samePhone = selectedPhone && normalizedPhoneForCompare(item.phone) === selectedPhone;
          const sameName = selectedName && String(item.client_name || "").trim().toLowerCase() === selectedName;
          return sameClientId || samePhone || sameName;
        }),
      ]);

      setClientBookings(merged);
    } catch (err) {
      console.error("Ошибка загрузки клиента:", err);
      setClientBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }

  async function handleSearchSubmit(e) {
    e.preventDefault();
    await loadClients({
      search,
      status: statusFilter,
      branch_mode: branchMode,
      branch_id: branchId,
    });
  }

  async function handleOpenClient(client) {
    setSelectedClient(client);
    setClientBookings([]);
    setViewerOpen(true);
    await loadClientDetails(client.id);
  }

  function closeViewer() {
    setViewerOpen(false);
    setSelectedClient(null);
    setClientBookings([]);
    setHistoryExpanded(false);
  }

  function openCreateEditor() {
    setEditingClientId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDuplicateWarning(null);
    setEditorOpen(true);
  }

  function openEditEditor(client) {
    const sourceKnown = SOURCE_OPTIONS.some((item) => item.value === client.source);

    setEditingClientId(client.id);
    setForm({
      full_name: client.full_name || "",
      phoneDigits: digitsFromPhone(client.phone),
      email: client.email || "",
      birthday: client.birthday ? String(client.birthday).slice(0, 10) : "",
      notes: client.notes || "",
      status: client.status || "new",
      source: sourceKnown ? client.source || "" : client.source ? "custom" : "",
      custom_source: sourceKnown ? "" : client.source || "",
    });
    setFormError("");
    setDuplicateWarning(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingClientId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDuplicateWarning(null);
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handlePhoneBlur() {
    if (editingClientId) return;

    const normalizedDigits = normalizePhoneDigits(form.phoneDigits);
    if (normalizedDigits.length !== 10) {
      setDuplicateWarning(null);
      return;
    }

    const phone = phoneFromDigits(normalizedDigits);
    const target = normalizedPhoneForCompare(phone);

    try {
      const data = await getClients({
        search: phone,
        limit: 30,
      });

      const found = Array.isArray(data)
        ? data.find((client) => normalizedPhoneForCompare(client.phone) === target)
        : null;

      setDuplicateWarning(found || null);
    } catch (err) {
      console.error("Ошибка проверки дубля:", err);
      setDuplicateWarning(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    const cleanName = form.full_name.trim().replace(/\s+/g, " ");
    const normalizedDigits = normalizePhoneDigits(form.phoneDigits);
    const fullPhone = phoneFromDigits(normalizedDigits);

    if (!validateFullName(cleanName)) {
      setFormError("ФИО должно содержать минимум фамилию и имя.");
      return;
    }

    if (normalizedDigits.length !== 10) {
      setFormError("Телефон должен содержать 10 цифр после +7.");
      return;
    }

    let sourceValue = form.source || null;
    if (form.source === "custom") {
      sourceValue = form.custom_source.trim() || null;
      if (!sourceValue) {
        setFormError("Укажи свой источник.");
        return;
      }
    }

    const payload = {
      full_name: cleanName,
      phone: fullPhone,
      email: form.email.trim() || null,
      birthday: form.birthday || null,
      notes: form.notes.trim() || null,
      status: form.status || "new",
      source: sourceValue,
      business_id: branchId || null,
      created_branch_id: branchId || null,
    };

    try {
      setSaving(true);

      if (editingClientId) {
        const result = await updateClient(editingClientId, payload);
        const saved = result?.data || result;

        setClients((prev) =>
          prev.map((c) => (c.id === editingClientId ? saved : c))
        );

        if (selectedClient?.id === editingClientId) {
          setSelectedClient(saved);
        }
      } else {
        const result = await createClient(payload);
        const saved = result?.data || null;
        if (saved) {
          setClients((prev) => {
            const exists = prev.some((c) => c.id === saved.id);
            if (exists) return prev.map((c) => (c.id === saved.id ? saved : c));
            return [saved, ...prev];
          });
          toast.success("Клиент создан");
        }
      }

      closeEditor();
      await loadClients();
    } catch (err) {
      console.error("Ошибка сохранения клиента:", err);
      if (err?.status === 409 && err?.payload?.error === "PHONE_DUPLICATE") {
        const existing = err.payload.data;
        setDuplicateWarning(existing);
        const msg = `Уже есть клиент с этим телефоном: ${existing?.full_name || "—"}`;
        setFormError(msg);
        toast.warning(msg);
      } else {
        const msg = err.message || "Не удалось сохранить клиента.";
        setFormError(msg);
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClient(client) {
    const ok = window.confirm(`Удалить клиента "${client.full_name}"?`);
    if (!ok) return;

    try {
      await deleteClient(client.id);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      if (selectedClient?.id === client.id) {
        closeViewer();
      }
    } catch (err) {
      console.error("Ошибка удаления клиента:", err);
      toast.error("Не удалось удалить клиента.");
    }
  }

  const branchMap = useMemo(() => {
    const map = new Map();
    for (const branch of branches) {
      map.set(String(extractBranchId(branch)), extractBranchName(branch));
    }
    return map;
  }, [branches]);

  const branchOptions = useMemo(() => {
    const items = branches
      .map((branch) => ({
        value: String(extractBranchId(branch)),
        label: extractBranchName(branch),
      }))
      .filter((x) => x.value);

    return [{ value: "", label: "Все филиалы" }, ...items];
  }, [branches]);

  const stats = useMemo(() => {
    const total = clients.length;
    const byStatus = clients.reduce(
      (acc, client) => {
        const key = client.status || "new";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { new: 0, active: 0, archive: 0 }
    );

    return {
      total,
      newCount: byStatus.new || 0,
      activeCount: byStatus.active || 0,
      archiveCount: byStatus.archive || 0,
    };
  }, [clients]);

  const historyStats = useMemo(() => getClientHistoryStats(clientBookings), [clientBookings]);
  const lastVisitBooking = useMemo(() => getLastVisitBooking(clientBookings), [clientBookings]);
  const remainingBookings = useMemo(() => {
    if (!lastVisitBooking) return clientBookings;

    const skipId = lastVisitBooking.id ?? null;
    let skipped = false;

    return clientBookings.filter((item) => {
      if (!skipped && skipId != null && item.id === skipId) {
        skipped = true;
        return false;
      }

      if (
        !skipped &&
        skipId == null &&
        item.date === lastVisitBooking.date &&
        item.start_time === lastVisitBooking.start_time &&
        item.end_time === lastVisitBooking.end_time &&
        (item.service_id || item.service_name || item.service_title || "") ===
          (lastVisitBooking.service_id || lastVisitBooking.service_name || lastVisitBooking.service_title || "")
      ) {
        skipped = true;
        return false;
      }

      return true;
    });
  }, [clientBookings, lastVisitBooking]);

  const visibleBookings = useMemo(() => (historyExpanded ? remainingBookings : []), [remainingBookings, historyExpanded]);

  const clientComment = useMemo(() => (
    selectedClient?.notes ||
    selectedClient?.comment ||
    selectedClient?.client_comment ||
    selectedClient?.description ||
    ""
  ), [selectedClient]);

  function handleExportClientHistory() {
    if (!selectedClient || clientBookings.length === 0) return;
    const rows = [
      ["Клиент", "Телефон", "Дата", "Время", "Статус", "Филиал", "Сотрудник", "Услуга", "Цена", "Комментарий"],
      ...clientBookings.map((booking) => [
        selectedClient.full_name || "",
        formatPhoneForView(selectedClient.phone),
        formatYmdToRu(booking.date),
        `${formatTimeShort(booking.start_time)}${booking.end_time ? `-${formatTimeShort(booking.end_time)}` : ""}`,
        booking.status || "",
        booking.branch_id ? branchMap.get(String(booking.branch_id)) || booking.branch_id : "",
        booking.employee_name || booking.employee_full_name || booking.employee_id || "",
        booking.service_name || booking.service_title || booking.service_id || "",
        booking.price ?? "",
        booking.comment || booking.notes || "",
      ]),
    ];
    const safeName = String(selectedClient.full_name || "client").replace(/[\/:*?"<>|]+/g, "_");
    downloadCsv(`client-history-${safeName}.csv`, rows);
  }

  return (
    <div className="page visionos-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <ViewSwitch viewMode={viewMode} setViewMode={setViewMode} />
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <ExportBtn entity="clients" />
          <button className="neo-btn" onClick={openCreateEditor}>
            + Новый клиент
          </button>
        </div>
      </div>

      <div className="visionos-card" style={{ padding: 16, marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 14,
            opacity: 0.76,
          }}
        >
          <span>Всего: {stats.total}</span>
          <span>new: {stats.newCount}</span>
          <span>active: {stats.activeCount}</span>
          <span>archive: {stats.archiveCount}</span>
        </div>
      </div>

      <div className="visionos-card" style={{ padding: 16, marginBottom: 18 }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px,1fr) 170px 190px 220px auto",
            gap: 10,
          }}
        >
          <input
            type="text"
            className="neo-input"
            placeholder="Поиск: ФИО, телефон, email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="neo-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="neo-input"
            value={branchMode}
            onChange={(e) => setBranchMode(e.target.value)}
          >
            {BRANCH_MODE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="neo-input"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={branchesLoading}
          >
            {branchOptions.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button className="neo-btn" type="submit">
            Найти
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ opacity: 0.75 }}>Загрузка...</div>
      ) : clients.length === 0 ? (
        <div style={{ opacity: 0.75 }}>Клиентов пока нет</div>
      ) : viewMode === "cards" ? (
        <ClientsCards
          clients={clients}
          branchMap={branchMap}
          onOpen={handleOpenClient}
          onEdit={openEditEditor}
          onDelete={handleDeleteClient}
        />
      ) : (
        <ClientsTable
          clients={clients}
          branchMap={branchMap}
          onOpen={handleOpenClient}
          onEdit={openEditEditor}
          onDelete={handleDeleteClient}
        />
      )}

      {viewerOpen && selectedClient && (
        <RightDrawer onClose={closeViewer} width={400}>
          <div style={{ display: "grid", gap: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, marginBottom: 10 }}>
                  {selectedClient.full_name || "Клиент"}
                </div>

                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
                  {formatPhoneForView(selectedClient.phone)}
                </div>

                <div style={{ fontSize: 14, opacity: 0.76, marginBottom: 4 }}>
                  {selectedClient.email || "Без email"}
                </div>

                <div style={{ fontSize: 14, opacity: 0.7 }}>
                  Источник: {getSourceLabel(selectedClient.source)}
                </div>
              </div>

              <button className="neo-btn" onClick={closeViewer}>
                Закрыть
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <InfoCard
                label="Последний визит"
                value={lastVisitBooking ? formatBookingDateRange(lastVisitBooking) : "—"}
              />
              <InfoCard label="Всего записей за всё время" value={historyStats.total} />
              <InfoCard label="Статус" value={selectedClient.status || "new"} />
              <InfoCard label="Источник" value={getSourceLabel(selectedClient.source)} />
            </div>

            <section
              style={{
                padding: 16,
                borderRadius: 18,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.72, marginBottom: 8 }}>Комментарий</div>
              <div style={{ lineHeight: 1.5 }}>
                {clientComment || "Комментария пока нет"}
              </div>
            </section>

            <section
              style={{
                padding: 16,
                borderRadius: 18,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800 }}>История записей</div>
                <div style={{ fontSize: 13, opacity: 0.72 }}>
                  {clientBookings.length === 0
                    ? "История пустая"
                    : historyExpanded
                    ? `Показаны все ${clientBookings.length}`
                    : lastVisitBooking
                    ? `Последняя запись: ${formatBookingDateRange(lastVisitBooking)}`
                    : `Записей: ${clientBookings.length}`}
                </div>
              </div>

              {bookingsLoading ? (
                <div style={{ opacity: 0.7 }}>Загрузка записей...</div>
              ) : clientBookings.length === 0 ? (
                <div style={{ opacity: 0.7 }}>У клиента пока нет записей</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {lastVisitBooking ? (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        background: "rgba(59,130,246,0.10)",
                        border: "1px solid rgba(59,130,246,0.22)",
                      }}
                    >
                      <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>
                        Последняя запись
                      </div>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>
                        {formatBookingDateRange(lastVisitBooking)}
                      </div>
                      <div style={{ fontSize: 14, opacity: 0.82 }}>
                        {lastVisitBooking.service_name || lastVisitBooking.service_title || lastVisitBooking.service_id || "—"}
                        {" • "}
                        {lastVisitBooking.employee_name || lastVisitBooking.employee_full_name || lastVisitBooking.employee_id || "—"}
                        {" • "}
                        {lastVisitBooking.status || "booked"}
                      </div>
                    </div>
                  ) : null}

                  {historyExpanded ? (
                    visibleBookings.map((booking, index) => (
                      <div
                        key={booking.id ?? `${booking.date}-${booking.start_time}-${index}`}
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          {formatBookingDateRange(booking)}
                        </div>

                        <div style={{ fontSize: 14, opacity: 0.82 }}>
                          {booking.service_name || booking.service_title || booking.service_id || "—"}
                          {" • "}
                          {booking.employee_name || booking.employee_full_name || booking.employee_id || "—"}
                          {" • "}
                          {booking.branch_id ? branchMap.get(String(booking.branch_id)) || booking.branch_id : "—"}
                        </div>

                        <div style={{ fontSize: 13, opacity: 0.72, marginTop: 4 }}>
                          Статус: {booking.status || "booked"} | Цена: {booking.price ?? 0}
                        </div>
                      </div>
                    ))
                  ) : null}
                </div>
              )}
            </section>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
                paddingTop: 4,
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="neo-btn"
                  onClick={handleExportClientHistory}
                  disabled={clientBookings.length === 0}
                >
                  Выгрузить историю
                </button>
                {remainingBookings.length > 0 ? (
                  <button className="neo-btn" onClick={() => setHistoryExpanded((prev) => !prev)}>
                    {historyExpanded ? "Свернуть" : `Показать ещё ${remainingBookings.length}`}
                  </button>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="neo-btn"
                  onClick={() => {
                    closeViewer();
                    openEditEditor(selectedClient);
                  }}
                >
                  Редактировать
                </button>

                <button className="neo-btn" onClick={() => handleDeleteClient(selectedClient)}>
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </RightDrawer>
      )}

      {editorOpen && (
        <RightDrawer onClose={closeEditor} width={400}>
          <HeaderWithClose
            title={editingClientId ? "Редактировать клиента" : "Новый клиент"}
            onClose={closeEditor}
          />

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <Field label="ФИО *">
              <input
                type="text"
                className="neo-input"
                placeholder="Иванова Мария / Иванова Мария Петровна"
                value={form.full_name}
                onChange={(e) => handleFormChange("full_name", e.target.value)}
              />
            </Field>

            <Field label="Телефон *">
              <PhoneInput
                className="neo-input"
                value={form.phoneDigits}
                onChange={(raw) => handleFormChange("phoneDigits", raw)}
                onBlur={handlePhoneBlur}
              />
            </Field>

            {duplicateWarning && !editingClientId && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(255, 196, 0, 0.12)",
                  border: "1px solid rgba(255, 196, 0, 0.28)",
                  color: "#ffe8a3",
                  fontSize: 14,
                }}
              >
                Клиент уже существует: <b>{duplicateWarning.full_name}</b>,{" "}
                {formatPhoneForView(duplicateWarning.phone)}. Новый дубль не нужен.
              </div>
            )}

            <Field label="Email">
              <input
                type="email"
                className="neo-input"
                placeholder="client@mail.com"
                value={form.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
              />
            </Field>

            <Field label="Дата рождения">
              <input
                type="date"
                className="neo-input"
                value={form.birthday}
                onChange={(e) => handleFormChange("birthday", e.target.value)}
              />
            </Field>

            <Field label="Статус">
              <select
                className="neo-input"
                value={form.status}
                onChange={(e) => handleFormChange("status", e.target.value)}
              >
                {STATUS_OPTIONS.filter((x) => x.value).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Источник">
              <select
                className="neo-input"
                value={form.source}
                onChange={(e) => handleFormChange("source", e.target.value)}
              >
                <option value="">Не выбран</option>
                {SOURCE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            {form.source === "custom" && (
              <Field label="Свой источник">
                <input
                  type="text"
                  className="neo-input"
                  placeholder="Например: наружка, партнёр, акция"
                  value={form.custom_source}
                  onChange={(e) => handleFormChange("custom_source", e.target.value)}
                />
              </Field>
            )}

            <Field label="Комментарий">
              <textarea
                className="neo-input"
                rows={5}
                placeholder="Примечания по клиенту"
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
              />
            </Field>

            {formError ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(255, 80, 80, 0.14)",
                  border: "1px solid rgba(255, 80, 80, 0.28)",
                  color: "#ffd7d7",
                  fontSize: 14,
                }}
              >
                {formError}
              </div>
            ) : null}

            <button className="neo-btn" type="submit" disabled={saving}>
              {saving
                ? "Сохраняем..."
                : editingClientId
                ? "Сохранить изменения"
                : "Создать клиента"}
            </button>
          </form>
        </RightDrawer>
      )}
    </div>
  );
}

function ViewSwitch({ viewMode, setViewMode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 4,
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
        gap: 4,
      }}
    >
      {VIEW_MODES.map((mode) => {
        const active = viewMode === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => setViewMode(mode.value)}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "10px 16px",
              cursor: "pointer",
              color: active ? "#fff" : "var(--text-secondary)",
              background: active
                ? "linear-gradient(90deg, #44d3ff 0%, #6c63ff 100%)"
                : "transparent",
              fontWeight: 600,
            }}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

function ClientsCards({ clients, branchMap, onOpen, onEdit, onDelete }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
      }}
    >
      {clients.map((client) => <ClientCard
        key={client.id}
        client={client}
        branchMap={branchMap}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
      />)}
    </div>
  );
}

function ClientCard({ client, branchMap, onOpen, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const name = client.full_name || "Без имени";
  const initials = name.split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase() || "?";
  const status = client.status || "new";
  const branchName = client.created_branch_id
    ? branchMap.get(String(client.created_branch_id)) || `#${client.created_branch_id}`
    : null;

  const statusBg = status === "active" ? "rgba(34,197,94,0.18)"
                : status === "archive" ? "rgba(148,163,184,0.18)"
                : "rgba(58,207,213,0.18)";
  const statusColor = status === "active" ? "#22c55e"
                    : status === "archive" ? "#94a3b8"
                    : "#3acfd5";

  // Stable gradient per client (hash of id)
  const gradients = [
    ["#3acfd5", "#6558f5"], ["#ec4899", "#f97316"],
    ["#22c55e", "#3acfd5"], ["#6558f5", "#ec4899"],
    ["#f59e0b", "#ec4899"], ["#3b82f6", "#22c55e"],
  ];
  const grad = gradients[Math.abs(Number(client.id) || 0) % gradients.length];

  return (
    <div
      onClick={() => onOpen(client)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 12, borderRadius: 14,
        background: "var(--bg-card-elevated)",
        border: "1px solid var(--border-card-elevated)",
        boxShadow: hover
          ? "0 10px 22px rgba(0,0,0,0.22), 0 0 0 1px rgba(58,207,213,0.28)"
          : "var(--shadow-card-elevated)",
        cursor: "pointer",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        display: "grid", gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 13,
        }}>{initials}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
          }}>{name}</div>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)", marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {formatPhoneForView(client.phone)}
          </div>
        </div>

        <div style={{ opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}>
          <CardActions onEdit={() => onEdit(client)} onDelete={() => onDelete(client)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
          background: statusBg, color: statusColor, textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}>{status}</span>
        {branchName && (
          <span style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 5,
            background: "var(--bg-section)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            fontWeight: 500,
          }}>{branchName}</span>
        )}
        {client.source && (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            · {getSourceLabel(client.source)}
          </span>
        )}
      </div>
    </div>
  );
}

function ClientsTable({ clients, branchMap, onOpen, onEdit, onDelete }) {
  return (
    <div className="visionos-card" style={{ padding: 8, overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: 1100,
        }}
      >
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.82 }}>
            <th style={thStyle}>ФИО</th>
            <th style={thStyle}>Телефон</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Источник</th>
            <th style={thStyle}>Создан филиалом</th>
            <th style={thStyle}>Статус</th>
            <th style={thStyle}>Последний визит</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr
              key={client.id}
              onClick={() => onOpen(client)}
              style={{
                borderTop: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              <td style={tdStyle}>{client.full_name || "Без имени"}</td>
              <td style={tdStyle}>{formatPhoneForView(client.phone)}</td>
              <td style={tdStyle}>{client.email || "Без email"}</td>
              <td style={tdStyle}>{getSourceLabel(client.source)}</td>
              <td style={tdStyle}>
                {client.created_branch_id
                  ? branchMap.get(String(client.created_branch_id)) ||
                    client.created_branch_id
                  : "—"}
              </td>
              <td style={tdStyle}>
                <span style={getStatusBadgeStyle(client.status || "new")}>
                  {client.status || "new"}
                </span>
              </td>
              <td style={tdStyle}>{formatDateTime(client.last_visit_at)}</td>
              <td
                style={{ ...tdStyle, textAlign: "right" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    style={actionBtnStyle}
                    onClick={() => onEdit(client)}
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button
                    style={actionBtnStyle}
                    onClick={() => onDelete(client)}
                    title="Удалить"
                  >
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RightDrawer({ children, onClose, width = 400 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "94vw",
          height: "100vh",
          overflowY: "auto",
          padding: "14px 16px 18px",
          background: "var(--bg-panel)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-14px 0 32px rgba(0,0,0,0.28)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function HeaderWithClose({ title, onClose }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        marginBottom: 18,
      }}
    >
      <h2 style={{ margin: 0 }}>{title}</h2>
      <button className="neo-btn" onClick={onClose}>
        Закрыть
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 14, opacity: 0.78 }}>{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ label, value }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value || "—"}</div>
    </div>
  );
}

const thStyle = {
  padding: "14px 12px",
  fontWeight: 700,
};

const tdStyle = {
  padding: "16px 12px",
  verticalAlign: "middle",
};