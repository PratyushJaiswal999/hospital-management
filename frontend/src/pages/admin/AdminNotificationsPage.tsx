import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { adminApi } from '../../api';

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  SENT:      { bg: '#dcfce7', color: '#12a150' },
  PENDING:   { bg: '#fef3c7', color: '#d97706' },
  RETRYING:  { bg: '#dbeafe', color: '#024ad8' },
  FAILED:    { bg: '#fee2e2', color: '#b3262b' },
};

const TYPE_LABELS: Record<string, string> = {
  BOOKING_CONFIRM:    '✅ Booking Confirm',
  REMINDER:           '⏰ Reminder',
  CANCELLATION:       '❌ Cancellation',
  LEAVE_CONFLICT:     '⚠️ Leave Conflict',
  MEDICATION_REMINDER:'💊 Medication',
};

type NotifStatus = 'ALL' | 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';

interface Notification {
  id: string;
  type: string;
  status: string;
  channel: string;
  attempts: number;
  scheduledFor: string;
  sentAt?: string | null;
  lastError?: string | null;
  user: { id: string; email: string; name: string };
  appointment?: { id: string; slotStart: string } | null;
}

export function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<NotifStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const fetchNotifications = (status: NotifStatus, off: number) => {
    setLoading(true);
    adminApi
      .getNotifications({
        ...(status !== 'ALL' && { status }),
        limit: String(LIMIT),
        offset: String(off),
      })
      .then((data: { notifications: Notification[]; total: number }) => {
        setNotifications(data.notifications);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications(filter, offset);
  }, [filter, offset]);

  const handleFilter = (s: NotifStatus) => {
    setFilter(s);
    setOffset(0);
  };

  return (
    <div style={{ backgroundColor: '#f7f7f7', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e8e8e8' }}>
        <div className="max-w-6xl mx-auto px-8 py-10">
          <h1 className="text-[32px] font-medium text-ink mb-1">Notification Log</h1>
          <p className="text-[16px] text-graphite">
            {total} total notifications — view email delivery status and retry counts
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* ── Status filter pills ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          {(['ALL', 'PENDING', 'SENT', 'RETRYING', 'FAILED'] as NotifStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => handleFilter(s)}
              style={{
                padding: '8px 18px',
                borderRadius: 24,
                border: '1px solid',
                borderColor: filter === s ? '#1a1a1a' : '#e8e8e8',
                backgroundColor: filter === s ? '#1a1a1a' : '#ffffff',
                color: filter === s ? '#ffffff' : '#3d3d3d',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div
          className="bg-white"
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(26,26,26,0.08)', overflow: 'hidden' }}
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="spinner" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[16px] text-graphite">No notifications found for this filter.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e8e8e8', backgroundColor: '#f7f7f7' }}>
                    {['Type', 'Recipient', 'Status', 'Attempts', 'Scheduled', 'Sent At', 'Error'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#6b6b6b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n, i) => {
                    const style = STATUS_STYLES[n.status] ?? { bg: '#f3f4f6', color: '#6b6b6b' };
                    return (
                      <tr
                        key={n.id}
                        style={{
                          borderBottom: i < notifications.length - 1 ? '1px solid #e8e8e8' : 'none',
                          backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa',
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                          {TYPE_LABELS[n.type] ?? n.type}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#3d3d3d' }}>
                          <p style={{ fontWeight: 600 }}>{n.user.name}</p>
                          <p style={{ color: '#6b6b6b', fontSize: 12 }}>{n.user.email}</p>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 700,
                              backgroundColor: style.bg,
                              color: style.color,
                            }}
                          >
                            {n.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: '#3d3d3d', textAlign: 'center' }}>
                          {n.attempts}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#6b6b6b', whiteSpace: 'nowrap' }}>
                          {format(new Date(n.scheduledFor), 'MMM d, HH:mm')}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#6b6b6b', whiteSpace: 'nowrap' }}>
                          {n.sentAt ? format(new Date(n.sentAt), 'MMM d, HH:mm') : '—'}
                        </td>
                        <td
                          style={{
                            padding: '14px 16px',
                            fontSize: 12,
                            color: '#b3262b',
                            maxWidth: 180,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={n.lastError ?? ''}
                        >
                          {n.lastError ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {total > LIMIT && (
          <div className="flex items-center justify-between mt-5">
            <p className="text-[14px] text-graphite">
              Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="btn-outline"
                style={{ padding: '8px 18px', fontSize: 13 }}
              >
                ← Previous
              </button>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                className="btn-outline"
                style={{ padding: '8px 18px', fontSize: 13 }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
