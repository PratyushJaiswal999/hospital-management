import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../api';

const STATUS_BADGE: Record<string, string> = {
  HELD: 'badge-yellow',
  CONFIRMED: 'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
  RESCHEDULED: 'badge-slate',
};

const URGENCY_BADGE: Record<string, string> = {
  High: 'badge-red',
  Medium: 'badge-yellow',
  Low: 'badge-green',
};

export function DoctorSchedulePage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  const load = async (date: string) => {
    setLoading(true);
    try {
      const data = await appointmentsApi.doctorView(date);
      setAppointments(data);
    } catch {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(selectedDate); }, [selectedDate]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment? The patient will be notified.')) return;
    try {
      await appointmentsApi.cancel(id);
      toast.success('Appointment cancelled');
      load(selectedDate);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Cancel failed');
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Cloud header band ── */}
      <div style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-4xl mx-auto px-8 py-10">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-[44px] font-medium text-ink leading-none">My Schedule</h1>
              <p className="text-[16px] text-graphite mt-2">
                View today's appointments and patient pre-visit summaries.
              </p>
            </div>
            {/* Date picker */}
            <div className="flex items-center gap-3">
              <input
                id="schedule-date"
                type="date"
                className="input"
                style={{ width: 180 }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className="btn-secondary"
                style={{ height: 44 }}
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Appointment list ── */}
      <div className="max-w-4xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[20px] font-medium text-charcoal mb-2">No appointments</p>
            <p className="text-[16px] text-graphite">No appointments scheduled for this date.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appt) => {
              const preVisit = appt.preVisitSummary as any;
              return (
                <div
                  key={appt.id}
                  className="bg-canvas flex items-start gap-5"
                  style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
                >
                  {/* Time block */}
                  <div
                    className="flex-shrink-0 bg-cloud flex flex-col items-center justify-center"
                    style={{ width: 64, height: 64, borderRadius: 8 }}
                  >
                    <span className="text-[20px] font-medium text-ink leading-none">
                      {format(new Date(appt.slotStart), 'HH:mm')}
                    </span>
                    <span className="text-[11px] text-graphite uppercase tracking-wide mt-0.5">
                      {format(new Date(appt.slotStart), 'EEE')}
                    </span>
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[16px] font-semibold text-ink">
                        {appt.patient?.name}
                      </span>
                      <span className={STATUS_BADGE[appt.status] || 'badge-slate'}>
                        {appt.status}
                      </span>
                    </div>
                    <p className="text-[13px] text-graphite">{appt.patient?.email}</p>

                    {/* AI urgency */}
                    {preVisit && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[12px] text-graphite uppercase tracking-wide font-semibold">
                          AI Urgency:
                        </span>
                        <span className={URGENCY_BADGE[preVisit.urgencyLevel] || 'badge-slate'}>
                          {preVisit.urgencyLevel}
                        </span>
                        <span className="text-[13px] text-graphite italic">
                          {preVisit.chiefComplaint}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Link
                      to={`/doctor/appointments/${appt.id}`}
                      className="btn-primary"
                      style={{ height: 40, padding: '0 18px', fontSize: 13 }}
                    >
                      Open
                    </Link>
                    {['HELD', 'CONFIRMED'].includes(appt.status) && (
                      <button
                        onClick={() => handleCancel(appt.id)}
                        className="btn-danger"
                        style={{ height: 40, padding: '0 14px', fontSize: 13 }}
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


