/**
 * SLOTIQ Intelligence — единый аналитический endpoint.
 *
 * Возвращает агрегированный JSON с метриками + AI-style insights + прогнозом.
 *
 * GET /api/v1/analytics/intelligence?from=YYYY-MM-DD&to=YYYY-MM-DD&branch_id=
 */
import express from "express";
import pool from "../db.js";

const router = express.Router();

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoYmd(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isYmd(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); }
function num(v) { return Number(v) || 0; }
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

router.get("/", async (req, res) => {
  try {
    const tenantId = Number(req.user?.business_id || 1);
    const from   = isYmd(req.query.from) ? req.query.from : daysAgoYmd(29);
    const to     = isYmd(req.query.to)   ? req.query.to   : todayYmd();
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;

    const periodDays = Math.max(1, Math.floor((new Date(to) - new Date(from)) / 86400000) + 1);
    const prevTo   = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
    const prevFrom = new Date(new Date(prevTo).getTime() - (periodDays - 1) * 86400000).toISOString().slice(0, 10);

    const bwParams = [tenantId, from, to];
    let bw = "c.tenant_id = $1 AND b.date >= $2 AND b.date <= $3";
    if (branchId) { bwParams.push(branchId); bw += ` AND b.branch_id = $${bwParams.length}`; }

    const prevParams = [tenantId, prevFrom, prevTo];
    let pw = "c.tenant_id = $1 AND b.date >= $2 AND b.date <= $3";
    if (branchId) { prevParams.push(branchId); pw += ` AND b.branch_id = $${prevParams.length}`; }

    const queries = [
      // [0] Current period KPIs
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE COALESCE(NULLIF(b.status,''),'booked') = 'cancelled')::int AS cancelled,
          COUNT(*) FILTER (WHERE COALESCE(NULLIF(b.status,''),'booked') IN ('completed','done','finished','confirmed'))::int AS completed,
          COUNT(*) FILTER (WHERE COALESCE(NULLIF(b.status,''),'booked') = 'no_show')::int AS no_show,
          COALESCE(SUM(CASE WHEN COALESCE(NULLIF(b.status,''),'booked') NOT IN ('cancelled','no_show') THEN b.price ELSE 0 END), 0)::numeric AS revenue,
          COALESCE(SUM(CASE WHEN COALESCE(NULLIF(b.status,''),'booked') IN ('cancelled','no_show') THEN b.price ELSE 0 END), 0)::numeric AS lost_revenue,
          COUNT(DISTINCT b.client_id)::int AS unique_clients
        FROM bookings b
        JOIN clients c ON c.id = b.client_id
        WHERE ${bw}
      `, bwParams),

      // [1] Previous period
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(CASE WHEN COALESCE(NULLIF(b.status,''),'booked') NOT IN ('cancelled','no_show') THEN b.price ELSE 0 END), 0)::numeric AS revenue
        FROM bookings b
        JOIN clients c ON c.id = b.client_id
        WHERE ${pw}
      `, prevParams),

      // [2] Daily revenue + bookings (for forecast + chart)
      pool.query(`
        SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
               COALESCE(cnt.bookings, 0)::int AS bookings,
               COALESCE(cnt.revenue, 0)::numeric AS revenue
          FROM generate_series($2::date, $3::date, '1 day'::interval) d(day)
     LEFT JOIN (
            SELECT b.date AS day,
                   COUNT(*)::int AS bookings,
                   SUM(CASE WHEN COALESCE(NULLIF(b.status,''),'booked') NOT IN ('cancelled','no_show') THEN b.price ELSE 0 END) AS revenue
              FROM bookings b JOIN clients c ON c.id=b.client_id
             WHERE ${bw}
          GROUP BY b.date
          ) cnt ON cnt.day = d.day
      ORDER BY d.day
      `, bwParams),

      // [3] Heatmap: weekday × hour
      pool.query(`
        SELECT EXTRACT(ISODOW FROM b.date)::int AS dow,
               EXTRACT(HOUR FROM b.start_time::time)::int AS hour,
               COUNT(*)::int AS cnt
          FROM bookings b JOIN clients c ON c.id=b.client_id
         WHERE ${bw} AND b.start_time IS NOT NULL
      GROUP BY dow, hour
      `, bwParams),

      // [4] Top clients by revenue
      pool.query(`
        SELECT c.id, c.full_name, c.phone,
               COUNT(b.id)::int AS visits,
               COALESCE(SUM(CASE WHEN COALESCE(NULLIF(b.status,''),'booked') NOT IN ('cancelled','no_show') THEN b.price ELSE 0 END), 0)::numeric AS revenue,
               TO_CHAR(MAX(b.date), 'YYYY-MM-DD') AS last_visit
          FROM clients c
          LEFT JOIN bookings b ON b.client_id = c.id
         WHERE c.tenant_id = $1
      GROUP BY c.id
      HAVING COUNT(b.id) > 0
      ORDER BY revenue DESC NULLS LAST, visits DESC
         LIMIT 10
      `, [tenantId]),

      // [5] Branch breakdown
      pool.query(`
        SELECT b.branch_id, COALESCE(br.name, 'Без филиала') AS branch_name,
               COUNT(*)::int AS bookings,
               COALESCE(SUM(CASE WHEN COALESCE(NULLIF(b.status,''),'booked') NOT IN ('cancelled','no_show') THEN b.price ELSE 0 END), 0)::numeric AS revenue,
               COUNT(*) FILTER (WHERE COALESCE(NULLIF(b.status,''),'booked') = 'cancelled')::int AS cancelled
          FROM bookings b
          LEFT JOIN branches br ON br.id = b.branch_id
          JOIN clients c ON c.id = b.client_id
         WHERE ${bw}
      GROUP BY b.branch_id, br.name
      ORDER BY revenue DESC
      `, bwParams),

      // [6] Employee breakdown
      pool.query(`
        SELECT b.employee_id, COALESCE(e.name, 'Без мастера') AS employee_name,
               COUNT(*)::int AS bookings,
               COALESCE(SUM(CASE WHEN COALESCE(NULLIF(b.status,''),'booked') NOT IN ('cancelled','no_show') THEN b.price ELSE 0 END), 0)::numeric AS revenue
          FROM bookings b
          LEFT JOIN employees e ON e.id = b.employee_id
          JOIN clients c ON c.id = b.client_id
         WHERE ${bw} AND b.employee_id IS NOT NULL
      GROUP BY b.employee_id, e.name
      ORDER BY revenue DESC NULLS LAST
         LIMIT 5
      `, bwParams),

      // [7] Retention: clients who came in period AND returned within 60 days after their last visit
      pool.query(`
        WITH first_visits AS (
          SELECT c.id AS client_id, MIN(b.date) AS first_date
            FROM clients c
            JOIN bookings b ON b.client_id = c.id
           WHERE c.tenant_id = $1 AND b.date >= $2 AND b.date <= $3
        GROUP BY c.id
        )
        SELECT
          COUNT(DISTINCT fv.client_id)::int AS cohort_size,
          COUNT(DISTINCT fv.client_id) FILTER (
            WHERE EXISTS (SELECT 1 FROM bookings b2 WHERE b2.client_id = fv.client_id AND b2.date > fv.first_date AND b2.date <= fv.first_date + 30)
          )::int AS returned_30d,
          COUNT(DISTINCT fv.client_id) FILTER (
            WHERE EXISTS (SELECT 1 FROM bookings b2 WHERE b2.client_id = fv.client_id AND b2.date > fv.first_date AND b2.date <= fv.first_date + 60)
          )::int AS returned_60d
        FROM first_visits fv
      `, [tenantId, from, to]),
    ];

    const [cur, prev, daily, heat, topClients, branches, employees, retention] =
      (await Promise.all(queries)).map(r => r.rows);

    const k = cur[0] || {};
    const p = prev[0] || {};

    const revenue   = num(k.revenue);
    const prevRev   = num(p.revenue);
    const total     = num(k.total);
    const cancelled = num(k.cancelled);
    const completed = num(k.completed);
    const noShow    = num(k.no_show);
    const lostRev   = num(k.lost_revenue);

    const cancelRate = pct(cancelled, total);
    const completionRate = pct(completed, total);
    const noShowRate = pct(noShow, total);
    const revenueDelta = prevRev > 0 ? Math.round(((revenue - prevRev) / prevRev) * 100) : (revenue > 0 ? 100 : 0);

    /* ── Health Score (0-100) ────────────────────── */
    const components = [
      { label: "Активность", score: total > 0 ? clamp(Math.round((total / Math.max(1, periodDays)) * 20), 0, 100) : 0, weight: 0.25, hint: `${total} записей за ${periodDays} дней` },
      { label: "Отмены",     score: clamp(100 - cancelRate * 3, 0, 100),  weight: 0.25, hint: `${cancelRate}% отмен` },
      { label: "Динамика выручки", score: revenueDelta >= 0 ? clamp(60 + revenueDelta, 0, 100) : clamp(60 + revenueDelta * 2, 0, 100), weight: 0.25, hint: `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}% к прошлому периоду` },
      { label: "Удержание",  score: retention[0] ? pct(retention[0].returned_60d, retention[0].cohort_size) : 0, weight: 0.25, hint: `${retention[0]?.returned_60d || 0} из ${retention[0]?.cohort_size || 0} вернулись` },
    ];
    const healthScore = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));

    /* ── Heatmap (7 × 24) ─────────────────────────── */
    const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    let heatMax = 0;
    for (const row of heat) {
      const d = ((Number(row.dow) || 1) - 1); // 0=Mon..6=Sun
      const h = Number(row.hour) || 0;
      if (d >= 0 && d < 7 && h >= 0 && h < 24) {
        heatmap[d][h] = Number(row.cnt) || 0;
        if (heatmap[d][h] > heatMax) heatMax = heatmap[d][h];
      }
    }

    /* ── Forecast (linear regression on daily revenue) ── */
    const series = daily.map(r => num(r.revenue));
    const forecast = linearForecast(series, 30);

    /* ── AI-style insights (rule-based) ───────────── */
    const insights = [];

    // Cancellation spike
    if (cancelRate >= 20) {
      insights.push({
        type: "danger",
        icon: "⚠️",
        title: "Высокий процент отмен",
        text: `${cancelRate}% записей отменено. Норма обычно 5-10%. Стоит позвонить клиентам за день и подтвердить.`,
      });
    } else if (cancelRate <= 5 && total >= 10) {
      insights.push({
        type: "success",
        icon: "✨",
        title: "Отличная дисциплина",
        text: `Всего ${cancelRate}% отмен — клиенты доходят. Это очень хорошо.`,
      });
    }

    // Revenue dynamics
    if (revenueDelta >= 20 && prevRev > 0) {
      insights.push({
        type: "success",
        icon: "🚀",
        title: "Выручка растёт",
        text: `+${revenueDelta}% к прошлому периоду (${formatMoney(revenue)} ₽ против ${formatMoney(prevRev)} ₽). Что-то делаешь правильно — масштабируй.`,
      });
    } else if (revenueDelta <= -15 && prevRev > 0) {
      insights.push({
        type: "warning",
        icon: "📉",
        title: "Выручка просела",
        text: `${revenueDelta}% к прошлому периоду. Стоит проверить отмены и загрузку популярных часов.`,
      });
    }

    // Peak hour
    if (heatMax > 0) {
      let peakDow = 0, peakHour = 10, peakVal = 0;
      for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
        if (heatmap[d][h] > peakVal) { peakVal = heatmap[d][h]; peakDow = d; peakHour = h; }
      }
      const days = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
      insights.push({
        type: "info",
        icon: "🔥",
        title: "Пиковый слот",
        text: `${days[peakDow]} в ${String(peakHour).padStart(2,"0")}:00 — ${peakVal} ${pluralRecord(peakVal)}. Загрузи это время мастерами в первую очередь.`,
      });
    }

    // Empty days
    const emptyDays = daily.filter(d => num(d.bookings) === 0).length;
    if (emptyDays >= 3 && periodDays > 7) {
      insights.push({
        type: "warning",
        icon: "🌙",
        title: `${emptyDays} ${pluralDay(emptyDays)} без записей`,
        text: `За период было ${emptyDays} ${pluralDay(emptyDays)} с нулевой загрузкой. Запусти промо или скидку на эти дни.`,
      });
    }

    // Top employee dominance
    if (employees[0] && employees.length >= 2) {
      const topEmpRev = num(employees[0].revenue);
      const totalEmpRev = employees.reduce((s, e) => s + num(e.revenue), 0);
      const share = totalEmpRev > 0 ? Math.round((topEmpRev / totalEmpRev) * 100) : 0;
      if (share >= 50) {
        insights.push({
          type: "info",
          icon: "👑",
          title: `${employees[0].employee_name} тянет ${share}% выручки`,
          text: `Если этот сотрудник уйдёт или заболеет — потеряешь половину дохода. Стоит развивать остальных.`,
        });
      }
    }

    // No-show notice
    if (noShowRate >= 10) {
      insights.push({
        type: "warning",
        icon: "👻",
        title: "Клиенты не приходят",
        text: `${noShowRate}% записей закончились "не пришёл". Подумай о предоплате или SMS-напоминании.`,
      });
    }

    // Empty insights fallback
    if (insights.length === 0) {
      insights.push({
        type: "info",
        icon: "💡",
        title: "Маловато данных",
        text: "Сделай больше записей за этот период — Intelligence начнёт находить инсайты автоматически.",
      });
    }

    /* ── Anomalies (z-score on daily bookings) ────── */
    const dailyBookings = daily.map(r => num(r.bookings));
    const mean = dailyBookings.reduce((s, v) => s + v, 0) / Math.max(1, dailyBookings.length);
    const variance = dailyBookings.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, dailyBookings.length);
    const std = Math.sqrt(variance);
    const anomalies = [];
    daily.forEach(r => {
      const v = num(r.bookings);
      if (std > 0 && Math.abs(v - mean) > std * 2) {
        anomalies.push({
          date: r.day,
          bookings: v,
          normal: Math.round(mean * 10) / 10,
          type: v > mean ? "spike" : "drop",
        });
      }
    });

    return res.json({
      period: { from, to, days: periodDays },
      health: { score: healthScore, components },
      kpi: {
        revenue, prev_revenue: prevRev, revenue_delta: revenueDelta,
        total_bookings: total, completed, cancelled, no_show: noShow,
        completion_rate: completionRate, cancel_rate: cancelRate, no_show_rate: noShowRate,
        lost_revenue: lostRev,
        unique_clients: num(k.unique_clients),
        avg_check: completed > 0 ? Math.round(revenue / completed) : 0,
      },
      series: {
        days:  daily.map(r => r.day),
        bookings: dailyBookings,
        revenue: series,
      },
      heatmap: { values: heatmap, max: heatMax },
      forecast: {
        next_30_days: forecast.total,
        per_day: forecast.perDay,
        trend: forecast.slope > 0.5 ? "up" : (forecast.slope < -0.5 ? "down" : "flat"),
      },
      retention: retention[0] || { cohort_size: 0, returned_30d: 0, returned_60d: 0 },
      top_clients: topClients.map(r => ({
        id: r.id, name: r.full_name, phone: r.phone,
        visits: num(r.visits), revenue: num(r.revenue), last_visit: r.last_visit,
      })),
      branches,
      employees,
      insights,
      anomalies,
    });
  } catch (err) {
    console.error("GET /analytics/intelligence error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", detail: err.message });
  }
});

function linearForecast(series, horizon = 30) {
  if (!series || series.length < 3) return { total: 0, perDay: 0, slope: 0 };
  const n = series.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = series.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (series[i] - meanY); den += (xs[i] - meanX) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const lastIdx = n - 1;
  let total = 0;
  for (let i = 1; i <= horizon; i++) {
    const v = Math.max(0, intercept + slope * (lastIdx + i));
    total += v;
  }
  return { total: Math.round(total), perDay: Math.round(total / horizon), slope };
}

function formatMoney(v) {
  const n = Math.round(Number(v) || 0);
  return n.toLocaleString("ru-RU");
}
function pluralRecord(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "записи";
  return "записей";
}
function pluralDay(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

export default router;
