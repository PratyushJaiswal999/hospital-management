import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { appointmentsApi, doctorsApi } from '../../api';

export function ReschedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [appt, setAppt] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  });
  const [slots, setSlots] = useState<{ slotStart: string; slotEnd: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load current appointment
  useEffect(() => {
    if (id) {
      appointmentsApi.getById(id).then(setAppt).catch(() => {
        toast.error('Appointment not found');
        navigate('/patient/appointments');
      });
    }
  }, [id]);

  // Load available slots when date or appointment changes
  useEffect(() => {
    if (!appt || !selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    doctorsApi
      .availability(appt.doctorId, selectedDate)
      .then((data: { slots: { slotStart: string; slotEnd: string }[] }) => {
        setSlots(data.slots);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [appt, selectedDate]);

  const handleReschedule = async () => {
    if (!id || !selectedSlot) return;
    setSubmitting(true);
    try {
      await appointmentsApi.reschedule(id, selectedSlot);
      toast.success('Appointment rescheduled! Check your email for confirmation.');
      navigate('/patient/appointments');
    } catch (err: any) {
      if (err.response?.data?.code === 'SLOT_CONFLICT') {
        toast.error('That slot is no longer available. Please pick another.');
        // Refresh slots
        doctorsApi.availability(appt.doctorId, selectedDate).then((data: any) => setSlots(data.slots));
        setSelectedSlot(null);
      } else {
        toast.error(err.response?.data?.error || 'Reschedule failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-xl mx-auto px-8 py-10">
          <h1 className="text-[32px] font-medium text-ink mb-2">Reschedule Appointment</h1>
          {appt && (
            <p className="text-[16px] text-graphite">
              Currently booked with{' '}
              <strong>{appt.doctor?.user?.name}</strong> on{' '}
              {format(new Date(appt.slotStart), 'PPpp')}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-8 py-8 space-y-5">
        {/* ── Date picker ── */}
        <div
          className="bg-canvas"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
        >
          <h2 className="text-[16px] font-semibold text-ink mb-4 uppercase tracking-wide">
            Select a New Date
          </h2>
          <input
            type="date"
            className="input"
            style={{ borderRadius: 4 }}
            value={selectedDate}
            min={minDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* ── Slot picker ── */}
        <div
          className="bg-canvas"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
        >
          <h2 className="text-[16px] font-semibold text-ink mb-4 uppercase tracking-wide">
            Available Slots
          </h2>

          {loadingSlots ? (
            <div className="flex justify-center py-8">
              <div className="spinner" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-[15px] text-graphite">
              No slots available on this date. Try another day.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const isSelected = selectedSlot === slot.slotStart;
                return (
                  <button
                    key={slot.slotStart}
                    onClick={() => setSelectedSlot(slot.slotStart)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: isSelected ? '#024ad8' : '#e8e8e8',
                      backgroundColor: isSelected ? '#024ad8' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#1a1a1a',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'center',
                    }}
                  >
                    {format(new Date(slot.slotStart), 'HH:mm')}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="flex gap-3">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => navigate('/patient/appointments')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={!selectedSlot || submitting}
            onClick={handleReschedule}
          >
            {submitting ? 'Rescheduling…' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
