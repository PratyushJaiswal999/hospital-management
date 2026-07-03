import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';



export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.phone || undefined);
      toast.success('Account created!');
      navigate('/patient/search');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-canvas)' }}>
      {/* ── Left panel: white form ── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 max-w-xl">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div
              className="w-9 h-9 bg-primary flex items-center justify-center"
              style={{ borderRadius: 2 }}
            >
              <span className="text-white font-bold text-xl leading-none">+</span>
            </div>
            <span className="font-bold text-[22px] text-ink tracking-tight">HealthCare</span>
          </Link>

          <h1 className="text-[32px] font-medium text-ink leading-none mb-2">
            Create account
          </h1>
          <p className="text-[16px] text-graphite mb-8">
            Register as a new patient.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="label" htmlFor="reg-email">Email address</label>
              <input
                id="reg-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone <span className="text-graphite font-normal">(optional)</span></label>
              <input
                id="phone"
                type="tel"
                className="input"
                placeholder="+1 555 0100"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className="input"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
              style={{ height: 48 }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-[14px] text-graphite text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:text-primary-deep">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right panel: cloud band with chevron decoration ── */}
      <div
        className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#f7f7f7' }}
      >
        {/* Angular HP blue chevron (left edge) */}
        <div
          className="absolute left-0 top-0 bottom-0 w-16 bg-primary"
          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 75% 100%, 0% 100%)' }}
        />
        {/* Content */}
        <div className="relative z-10 text-center px-16">
          <div
            className="w-20 h-20 bg-primary mx-auto flex items-center justify-center mb-6"
            style={{ borderRadius: 16 }}
          >
            <span className="text-white text-4xl">🩺</span>
          </div>
          <h2 className="text-[28px] font-medium text-ink leading-tight mb-4">
            Join thousands of<br />patients managing<br />their health
          </h2>
          <p className="text-[15px] text-graphite leading-relaxed max-w-xs mx-auto">
            Get instant access to top specialists, book in minutes, and receive AI-powered health insights.
          </p>
          <div className="mt-10 space-y-3">
            {[
              '✓ Instant appointment booking',
              '✓ AI pre-visit summaries',
              '✓ Medication reminders',
              '✓ Google Calendar sync',
            ].map((item) => (
              <p key={item} className="text-[14px] font-medium text-charcoal text-left">{item}</p>
            ))}
          </div>
        </div>
        {/* Angular HP blue chevron (right edge) */}
        <div
          className="absolute right-0 top-0 bottom-0 w-16 bg-primary"
          style={{ clipPath: 'polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
        />
      </div>
    </div>
  );
}

