import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { appointmentsApi, type PrescriptionItem } from '../../api';

export function DoctorAppointmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [appt, setAppt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [doctorNotes, setDoctorNotes] = useState('');
  const [prescription, setPrescription] = useState<PrescriptionItem[]>([]);

  useEffect(() => {
    if (id) appointmentsApi.getById(id).then(setAppt).finally(() => setLoading(false));
  }, [id]);

  const addMed = () => setPrescription([...prescription, { drug: '', dose: '', frequency: 'once daily', durationDays: 7 }]);
  const removeMed = (i: number) => setPrescription(prescription.filter((_, idx) => idx !== i));
  const updateMed = (i: number, field: keyof PrescriptionItem, value: string | number) => {
    setPrescription(prescription.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || doctorNotes.length < 5) return;
    setSubmitting(true);
    try {
      await appointmentsApi.submitNotes(id, { doctorNotes, prescription });
      toast.success('Notes saved! Post-visit summary being generated…');
      navigate('/doctor/schedule');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save notes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="spinner" />
    </div>
  );
  if (!appt) return (
    <div className="text-center py-20">
      <p className="text-[16px] text-charcoal">Appointment not found.</p>
    </div>
  );

  const preVisit = appt.preVisitSummary as any;

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Cloud header ── */}
      <div style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-3xl mx-auto px-8 py-10">
          <h1 className="text-[32px] font-medium text-ink mb-5">Patient Appointment</h1>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Patient', value: appt.patient?.name },
              { label: 'Email', value: appt.patient?.email },
              { label: 'Time', value: format(new Date(appt.slotStart), 'PPpp') },
              { label: 'Status', value: appt.status },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[13px] text-graphite uppercase tracking-wide font-semibold mb-1">
                  {item.label}
                </p>
                <p className="text-[15px] font-medium text-ink">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8 space-y-5">
        {/* ── AI Pre-visit summary (ink slab) ── */}
        {preVisit && (
          <div
            className="bg-ink text-white"
            style={{ borderRadius: 16, padding: 24 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[16px] font-semibold uppercase tracking-wide" style={{ color: '#c9e0fc' }}>
                AI Pre-Visit Summary
              </h2>
              {preVisit.generationFailed && (
                <span className="badge-red text-[11px]">Generation failed</span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] mb-1" style={{ color: '#c2c2c2' }}>Urgency Level</p>
                <span className={
                  preVisit.urgencyLevel === 'High' ? 'badge-red' :
                  preVisit.urgencyLevel === 'Medium' ? 'badge-yellow' : 'badge-green'
                }>
                  {preVisit.urgencyLevel}
                </span>
              </div>
              <div>
                <p className="text-[12px] mb-1" style={{ color: '#c2c2c2' }}>Chief Complaint</p>
                <p className="text-[14px]">{preVisit.chiefComplaint}</p>
              </div>
            </div>
            {preVisit.suggestedQuestions?.length > 0 && (
              <div className="mt-4">
                <p className="text-[12px] mb-2" style={{ color: '#c2c2c2' }}>Suggested Questions</p>
                <ul className="space-y-1.5">
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
        )}

        {/* ── Patient symptoms ── */}
        {appt.symptomText && (
          <div
            className="bg-canvas"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
          >
            <h2 className="text-[16px] font-semibold text-ink mb-3 uppercase tracking-wide">
              Patient's Reported Symptoms
            </h2>
            <p className="text-[15px] text-charcoal leading-relaxed whitespace-pre-wrap">
              {appt.symptomText}
            </p>
          </div>
        )}

        {/* ── Notes form — only if CONFIRMED ── */}
        {appt.status === 'CONFIRMED' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Clinical Notes */}
            <div
              className="bg-canvas"
              style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
            >
              <h2 className="text-[16px] font-semibold text-ink mb-3 uppercase tracking-wide">
                Clinical Notes
              </h2>
              <textarea
                id="doctor-notes"
                className="input"
                style={{ height: 160, borderRadius: 4 }}
                placeholder="Write your clinical notes, diagnosis, and recommendations…"
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                required
                minLength={5}
              />
            </div>

            {/* Prescription */}
            <div
              className="bg-canvas"
              style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold text-ink uppercase tracking-wide">
                  Prescription
                </h2>
                <button type="button" onClick={addMed} className="btn-outline" style={{ height: 36, padding: '0 14px', fontSize: 13 }}>
                  + Add Medication
                </button>
              </div>

              {prescription.length === 0 && (
                <p className="text-[14px] text-graphite">
                  No medications added. Click "+ Add Medication" to prescribe.
                </p>
              )}

              <div className="space-y-3">
                {prescription.map((med, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                    style={{ padding: '12px', backgroundColor: '#f7f7f7', borderRadius: 8 }}
                  >
                    <div>
                      <label className="label">Drug</label>
                      <input className="input" placeholder="Paracetamol" value={med.drug}
                        onChange={(e) => updateMed(i, 'drug', e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Dose</label>
                      <input className="input" placeholder="500mg" value={med.dose}
                        onChange={(e) => updateMed(i, 'dose', e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Frequency</label>
                      <select className="input" value={med.frequency}
                        onChange={(e) => updateMed(i, 'frequency', e.target.value)}>
                        <option value="once daily">Once daily</option>
                        <option value="twice daily">Twice daily</option>
                        <option value="three times daily">Three times daily</option>
                        <option value="four times daily">Four times daily</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Duration (days)</label>
                      <div className="flex gap-1">
                        <input type="number" className="input" min={1} value={med.durationDays}
                          onChange={(e) => updateMed(i, 'durationDays', parseInt(e.target.value))} required />
                        <button type="button" onClick={() => removeMed(i)}
                          className="btn-danger" style={{ height: 44, padding: '0 12px', minWidth: 44 }}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || doctorNotes.length < 5}
              className="btn-ink w-full"
              style={{ height: 52, fontSize: 16 }}
            >
              {submitting ? 'Saving Notes…' : 'Complete Appointment & Generate Summary'}
            </button>
          </form>
        )}

        {/* ── Show existing notes if COMPLETED ── */}
        {appt.status === 'COMPLETED' && appt.doctorNotes && (
          <div
            className="bg-canvas"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
          >
            <h2 className="text-[16px] font-semibold text-ink mb-3 uppercase tracking-wide">
              Your Notes (Submitted)
            </h2>
            <p className="text-[15px] text-charcoal">{appt.doctorNotes}</p>
            {appt.postVisitSummary && (
              <div className="mt-5" style={{ paddingTop: 16, borderTop: '1px solid #e8e8e8' }}>
                <h3 className="text-[14px] font-semibold text-primary mb-2 uppercase tracking-wide">
                  AI Post-Visit Summary (sent to patient)
                </h3>
                <p className="text-[14px] text-charcoal whitespace-pre-wrap">{appt.postVisitSummary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
