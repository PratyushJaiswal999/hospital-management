import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi, type CreateDoctorPayload } from '../../api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateDoctorPayload>({
    name: '',
    email: '',
    password: 'Doctor@1234',
    specialisation: '',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    slotDurationMinutes: 30,
    workingDays: [1, 2, 3, 4, 5],
  });

  const load = async () => {
    try {
      const data = await adminApi.getDoctors();
      setDoctors(data);
    } catch {
      toast.error('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDay = (day: number) => {
    const days = form.workingDays ?? [];
    setForm({
      ...form,
      workingDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort(),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminApi.createDoctor(form);
      toast.success('Doctor created!');
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create doctor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doctor? All appointments and schedule data will be permanently removed.')) return;
    try {
      await adminApi.deleteDoctor(id);
      toast.success('Doctor deleted');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete doctor');
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* ── Header band ── */}
      <div style={{ backgroundColor: '#f7f7f7', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-5xl mx-auto px-8 py-10 flex items-end justify-between">
          <div>
            <h1 className="text-[44px] font-medium text-ink leading-none">Manage Doctors</h1>
            <p className="text-[16px] text-graphite mt-2">{doctors.length} registered</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={showForm ? 'btn-secondary' : 'btn-primary'}
          >
            {showForm ? 'Cancel' : '+ Add Doctor'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* ── Create Doctor Form ── */}
        {showForm && (
          <div
            className="bg-canvas mb-8"
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
          >
            <h2 className="text-[18px] font-semibold text-ink mb-5">New Doctor</h2>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Password (Temporary)</label>
                  <input type="text" className="input" required value={form.password || ''}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div>
                  <label className="label">Specialisation</label>
                  <input className="input" required value={form.specialisation}
                    onChange={(e) => setForm({ ...form, specialisation: e.target.value })} />
                </div>
                <div>
                  <label className="label">Slot Duration (minutes)</label>
                  <input type="number" className="input" min={5} max={120} value={form.slotDurationMinutes}
                    onChange={(e) => setForm({ ...form, slotDurationMinutes: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Working Hours Start</label>
                  <input type="time" className="input" value={form.workingHoursStart}
                    onChange={(e) => setForm({ ...form, workingHoursStart: e.target.value })} />
                </div>
                <div>
                  <label className="label">Working Hours End</label>
                  <input type="time" className="input" value={form.workingHoursEnd}
                    onChange={(e) => setForm({ ...form, workingHoursEnd: e.target.value })} />
                </div>
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
                        backgroundColor: form.workingDays?.includes(i) ? '#1a1a1a' : '#ffffff',
                        color: form.workingDays?.includes(i) ? '#ffffff' : '#1a1a1a',
                        border: `1px solid ${form.workingDays?.includes(i) ? '#1a1a1a' : '#c2c2c2'}`,
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating…' : 'Create Doctor'}
              </button>
            </form>
          </div>
        )}

        {/* ── Doctors list ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map((doc) => (
              <div
                key={doc.id}
                className="bg-canvas flex items-center gap-5"
                style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
              >
                <div
                  className="w-12 h-12 bg-ink flex items-center justify-center text-xl flex-shrink-0"
                  style={{ borderRadius: 10 }}
                >
                  👨‍⚕️
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-semibold text-ink">{doc.user?.name}</h3>
                  <p className="text-[14px] font-semibold text-primary">{doc.specialisation}</p>
                  <p className="text-[13px] text-graphite mt-1">
                    {doc.workingHoursStart}–{doc.workingHoursEnd} · {doc.slotDurationMinutes} min slots ·{' '}
                    {(doc.workingDays ?? []).map((d: number) => DAYS[d]).join(', ')}
                  </p>
                  {doc.leaves?.length > 0 && (
                    <p className="text-[12px] text-bloom-coral mt-1 font-medium">
                      ⚠ {doc.leaves.length} leave day(s) scheduled
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    to={`/admin/doctors/${doc.id}/edit`}
                    className="btn-outline"
                    style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                  >
                    Edit
                  </Link>
                  <Link
                    to={`/admin/doctors/${doc.id}/leave`}
                    className="btn-secondary"
                    style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                  >
                    Leave
                  </Link>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="btn-danger"
                    style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
