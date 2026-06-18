import "dotenv/config";
import express from "express";
import cors from "cors";

import { requireAuth } from "./middleware/auth.js";

import authRouter                  from "./routes/auth.js";
import employeesRoutes             from "./routes/employees.js";
import branchesRoutes              from "./routes/branches.js";
import servicesRoutes              from "./routes/services.js";
import roomsRoutes                 from "./routes/rooms.js";
import bookingsRoutes              from "./routes/bookings.js";
import clientsRouter               from "./routes/clients.js";
import scheduleShiftsRouter        from "./routes/scheduleShifts.js";
import scheduleOverviewRouter      from "./routes/scheduleOverview.js";
import dashboardRouter             from "./routes/dashboard.js";
import settingsRouter              from "./routes/settings.js";
import roomBookingsRouter          from "./routes/roomBookings.js";
import uploadsRouter               from "./routes/uploads.js";
import analyticsIntelligenceRouter from "./routes/analyticsIntelligence.js";
import clientAuthRouter             from "./routes/clientAuth.js";
import shiftTemplatesRouter         from "./routes/shiftTemplates.js";
import exportsRouter                from "./routes/exports.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use((req, res, next) => {
  console.log(">>> BACKEND HIT:", req.method, req.url);
  next();
});

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
    credentials: false,
  })
);

app.use(express.json());

// Serve uploaded photos as static files
app.use("/uploads", express.static("uploads"));

/* ─── Public ─────────────────────────────────────── */
app.get("/", (_req, res) => res.send("SLOTIQ API is running"));
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "slotiq-api", version: "v1" })
);

// auth router has both public (login) and protected (me) endpoints — handles internally
app.use("/api/v1/auth", authRouter);

// Client auth (public booking widget) — handles its own auth via Bearer token
app.use("/api/v1/client-auth", clientAuthRouter);

/* ─── Protected ──────────────────────────────────── */
app.use("/api/v1/employees",              requireAuth, employeesRoutes);
app.use("/api/v1/branches",               requireAuth, branchesRoutes);
app.use("/api/v1/services",               requireAuth, servicesRoutes);
app.use("/api/v1/rooms",                  requireAuth, roomsRoutes);
app.use("/api/v1/bookings",               requireAuth, bookingsRoutes);
app.use("/api/v1/clients",                requireAuth, clientsRouter);
app.use("/api/v1/dashboard",              requireAuth, dashboardRouter);
app.use("/api/v1/settings",               requireAuth, settingsRouter);
app.use("/api/v1/room-bookings",          requireAuth, roomBookingsRouter);
app.use("/api/v1/uploads",                requireAuth, uploadsRouter);
app.use("/api/v1/analytics/intelligence", requireAuth, analyticsIntelligenceRouter);
app.use("/api/v1/schedule/templates",     requireAuth, shiftTemplatesRouter);
app.use("/api/v1/export",                 requireAuth, exportsRouter);

// schedule (two routers, same prefix — order matters)
app.use("/api/v1/schedule", requireAuth, scheduleOverviewRouter);
app.use("/api/v1/schedule", requireAuth, scheduleShiftsRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SLOTIQ API listening on http://localhost:${PORT}`);
});
