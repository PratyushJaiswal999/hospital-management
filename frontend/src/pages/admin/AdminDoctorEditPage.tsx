import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../../api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AdminDoctorEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    specialisation: '',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    slotDurationMinutes: 30,
    workingDays: [1, 2, 3, 4, 5] as number[],
  });

  useEffect(() => {
    if (!id) return;
    adminApi.getDoctors().then((docs) => {
      const doc = docs.find((d: any) => d.id === id);
      if (doc) {
        setForm({
          name: doc.user?.name || '',
          specialisation: doc.specialisation,
          workingHoursStart: doc.workingHoursStart,
          workingHoursEnd: doc.workingHoursEnd,
          slotDurationMinutes: doc.slotDurationMinutes,
          workingDays: doc.workingDays ?? [1, 2, 3, 4, 5],
        });
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const toggleDay = (day: number) => {
    setForm({
      ...form,
      workingDays: form.workingDays.includes(day)
        ? form.workingDays.filter((d) => d !== day)
        : [...form.workingDays, day].sort(),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await adminApi.updateDoctor(id, form);
      toast.success('Doctor updated!');
      navigate('/admin/doctors');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Cloud header ── */}
      <div style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-xl mx-auto px-8 py-10">
          <h1 className="text-[32px] font-medium text-ink">Edit Doctor Profile</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-8 py-8">
        <form
          onSubmit={handleSave}
          className="bg-canvas space-y-5"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
        >
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Specialisation</label>
            <input className="input" required value={form.specialisation}
              onChange={(e) => setForm({ ...form, specialisation: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={form.workingHoursStart}
                onChange={(e) => setForm({ ...form, workingHoursStart: e.target.value })} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={form.workingHoursEnd}
                onChange={(e) => setForm({ ...form, workingHoursEnd: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Slot Duration (minutes)</label>
            <input type="number" className="input" min={5} max={120} value={form.slotDurationMinutes}
              onChange={(e) => setForm({ ...form, slotDurationMinutes: parseInt(e.target.value) })} />
          </div>
          <div>
            <label className="label">Working Days</label>
            <div className="flex gap-2 flex-wrap mt-2">
              {DAYS.map((d, i) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(i)}
                  className="font-medium text-[14px] transition-all"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 4,
                    backgroundColor: form.workingDays.includes(i) ? '#1a1a1a' : '#ffffff',
                    color: form.workingDays.includes(i) ? '#ffffff' : '#1a1a1a',
                    border: `1px solid ${form.workingDays.includes(i) ? '#1a1a1a' : '#c2c2c2'}`,
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/admin/doctors')}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
