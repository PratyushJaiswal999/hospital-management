import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../api';

export function BookAppointmentPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [appt, setAppt] = useState<any>(null);
  const [symptomText, setSymptomText] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (appointmentId) {
      appointmentsApi.getById(appointmentId).then((data) => {
        setAppt(data);
        if (data.holdExpiresAt) {
          const ms = new Date(data.holdExpiresAt).getTime() - Date.now();
          setTimeLeft(Math.max(0, Math.floor(ms / 1000)));
        }
      }).catch(() => {
        toast.error('Appointment not found or hold expired');
        navigate('/patient/search');
      });
    }
  }, [appointmentId]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null || t <= 1) {
          clearInterval(interval);
          toast.error('Hold expired — please select a new slot');
          navigate(`/patient/doctor/${appt?.doctorId}`);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) return;
    if (symptomText.length < 10) {
      toast.error('Please describe your symptoms in more detail (min 10 characters)');
      return;
    }
    setLoading(true);
    try {
      await appointmentsApi.confirm(appointmentId, symptomText);
      toast.success('Appointment confirmed! Check your email for confirmation.');
      navigate('/patient/appointments');
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.code === 'HOLD_EXPIRED') {
        toast.error('Hold expired — please select a new slot');
        navigate('/patient/search');
      } else {
        toast.error(err.response?.data?.error || 'Confirmation failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const mins = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const secs = timeLeft !== null ? timeLeft % 60 : 0;
  const isExpiringSoon = timeLeft !== null && timeLeft < 60;

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Timer banner ── */}
      {timeLeft !== null && timeLeft > 0 && (
        <div
          style={{
            backgroundColor: isExpiringSoon ? '#ff5050' : '#f7f7f7',
            borderBottom: `1px solid ${isExpiringSoon ? '#b3262b' : '#e8e8e8'}`,
            padding: '10px 32px',
          }}
        >
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <span
              className="text-[14px] font-semibold"
              style={{ color: isExpiringSoon ? '#ffffff' : '#3d3d3d' }}
            >
              Slot reserved for:
            </span>
            <span
              className="font-mono text-[20px] font-bold"
              style={{ color: isExpiringSoon ? '#ffffff' : '#1a1a1a' }}
            >
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-8 py-10">
        <h1 className="text-[32px] font-medium text-ink mb-2">Complete Your Booking</h1>
        <p className="text-[16px] text-graphite mb-8">
          Describe your symptoms so your doctor can prepare.
        </p>

        {/* ── Appointment info card ── */}
        {appt && (
          <div
            className="bg-canvas mb-6"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
          >
            <h2 className="text-[16px] font-semibold text-ink mb-4 uppercase tracking-wide">
              Appointment Details
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Doctor', value: appt.doctor?.user?.name },
                { label: 'Specialisation', value: appt.doctor?.specialisation },
                { label: 'Date & Time', value: appt.slotStart ? format(new Date(appt.slotStart), 'PPpp') : '—' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center"
                  style={{ paddingBottom: 12, borderBottom: '1px solid #e8e8e8' }}
                >
                  <span className="text-[14px] text-graphite">{row.label}</span>
                  <span className="text-[14px] font-medium text-ink">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Symptom form ── */}
        <form
          onSubmit={handleConfirm}
          className="bg-canvas"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
        >
          <h2 className="text-[16px] font-semibold text-ink mb-1">Describe Your Symptoms</h2>
          <p className="text-[13px] text-graphite mb-4">
            This will be used to generate an AI pre-visit summary for your doctor.
          </p>
          <textarea
            id="symptom-text"
            className="input"
            style={{ height: 160, borderRadius: 4 }}
            placeholder="Describe your symptoms in detail (e.g. I have had a persistent headache for 3 days…)"
            value={symptomText}
            onChange={(e) => setSymptomText(e.target.value)}
            required
            minLength={10}
          />
          <p className="text-[12px] text-graphite mt-1 mb-5">
            {symptomText.length} characters (minimum 10)
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || symptomText.length < 10}
              className="btn-primary flex-1"
            >
              {loading ? 'Confirming…' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

