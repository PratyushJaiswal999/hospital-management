import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Navbar } from './components/Navbar';

// Auth pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// Patient pages
import { PatientSearchPage } from './pages/patient/PatientSearchPage';
import { DoctorSlotsPage } from './pages/patient/DoctorSlotsPage';
import { BookAppointmentPage } from './pages/patient/BookAppointmentPage';
import { PatientAppointmentsPage } from './pages/patient/PatientAppointmentsPage';
import { AppointmentDetailPage } from './pages/patient/AppointmentDetailPage';
import { ReschedulePage } from './pages/patient/ReschedulePage';

// Doctor pages
import { DoctorSchedulePage } from './pages/doctor/DoctorSchedulePage';
import { DoctorAppointmentPage } from './pages/doctor/DoctorAppointmentPage';

// Admin pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminDoctorsPage } from './pages/admin/AdminDoctorsPage';
import { AdminDoctorEditPage } from './pages/admin/AdminDoctorEditPage';
import { AdminDoctorLeavePage } from './pages/admin/AdminDoctorLeavePage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';

import { ThemeToggle } from './components/ThemeToggle';

function AppInner() {
  const { user } = useAuth();

  const defaultRedirect =
    user?.role === 'ADMIN'
      ? '/admin'
      : user?.role === 'DOCTOR'
      ? '/doctor/schedule'
      : '/patient/search';

  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/register';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Global Theme Toggle for Auth Pages (Login/Register) */}
      {isAuthPage && (
        <div style={{ position: 'absolute', top: '24px', right: '32px', zIndex: 9999 }}>
          <ThemeToggle />
        </div>
      )}
      {user && !isAuthPage && <Navbar />}
      <main style={{ flex: 1 }}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
          <Route path="/google-connected" element={<Navigate to={defaultRedirect} replace />} />

          {/* Patient */}
          <Route element={<PrivateRoute allowedRoles={['PATIENT']} />}>
            <Route path="/patient/search" element={<PatientSearchPage />} />
            <Route path="/patient/doctor/:id" element={<DoctorSlotsPage />} />
            <Route path="/patient/book/:appointmentId" element={<BookAppointmentPage />} />
            <Route path="/patient/appointments" element={<PatientAppointmentsPage />} />
            <Route path="/patient/appointments/:id" element={<AppointmentDetailPage />} />
            <Route path="/patient/appointments/:id/reschedule" element={<ReschedulePage />} />
          </Route>

          {/* Doctor */}
          <Route element={<PrivateRoute allowedRoles={['DOCTOR']} />}>
            <Route path="/doctor/schedule" element={<DoctorSchedulePage />} />
            <Route path="/doctor/appointments/:id" element={<DoctorAppointmentPage />} />
          </Route>

          {/* Admin */}
          <Route element={<PrivateRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/doctors" element={<AdminDoctorsPage />} />
            <Route path="/admin/doctors/:id/edit" element={<AdminDoctorEditPage />} />
            <Route path="/admin/doctors/:id/leave" element={<AdminDoctorLeavePage />} />
            <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* HP-styled toast: white, ink text, fog border, 4px radius */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#1a1a1a',
            border: '1px solid #e8e8e8',
            borderRadius: '4px',
            fontFamily: 'SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif',
            fontSize: '14px',
            boxShadow: '0 8px 24px rgba(26, 26, 26, 0.12)',
          },
          success: {
            iconTheme: { primary: '#024ad8', secondary: '#ffffff' },
          },
          error: {
            iconTheme: { primary: '#ff5050', secondary: '#ffffff' },
          },
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </AuthProvider>
  );
}
