import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleConnectCalendar = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await api.get('/auth/me');
      const latestToken = localStorage.getItem('accessToken');
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/auth/google?token=${latestToken}`;
    } catch (err) {
      console.error('Failed to sync token before redirecting to Google Calendar connection:', err);
      const fallbackToken = localStorage.getItem('accessToken');
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/auth/google?token=${fallbackToken}`;
    }
  };

  const homeLink =
    user?.role === 'ADMIN'
      ? '/admin'
      : user?.role === 'DOCTOR'
      ? '/doctor/schedule'
      : '/patient/search';

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `relative text-[16px] font-semibold transition-colors pb-1 ${
      isActive(path)
        ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:content-[""]'
        : 'text-charcoal hover:text-ink'
    }`;

  return (
    <header className="sticky top-0 z-50">
      {/* ── Utility Strip (36px dark ink bar) ── */}
      <div className="bg-ink text-white" style={{ height: 36 }}>
        <div className="max-w-7xl mx-auto h-full px-8 flex items-center justify-between">
          <span className="text-[13px] text-steel">
            Healthcare Appointment Manager
          </span>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-steel">
              {user?.name}
            </span>
            {user && !user.googleCalendarConnected && (
              <button
                onClick={handleConnectCalendar}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-white text-[12px] font-bold transition-all duration-150 hover:bg-primary-active active:scale-95 flex-shrink-0"
                style={{ borderRadius: 9999 }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>Connect Calendar</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-[13px] text-steel hover:text-white transition-colors"
            >
              Sign out
            </button>
            <ThemeToggle className="hover:bg-white/10 text-white p-1 ml-1" />
          </div>
        </div>
      </div>

      {/* ── Top Nav Bar (64px white bar) ── */}
      <nav
        className="bg-canvas border-b border-fog"
        style={{ height: 64 }}
      >
        <div className="max-w-7xl mx-auto h-full px-8 flex items-center justify-between">
          {/* Logo */}
          <Link to={homeLink} className="flex items-center gap-2 flex-shrink-0">
            {/* HP-style cross/plus wordmark */}
            <div className="w-8 h-8 bg-primary flex items-center justify-center" style={{ borderRadius: 2 }}>
              <span className="text-white font-bold text-lg leading-none">+</span>
            </div>
            <span className="font-bold text-[18px] text-ink tracking-tight">HealthCare</span>
          </Link>

          {/* Role-based nav links */}
          <div className="flex items-center gap-8">
            {user?.role === 'PATIENT' && (
              <>
                <Link to="/patient/search" className={navLinkClass('/patient/search')}>
                  Find Doctors
                </Link>
                <Link to="/patient/appointments" className={navLinkClass('/patient/appointments')}>
                  My Appointments
                </Link>
              </>
            )}
            {user?.role === 'DOCTOR' && (
              <Link to="/doctor/schedule" className={navLinkClass('/doctor/schedule')}>
                My Schedule
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/admin" className={navLinkClass('/admin')}>
                  Dashboard
                </Link>
                <Link to="/admin/doctors" className={navLinkClass('/admin/doctors')}>
                  Doctors
                </Link>
                <Link to="/admin/notifications" className={navLinkClass('/admin/notifications')}>
                  Notifications
                </Link>
              </>
            )}
          </div>

          {/* Right: role pill */}
          <div className="flex items-center gap-3">
            <span
              className="text-[12px] font-semibold uppercase tracking-wide px-3 py-1"
              style={{
                borderRadius: 9999,
                backgroundColor: 'var(--color-cloud)',
                color: 'var(--color-graphite)',
              }}
            >
              {user?.role}
            </span>
          </div>
        </div>
      </nav>
    </header>
  );
}
