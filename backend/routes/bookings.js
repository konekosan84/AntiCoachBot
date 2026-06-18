import express from "express";
import pool from "../db.js";

const router = express.Router();

const ALLOWED_STATUSES = ["booked", "cancelled", "completed", "no_show"];

function normalizePhone(phone) {
  if (!phone) return null;

  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  } else if (digits.length === 10) {
    digits = "7" + digits;
  }

  if (digits.length !== 11 || !digits.startsWith("7")) {
    return null;
  }

  return digits;
}

function normalizeDate(value) {
  const v = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function normalizeTime(value) {
  const v = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(v) ? v : null;
}

function normalizeStatus(value, fallback = "booked") {
  const raw = String(value || fallback).trim().toLowerCase();
  if (!raw) return "";
  return ALLOWED_STATUSES.includes(raw) ? raw : fallback;
}

function timeToMinutes(time) {
  const t = normalizeTime(time);
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

function minutesToTime(totalMinutes) {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function mapBookingRow(row) {
  if (!row) return row;
  return {
    ...row,
    date: normalizeDate(row.date) || row.date || null,
    start_time: normalizeTime(row.start_time) || row.start_time || null,
    end_time: normalizeTime(row.end_time) || row.end_time || null,
  };
}

async function getServiceInfo(serviceId) {
  if (!serviceId) return null;

  const result = await pool.query(
    `
    SELECT id, name, price, duration
    FROM services
    WHERE id = $1
    LIMIT 1
    `,
    [serviceId]
  );

  return result.rows[0] || null;
}

async function getShiftForEmployee({ employeeId, branchId, date }) {
  const result = await pool.query(
    `
    SELECT
      ss.id,
      ss.employee_id,
      ss.branch_id,
      TO_CHAR(ss.date, 'YYYY-MM-DD') AS date,
      ss.start_time,
      ss.end_time
    FROM schedule_shifts ss
    WHERE ss.employee_id = $1
      AND ss.branch_id = $2
      AND ss.date = $3::date
    ORDER BY ss.start_time ASC
    LIMIT 1
    `,
    [employeeId, branchId, date]
  );

  return result.rows[0] || null;
}

async function hasBookingOverlap({
  employeeId,
  date,
  startTime,
  endTime,
  excludeBookingId = null,
}) {
  const params = [employeeId, date, startTime, endTime];
  let excludeSql = "";

  if (excludeBookingId) {
    params.push(excludeBookingId);
    excludeSql = `AND b.id <> $5`;
  }

  const result = await pool.query(
    `
    SELECT b.id
    FROM bookings b
    WHERE b.employee_id = $1
      AND b.date = $2::date
      AND COALESCE(NULLIF(b.status, ''), 'booked') NOT IN ('cancelled')
      AND b.start_time < $4
      AND COALESCE(b.end_time, b.start_time) > $3
      ${excludeSql}
    LIMIT 1
    `,
    params
  );

  return Boolean(result.rows[0]);
}

async function validateBookingAvailability({
  employeeId,
  branchId,
  serviceId,
  date,
  startTime,
  endTime = null,
  excludeBookingId = null,
}) {
  const finalDate = normalizeDate(date);
  const finalStartTime = normalizeTime(startTime);

  if (!employeeId) {
    return { ok: false, error: "EMPLOYEE_REQUIRED" };
  }

  if (!branchId) {
    return { ok: false, error: "BRANCH_REQUIRED" };
  }

  if (!serviceId) {
    return { ok: false, error: "SERVICE_REQUIRED" };
  }

  if (!finalDate) {
    return { ok: false, error: "DATE_REQUIRED" };
  }

  if (!finalStartTime) {
    return { ok: false, error: "START_TIME_REQUIRED" };
  }

  const service = await getServiceInfo(serviceId);
  if (!service) {
    return { ok: false, error: "SERVICE_NOT_FOUND" };
  }

  const durationMinutes = Number(service.duration || 0);
  if (!durationMinutes || durationMinutes <= 0) {
    return { ok: false, error: "SERVICE_DURATION_INVALID" };
  }

  const startMinutes = timeToMinutes(finalStartTime);
  const computedEndTime = endTime
    ? normalizeTime(endTime)
    : minutesToTime(startMinutes + durationMinutes);

  if (!computedEndTime) {
    return { ok: false, error: "END_TIME_INVALID" };
  }

  const endMinutes = timeToMinutes(computedEndTime);
  if (endMinutes <= startMinutes) {
    return { ok: false, error: "END_TIME_INVALID" };
  }

  const shift = await getShiftForEmployee({
    employeeId,
    branchId,
    date: finalDate,
  });

  if (!shift) {
    return { ok: false, error: "EMPLOYEE_HAS_NO_SHIFT" };
  }

  const shiftStart = timeToMinutes(shift.start_time);
  const shiftEnd = timeToMinutes(shift.end_time);

  if (startMinutes < shiftStart || endMinutes > shiftEnd) {
    return { ok: false, error: "BOOKING_OUTSIDE_SHIFT" };
  }

  const overlap = await hasBookingOverlap({
    employeeId,
    date: finalDate,
    startTime: finalStartTime,
    endTime: computedEndTime,
    excludeBookingId,
  });

  if (overlap) {
    return { ok: false, error: "BOOKING_OVERLAP" };
  }

  return {
    ok: true,
    data: {
      service,
      shift,
      start_time: finalStartTime,
      end_time: computedEndTime,
      price: Number(service.price || 0),
    },
  };
}

/* =========================================================
   GET /api/v1/bookings/available-employees
========================================================= */
router.get("/available-employees", async (req, res) => {
  try {
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const serviceId = req.query.service_id ? Number(req.query.service_id) : null;
    const date = normalizeDate(req.query.date);
    const startTime = normalizeTime(req.query.start_time);
    const excludeBookingId = req.query.exclude_booking_id
      ? Number(req.query.exclude_booking_id)
      : null;

    if (!branchId) {
      return res.status(400).json({ ok: false, error: "BRANCH_REQUIRED" });
    }

    if (!serviceId) {
      return res.status(400).json({ ok: false, error: "SERVICE_REQUIRED" });
    }

    if (!date) {
      return res.status(400).json({ ok: false, error: "DATE_REQUIRED" });
    }

    if (!startTime) {
      return res.status(400).json({ ok: false, error: "START_TIME_REQUIRED" });
    }

    const service = await getServiceInfo(serviceId);
    if (!service) {
      return res.status(404).json({ ok: false, error: "SERVICE_NOT_FOUND" });
    }

    const durationMinutes = Number(service.duration || 0);
    if (!durationMinutes || durationMinutes <= 0) {
      return res.status(400).json({ ok: false, error: "SERVICE_DURATION_INVALID" });
    }

    const startMinutes = timeToMinutes(startTime);
    const endTime = minutesToTime(startMinutes + durationMinutes);

    const employeesResult = await pool.query(
      `
      SELECT DISTINCT
        e.id,
        e.name,
        ss.branch_id
      FROM schedule_shifts ss
      JOIN employees e
        ON e.id = ss.employee_id
      WHERE ss.branch_id = $1
        AND ss.date = $2::date
      ORDER BY e.name ASC, e.id ASC
      `,
      [branchId, date]
    );

    const available = [];

    for (const employee of employeesResult.rows) {
      const check = await validateBookingAvailability({
        employeeId: employee.id,
        branchId,
        serviceId,
        date,
        startTime,
        endTime,
        excludeBookingId,
      });

      if (check.ok) {
        available.push({
          id: employee.id,
          name: employee.name,
          branch_id: employee.branch_id,
          start_time: startTime,
          end_time: endTime,
        });
      }
    }

    return res.json({
      ok: true,
      data: available,
      meta: {
        date,
        start_time: startTime,
        end_time: endTime,
        service_id: serviceId,
        duration: durationMinutes,
        exclude_booking_id: excludeBookingId,
      },
    });
  } catch (e) {
    console.error("GET /bookings/available-employees error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* =========================================================
   GET /api/v1/bookings
========================================================= */
router.get("/", async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);

    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
    const serviceId = req.query.service_id ? Number(req.query.service_id) : null;
    const status = req.query.status ? normalizeStatus(req.query.status, "") : "";
    const search = String(req.query.search || "").trim();

    const dateFrom =
      normalizeDate(req.query.date_from) ||
      normalizeDate(req.query.from) ||
      normalizeDate(req.query.date);

    const dateTo =
      normalizeDate(req.query.date_to) ||
      normalizeDate(req.query.to) ||
      normalizeDate(req.query.date);

    const params = [tenantId];
    let p = 1;

    const where = [`c.tenant_id = $1`];

    if (branchId) {
      params.push(branchId);
      p++;
      where.push(`b.branch_id = $${p}`);
    }

    if (employeeId) {
      params.push(employeeId);
      p++;
      where.push(`b.employee_id = $${p}`);
    }

    if (serviceId) {
      params.push(serviceId);
      p++;
      where.push(`b.service_id = $${p}`);
    }

    if (status) {
      params.push(status);
      p++;
      where.push(`COALESCE(NULLIF(b.status, ''), 'booked') = $${p}`);
    }

    if (dateFrom && dateTo) {
      params.push(dateFrom);
      p++;
      where.push(`b.date >= $${p}::date`);

      params.push(dateTo);
      p++;
      where.push(`b.date <= $${p}::date`);
    } else if (dateFrom) {
      params.push(dateFrom);
      p++;
      where.push(`b.date = $${p}::date`);
    }

    if (search) {
      const normalizedPhone = normalizePhone(search);
      params.push(`%${search.toLowerCase()}%`);
      p++;
      const nameParam = `$${p}`;

      if (normalizedPhone) {
        params.push(normalizedPhone);
        p++;
        const phoneParam = `$${p}`;

        where.push(`(
          LOWER(COALESCE(c.full_name, '')) LIKE ${nameParam}
          OR c.phone = ${phoneParam}
        )`);
      } else {
        where.push(`LOWER(COALESCE(c.full_name, '')) LIKE ${nameParam}`);
      }
    }

    const sql = `
      SELECT
        b.id,
        b.client_id,
        b.branch_id,
        b.employee_id,
        b.service_id,
        TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
        b.start_time,
        b.end_time,
        b.price,
        COALESCE(NULLIF(b.status, ''), 'booked') AS status,

        c.full_name AS client_name,
        c.phone AS client_phone,
        c.email AS client_email,

        COALESCE(br.name, 'Без филиала') AS branch_name,
        COALESCE(e.name, 'Без сотрудника') AS employee_name,
        COALESCE(s.name, 'Без услуги') AS service_name

      FROM bookings b
      JOIN clients c ON c.id = b.client_id
      LEFT JOIN branches br ON br.id = b.branch_id
      LEFT JOIN employees e ON e.id = b.employee_id
      LEFT JOIN services s ON s.id = b.service_id
      WHERE ${where.join(" AND ")}
      ORDER BY b.date DESC, b.start_time ASC NULLS LAST, b.id DESC
      LIMIT 500
    `;

    const result = await pool.query(sql, params);

    return res.json({
      ok: true,
      data: result.rows.map(mapBookingRow),
    });
  } catch (e) {
    console.error("GET /bookings error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* =========================================================
   GET /api/v1/bookings/:id
========================================================= */
router.get("/:id", async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);
    const bookingId = Number(req.params.id);

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });
    }

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.client_id,
        b.branch_id,
        b.employee_id,
        b.service_id,
        TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
        b.start_time,
        b.end_time,
        b.price,
        COALESCE(NULLIF(b.status, ''), 'booked') AS status,

        c.full_name AS client_name,
        c.phone AS client_phone,
        c.email AS client_email,

        COALESCE(br.name, 'Без филиала') AS branch_name,
        COALESCE(e.name, 'Без сотрудника') AS employee_name,
        COALESCE(s.name, 'Без услуги') AS service_name

      FROM bookings b
      JOIN clients c ON c.id = b.client_id
      LEFT JOIN branches br ON br.id = b.branch_id
      LEFT JOIN employees e ON e.id = b.employee_id
      LEFT JOIN services s ON s.id = b.service_id
      WHERE b.id = $1
        AND c.tenant_id = $2
      LIMIT 1
      `,
      [bookingId, tenantId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" });
    }

    return res.json({ ok: true, data: mapBookingRow(result.rows[0]) });
  } catch (e) {
    console.error("GET /bookings/:id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* =========================================================
   POST /api/v1/bookings
========================================================= */
router.post("/", async (req, res) => {
  const db = await pool.connect();

  try {
    await db.query("BEGIN");

    const tenantId = Number(req.headers["x-tenant-id"] || 1);

    let {
      client_id = null,
      full_name = null,
      phone = null,
      email = null,

      branch_id = null,
      employee_id = null,
      service_id = null,
      date = null,
      start_time = null,
      end_time = null,
      price = 0,
      status = "booked",
    } = req.body || {};

    const finalBranchId = branch_id ? Number(branch_id) : null;
    const finalEmployeeId = employee_id ? Number(employee_id) : null;
    const finalServiceId = service_id ? Number(service_id) : null;
    const finalStatus = normalizeStatus(status, "booked");
    const finalDate = normalizeDate(date);
    const finalStartTime = normalizeTime(start_time);
    const manualEndTime = normalizeTime(end_time);

    if (!finalDate) {
      await db.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "DATE_REQUIRED" });
    }

    if (!finalStartTime) {
      await db.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "START_TIME_REQUIRED" });
    }

    let finalClientId = client_id ? Number(client_id) : null;

    if (!finalClientId) {
      const cleanName = String(full_name || "").trim().replace(/\s+/g, " ");
      const normalizedPhone = normalizePhone(phone);
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;

      if (!cleanName) {
        await db.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "FULL_NAME_REQUIRED" });
      }

      if (!normalizedPhone) {
        await db.query("ROLLBACK");
        return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" });
      }

      const existingClientResult = await db.query(
        `
        SELECT id, email, full_name
        FROM clients
        WHERE tenant_id = $1
          AND phone = $2
        ORDER BY id ASC
        LIMIT 1
        `,
        [tenantId, normalizedPhone]
      );

      if (existingClientResult.rows[0]) {
        finalClientId = existingClientResult.rows[0].id;

        // If client supplied a different name → update, so booking + future history
        // reflect the latest spelling (e.g. user corrected their name).
        const oldName = String(existingClientResult.rows[0].full_name || "").trim().toLowerCase();
        const newName = cleanName.toLowerCase();
        if (cleanName && newName !== oldName) {
          await db.query(
            `UPDATE clients SET full_name = $1, updated_at = NOW()
             WHERE tenant_id = $2 AND id = $3`,
            [cleanName, tenantId, finalClientId]
          );
        }

        if (cleanEmail && !existingClientResult.rows[0].email) {
          await db.query(
            `
            UPDATE clients
            SET email = $1,
                updated_at = NOW()
            WHERE tenant_id = $2
              AND id = $3
            `,
            [cleanEmail, tenantId, finalClientId]
          );
        }
      } else {
        const createdClientResult = await db.query(
          `
          INSERT INTO clients (
            tenant_id,
            business_id,
            full_name,
            phone,
            email,
            birthday,
            notes,
            status,
            source,
            created_branch_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
          `,
          [
            tenantId,
            finalBranchId,
            cleanName,
            normalizedPhone,
            cleanEmail,
            null,
            "",
            "new",
            "booking_manual",
            finalBranchId,
          ]
        );

        finalClientId = createdClientResult.rows[0].id;
      }
    } else {
      const existingByIdResult = await db.query(
        `
        SELECT id
        FROM clients
        WHERE tenant_id = $1
          AND id = $2
        LIMIT 1
        `,
        [tenantId, finalClientId]
      );

      if (!existingByIdResult.rows[0]) {
        await db.query("ROLLBACK");
        return res.status(404).json({ ok: false, error: "CLIENT_NOT_FOUND" });
      }
    }

    const availability = await validateBookingAvailability({
      employeeId: finalEmployeeId,
      branchId: finalBranchId,
      serviceId: finalServiceId,
      date: finalDate,
      startTime: finalStartTime,
      endTime: manualEndTime,
    });

    if (!availability.ok) {
      await db.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: availability.error });
    }

    const finalEndTime = availability.data.end_time;
    const finalPrice =
      req.body?.price === "" || req.body?.price == null
        ? Number(availability.data.price || 0)
        : Number(price || 0);

    const bookingResult = await db.query(
      `
      INSERT INTO bookings (
        client_id,
        branch_id,
        employee_id,
        service_id,
        date,
        start_time,
        end_time,
        price,
        status
      )
      VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9)
      RETURNING
        id,
        client_id,
        branch_id,
        employee_id,
        service_id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        start_time,
        end_time,
        price,
        status
      `,
      [
        finalClientId,
        finalBranchId,
        finalEmployeeId,
        finalServiceId,
        finalDate,
        finalStartTime,
        finalEndTime,
        finalPrice,
        finalStatus,
      ]
    );

    await db.query(
      `
      UPDATE clients
      SET
        last_visit_at = CASE
          WHEN $3::date <= CURRENT_DATE THEN NOW()
          ELSE last_visit_at
        END,
        updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
      `,
      [tenantId, finalClientId, finalDate]
    );

    await db.query("COMMIT");

    return res.status(201).json({
      ok: true,
      data: mapBookingRow(bookingResult.rows[0]),
      client_id: finalClientId,
    });
  } catch (e) {
    await db.query("ROLLBACK");
    console.error("POST /bookings error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  } finally {
    db.release();
  }
});

/* =========================================================
   PUT /api/v1/bookings/:id
========================================================= */
router.put("/:id", async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);
    const bookingId = Number(req.params.id);

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });
    }

    const {
      client_id = null,
      branch_id = null,
      employee_id = null,
      service_id = null,
      date = null,
      start_time = null,
      end_time = null,
      price = 0,
      status = "booked",
    } = req.body || {};

    const finalDate = normalizeDate(date);
    const finalStartTime = normalizeTime(start_time);
    const manualEndTime = normalizeTime(end_time);

    if (!finalDate) {
      return res.status(400).json({ ok: false, error: "DATE_REQUIRED" });
    }

    if (!finalStartTime) {
      return res.status(400).json({ ok: false, error: "START_TIME_REQUIRED" });
    }

    const finalStatus = normalizeStatus(status, "booked");

    const checkResult = await pool.query(
      `
      SELECT b.id
      FROM bookings b
      JOIN clients c ON c.id = b.client_id
      WHERE b.id = $1
        AND c.tenant_id = $2
      LIMIT 1
      `,
      [bookingId, tenantId]
    );

    if (!checkResult.rows[0]) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" });
    }

    if (client_id) {
      const clientCheck = await pool.query(
        `
        SELECT id
        FROM clients
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
        `,
        [Number(client_id), tenantId]
      );

      if (!clientCheck.rows[0]) {
        return res.status(404).json({ ok: false, error: "CLIENT_NOT_FOUND" });
      }
    }

    const availability = await validateBookingAvailability({
      employeeId: employee_id ? Number(employee_id) : null,
      branchId: branch_id ? Number(branch_id) : null,
      serviceId: service_id ? Number(service_id) : null,
      date: finalDate,
      startTime: finalStartTime,
      endTime: manualEndTime,
      excludeBookingId: bookingId,
    });

    if (!availability.ok) {
      return res.status(409).json({ ok: false, error: availability.error });
    }

    const finalEndTime = availability.data.end_time;
    const finalPrice =
      req.body?.price === "" || req.body?.price == null
        ? Number(availability.data.price || 0)
        : Number(price || 0);

    const result = await pool.query(
      `
      UPDATE bookings
      SET
        client_id = $1,
        branch_id = $2,
        employee_id = $3,
        service_id = $4,
        date = $5::date,
        start_time = $6,
        end_time = $7,
        price = $8,
        status = $9
      WHERE id = $10
      RETURNING
        id,
        client_id,
        branch_id,
        employee_id,
        service_id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        start_time,
        end_time,
        price,
        status
      `,
      [
        client_id ? Number(client_id) : null,
        branch_id ? Number(branch_id) : null,
        employee_id ? Number(employee_id) : null,
        service_id ? Number(service_id) : null,
        finalDate,
        finalStartTime,
        finalEndTime,
        finalPrice,
        finalStatus,
        bookingId,
      ]
    );

    return res.json({
      ok: true,
      data: mapBookingRow(result.rows[0]),
    });
  } catch (e) {
    console.error("PUT /bookings/:id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* =========================================================
   PATCH /api/v1/bookings/:id/status
========================================================= */
router.patch("/:id/status", async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);
    const bookingId = Number(req.params.id);
    const status = normalizeStatus(req.body?.status, "");

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });
    }

    if (!status) {
      return res.status(400).json({ ok: false, error: "STATUS_REQUIRED" });
    }

    const result = await pool.query(
      `
      UPDATE bookings b
      SET status = $1
      FROM clients c
      WHERE b.id = $2
        AND c.id = b.client_id
        AND c.tenant_id = $3
      RETURNING
        b.id,
        b.client_id,
        b.branch_id,
        b.employee_id,
        b.service_id,
        TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
        b.start_time,
        b.end_time,
        b.price,
        b.status
      `,
      [status, bookingId, tenantId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" });
    }

    return res.json({
      ok: true,
      data: mapBookingRow(result.rows[0]),
    });
  } catch (e) {
    console.error("PATCH /bookings/:id/status error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* =========================================================
   DELETE /api/v1/bookings/:id
========================================================= */
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);
    const bookingId = Number(req.params.id);

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });
    }

    const result = await pool.query(
      `
      DELETE FROM bookings b
      USING clients c
      WHERE b.id = $1
        AND c.id = b.client_id
        AND c.tenant_id = $2
      RETURNING
        b.id,
        b.client_id,
        b.branch_id,
        b.employee_id,
        b.service_id,
        TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
        b.start_time,
        b.end_time,
        b.price,
        b.status
      `,
      [bookingId, tenantId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" });
    }

    return res.json({
      ok: true,
      data: mapBookingRow(result.rows[0]),
    });
  } catch (e) {
    console.error("DELETE /bookings/:id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;