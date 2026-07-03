import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { appointmentsApi } from '../../api';

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [appt, setAppt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) appointmentsApi.getById(id).then(setAppt).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }
  if (!appt) return (
    <div className="text-center py-20">
      <p className="text-[16px] text-charcoal">Appointment not found.</p>
    </div>
  );

  const preVisit = appt.preVisitSummary as any;
  const meds = appt.medicationReminders as any[];

  const urgencyBadge = (level: string) =>
    level === 'High' ? 'badge-red' : level === 'Medium' ? 'badge-yellow' : 'badge-green';

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Cloud header band ── */}
      <div style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-2xl mx-auto px-8 py-10">
          <h1 className="text-[32px] font-medium text-ink mb-6">Appointment Summary</h1>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Doctor', value: appt.doctor?.user?.name },
              { label: 'Specialisation', value: appt.doctor?.specialisation },
              { label: 'Date & Time', value: format(new Date(appt.slotStart), 'PPpp') },
              { label: 'Status', value: appt.status },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[13px] text-graphite uppercase tracking-wide font-semibold mb-1">
                  {item.label}
                </p>
                <p className="text-[16px] font-medium text-ink">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 space-y-5">
        {/* ── Post-visit summary ── */}
        {appt.postVisitSummary && (
          <div
            className="bg-canvas"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
          >
            <h2 className="text-[16px] font-semibold text-ink mb-3 uppercase tracking-wide">
              Doctor's Summary
            </h2>
            <p className="text-[15px] text-charcoal leading-relaxed whitespace-pre-wrap">
              {appt.postVisitSummary}
            </p>
          </div>
        )}

        {/* ── Medication reminders ── */}
        {meds && meds.length > 0 && (
          <div
            className="bg-canvas"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
          >
            <h2 className="text-[16px] font-semibold text-ink mb-4 uppercase tracking-wide">
              Medication Schedule
            </h2>
            <div className="space-y-3">
              {meds.map((med: any) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between"
                  style={{ padding: '12px 0', borderBottom: '1px solid #e8e8e8' }}
                >
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{med.drug}</p>
                    <p className="text-[13px] text-graphite mt-0.5">
                      {med.dose} · {med.frequencyPerDay}× daily · {med.remainingDays} days remaining
                    </p>
                  </div>
                  <span className={med.active ? 'badge-blue' : 'badge-slate'}>
                    {med.active ? 'Active' : 'Complete'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Pre-Visit Summary (ink slab) ── */}
        {preVisit && (
          <div
            className="bg-ink text-white"
            style={{ borderRadius: 16, padding: 24 }}
          >
            <h2 className="text-[16px] font-semibold mb-4 uppercase tracking-wide" style={{ color: '#c9e0fc' }}>
              AI Pre-Visit Summary
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[13px]" style={{ color: '#c2c2c2' }}>Urgency:</span>
                <span className={urgencyBadge(preVisit.urgencyLevel)}>
                  {preVisit.urgencyLevel}
                </span>
              </div>
              <div>
                <p className="text-[13px] mb-1" style={{ color: '#c2c2c2' }}>Chief Complaint</p>
                <p className="text-[15px] font-medium">{preVisit.chiefComplaint}</p>
              </div>
              {preVisit.suggestedQuestions?.length > 0 && (
                <div>
                  <p className="text-[13px] mb-2" style={{ color: '#c2c2c2' }}>
                    Suggested Questions for Doctor
                  </p>
                  <ul className="space-y-2">
                    {preVisit.suggestedQuestions.map((q: string, i: number) => (
                      <li key={i} className="flex gap-2 text-[14px]">
                        <span style={{ color: '#296ef9' }}>{i + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Reported symptoms ── */}
        {appt.symptomText && (
          <div
            className="bg-canvas"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
          >
            <h2 className="text-[16px] font-semibold text-ink mb-3 uppercase tracking-wide">
              Your Reported Symptoms
            </h2>
            <p className="text-[15px] text-charcoal leading-relaxed">{appt.symptomText}</p>
          </div>
        )}
      </div>
    </div>
  );
}


