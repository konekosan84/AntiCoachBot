import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import PhoneInput from "../ui/PhoneInput.jsx";
import ExportBtn from "../ui/ExportBtn.jsx";
import { useToast } from "../helpers/ToastContext.jsx";
import {
  getBookings,
  createBooking,
  updateBooking,
  updateBookingStatus,
  getAvailableEmployees,
} from "../api/bookings";
import { getClients } from "../api/clients";
import { getEmployees } from "../api/employees";
import { getServices } from "../api/services";
import { getBranches } from "../api/branches";

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizePhoneInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  let normalized = digits;
  if (normalized.length === 11 && normalized.startsWith("8")) {
    normalized = `7${normalized.slice(1)}`;
  } else if (normalized.length === 10) {
    normalized = `7${normalized}`;
  }

  return normalized.slice(0, 11);
}

function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "—";

  const core =
    digits.length === 11 && digits.startsWith("7")
      ? digits.slice(1)
      : digits.slice(-10);

  if (core.length < 10) return phone || "—";

  const p1 = core.slice(0, 3);
  const p2 = core.slice(3, 6);
  const p3 = core.slice(6, 8);
  const p4 = core.slice(8, 10);

  return `+7 (${p1}) ${p2}-${p3}-${p4}`;
}

function statusLabel(status) {
  switch (status) {
    case "booked":
      return "Записан";
    case "cancelled":
      return "Отменён";
    case "completed":
      return "Завершён";
    case "no_show":
      return "Не пришёл";
    default:
      return status || "—";
  }
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case "booked":
      return {
        background: "var(--badge-booked-bg)",
        color: "var(--badge-booked-text)",
        border: "1px solid var(--badge-booked-border)",
      };
    case "completed":
      return {
        background: "var(--badge-done-bg)",
        color: "var(--badge-done-text)",
        border: "1px solid var(--badge-done-border)",
      };
    case "cancelled":
      return {
        background: "var(--badge-cancel-bg)",
        color: "var(--badge-cancel-text)",
        border: "1px solid var(--badge-cancel-border)",
      };
    case "no_show":
      return {
        background: "var(--badge-noshow-bg)",
        color: "var(--badge-noshow-text)",
        border: "1px solid var(--badge-noshow-border)",
      };
    default:
      return {
        background: "var(--badge-default-bg)",
        color: "var(--badge-default-text)",
        border: "1px solid var(--badge-default-border)",
      };
  }
}

function formatShortDate(date) {
  const raw = String(date || "").slice(0, 10);
  if (!raw) return "—";

  const [yyyy, mm, dd] = raw.split("-");
  if (!yyyy || !mm || !dd) return raw;

  return `${dd}.${mm}.${yyyy}`;
}

function formatTimeRange(start, end) {
  if (!start && !end) return "—";
  if (start && end) return `${start}–${end}`;
  return start || end || "—";
}

function extractArrayPayload(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function extractName(item) {
  return (
    item?.full_name ??
    item?.name ??
    item?.title ??
    item?.label ??
    `#${item?.id ?? ""}`
  );
}

function extractServicePrice(service) {
  const raw =
    service?.price ??
    service?.base_price ??
    service?.amount ??
    service?.cost ??
    service?.value ??
    0;
  return Number(raw) || 0;
}

function extractServiceDuration(service) {
  const raw =
    service?.duration ??
    service?.duration_min ??
    service?.duration_minutes ??
    service?.minutes ??
    0;
  return Number(raw) || 0;
}

function timeToMinutes(value) {
  const [h, m] = String(value || "")
    .split(":")
    .map((v) => Number(v || 0));
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const safe = Math.max(0, Number(totalMinutes) || 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function roundUpToStep(minutes, step = 30) {
  if (!minutes) return 0;
  return Math.ceil(minutes / step) * step;
}

function buildEmptyForm(branchId = "", serviceId = "", date = todayYmd()) {
  return {
    id: null,
    mode: "existing",
    client_search: "",
    client_id: "",
    full_name: "",
    phone: "",
    email: "",
    branch_id: branchId,
    service_id: serviceId,
    date,
    start_time: "",
    employee_id: "",
    employee_name: "",
    end_time: "",
    price: "",
    status: "booked",
  };
}

function fieldLabel(text) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        opacity: 0.86,
        marginBottom: 6,
      }}
    >
      {text}
    </div>
  );
}

function escapeCsvValue(value) {
  const text = value == null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCsvFile(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const csv = rows.map((row) => row.map(escapeCsvValue).join(';')).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildBookingsExportRows(bookings) {
  const header = [
    'Клиент',
    'Телефон',
    'Дата',
    'Время начала',
    'Время окончания',
    'Услуга',
    'Сотрудник',
    'Филиал',
    'Статус',
    'Цена',
    'Комментарий',
  ];

  const rows = (Array.isArray(bookings) ? bookings : []).map((item) => [
    item?.client_name || '',
    formatPhone(item?.client_phone) === '—' ? '' : formatPhone(item?.client_phone),
    formatShortDate(item?.date) === '—' ? '' : formatShortDate(item?.date),
    item?.start_time || '',
    item?.end_time || '',
    item?.service_name || '',
    item?.employee_name || '',
    item?.branch_name || '',
    statusLabel(item?.status) === '—' ? '' : statusLabel(item?.status),
    item?.price ?? '',
    item?.comment || item?.notes || '',
  ]);

  return [header, ...rows];
}

export default function Bookings() {
  const toast = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingIdFromUrl = searchParams.get("booking_id");

  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState("create");

  const [dateFrom, setDateFrom] = useState(todayYmd());
  const [dateTo, setDateTo] = useState(todayYmd());
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(buildEmptyForm());
  const [originalBooking, setOriginalBooking] = useState(null);

  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [availabilityMeta, setAvailabilityMeta] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [clientHistory, setClientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState([]);
  const [slotSuggestionsLoading, setSlotSuggestionsLoading] = useState(false);

  function handleExportSelection() {
    const rows = buildBookingsExportRows(filteredBookings);
    downloadCsvFile(`bookings-${dateFrom || 'from'}_${dateTo || 'to'}.csv`, rows);
  }

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!bookingIdFromUrl) return;
    if (!Array.isArray(bookings) || bookings.length === 0) return;

    const target = bookings.find(
      (item) => String(item.id) === String(bookingIdFromUrl)
    );

    if (!target) return;

    openEditPanel(target);

    const next = new URLSearchParams(searchParams);
    next.delete("booking_id");
    setSearchParams(next, { replace: true });
  }, [bookingIdFromUrl, bookings, searchParams, setSearchParams]);

  const canCheckAvailability =
    form.branch_id && form.service_id && form.date && form.start_time;

  useEffect(() => {
    if (!canCheckAvailability) {
      setAvailableEmployees([]);
      setAvailabilityMeta(null);
      return;
    }

    loadAvailableEmployees();
  }, [form.id, form.branch_id, form.service_id, form.date, form.start_time]);

  useEffect(() => {
    if (availableEmployees.length === 1) {
      setForm((prev) => {
        if (String(prev.employee_id || "") === String(availableEmployees[0].id)) {
          return prev;
        }
        return {
          ...prev,
          employee_id: String(availableEmployees[0].id),
          employee_name: extractName(availableEmployees[0]),
        };
      });
    }
  }, [availableEmployees]);

  useEffect(() => {
    const service = services.find((s) => String(s.id) === String(form.service_id));
    if (!service) return;

    setForm((prev) => {
      const nextPrice = String(extractServicePrice(service));
      if (String(prev.price ?? "") === nextPrice) return prev;
      return {
        ...prev,
        price: nextPrice,
      };
    });
  }, [form.service_id, services]);

  useEffect(() => {
    const clientId = String(form.client_id || "");
    if (!clientId) {
      setClientHistory([]);
      return;
    }
    loadClientHistory(clientId);
  }, [form.client_id, bookings]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (
        !canCheckAvailability ||
        availabilityLoading ||
        availableEmployees.length > 0
      ) {
        setSuggestedSlots([]);
        return;
      }

      await loadSuggestedSlots(cancelled);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [
    canCheckAvailability,
    availabilityLoading,
    availableEmployees,
    form.branch_id,
    form.service_id,
    form.date,
    form.start_time,
    form.id,
  ]);

  async function init() {
    try {
      setLoading(true);
      setError("");

      const [clientsData, employeesData, branchesData, servicesData] =
        await Promise.all([
          getClients(),
          getEmployees(),
          getBranches(),
          getServices(),
        ]);

      setClients(extractArrayPayload(clientsData));
      setEmployees(extractArrayPayload(employeesData));
      setBranches(extractArrayPayload(branchesData));
      setServices(extractArrayPayload(servicesData));

      await loadBookings();
    } catch (e) {
      console.error("Ошибка инициализации записей:", e);
      setError("Не удалось загрузить записи и справочники");
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings(params = {}) {
    try {
      setLoading(true);
      setError("");

      const data = await getBookings({
        date_from: params.date_from ?? dateFrom,
        date_to: params.date_to ?? dateTo,
        branch_id: params.branch_id ?? branchId,
        employee_id: params.employee_id ?? employeeId,
        status: params.status ?? status,
        search: params.search ?? search,
      });

      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Ошибка загрузки записей:", e);
      setBookings([]);
      setError("Не удалось загрузить список записей");
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableEmployees() {
    try {
      setAvailabilityLoading(true);

      const canCheck =
        form.branch_id && form.service_id && form.date && form.start_time;

      if (!canCheck) {
        setAvailableEmployees([]);
        setAvailabilityMeta(null);
        return;
      }

      const result = await getAvailableEmployees({
        branch_id: form.branch_id,
        service_id: form.service_id,
        date: form.date,
        start_time: form.start_time,
        exclude_booking_id: form.id || undefined,
      });

      const items = Array.isArray(result?.data) ? result.data : [];
      setAvailableEmployees(items);
      setAvailabilityMeta(result?.meta || null);

      const exists = items.some((e) => String(e.id) === String(form.employee_id));

      if (!exists) {
        setForm((prev) => ({
          ...prev,
          employee_id: "",
          employee_name: "",
        }));
      }

      if (result?.meta?.end_time) {
        setForm((prev) => ({
          ...prev,
          end_time: result.meta.end_time,
        }));
      }
    } catch (e) {
      console.error("Ошибка загрузки доступных сотрудников:", e);
      setAvailableEmployees([]);
      setAvailabilityMeta(null);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function loadClientHistory(clientId) {
    try {
      setHistoryLoading(true);

      const localHistory = bookings
        .filter((b) => String(b.client_id || "") === String(clientId))
        .sort((a, b) => {
          const aKey = `${String(a.date || "").slice(0, 10)} ${a.start_time || ""}`;
          const bKey = `${String(b.date || "").slice(0, 10)} ${b.start_time || ""}`;
          return aKey < bKey ? 1 : -1;
        })
        .slice(0, 6);

      setClientHistory(localHistory);
    } catch (e) {
      console.error("Ошибка загрузки истории клиента:", e);
      setClientHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadSuggestedSlots(cancelled = false) {
    try {
      setSlotSuggestionsLoading(true);

      const service = services.find((s) => String(s.id) === String(form.service_id));
      const duration = extractServiceDuration(service);

      if (!service || !duration || !form.start_time) {
        setSuggestedSlots([]);
        return;
      }

      const baseMinutes = roundUpToStep(timeToMinutes(form.start_time), 30);
      const dayStart = 8 * 60;
      const dayEnd = 21 * 60;

      const suggestions = [];

      for (let candidate = Math.max(baseMinutes, dayStart); candidate <= dayEnd; candidate += 30) {
        if (cancelled) return;

        const candidateTime = minutesToTime(candidate);

        try {
          const result = await getAvailableEmployees({
            branch_id: form.branch_id,
            service_id: form.service_id,
            date: form.date,
            start_time: candidateTime,
            exclude_booking_id: form.id || undefined,
          });

          const employeesAtTime = Array.isArray(result?.data) ? result.data : [];
          const meta = result?.meta || null;

          if (employeesAtTime.length > 0) {
            suggestions.push({
              start_time: candidateTime,
              end_time:
                meta?.end_time ||
                minutesToTime(candidate + duration),
              employees: employeesAtTime.map((item) => ({
                id: item.id,
                name: extractName(item),
              })),
            });
          }

          if (suggestions.length >= 6) break;
        } catch (e) {
          console.error("Ошибка подсказки слотов:", e);
        }
      }

      if (!cancelled) {
        setSuggestedSlots(suggestions);
      }
    } finally {
      if (!cancelled) {
        setSlotSuggestionsLoading(false);
      }
    }
  }

  function openCreatePanel() {
    setPanelMode("create");
    setOriginalBooking(null);
    setForm(
      buildEmptyForm(
        branchId || String(branches[0]?.id || ""),
        String(services[0]?.id || ""),
        dateFrom || todayYmd()
      )
    );
    setAvailableEmployees([]);
    setAvailabilityMeta(null);
    setPanelOpen(true);
  }

  function openEditPanel(booking) {
    setPanelMode("edit");
    setOriginalBooking({
      id: booking.id,
      client_id: String(booking.client_id || ""),
      branch_id: String(booking.branch_id || ""),
      service_id: String(booking.service_id || ""),
      date: booking.date ? String(booking.date).slice(0, 10) : "",
      start_time: booking.start_time || "",
      end_time: booking.end_time || "",
      employee_id: String(booking.employee_id || ""),
      price: String(booking.price ?? ""),
      status: booking.status || "booked",
    });

    setForm({
      id: booking.id,
      mode: "existing",
      client_search: booking.client_name || "",
      client_id: String(booking.client_id || ""),
      full_name: booking.client_name || "",
      phone: booking.client_phone || "",
      email: booking.client_email || "",
      branch_id: String(booking.branch_id || ""),
      service_id: String(booking.service_id || ""),
      date: booking.date ? String(booking.date).slice(0, 10) : todayYmd(),
      start_time: booking.start_time || "",
      employee_id: String(booking.employee_id || ""),
      employee_name: booking.employee_name || "",
      end_time: booking.end_time || "",
      price: String(booking.price ?? ""),
      status: booking.status || "booked",
    });

    setAvailableEmployees([]);
    setAvailabilityMeta(null);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setOriginalBooking(null);
    setClientHistory([]);
    setSuggestedSlots([]);
  }

  function handleFormChange(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "phone") {
        next.phone = normalizePhoneInput(value);
      }

      if (key === "branch_id") {
        next.employee_id = "";
        next.employee_name = "";
      }

      if (key === "service_id") {
        const service = services.find((s) => String(s.id) === String(value));
        if (service) {
          next.price = String(extractServicePrice(service));
        }
        next.employee_id = "";
        next.employee_name = "";
      }

      if (key === "date" || key === "start_time") {
        next.employee_id = "";
        next.employee_name = "";
      }

      if (key === "employee_id") {
        const selected =
          availableEmployees.find((e) => String(e.id) === String(value)) ||
          employees.find((e) => String(e.id) === String(value));

        next.employee_name = selected ? extractName(selected) : prev.employee_name;
      }

      if (key === "mode" && panelMode === "create") {
        if (value === "existing") {
          next.full_name = "";
          next.phone = "";
          next.email = "";
        } else {
          next.client_id = "";
          next.client_search = "";
        }
      }

      return next;
    });
  }

  async function handleSubmitFilters(e) {
    e.preventDefault();
    await loadBookings({
      date_from: dateFrom,
      date_to: dateTo,
      branch_id: branchId,
      employee_id: employeeId,
      status,
      search,
    });
  }

  function buildPayloadFromForm() {
    return {
      client_id: form.client_id ? Number(form.client_id) : null,
      branch_id: form.branch_id ? Number(form.branch_id) : null,
      employee_id: form.employee_id ? Number(form.employee_id) : null,
      service_id: form.service_id ? Number(form.service_id) : null,
      date: form.date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      price: form.price === "" ? 0 : Number(form.price || 0),
      status: form.status || "booked",
    };
  }

  function isOnlyStatusChanged() {
    if (panelMode !== "edit" || !originalBooking) return false;

    const sameClient = String(form.client_id || "") === String(originalBooking.client_id || "");
    const sameBranch = String(form.branch_id || "") === String(originalBooking.branch_id || "");
    const sameService = String(form.service_id || "") === String(originalBooking.service_id || "");
    const sameDate = String(form.date || "") === String(originalBooking.date || "");
    const sameStart = String(form.start_time || "") === String(originalBooking.start_time || "");
    const sameEnd = String(form.end_time || "") === String(originalBooking.end_time || "");
    const sameEmployee = String(form.employee_id || "") === String(originalBooking.employee_id || "");
    const samePrice = String(form.price ?? "") === String(originalBooking.price ?? "");
    const statusChanged = String(form.status || "") !== String(originalBooking.status || "");

    return (
      sameClient &&
      sameBranch &&
      sameService &&
      sameDate &&
      sameStart &&
      sameEnd &&
      sameEmployee &&
      samePrice &&
      statusChanged
    );
  }

  async function handleSaveBooking() {
    try {
      setSaving(true);

      const payload = buildPayloadFromForm();

      if (!payload.branch_id) {
        toast.warning("Выбери филиал");
        return;
      }

      if (!payload.service_id) {
        toast.warning("Выбери услугу");
        return;
      }

      if (!payload.date) {
        toast.warning("Укажи дату");
        return;
      }

      if (!payload.start_time) {
        toast.warning("Укажи время начала");
        return;
      }

      if (!availableEmployees.length) {
        toast.warning("Нет доступных сотрудников на выбранное время");
        return;
      }

      const employeeStillAvailable = availableEmployees.some(
        (e) => String(e.id) === String(payload.employee_id)
      );

      if (!employeeStillAvailable) {
        toast.warning("Сотрудник уже недоступен");
        return;
      }

      if (!payload.employee_id) {
        toast.warning("Выбери доступного сотрудника");
        return;
      }

      if (panelMode === "create") {
        if (form.mode === "existing") {
          if (!form.client_id) {
            toast.warning("Выбери клиента");
            return;
          }
        } else {
          const fullName = String(form.full_name || "").trim();
          const phone = normalizePhoneInput(form.phone);

          if (!fullName) {
            toast.warning("Укажи ФИО клиента");
            return;
          }

          if (!phone || phone.length !== 11) {
            toast.warning("Укажи корректный телефон");
            return;
          }

          payload.full_name = fullName;
          payload.phone = phone;
          payload.email = String(form.email || "").trim().toLowerCase() || null;
          delete payload.client_id;
        }

        await createBooking(payload);
      } else {
        if (!form.client_id) {
          toast.warning("Для редактирования запись должна быть привязана к клиенту");
          return;
        }

        if (isOnlyStatusChanged()) {
          await updateBookingStatus(form.id, form.status);
        } else {
          await updateBooking(form.id, payload);
        }
      }

      closePanel();
      await loadBookings();
    } catch (e) {
      console.error("Ошибка сохранения записи:", e);
      const message = String(e?.message || "");
      if (message.includes("EMPLOYEE_HAS_NO_SHIFT")) {
        toast.error("Сотрудник не прошёл текущую проверку доступности для выбранных даты и времени");
      } else {
        toast.error("Не удалось сохранить запись");
      }
    } finally {
      setSaving(false);
    }
  }

  const branchOptions = useMemo(() => {
    return [{ value: "", label: "Все филиалы" }].concat(
      branches.map((b) => ({
        value: String(b.id),
        label: extractName(b),
      }))
    );
  }, [branches]);

  const employeeOptions = useMemo(() => {
    return [{ value: "", label: "Все сотрудники" }].concat(
      employees.map((e) => ({
        value: String(e.id),
        label: extractName(e),
      }))
    );
  }, [employees]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => String(c.id) === String(form.client_id)) || null;
  }, [clients, form.client_id]);

  const selectedService = useMemo(() => {
    return services.find((s) => String(s.id) === String(form.service_id)) || null;
  }, [services, form.service_id]);

  const serviceEmployeesCount = useMemo(() => {
    if (!form.service_id) return 0;

    const selectedServiceRecord = services.find(
      (s) => String(s.id) === String(form.service_id)
    );

    const linkedEmployeeIds = new Set(
      [
        ...(Array.isArray(selectedServiceRecord?.employee_ids)
          ? selectedServiceRecord.employee_ids
          : []),
        ...(Array.isArray(selectedServiceRecord?.employees)
          ? selectedServiceRecord.employees.map((e) => e?.id).filter(Boolean)
          : []),
      ].map((id) => String(id))
    );

    if (linkedEmployeeIds.size > 0) {
      return employees.filter((e) => linkedEmployeeIds.has(String(e.id))).length;
    }

    return employees.length;
  }, [employees, services, form.service_id]);

  const clientSearchResults = useMemo(() => {
    const q = String(form.client_search || "").trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");

    if (!q) return [];

    const items = clients.map((c) => {
      const fullName = c.full_name || c.name || "";
      const phone = c.phone || "";
      return {
        id: c.id,
        fullName,
        phone,
        label: `${fullName}${phone ? ` • ${formatPhone(phone)}` : ""}`,
      };
    });

    return items
      .filter((item) => {
        const nameHit = item.fullName.toLowerCase().includes(q);
        const phoneHit = qDigits
          ? String(item.phone || "").includes(qDigits)
          : false;
        return nameHit || phoneHit;
      })
      .slice(0, 8);
  }, [clients, form.client_search]);

  // Same logic but driven by `full_name` input in "new client" mode
  const newClientNameMatches = useMemo(() => {
    const q = String(form.full_name || "").trim().toLowerCase();
    if (q.length < 2) return [];
    return clients
      .map((c) => ({
        id: c.id,
        fullName: c.full_name || c.name || "",
        phone: c.phone || "",
      }))
      .filter((c) => c.fullName.toLowerCase().includes(q))
      .slice(0, 6);
  }, [clients, form.full_name]);

  const employeeSelectOptions = useMemo(() => {
    const options = [...availableEmployees];

    const hasCurrent =
      form.employee_id &&
      options.some((e) => String(e.id) === String(form.employee_id));

    if (!hasCurrent && form.employee_id && panelMode === "edit") {
      options.unshift({
        id: form.employee_id,
        name:
          (form.employee_name || `Сотрудник #${form.employee_id}`) +
          " (из текущей записи)",
        isCurrentFallback: true,
      });
    }

    return options;
  }, [availableEmployees, form.employee_id, form.employee_name, panelMode]);

  const hasCurrentEmployeeInAvailable =
    form.employee_id &&
    availableEmployees.some((e) => String(e.id) === String(form.employee_id));

  const showAvailabilityWarning =
    panelMode === "edit" &&
    Boolean(form.employee_id) &&
    !availabilityLoading &&
    !hasCurrentEmployeeInAvailable;

  const showAvailabilityHint =
    Boolean(form.service_id) && !canCheckAvailability;

  const availabilityExplainText = useMemo(() => {
    if (!form.service_id || !canCheckAvailability || availabilityLoading) return "";
    if (availableEmployees.length > 0) return "";

    if (!serviceEmployeesCount) {
      return "В этом филиале нет сотрудников, привязанных к выбранной услуге";
    }

    if (suggestedSlots.length > 0) {
      return "На выбранное время все подходящие сотрудники заняты или вне смены. Ниже показаны ближайшие реальные окна";
    }

    return "На выбранное время все подходящие сотрудники заняты или вне смены";
  }, [
    form.service_id,
    canCheckAvailability,
    availabilityLoading,
    availableEmployees.length,
    serviceEmployeesCount,
    suggestedSlots.length,
  ]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = String(search || "").trim().toLowerCase();
    const searchDigits = normalizedSearch.replace(/\D/g, "");

    return bookings.filter((b) => {
      const bookingDate = String(b.date || "").slice(0, 10);
      const bookingBranchId = String(b.branch_id || "");
      const bookingEmployeeId = String(b.employee_id || "");
      const bookingStatus = String(b.status || "");

      const clientName = String(b.client_name || "").toLowerCase();
      const clientPhoneRaw = String(b.client_phone || "");
      const clientPhoneDigits = clientPhoneRaw.replace(/\D/g, "");

      if (dateFrom && bookingDate < dateFrom) return false;
      if (dateTo && bookingDate > dateTo) return false;
      if (branchId && bookingBranchId !== String(branchId)) return false;
      if (employeeId && bookingEmployeeId !== String(employeeId)) return false;
      if (status && bookingStatus !== String(status)) return false;

      if (normalizedSearch) {
        const byName = clientName.includes(normalizedSearch);
        const byPhone = searchDigits
          ? clientPhoneDigits.includes(searchDigits)
          : clientPhoneRaw.toLowerCase().includes(normalizedSearch);

        if (!byName && !byPhone) return false;
      }

      return true;
    });
  }, [bookings, dateFrom, dateTo, branchId, employeeId, status, search]);

  return (
    <div className="page visionos-container" style={{ position: "relative" }}>
      <div className="visionos-card" style={{ padding: 16, marginBottom: 18 }}>
        <form
          onSubmit={handleSubmitFilters}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
          }}
        >
          <input
            type="date"
            className="neo-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <input
            type="date"
            className="neo-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          <select
            className="neo-input"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branchOptions.map((item) => (
              <option key={item.value || "all-branches"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="neo-input"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {employeeOptions.map((item) => (
              <option key={item.value || "all-employees"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="neo-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="booked">Записан</option>
            <option value="cancelled">Отменён</option>
            <option value="completed">Завершён</option>
            <option value="no_show">Не пришёл</option>
          </select>

          <input
            type="text"
            className="neo-input"
            placeholder="Поиск по клиенту / телефону"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button className="neo-btn" type="submit">
            Обновить
          </button>
        </form>
      </div>

      <div
        className="visionos-card"
        style={{
          padding: 16,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Записи</h2>
            <div style={{ opacity: 0.72, marginTop: 4 }}>
              Всего в выборке: {filteredBookings.length}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ExportBtn entity="bookings" params={{ from: filters.from, to: filters.to }} label="Скачать CSV" />
            <button className="neo-btn" type="button" onClick={handleExportSelection}>
              Выгрузить выборку
            </button>
            <button className="neo-btn" type="button" onClick={openCreatePanel}>
              + Добавить запись
            </button>
          </div>
        </div>

        {loading && bookings.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Загрузка...</div>
        ) : error ? (
          <div style={{ opacity: 0.8 }}>{error}</div>
        ) : filteredBookings.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Нет записей</div>
        ) : (
          <div style={{ overflowX: "auto", margin: "0 -12px", padding: "0 12px" }}>
            <div style={{ minWidth: 820 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(130px, 1.2fr) minmax(180px, 1.8fr) minmax(120px, 1.2fr) minmax(120px, 1.2fr) minmax(100px, 1fr) minmax(90px, 0.7fr)",
                  gap: 10,
                  padding: "0 12px 8px",
                  opacity: 0.62,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <div>Дата и время</div>
                <div>Клиент</div>
                <div>Услуга</div>
                <div>Сотрудник</div>
                <div>Филиал</div>
                <div>Статус</div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {filteredBookings.map((b) => {
                  const badgeStyle = getStatusBadgeStyle(b.status);

                  return (
                    <div
                      key={b.id}
                      onClick={() => openEditPanel(b)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(130px, 1.2fr) minmax(180px, 1.8fr) minmax(120px, 1.2fr) minmax(120px, 1.2fr) minmax(100px, 1fr) minmax(90px, 0.7fr)",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "var(--bg-row)",
                        border: "1px solid var(--border-row)",
                        cursor: "pointer",
                        transition: "transform .16s ease, border-color .16s ease, background .16s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.borderColor = "var(--border-row-hover)";
                        e.currentTarget.style.background = "var(--bg-row-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.borderColor = "var(--border-row)";
                        e.currentTarget.style.background = "var(--bg-row)";
                      }}
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {formatShortDate(b.date)}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.72 }}>
                          {formatTimeRange(b.start_time, b.end_time)}
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={b.client_name || "—"}
                        >
                          {b.client_name || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.68,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={formatPhone(b.client_phone)}
                        >
                          {formatPhone(b.client_phone)}
                        </div>
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={b.service_name || "—"}
                      >
                        {b.service_name || "—"}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={b.employee_name || "—"}
                      >
                        {b.employee_name || "—"}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          opacity: 0.88,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={b.branch_name || "—"}
                      >
                        {b.branch_name || "—"}
                      </div>

                      <div>
                        <span
                          style={{
                            ...badgeStyle,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.2,
                            minHeight: "auto",
                          }}
                        >
                          {statusLabel(b.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {panelOpen && (
        <>
          <div
            onClick={closePanel}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.42)",
              zIndex: 1100,
            }}
          />

          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100vh",
              width: 500,
              maxWidth: "92vw",
              zIndex: 1200,
              overflowY: "auto",
              background: "var(--bg-panel)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "-14px 0 32px rgba(0,0,0,0.35)",
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 24 }}>
                {panelMode === "create"
                  ? "Добавить запись"
                  : "Редактировать запись"}
              </h2>

              <button className="neo-btn" type="button" onClick={closePanel}>
                Закрыть
              </button>
            </div>

            <div style={{ display: "grid", gap: 18 }}>
              <section
                style={{
                  background: "var(--bg-section)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Клиент</div>

                {panelMode === "create" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="neo-btn"
                      type="button"
                      onClick={() => handleFormChange("mode", "existing")}
                      style={{ opacity: form.mode === "existing" ? 1 : 0.75 }}
                    >
                      Существующий
                    </button>

                    <button
                      className="neo-btn"
                      type="button"
                      onClick={() => handleFormChange("mode", "new")}
                      style={{ opacity: form.mode === "new" ? 1 : 0.75 }}
                    >
                      Новый
                    </button>
                  </div>
                )}

                {panelMode === "create" && form.mode === "existing" ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      {fieldLabel("Поиск клиента")}
                      <input
                        type="text"
                        className="neo-input"
                        placeholder="Начни вводить ФИО или телефон"
                        value={form.client_search}
                        onChange={(e) =>
                          handleFormChange("client_search", e.target.value)
                        }
                      />

                      {form.client_search ? (
                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            maxHeight: 220,
                            overflowY: "auto",
                            paddingRight: 4,
                          }}
                        >
                          {clientSearchResults.length === 0 ? (
                            <div style={{ opacity: 0.7, padding: "4px 2px" }}>
                              Клиенты не найдены
                            </div>
                          ) : (
                            clientSearchResults.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="neo-btn"
                                onClick={() =>
                                  setForm((prev) => ({
                                    ...prev,
                                    client_id: String(item.id),
                                    client_search: item.fullName,
                                  }))
                                }
                                style={{
                                  textAlign: "left",
                                  justifyContent: "flex-start",
                                }}
                              >
                                {item.label}
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}

                      <div style={{ opacity: 0.82 }}>
                        Выбран клиент:{" "}
                        {selectedClient
                          ? `${
                              selectedClient.full_name || selectedClient.name
                            } • ${formatPhone(selectedClient.phone)}`
                          : "не выбран"}
                      </div>
                    </div>
                  </div>
                ) : panelMode === "create" && form.mode === "new" ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      {fieldLabel("ФИО")}
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          className="neo-input"
                          placeholder="ФИО клиента"
                          value={form.full_name}
                          onChange={(e) =>
                            handleFormChange("full_name", e.target.value)
                          }
                        />
                        {newClientNameMatches.length > 0 && (
                          <div style={{
                            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: 10, zIndex: 50, overflow: "hidden",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                          }}>
                            <div style={{
                              padding: "6px 12px", fontSize: 11,
                              color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
                              background: "var(--bg-section)",
                            }}>
                              Похожие клиенты — кликни чтобы выбрать
                            </div>
                            {newClientNameMatches.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setForm(prev => ({
                                  ...prev,
                                  mode: "existing",
                                  client_id: String(c.id),
                                  client_search: c.fullName,
                                  full_name: "", phone: "", email: "",
                                }))}
                                style={{
                                  width: "100%", textAlign: "left", padding: "8px 12px",
                                  background: "none", border: "none", cursor: "pointer",
                                  color: "var(--text-primary)", fontSize: 13,
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-card-hover)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                              >
                                <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                  {c.phone ? formatPhone(c.phone) : "—"}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      {fieldLabel("Телефон")}
                      <PhoneInput
                        className="neo-input"
                        value={form.phone}
                        onChange={(raw) => handleFormChange("phone", raw)}
                      />
                    </div>

                    <div>
                      {fieldLabel("Email")}
                      <input
                        type="email"
                        className="neo-input"
                        placeholder="email@domain.com"
                        value={form.email}
                        onChange={(e) => handleFormChange("email", e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.82 }}>
                    {selectedClient
                      ? `${
                          selectedClient.full_name || selectedClient.name
                        } • ${formatPhone(selectedClient.phone)}`
                      : "Клиент не выбран"}
                  </div>
                )}
              </section>

              <section
                style={{
                  background: "var(--bg-section)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 12 }}>
                  Параметры записи
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    {fieldLabel("Филиал")}
                    <select
                      className="neo-input"
                      value={form.branch_id}
                      onChange={(e) => handleFormChange("branch_id", e.target.value)}
                    >
                      <option value="">Выберите филиал</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {extractName(b)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    {fieldLabel("Дата")}
                    <input
                      type="date"
                      className="neo-input"
                      value={form.date}
                      onChange={(e) => handleFormChange("date", e.target.value)}
                    />
                  </div>

                  <div>
                    {fieldLabel("Услуга")}
                    <select
                      className="neo-input"
                      value={form.service_id}
                      onChange={(e) =>
                        handleFormChange("service_id", e.target.value)
                      }
                    >
                      <option value="">Выберите услугу</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {extractName(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    {fieldLabel("Время начала")}
                    <input
                      type="time"
                      className="neo-input"
                      value={form.start_time}
                      onChange={(e) =>
                        handleFormChange("start_time", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    {fieldLabel("Доступный сотрудник")}

                    {showAvailabilityHint ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ color: "#94a3b8", fontSize: 13 }}>
                          Выберите дату и время, чтобы показать доступных сотрудников
                        </div>
                        {serviceEmployeesCount > 0 ? (
                          <div style={{ color: "#6b7280", fontSize: 13 }}>
                            Подходящих сотрудников: {serviceEmployeesCount}
                          </div>
                        ) : selectedService ? (
                          <div style={{ color: "#f59e0b", fontSize: 13 }}>
                            Для этой услуги пока не найдено привязанных сотрудников
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {canCheckAvailability && !availabilityLoading && !availableEmployees.length ? (
                      <div
                        style={{
                          color: "#fca5a5",
                          fontSize: 13,
                          marginBottom: 8,
                          lineHeight: 1.4,
                        }}
                      >
                        {availabilityExplainText || "Нет доступных сотрудников"}
                      </div>
                    ) : null}

                    {showAvailabilityWarning ? (
                      <div
                        style={{
                          color: "#f59e0b",
                          fontSize: 13,
                          marginBottom: 8,
                          lineHeight: 1.4,
                        }}
                      >
                        Текущий сотрудник больше не доступен на выбранные дату и время
                      </div>
                    ) : null}

                    <select
                      className="neo-input"
                      value={form.employee_id}
                      onChange={(e) =>
                        handleFormChange("employee_id", e.target.value)
                      }
                    >
                      <option value="">
                        {availabilityLoading
                          ? "Ищем доступных сотрудников..."
                          : "Выберите доступного сотрудника"}
                      </option>

                      {employeeSelectOptions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.isCurrentFallback ? `${e.name} (текущий)` : e.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    {fieldLabel("Время окончания")}
                    <input
                      type="time"
                      className="neo-input"
                      value={form.end_time}
                      readOnly
                    />
                  </div>

                  <div>
                    {fieldLabel("Цена")}
                    <input
                      type="number"
                      className="neo-input"
                      placeholder="Цена"
                      value={form.price}
                      onChange={(e) => handleFormChange("price", e.target.value)}
                    />
                  </div>

                  <div>
                    {fieldLabel("Статус")}
                    <select
                      className="neo-input"
                      value={form.status}
                      onChange={(e) => handleFormChange("status", e.target.value)}
                    >
                      <option value="booked">Записан</option>
                      <option value="cancelled">Отменён</option>
                      <option value="completed">Завершён</option>
                      <option value="no_show">Не пришёл</option>
                    </select>
                  </div>
                </div>

                {availabilityMeta ? (
                  <div style={{ opacity: 0.72, marginTop: 10 }}>
                    Услуга занимает до {availabilityMeta.end_time}
                  </div>
                ) : null}
              </section>

              {canCheckAvailability &&
              !availabilityLoading &&
              !availableEmployees.length ? (
                <section
                  style={{
                    background: "var(--bg-section)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 12 }}>
                    Ближайшие реальные окна
                  </div>

                  {slotSuggestionsLoading ? (
                    <div style={{ opacity: 0.72 }}>Ищем ближайшие свободные слоты...</div>
                  ) : suggestedSlots.length === 0 ? (
                    <div style={{ opacity: 0.72 }}>
                      На ближайшее время свободных окон не найдено
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.4 }}>
                        Показаны реальные окна с проверкой доступности сотрудников на выбранную услугу, дату и филиал
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {suggestedSlots.map((slot) => (
                          <button
                            key={`${slot.start_time}-${slot.employees[0]?.id || "x"}`}
                            type="button"
                            className="neo-btn"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                start_time: slot.start_time,
                                end_time: slot.end_time,
                                employee_id: slot.employees[0] ? String(slot.employees[0].id) : "",
                                employee_name: slot.employees[0]?.name || "",
                              }));
                            }}
                            style={{
                              justifyContent: "space-between",
                              textAlign: "left",
                              padding: "12px 14px",
                            }}
                          >
                            <span>
                              {slot.start_time}–{slot.end_time}
                            </span>
                            <span style={{ opacity: 0.82 }}>
                              {slot.employees[0]?.name}
                              {slot.employees.length > 1
                                ? ` + ещё ${slot.employees.length - 1}`
                                : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ) : null}

              {selectedClient ? (
                <section
                  style={{
                    background: "var(--bg-section)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 12 }}>
                    История клиента
                  </div>

                  {historyLoading ? (
                    <div style={{ opacity: 0.72 }}>Загрузка истории...</div>
                  ) : clientHistory.length === 0 ? (
                    <div style={{ opacity: 0.72 }}>Нет предыдущих записей в текущей выборке</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {clientHistory.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "88px 74px 1fr",
                            gap: 10,
                            alignItems: "center",
                            padding: "9px 10px",
                            borderRadius: 12,
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            fontSize: 13,
                          }}
                        >
                          <div style={{ opacity: 0.86 }}>{formatShortDate(item.date)}</div>
                          <div style={{ opacity: 0.86 }}>
                            {formatTimeRange(item.start_time, item.end_time)}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: 2,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontWeight: 700,
                              }}
                            >
                              {item.service_name || "Услуга не указана"}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                opacity: 0.74,
                              }}
                            >
                              <span>{item.employee_name || "Сотрудник не указан"}</span>
                              <span>•</span>
                              <span>{statusLabel(item.status)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {panelMode === "edit" ? (
                <section
                  style={{
                    background: "var(--bg-section)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 12 }}>
                    Быстрые действия
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="neo-btn"
                      type="button"
                      onClick={() => handleFormChange("status", "booked")}
                    >
                      Записан
                    </button>
                    <button
                      className="neo-btn"
                      type="button"
                      onClick={() => handleFormChange("status", "completed")}
                    >
                      Завершён
                    </button>
                    <button
                      className="neo-btn"
                      type="button"
                      onClick={() => handleFormChange("status", "cancelled")}
                    >
                      Отменён
                    </button>
                    <button
                      className="neo-btn"
                      type="button"
                      onClick={() => handleFormChange("status", "no_show")}
                    >
                      Не пришёл
                    </button>
                  </div>
                </section>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
              }}
            >
              <button className="neo-btn" type="button" onClick={closePanel}>
                Отмена
              </button>

              <button
                className="neo-btn"
                type="button"
                disabled={
                  saving ||
                  (canCheckAvailability && !availabilityLoading && availableEmployees.length === 0)
                }
                onClick={handleSaveBooking}
              >
                {saving
                  ? "Сохраняем..."
                  : panelMode === "create"
                  ? "Сохранить запись"
                  : "Сохранить изменения"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}