import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./helpers/AuthContext";
import { ToastProvider } from "./helpers/ToastContext";
import { ClientAuthProvider } from "./helpers/ClientAuthContext";
import { PrivateRoute, RoleRoute } from "./auth/RouteGuards";
import LoginPage from "./auth/LoginPage";

import AppLayout from "./business-panel/AppLayout";

import Dashboard from "./business-panel/Dashboard";
import Branches from "./business-panel/Branches";
import Employees from "./business-panel/Employees";
import Services from "./business-panel/Services";
import Rooms from "./business-panel/Rooms";
import Schedule from "./business-panel/Schedule";
import ScheduleRoom from "./business-panel/ScheduleRoom";
import Bookings from "./business-panel/Bookings";
import BookingsRoom from "./business-panel/BookingsRoom";
import { useSettings } from "./helpers/SettingsContext";
import Clients from "./business-panel/Clients";
import Analytics from "./business-panel/AnalyticsIntelligence";
import Settings from "./business-panel/Settings";
import BookingFlow from "./client-widget/BookingFlow";
import MyCabinet from "./client-widget/MyCabinet";

// Role policy
const R = {
  any:     ["owner", "admin", "employee"],
  manager: ["owner", "admin"],
  owner:   ["owner"],
};

function BookingsRouter() {
  const { bookingType } = useSettings();
  return bookingType === "room" ? <BookingsRoom /> : <Bookings />;
}

function ScheduleRouter() {
  const { bookingType } = useSettings();
  return bookingType === "room" ? <ScheduleRoom /> : <Schedule />;
}

export default function App() {
  return (
    <ToastProvider>
    <ClientAuthProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — client widget */}
          <Route path="/booking" element={<BookingFlow />} />
          <Route path="/me"      element={<MyCabinet />} />
          <Route path="/login"   element={<LoginPage />} />

          {/* Authenticated admin layout */}
          <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<RoleRoute roles={R.any}><Dashboard /></RoleRoute>} />
            <Route path="/branches"  element={<RoleRoute roles={R.owner}><Branches  /></RoleRoute>} />
            <Route path="/employees" element={<RoleRoute roles={R.manager}><Employees /></RoleRoute>} />
            <Route path="/services"  element={<RoleRoute roles={R.manager}><Services  /></RoleRoute>} />
            <Route path="/rooms"     element={<RoleRoute roles={R.manager}><Rooms     /></RoleRoute>} />
            <Route path="/schedule"  element={<RoleRoute roles={R.any}><ScheduleRouter /></RoleRoute>} />
            <Route path="/bookings"  element={<RoleRoute roles={R.any}><BookingsRouter /></RoleRoute>} />
            <Route path="/clients"   element={<RoleRoute roles={R.manager}><Clients  /></RoleRoute>} />
            <Route path="/analytics" element={<RoleRoute roles={R.manager}><Analytics /></RoleRoute>} />
            <Route path="/settings"  element={<RoleRoute roles={R.owner}><Settings /></RoleRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ClientAuthProvider>
    </ToastProvider>
  );
}
