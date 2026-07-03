import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api';

export function AdminDoctorLeavePage() {
  const { id } = useParams<{ id: string }>();
  const [doctorName, setDoctorName] = useState('');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!id) return;
    const docs = await adminApi.getDoctors();
    const doc = docs.find((d: any) => d.id === id);
    if (doc) {
      setDoctorName(doc.user?.name);
      setLeaves(doc.leaves ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !date) return;
    setAdding(true);
    try {
      const result = await adminApi.addLeave(id, { date, reason: reason || undefined });
      toast.success(
        `Leave added. ${result.cancelledAppointments} appointment(s) cancelled and patients notified.`,
      );
      setDate('');
      setReason('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add leave');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (leaveId: string) => {
    if (!id) return;
    if (!confirm('Remove this leave day?')) return;
    try {
      await adminApi.deleteLeave(id, leaveId);
      toast.success('Leave removed');
      load();
    } catch {
      toast.error('Failed to remove leave');
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
          <h1 className="text-[32px] font-medium text-ink">Manage Leave</h1>
          <p className="text-[16px] text-graphite mt-1">{doctorName}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-8 py-8 space-y-6">
        {/* ── Add leave form ── */}
        <form
          onSubmit={handleAdd}
          className="bg-canvas"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
        >
          <h2 className="text-[16px] font-semibold text-ink mb-4 uppercase tracking-wide">
            Add Leave Day
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Date</label>
              <input
                id="leave-date"
                type="date"
                className="input"
                value={date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Reason <span className="text-graphite font-normal">(optional)</span></label>
              <input
                className="input"
                placeholder="e.g. Personal leave"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div
              className="p-3 text-[13px] font-medium text-bloom-deep"
              style={{ backgroundColor: '#f9d4d2', borderRadius: 8 }}
            >
              ⚠ Adding leave will automatically cancel any existing appointments on that day and notify patients via email.
            </div>
            <button
              type="submit"
              disabled={adding || !date}
              className="btn-danger w-full"
            >
              {adding ? 'Adding Leave…' : 'Add Leave Day'}
            </button>
          </div>
        </form>

        {/* ── Existing leaves ── */}
        <div
          className="bg-canvas"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', padding: 24 }}
        >
          <h2 className="text-[16px] font-semibold text-ink mb-4 uppercase tracking-wide">
            Scheduled Leave Days ({leaves.length})
          </h2>
          {leaves.length === 0 ? (
            <p className="text-[14px] text-graphite">No leave days scheduled.</p>
          ) : (
            <div className="space-y-2">
              {leaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between"
                  style={{ padding: '12px 0', borderBottom: '1px solid #e8e8e8' }}
                >
                  <div>
                    <p className="text-[15px] font-medium text-ink">
                      {format(new Date(leave.date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    {leave.reason && <p className="text-[13px] text-graphite mt-0.5">{leave.reason}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(leave.id)}
                    className="btn-danger"
                    style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
