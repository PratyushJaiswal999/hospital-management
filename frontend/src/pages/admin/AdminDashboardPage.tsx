import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../../api';

interface Stats {
  doctors: number;
  patients: number;
  appointments: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#12a150',
  COMPLETED: '#024ad8',
  CANCELLED: '#b3262b',
  HELD: '#d97706',
  RESCHEDULED: '#6366f1',
};

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const handleTriggerReminders = async () => {
    setTriggering(true);
    try {
      await adminApi.triggerReminders();
      toast.success('All active reminders triggered! Emails are being dispatched.');
    } catch {
      toast.error('Failed to trigger reminders');
    } finally {
      setTriggering(false);
    }
  };

  const totalAppointments = stats
    ? Object.values(stats.appointments).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div style={{ backgroundColor: '#f7f7f7', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-5xl mx-auto px-8 py-10 flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-medium text-ink mb-1">Admin Dashboard</h1>
            <p className="text-[16px] text-graphite">System overview and quick links</p>
          </div>
          <button
            onClick={handleTriggerReminders}
            disabled={triggering}
            className="btn-primary"
            style={{ height: 44 }}
          >
            {triggering ? 'Triggering...' : '⏰ Force Run Reminders'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* ── Top stats row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              {[
                { label: 'Doctors', value: stats?.doctors ?? 0, color: '#024ad8', icon: '👨‍⚕️' },
                { label: 'Patients', value: stats?.patients ?? 0, color: '#12a150', icon: '🧑' },
                { label: 'Total Appointments', value: totalAppointments, color: '#6366f1', icon: '📅' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-white"
                  style={{
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: '0 2px 8px rgba(26,26,26,0.08)',
                    borderLeft: `4px solid ${card.color}`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span style={{ fontSize: 28 }}>{card.icon}</span>
                    <p className="text-[13px] text-graphite uppercase tracking-wide font-semibold">
                      {card.label}
                    </p>
                  </div>
                  <p className="text-[40px] font-bold text-ink">{card.value}</p>
                </div>
              ))}
            </div>

            {/* ── Appointment breakdown ── */}
            <div
              className="bg-white mb-8"
              style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}
            >
              <h2 className="text-[16px] font-semibold text-ink mb-5 uppercase tracking-wide">
                Appointments by Status
              </h2>
              {stats && Object.keys(stats.appointments).length === 0 ? (
                <p className="text-[15px] text-graphite">No appointments yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {stats &&
                    Object.entries(stats.appointments).map(([status, count]) => (
                      <div
                        key={status}
                        style={{
                          padding: '16px 20px',
                          borderRadius: 12,
                          backgroundColor: '#f7f7f7',
                          borderLeft: `3px solid ${STATUS_COLORS[status] ?? '#888'}`,
                        }}
                      >
                        <p
                          className="text-[12px] font-semibold uppercase tracking-wider mb-1"
                          style={{ color: STATUS_COLORS[status] ?? '#888' }}
                        >
                          {status}
                        </p>
                        <p className="text-[28px] font-bold text-ink">{count}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* ── Quick links ── */}
            <div
              className="bg-white"
              style={{ borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}
            >
              <h2 className="text-[16px] font-semibold text-ink mb-5 uppercase tracking-wide">
                Quick Links
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { to: '/admin/doctors', label: '👨‍⚕️ Manage Doctors', desc: 'Add, edit, or remove doctor profiles' },
                  { to: '/admin/notifications', label: '📬 Notification Log', desc: 'View sent, pending, and failed emails' },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    style={{
                      display: 'block',
                      padding: '16px 20px',
                      borderRadius: 12,
                      backgroundColor: '#f7f7f7',
                      border: '1px solid #e8e8e8',
                      textDecoration: 'none',
                      transition: 'box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(26,26,26,0.15)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.boxShadow = 'none')
                    }
                  >
                    <p className="text-[15px] font-semibold text-ink mb-1">{link.label}</p>
                    <p className="text-[13px] text-graphite">{link.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
