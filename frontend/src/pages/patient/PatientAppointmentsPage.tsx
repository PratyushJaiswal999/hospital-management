import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../api';

// HP-palette status badge classes mapped to index.css status badges
const STATUS_BADGE: Record<string, string> = {
  HELD: 'badge-held',
  CONFIRMED: 'badge-confirmed',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
  RESCHEDULED: 'badge-rescheduled',
};

// Curated high-resolution Unsplash doctor profile photos (Real healthcare portals style)
const avatarImages: Record<string, string> = {
  'Dr. Priya Sharma': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&h=150&q=80',
  'Dr. Rohan Mehta': 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&h=150&q=80',
  'Dr. Utkarsh Mishra': 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=150&h=150&q=80',
};

export function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await appointmentsApi.mine();
      // Sort appointments:
      // - Upcoming (HELD, CONFIRMED) first, chronologically ascending
      // - Past/Cancelled (COMPLETED, CANCELLED, RESCHEDULED) next, chronologically descending
      const sorted = [...data].sort((a, b) => {
        const aUpcoming = ['HELD', 'CONFIRMED'].includes(a.status);
        const bUpcoming = ['HELD', 'CONFIRMED'].includes(b.status);
        
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;

        const aTime = new Date(a.slotStart).getTime();
        const bTime = new Date(b.slotStart).getTime();

        if (aUpcoming) {
          return aTime - bTime; // Ascending for upcoming
        } else {
          return bTime - aTime; // Descending for past
        }
      });
      setAppointments(sorted);
    } catch {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await appointmentsApi.cancel(id);
      toast.success('Appointment cancelled');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Cancel failed');
    }
  };

  const getAvatarUrl = (name: string, index: number) => {
    if (avatarImages[name]) return avatarImages[name];
    const fallbacks = [
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&w=150&h=150&q=80',
    ];
    return fallbacks[index % fallbacks.length];
  };

  // Filters logic
  const filteredAppointments = appointments.filter((appt) => {
    if (activeTab === 'UPCOMING') {
      return ['HELD', 'CONFIRMED'].includes(appt.status);
    }
    if (activeTab === 'COMPLETED') {
      return appt.status === 'COMPLETED';
    }
    if (activeTab === 'CANCELLED') {
      return ['CANCELLED', 'RESCHEDULED'].includes(appt.status);
    }
    return true; // ALL
  });

  return (
    <div className="doctor-search-page-bg">
      {/* ── Header band ── */}
      <div className="doctor-search-hero">
        <div className="max-w-4xl mx-auto px-8 py-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[44px] font-medium text-ink leading-none">My Appointments</h1>
            <p className="text-[16px] text-graphite mt-2">
              {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''} filtered
            </p>
          </div>
          <Link
            to="/patient/search"
            className="btn-primary flex items-center gap-1.5"
            style={{ borderRadius: 9999, height: 46 }}
          >
            <span className="text-[18px]">+</span>
            <span>Book New</span>
          </Link>
        </div>
      </div>

      {/* ── Appointments list ── */}
      <div className="max-w-4xl mx-auto px-8 py-8">
        
        {/* Navigation Tabs */}
        {appointments.length > 0 && (
          <div className="flex border-b mb-6" style={{ borderColor: 'var(--color-fog)' }}>
            {(['ALL', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as const).map((tab) => {
              const isSelected = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="text-[14px] font-semibold transition-all pb-3 px-4 relative -mb-[1px]"
                  style={{
                    color: isSelected ? 'var(--color-ink)' : 'var(--color-graphite)',
                    borderBottom: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                  }}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          /* Premium Loading Skeletons */
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-6 border flex items-center gap-5"
                style={{
                  borderRadius: 20,
                  backgroundColor: 'var(--color-cloud)',
                  borderColor: 'var(--color-fog)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl bg-steel/20 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-steel/20 rounded w-1/4" />
                  <div className="h-4 bg-steel/20 rounded w-1/3" />
                  <div className="h-3 bg-steel/20 rounded w-1/2" />
                </div>
                <div className="w-16 h-8 bg-steel/20 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          /* Premium Empty State */
          <div
            className="text-center py-16 px-8 border"
            style={{
              borderRadius: 20,
              backgroundColor: 'var(--color-cloud)',
              borderColor: 'var(--color-fog)',
            }}
          >
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[20px] font-bold text-ink mb-2">No Appointments</p>
            <p className="text-[15px] text-graphite mb-6 max-w-sm mx-auto">
              {activeTab === 'ALL'
                ? "You haven't scheduled any healthcare appointments yet. Find a specialist and book your first slot."
                : `You don't have any appointments classified as "${activeTab.toLowerCase()}".`}
            </p>
            <Link
              to="/patient/search"
              className="btn-primary inline-flex items-center gap-1.5"
              style={{ borderRadius: 9999, height: 44 }}
            >
              <span>Find a Doctor</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appt, idx) => {
              const avatarUrl = getAvatarUrl(appt.doctor?.user?.name, idx);
              return (
                <div
                  key={appt.id}
                  className="doctor-card flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-350"
                  style={{
                    borderRadius: 20,
                    padding: 24,
                  }}
                >
                  {/* Left Column: Doctor Profile + Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={avatarUrl}
                      alt={appt.doctor?.user?.name}
                      className="w-14 h-14 flex-shrink-0 object-cover relative overflow-hidden shadow-inner border"
                      style={{
                        borderRadius: 14,
                        borderColor: 'var(--color-fog)',
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                        <h3 className="text-[18px] font-bold text-ink truncate leading-tight">
                          {appt.doctor?.user?.name}
                        </h3>
                        <span className={STATUS_BADGE[appt.status] || 'badge-slate'}>
                          {appt.status}
                        </span>
                      </div>
                      <p className="text-[13px] font-bold text-graphite uppercase tracking-wide">
                        {appt.doctor?.specialisation}
                      </p>
                      {/* High-contrast Date display */}
                      <p className="text-[13px] text-ink font-semibold mt-1">
                        📅 {format(new Date(appt.slotStart), 'PPpp')}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 md:flex-shrink-0">
                    {/* View Detail */}
                    <Link
                      to={`/patient/appointments/${appt.id}`}
                      className="doctor-card-btn flex items-center justify-center"
                      style={{
                        height: 38,
                        padding: '0 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 9999,
                      }}
                    >
                      View
                    </Link>

                    {/* Reschedule — only for CONFIRMED */}
                    {appt.status === 'CONFIRMED' && (
                      <button
                        onClick={() => navigate(`/patient/appointments/${appt.id}/reschedule`)}
                        className="doctor-card-btn"
                        style={{
                          height: 38,
                          padding: '0 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 9999,
                        }}
                      >
                        Reschedule
                      </button>
                    )}

                    {/* Cancel — HELD or CONFIRMED */}
                    {['HELD', 'CONFIRMED'].includes(appt.status) && (
                      <button
                        onClick={() => handleCancel(appt.id)}
                        className="btn-danger"
                        style={{
                          height: 38,
                          padding: '0 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 9999,
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
