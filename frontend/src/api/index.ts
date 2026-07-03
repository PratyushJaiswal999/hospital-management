import { api } from '../context/AuthContext';

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ── Doctors ────────────────────────────────────────────────────────────────
export const doctorsApi = {
  search: (params?: { specialisation?: string; name?: string }) =>
    api.get('/doctors', { params }).then((r) => r.data),
  getById: (id: string) => api.get(`/doctors/${id}`).then((r) => r.data),
  availability: (id: string, date: string) =>
    api.get(`/doctors/${id}/availability`, { params: { date } }).then((r) => r.data),
};

// ── Appointments ───────────────────────────────────────────────────────────
export const appointmentsApi = {
  hold: (data: { doctorId: string; slotStart: string; idempotencyKey?: string }) =>
    api.post('/appointments/hold', data).then((r) => r.data),
  confirm: (id: string, symptomText: string) =>
    api.post(`/appointments/${id}/confirm`, { symptomText }).then((r) => r.data),
  cancel: (id: string) => api.post(`/appointments/${id}/cancel`).then((r) => r.data),
  reschedule: (id: string, newSlotStart: string) =>
    api.post(`/appointments/${id}/reschedule`, { newSlotStart }).then((r) => r.data),
  mine: () => api.get('/appointments/mine').then((r) => r.data),
  doctorView: (date?: string) =>
    api.get('/appointments/doctor-view', { params: date ? { date } : {} }).then((r) => r.data),
  getById: (id: string) => api.get(`/appointments/${id}`).then((r) => r.data),
  submitNotes: (
    id: string,
    data: { doctorNotes: string; prescription: PrescriptionItem[] },
  ) => api.post(`/appointments/${id}/notes`, data).then((r) => r.data),
};

// ── Admin ──────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: () => api.get('/admin/stats').then((r) => r.data),
  triggerReminders: () => api.post('/admin/trigger-reminders').then((r) => r.data),
  getDoctors: () => api.get('/admin/doctors').then((r) => r.data),
  createDoctor: (data: CreateDoctorPayload) =>
    api.post('/admin/doctors', data).then((r) => r.data),
  updateDoctor: (id: string, data: Partial<CreateDoctorPayload>) =>
    api.patch(`/admin/doctors/${id}`, data).then((r) => r.data),
  deleteDoctor: (id: string) =>
    api.delete(`/admin/doctors/${id}`).then((r) => r.data),
  addLeave: (doctorId: string, data: { date: string; reason?: string }) =>
    api.post(`/admin/doctors/${doctorId}/leave`, data).then((r) => r.data),
  deleteLeave: (doctorId: string, leaveId: string) =>
    api.delete(`/admin/doctors/${doctorId}/leave/${leaveId}`).then((r) => r.data),
  getNotifications: (params?: { status?: string; limit?: string; offset?: string }) =>
    api.get('/notifications', { params }).then((r) => r.data),
};

// ── Types ──────────────────────────────────────────────────────────────────
export interface PrescriptionItem {
  drug: string;
  dose: string;
  frequency: string;
  durationDays: number;
}

export interface CreateDoctorPayload {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  specialisation: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes?: number;
  workingDays?: number[];
}
