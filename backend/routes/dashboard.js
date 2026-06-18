import express from "express";
import { pool } from "../db.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function normalizeDate(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

async function getDirectorDashboard({ tenantId = 1, from = null, to = null, branchId = null }) {
  function buildClientWhere() {
    const where = [`c.tenant_id = $1`];
    const params = [tenantId];
    let p = 1;

    if (branchId) {
      params.push(branchId);
      p++;
      where.push(`c.created_branch_id = $${p}`);
    }

    return { where, params, p };
  }

  function buildBookingWhereWithClient() {
    const where = [`c.tenant_id = $1`];
    const params = [tenantId];
    let p = 1;

    if (branchId) {
      params.push(branchId);
      p++;
      where.push(`b.branch_id = $${p}`);
    }

    if (from && to) {
      params.push(from);
      p++;
      where.push(`b.date >= $${p}`);

      params.push(to);
      p++;
      where.push(`b.date <= $${p}`);
    }

    return { where, params, p };
  }

  function buildBookingWhereRaw() {
    const where = [`1=1`];
    const params = [];
    let p = 0;

    if (branchId) {
      params.push(branchId);
      p++;
      where.push(`b.branch_id = $${p}`);
    }

    if (from && to) {
      params.push(from);
      p++;
      where.push(`b.date >= $${p}`);

      params.push(to);
      p++;
      where.push(`b.date <= $${p}`);
    }

    return { where, params, p };
  }

  const clientBase = buildClientWhere();
  const bookingBase = buildBookingWhereWithClient();
  const bookingRawBase = buildBookingWhereRaw();

  const totalClientsSql = `
    SELECT COUNT(*)::int AS value
    FROM clients c
    WHERE ${clientBase.where.join(" AND ")}
  `;

  const newClientsParams = [...clientBase.params];
  const newClientsWhere = [...clientBase.where];
  let newClientsP = clientBase.p;

  if (from && to) {
    newClientsParams.push(from);
    newClientsP++;
    newClientsWhere.push(`c.created_at::date >= $${newClientsP}`);

    newClientsParams.push(to);
    newClientsP++;
    newClientsWhere.push(`c.created_at::date <= $${newClientsP}`);
  } else {
    newClientsWhere.push(`c.created_at::date >= CURRENT_DATE - INTERVAL '30 days'`);
  }

  const newClientsSql = `
    SELECT COUNT(*)::int AS value
    FROM clients c
    WHERE ${newClientsWhere.join(" AND ")}
  `;

  const activeClientsSql = `
    SELECT COUNT(*)::int AS value
    FROM (
      SELECT DISTINCT b.client_id
      FROM bookings b
      JOIN clients c ON c.id = b.client_id
      WHERE ${bookingBase.where.join(" AND ")}
    ) t
  `;

  const totalBookingsSql = `
    SELECT COUNT(*)::int AS value
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE ${bookingBase.where.join(" AND ")}
  `;

  const todayBookingsSql = `
    SELECT COUNT(*)::int AS value
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE c.tenant_id = $1
      ${branchId ? `AND b.branch_id = $2` : ``}
      AND b.date = CURRENT_DATE
  `;
  const todayBookingsParams = branchId ? [tenantId, branchId] : [tenantId];

  const repeatClientsSql = `
    SELECT COUNT(*)::int AS value
    FROM (
      SELECT b.client_id
      FROM bookings b
      JOIN clients c ON c.id = b.client_id
      WHERE ${bookingBase.where.join(" AND ")}
      GROUP BY b.client_id
      HAVING COUNT(*) > 1
    ) t
  `;

  const cancelledBookingsSql = `
    SELECT COUNT(*)::int AS value
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE ${bookingBase.where.join(" AND ")}
      AND COALESCE(NULLIF(b.status, ''), 'booked') = 'cancelled'
  `;

  const completedBookingsSql = `
    SELECT COUNT(*)::int AS value
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE ${bookingBase.where.join(" AND ")}
      AND COALESCE(NULLIF(b.status, ''), 'booked') IN ('completed', 'done', 'finished', 'confirmed')
  `;

  const revenueSql = `
    SELECT COALESCE(SUM(b.price), 0)::numeric AS value
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE ${bookingBase.where.join(" AND ")}
      AND COALESCE(NULLIF(b.status, ''), 'booked') IN ('completed', 'done', 'finished', 'confirmed')
  `;

  const branchBookingsSql = `
    SELECT
      b.branch_id,
      COALESCE(br.name, 'Без филиала') AS branch_name,
      COUNT(*)::int AS bookings_count
    FROM bookings b
    LEFT JOIN branches br ON br.id = b.branch_id
    JOIN clients c ON c.id = b.client_id
    WHERE ${bookingBase.where.join(" AND ")}
    GROUP BY b.branch_id, br.name
    ORDER BY bookings_count DESC, branch_name ASC
  `;

  const branchClientsParams = [...clientBase.params];
  const branchClientsWhere = [...clientBase.where];
  let branchClientsP = clientBase.p;

  if (from && to) {
    branchClientsParams.push(from);
    branchClientsP++;
    branchClientsWhere.push(`c.created_at::date >= $${branchClientsP}`);

    branchClientsParams.push(to);
    branchClientsP++;
    branchClientsWhere.push(`c.created_at::date <= $${branchClientsP}`);
  }

  const branchClientsSql = `
    SELECT
      c.created_branch_id AS branch_id,
      COALESCE(br.name, 'Без филиала') AS branch_name,
      COUNT(*)::int AS clients_count
    FROM clients c
    LEFT JOIN branches br ON br.id = c.created_branch_id
    WHERE ${branchClientsWhere.join(" AND ")}
    GROUP BY c.created_branch_id, br.name
    ORDER BY clients_count DESC, branch_name ASC
  `;

  const sourcesParams = [...clientBase.params];
  const sourcesWhere = [...clientBase.where];
  let sourcesP = clientBase.p;

  if (from && to) {
    sourcesParams.push(from);
    sourcesP++;
    sourcesWhere.push(`c.created_at::date >= $${sourcesP}`);

    sourcesParams.push(to);
    sourcesP++;
    sourcesWhere.push(`c.created_at::date <= $${sourcesP}`);
  }

  const sourcesSql = `
    SELECT
      COALESCE(NULLIF(c.source, ''), 'unknown') AS source,
      COUNT(*)::int AS clients_count
    FROM clients c
    WHERE ${sourcesWhere.join(" AND ")}
    GROUP BY COALESCE(NULLIF(c.source, ''), 'unknown')
    ORDER BY clients_count DESC, source ASC
    LIMIT 10
  `;

  const recentClientsSql = `
    SELECT
      c.id,
      c.full_name,
      c.phone,
      c.email,
      c.status,
      c.source,
      c.created_branch_id,
      COALESCE(br.name, 'Без филиала') AS branch_name,
      c.created_at
    FROM clients c
    LEFT JOIN branches br ON br.id = c.created_branch_id
    WHERE ${clientBase.where.join(" AND ")}
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT 10
  `;

  const recentBookingsSql = `
    SELECT
      b.id,
      TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
      b.start_time,
      b.end_time,
      COALESCE(NULLIF(b.status, ''), 'booked') AS status,
      b.price,
      b.branch_id,
      COALESCE(br.name, 'Без филиала') AS branch_name,
      b.client_id,
      c.full_name AS client_name
    FROM bookings b
    LEFT JOIN branches br ON br.id = b.branch_id
    LEFT JOIN clients c ON c.id = b.client_id
    WHERE ${bookingRawBase.where.join(" AND ")}
    ORDER BY b.date DESC, b.start_time DESC NULLS LAST, b.id DESC
    LIMIT 10
  `;

  /* =========================
     Previous period for deltas
     ========================= */
  function effectiveRange() {
    if (from && to) return { f: from, t: to };
    // default: last 30 days ending today
    const today = new Date();
    const t = today.toISOString().slice(0,10);
    const fromD = new Date(today); fromD.setDate(fromD.getDate() - 29);
    return { f: fromD.toISOString().slice(0,10), t };
  }
  const { f: curFrom, t: curTo } = effectiveRange();
  const diffDays = Math.max(1, Math.floor((new Date(curTo) - new Date(curFrom)) / 86400000) + 1);
  const prevTo = new Date(new Date(curFrom).getTime() - 86400000).toISOString().slice(0,10);
  const prevFrom = new Date(new Date(prevTo).getTime() - (diffDays - 1) * 86400000).toISOString().slice(0,10);

  // Build SQL for an arbitrary period — counts of new clients + bookings + revenue
  const periodParams = [tenantId, curFrom, curTo];
  let periodWhereC = `c.tenant_id = $1 AND c.created_at::date >= $2 AND c.created_at::date <= $3`;
  let periodWhereB = `c.tenant_id = $1 AND b.date >= $2 AND b.date <= $3`;
  let periodP = 3;
  if (branchId) {
    periodParams.push(branchId);
    periodP++;
    periodWhereC += ` AND c.created_branch_id = $${periodP}`;
    periodWhereB += ` AND b.branch_id = $${periodP}`;
  }

  const prevPeriodParams = [tenantId, prevFrom, prevTo];
  let prevWhereC = `c.tenant_id = $1 AND c.created_at::date >= $2 AND c.created_at::date <= $3`;
  let prevWhereB = `c.tenant_id = $1 AND b.date >= $2 AND b.date <= $3`;
  if (branchId) {
    prevPeriodParams.push(branchId);
    prevWhereC += ` AND c.created_branch_id = $4`;
    prevWhereB += ` AND b.branch_id = $4`;
  }

  const periodKpiSql = `
    SELECT
      (SELECT COUNT(*)::int FROM clients c WHERE ${periodWhereC}) AS new_clients,
      (SELECT COUNT(*)::int FROM bookings b JOIN clients c ON c.id=b.client_id WHERE ${periodWhereB}) AS total_bookings,
      (SELECT COUNT(*)::int FROM bookings b JOIN clients c ON c.id=b.client_id WHERE ${periodWhereB}
         AND COALESCE(NULLIF(b.status,''),'booked') = 'cancelled') AS cancelled_bookings
  `;
  const prevPeriodKpiSql = periodKpiSql
    .replace(periodWhereC, prevWhereC)
    .replace(periodWhereB, prevWhereB)
    .replace(periodWhereB, prevWhereB);

  // Daily series for sparklines — new clients per day for current period
  const dailyNewClientsSql = `
    SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
           COALESCE(cnt.value, 0)::int AS value
      FROM generate_series($2::date, $3::date, '1 day'::interval) d(day)
 LEFT JOIN (
        SELECT c.created_at::date AS day, COUNT(*)::int AS value
          FROM clients c
         WHERE ${periodWhereC}
      GROUP BY c.created_at::date
      ) cnt ON cnt.day = d.day
  ORDER BY d.day`;

  const dailyBookingsSql = `
    SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
           COALESCE(cnt.value, 0)::int AS value
      FROM generate_series($2::date, $3::date, '1 day'::interval) d(day)
 LEFT JOIN (
        SELECT b.date AS day, COUNT(*)::int AS value
          FROM bookings b JOIN clients c ON c.id=b.client_id
         WHERE ${periodWhereB}
      GROUP BY b.date
      ) cnt ON cnt.day = d.day
  ORDER BY d.day`;

  const [
    totalClientsResult,
    newClientsResult,
    activeClientsResult,
    totalBookingsResult,
    todayBookingsResult,
    repeatClientsResult,
    cancelledBookingsResult,
    branchBookingsResult,
    branchClientsResult,
    sourcesResult,
    recentClientsResult,
    recentBookingsResult,
    prevPeriodKpi,
    dailyNewClients,
    dailyBookings,
  ] = await Promise.all([
    pool.query(totalClientsSql, clientBase.params),
    pool.query(newClientsSql, newClientsParams),
    pool.query(activeClientsSql, bookingBase.params),
    pool.query(totalBookingsSql, bookingBase.params),
    pool.query(todayBookingsSql, todayBookingsParams),
    pool.query(repeatClientsSql, bookingBase.params),
    pool.query(cancelledBookingsSql, bookingBase.params),
    pool.query(branchBookingsSql, bookingBase.params),
    pool.query(branchClientsSql, branchClientsParams),
    pool.query(sourcesSql, sourcesParams),
    pool.query(recentClientsSql, clientBase.params),
    pool.query(recentBookingsSql, bookingRawBase.params),
    pool.query(prevPeriodKpiSql, prevPeriodParams),
    pool.query(dailyNewClientsSql, periodParams),
    pool.query(dailyBookingsSql, periodParams),
  ]);

  const prev = prevPeriodKpi.rows[0] || {};
  const cur = {
    new_clients:        newClientsResult.rows[0]?.value || 0,
    total_bookings:     totalBookingsResult.rows[0]?.value || 0,
    cancelled_bookings: cancelledBookingsResult.rows[0]?.value || 0,
  };

  return {
    kpi: {
      total_clients: totalClientsResult.rows[0]?.value || 0,
      new_clients: cur.new_clients,
      active_clients: activeClientsResult.rows[0]?.value || 0,
      total_bookings: cur.total_bookings,
      today_bookings: todayBookingsResult.rows[0]?.value || 0,
      repeat_clients: repeatClientsResult.rows[0]?.value || 0,
      cancelled_bookings: cur.cancelled_bookings,
    },
    prev_kpi: {
      new_clients:        Number(prev.new_clients)        || 0,
      total_bookings:     Number(prev.total_bookings)     || 0,
      cancelled_bookings: Number(prev.cancelled_bookings) || 0,
    },
    series: {
      new_clients: dailyNewClients.rows.map(r => ({ day: r.day, value: r.value })),
      bookings:    dailyBookings.rows.map(r => ({ day: r.day, value: r.value })),
    },
    period: { from: curFrom, to: curTo, prev_from: prevFrom, prev_to: prevTo },
    branch_bookings: branchBookingsResult.rows,
    branch_clients: branchClientsResult.rows,
    sources: sourcesResult.rows,
    recent_clients: recentClientsResult.rows,
    recent_bookings: recentBookingsResult.rows,
  };
}

/* =========================================================
   NEW DIRECTOR DASHBOARD
   GET /api/v1/dashboard/director?from=YYYY-MM-DD&to=YYYY-MM-DD&branch_id=1
========================================================= */

router.get("/director", async (req, res) => {
  try {
    const tenantId = Number(req.headers["x-tenant-id"] || 1);
    const from = normalizeDate(req.query.from);
    const to = normalizeDate(req.query.to);
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;

    const data = await getDirectorDashboard({
      tenantId,
      from,
      to,
      branchId,
    });

    return res.json({ ok: true, data });
  } catch (e) {
    console.error("GET /dashboard/director error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

/* =========================================================
   LEGACY / EXISTING ROUTES
========================================================= */

// PLATFORM OWNER DASHBOARD
router.get("/platform", async (req, res) => {
  try {
    const businessesResult = await pool.query(`
      SELECT COUNT(*)::int AS total_businesses
      FROM businesses
    `);

    const branchesResult = await pool.query(`
      SELECT COUNT(*)::int AS total_branches
      FROM branches
    `);

    const employeesResult = await pool.query(`
      SELECT COUNT(*)::int AS total_employees
      FROM employees
    `);

    const clientsResult = await pool.query(`
      SELECT COUNT(*)::int AS total_clients
      FROM clients
    `);

    return res.json({
      ok: true,
      data: {
        total_businesses: businessesResult.rows[0]?.total_businesses || 0,
        total_branches: branchesResult.rows[0]?.total_branches || 0,
        total_employees: employeesResult.rows[0]?.total_employees || 0,
        total_clients: clientsResult.rows[0]?.total_clients || 0,
      },
    });
  } catch (e) {
    console.error("GET /dashboard/platform error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// BUSINESS OWNER DASHBOARD
router.get("/business/:business_id", async (req, res) => {
  try {
    const businessId = Number(req.params.business_id);

    const branchesResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total_branches
      FROM branches
      WHERE business_id = $1
      `,
      [businessId]
    );

    const employeesResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total_employees
      FROM employees
      WHERE business_id = $1
      `,
      [businessId]
    );

    const clientsResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total_clients
      FROM clients
      WHERE business_id = $1
      `,
      [businessId]
    );

    return res.json({
      ok: true,
      data: {
        total_branches: branchesResult.rows[0]?.total_branches || 0,
        total_employees: employeesResult.rows[0]?.total_employees || 0,
        total_clients: clientsResult.rows[0]?.total_clients || 0,
      },
    });
  } catch (e) {
    console.error("GET /dashboard/business/:business_id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// BRANCH MANAGER DASHBOARD
router.get("/branch/:branch_id", async (req, res) => {
  try {
    const branchId = Number(req.params.branch_id);

    const employeesResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total_employees
      FROM employees
      WHERE branch_id = $1
      `,
      [branchId]
    );

    const clientsResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total_clients
      FROM clients
      WHERE created_branch_id = $1
      `,
      [branchId]
    );

    const todayBookingsResult = await pool.query(
      `
      SELECT COUNT(*)::int AS today_bookings
      FROM bookings
      WHERE branch_id = $1
        AND date = CURRENT_DATE
      `,
      [branchId]
    );

    return res.json({
      ok: true,
      data: {
        total_employees: employeesResult.rows[0]?.total_employees || 0,
        total_clients: clientsResult.rows[0]?.total_clients || 0,
        today_bookings: todayBookingsResult.rows[0]?.today_bookings || 0,
      },
    });
  } catch (e) {
    console.error("GET /dashboard/branch/:branch_id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// EMPLOYEE DASHBOARD
router.get("/employee/:employee_id", async (req, res) => {
  try {
    const employeeId = Number(req.params.employee_id);

    const todayBookingsResult = await pool.query(
      `
      SELECT COUNT(*)::int AS today_bookings
      FROM bookings
      WHERE employee_id = $1
        AND date = CURRENT_DATE
      `,
      [employeeId]
    );

    const upcomingBookingsResult = await pool.query(
      `
      SELECT
        b.id,
        b.date,
        b.start_time,
        b.end_time,
        b.status,
        c.full_name AS client_name
      FROM bookings b
      LEFT JOIN clients c ON c.id = b.client_id
      WHERE b.employee_id = $1
        AND b.date >= CURRENT_DATE
      ORDER BY b.date ASC, b.start_time ASC NULLS LAST
      LIMIT 10
      `,
      [employeeId]
    );

    return res.json({
      ok: true,
      data: {
        today_bookings: todayBookingsResult.rows[0]?.today_bookings || 0,
        upcoming_bookings: upcomingBookingsResult.rows,
      },
    });
  } catch (e) {
    console.error("GET /dashboard/employee/:employee_id error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;