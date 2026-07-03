import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { doctorsApi, appointmentsApi } from '../../api';
import { v4 as uuidv4 } from 'uuid';

interface Slot {
  slotStart: string;
  slotEnd: string;
}

interface Doctor {
  id: string;
  specialisation: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes: number;
  user: { name: string };
}

function genKey() { return uuidv4(); }

export function DoctorSlotsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);

  useEffect(() => {
    if (id) doctorsApi.getById(id).then(setDoctor).catch(console.error);
  }, [id]);

  const loadSlots = async (date: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await doctorsApi.availability(id, date);
      setSlots(data.slots);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSlots(selectedDate); }, [selectedDate]);

  const handleBook = async (slot: Slot) => {
    if (!id) return;
    setBooking(slot.slotStart);
    const idempotencyKey = genKey();
    try {
      const result = await appointmentsApi.hold({
        doctorId: id,
        slotStart: slot.slotStart,
        idempotencyKey,
      });
      toast.success('Slot held for 5 minutes — complete your booking!');
      navigate(`/patient/book/${result.appointment.id}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error('Slot just got booked! Refreshing available slots…');
        await loadSlots(selectedDate);
      } else {
        toast.error(err.response?.data?.error || 'Booking failed');
      }
    } finally {
      setBooking(null);
    }
  };

  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Doctor header (cloud feature card) ── */}
      {doctor && (
        <div style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #e8e8e8' }}>
          <div className="max-w-4xl mx-auto px-8 py-10">
            <div className="flex items-center gap-6">
              <div
                className="w-16 h-16 bg-ink flex items-center justify-center text-3xl flex-shrink-0"
                style={{ borderRadius: 12 }}
              >
                👨‍⚕️
              </div>
              <div>
                <h1 className="text-[32px] font-medium text-ink leading-none">
                  {doctor.user.name}
                </h1>
                <p className="text-[16px] font-semibold text-primary mt-1">{doctor.specialisation}</p>
                <p className="text-[14px] text-graphite mt-1">
                  {doctor.workingHoursStart} – {doctor.workingHoursEnd} &nbsp;·&nbsp; {doctor.slotDurationMinutes} min slots
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* ── Date picker row ── */}
        <h2 className="text-[20px] font-medium text-ink mb-4">Select a date</h2>
        <div className="flex gap-2 overflow-x-auto pb-3 mb-8">
          {dates.map((d) => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className="flex-shrink-0 flex flex-col items-center transition-all"
                style={{
                  minWidth: 60,
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: isSelected ? '#1a1a1a' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#1a1a1a',
                  border: `1px solid ${isSelected ? '#1a1a1a' : '#e8e8e8'}`,
                }}
              >
                <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                  {format(d, 'EEE')}
                </span>
                <span className="text-[20px] font-medium leading-tight">{format(d, 'd')}</span>
                <span className="text-[11px] opacity-70">{format(d, 'MMM')}</span>
              </button>
            );
          })}
        </div>

        {/* ── Slots grid ── */}
        <div
          className="bg-canvas"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[20px] font-medium text-ink">
              Available slots — {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')}
            </h2>
            {slots.length > 0 && (
              <span className="badge-pill">{slots.length} available</span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="spinner" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[16px] text-charcoal font-medium">No available slots</p>
              <p className="text-[14px] text-graphite mt-1">Try selecting a different date.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {slots.map((slot) => {
                const isBooked = booking === slot.slotStart;
                return (
                  <button
                    key={slot.slotStart}
                    onClick={() => handleBook(slot)}
                    disabled={!!booking}
                    className="transition-all font-medium text-[14px]"
                    style={{
                      padding: '10px 8px',
                      borderRadius: 4,
                      backgroundColor: isBooked ? '#024ad8' : '#f7f7f7',
                      color: isBooked ? '#ffffff' : '#1a1a1a',
                      border: `1px solid ${isBooked ? '#024ad8' : '#e8e8e8'}`,
                      cursor: !!booking ? 'wait' : 'pointer',
                    }}
                  >
                    {format(new Date(slot.slotStart), 'HH:mm')}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[13px] text-graphite mt-4 text-center">
          Slots update in real-time. If a slot disappears after clicking, it was just booked.
        </p>
      </div>
    </div>
  );
}

