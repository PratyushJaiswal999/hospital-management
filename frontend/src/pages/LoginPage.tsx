import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── Hook: 3D Tilt Effect ──
function useTilt() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;
    const rotateX = -(y / (box.height / 2)) * 3; // Max RotateX 3 degrees
    const rotateY = (x / (box.width / 2)) * 3;   // Max RotateY 3 degrees
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  };

  const handleMouseEnter = () => {
    setHovered(true);
  };

  return { tilt, hovered, handleMouseMove, handleMouseLeave, handleMouseEnter };
}

// ── Component: Smooth requestAnimationFrame Counter ──
function Counter({ target, suffix = '', duration = 1200, delay = 600 }: { target: number; suffix?: string; duration?: number; delay?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        setCount(Math.floor(progress * target));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          setCount(target);
        }
      };
      window.requestAnimationFrame(step);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [target, duration, delay]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

// ── Component: Floating Input field with focus glow/animation ──
interface FloatingInputProps {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
}

function FloatingInput({ id, label, type, placeholder, value, onChange, required }: FloatingInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className={`block text-button-utility font-normal transition-colors duration-250 ${
          focused ? 'text-primary' : 'text-charcoal'
        }`}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="input transition-all duration-250"
        style={{
          height: 48,
          borderColor: focused ? '#024ad8' : '#c2c2c2',
          borderWidth: focused ? '2px' : '1px',
          boxShadow: focused ? '0 0 0 4px rgba(2, 74, 216, 0.12)' : 'none',
        }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
      />
    </div>
  );
}

// ── Component: Feature Card ──
interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  index: number;
  mounted: boolean;
}

function FeatureCard({ icon, title, description, index, mounted }: FeatureCardProps) {
  const { tilt, hovered, handleMouseMove, handleMouseLeave, handleMouseEnter } = useTilt();

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        transform: hovered 
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-8px) scale(1.03)`
          : `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(${mounted ? '0px' : '20px'}) scale(1)`,
        transition: hovered
          ? 'transform 0.1s ease-out, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease'
          : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease, border-color 0.5s ease, background-color 0.5s ease, opacity 0.5s ease',
        boxShadow: hovered
          ? '0 20px 25px -5px rgba(2, 74, 216, 0.08), 0 10px 10px -5px rgba(2, 74, 216, 0.04)'
          : '0 2px 8px rgba(26, 26, 26, 0.08)',
        opacity: mounted ? 1 : 0,
        transitionDelay: `${300 + index * 80}ms`,
      }}
      className={`relative bg-canvas p-6 rounded-xl border transition-all duration-300 ${
        hovered ? 'border-primary bg-primary-soft/5' : 'border-fog bg-canvas'
      }`}
    >
      {/* Top Accent Line */}
      <div
        className="absolute top-0 left-0 h-[3px] bg-primary transition-all duration-300"
        style={{ width: hovered ? '100%' : '0%' }}
      />
      {/* Icon */}
      <div
        className="w-14 h-14 bg-cloud flex items-center justify-center text-3xl mb-4 transition-transform duration-300"
        style={{
          transform: hovered ? 'rotate(5deg) scale(1.1)' : 'rotate(0deg) scale(1)',
          borderRadius: 12,
        }}
      >
        {icon}
      </div>
      <h3 
        className="text-tagline font-semibold mb-2 transition-colors duration-300"
        style={{ color: hovered ? '#024ad8' : '#1a1a1a' }}
      >
        {title}
      </h3>
      <p 
        className="text-caption leading-relaxed transition-all duration-300"
        style={{
          color: hovered ? '#1a1a1a' : '#636363',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0px)',
        }}
      >
        {description}
      </p>
    </div>
  );
}

import { useRef } from 'react';

// ── Component: Background Live Canvas Particle System ──
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = -Math.random() * 0.4 - 0.2; // Float slowly upwards
        this.radius = Math.random() * 8 + 3; // Float cells (3px to 11px)
        this.alpha = Math.random() * 0.18 + 0.04; // Very subtle transparency
        // Theme Colors: Green (#12a150) or Blue (#024ad8)
        this.color = Math.random() > 0.45 ? '2, 74, 216' : '18, 161, 80';
      }

      update(mouseX: number, mouseY: number) {
        this.x += this.vx;
        this.y += this.vy;

        // Reset if drifted offscreen
        if (this.y < -20) {
          this.y = height + 20;
          this.x = Math.random() * width;
        }
        if (this.x < -20 || this.x > width + 20) {
          this.x = Math.random() * width;
        }

        // Repel from mouse cursor
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const forceRadius = 140; // Area of effect

        if (distance < forceRadius) {
          const force = (forceRadius - distance) / forceRadius;
          const angle = Math.atan2(dy, dx);
          // Push cells away smoothly
          this.x += Math.cos(angle) * force * 3.5;
          this.y += Math.sin(angle) * force * 3.5;
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = `rgba(${this.color}, ${this.alpha})`;
        c.fill();
        c.restore();
      }
    }

    // Adjust particle density based on screen size
    const particleCount = Math.min(60, Math.floor((width * height) / 25000));
    const particles = Array.from({ length: particleCount }, () => new Particle());

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render and update each drifting cell
      particles.forEach((p) => {
        p.update(mouseX, mouseY);
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

// ── Component: Background decorations & layout wrappers ──
function BackgroundDecorations() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Interactive canvas particles */}
      <ParticleBackground />

      {/* Radial soft glow */}
      <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-primary/5 rounded-full filter blur-[100px] opacity-[0.04]" />
      <div className="absolute -bottom-60 -left-60 w-[500px] h-[500px] bg-primary/5 rounded-full filter blur-[100px] opacity-[0.04]" />

      {/* Floating HP-like chevrons */}
      <svg
        className="absolute top-[15%] right-[10%] w-32 h-32 text-primary opacity-[0.03]"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <polygon points="15,0 100,0 85,100 0,100" />
      </svg>
      <svg
        className="absolute bottom-[10%] left-[8%] w-40 h-40 text-primary opacity-[0.03]"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <polygon points="15,0 100,0 85,100 0,100" />
      </svg>

      {/* Medical Cross line-art */}
      <svg
        className="absolute top-[60%] right-[5%] w-16 h-16 text-primary opacity-[0.03]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Entrance animations trigger
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const heroWords = "Healthcare Appointment Manager".split(" ");
  const subheadingText = "Smart appointment scheduling, seamless doctor coordination, and AI-powered patient care.";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-canvas relative overflow-hidden select-none font-sans">
      <BackgroundDecorations />

      {/* ── Left panel: Login form ── */}
      <div className="w-full lg:w-[42%] xl:w-[38%] flex items-center justify-center px-8 sm:px-16 py-16 relative z-10">
        <div
          className={`w-full max-w-md transition-all duration-500 transform ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
          style={{ transitionDelay: '0ms' }}
        >
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 mb-10 transition-transform duration-300 hover:scale-[1.02] w-fit"
          >
            <div
              className="w-10 h-10 bg-primary flex items-center justify-center"
              style={{ borderRadius: 2 }}
            >
              <span className="text-white font-bold text-2xl leading-none">+</span>
            </div>
            <span className="font-bold text-[24px] text-ink tracking-tight">HealthCare</span>
          </Link>

          <h1 className="text-display-md text-ink leading-tight mb-2">Sign in</h1>
          <p className="text-body-apple text-graphite mb-8">Welcome back to your account.</p>

          {/* Demo credentials info card */}
          <div
            className="mb-8 p-5 border-l-4 border-primary transition-all duration-350 hover:shadow-soft-lift hover:-translate-y-0.5 rounded-r-xl"
            style={{
              backgroundColor: '#f7f7f7',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[18px]">🔑</span>
              <p className="text-[12px] font-bold text-charcoal uppercase tracking-wider">
                Demo credentials
              </p>
            </div>
            <div className="space-y-2 text-[13px] text-graphite">
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-60">🛡️</span>
                <span>
                  <strong className="text-ink font-semibold">Admin:</strong> admin@healthcare.local / Admin@1234
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-60">👨‍⚕️</span>
                <span>
                  <strong className="text-ink font-semibold">Doctor:</strong> dr.sharma@healthcare.local / Doctor@1234
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-60">🧑</span>
                <span>
                  <strong className="text-ink font-semibold">Patient:</strong> patient@healthcare.local / Patient@1234
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FloatingInput
              id="email"
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(val) => setForm((prev) => ({ ...prev, email: val }))}
              required
            />
            <FloatingInput
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(val) => setForm((prev) => ({ ...prev, password: val }))}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-login w-full mt-4"
              style={{ height: 48 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-caption text-graphite text-center">
            New patient?{' '}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="hidden lg:flex w-[1px] relative items-center justify-center bg-gradient-to-b from-transparent via-fog to-transparent my-16 z-10">
        <div
          className="absolute w-2.5 h-6 bg-primary transform -rotate-12 rounded-xs opacity-90 shadow-sm"
          style={{ transition: 'transform 0.3s ease' }}
        />
      </div>

      {/* ── Right panel: Hero + Features + Stats ── */}
      <div className="w-full lg:flex-1 bg-cloud relative px-8 sm:px-16 py-16 flex flex-col justify-center overflow-hidden z-10">

        <div className="max-w-4xl mx-auto w-full relative z-10 space-y-12">
          {/* Hero composition */}
          <div>
            {/* Larger icon with floating animation */}
            <div 
              className={`mb-6 w-fit relative group transition-all duration-700 transform ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
              style={{ transitionDelay: '50ms' }}
            >
              <div className="absolute inset-0 bg-primary/20 rounded-2xl filter blur-xl group-hover:scale-125 transition-transform duration-300 opacity-70" />
              <div
                className="w-20 h-20 bg-primary flex items-center justify-center shadow-lg relative z-10 transition-transform duration-300 group-hover:scale-110 animate-float"
                style={{ borderRadius: 16 }}
              >
                <span className="text-white text-4xl">🏥</span>
              </div>
            </div>

            {/* Word-by-word staggered entrance headline */}
            <h2 className="text-hero-display text-ink leading-tight mb-4 flex flex-wrap">
              {heroWords.map((word, idx) => (
                <span
                  key={idx}
                  className="inline-block mr-3 transition-all duration-700 transform"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0)' : 'translateY(15px)',
                    transitionDelay: `${120 + idx * 80}ms`,
                  }}
                >
                  {word}
                </span>
              ))}
            </h2>

            {/* Staggered subtitle */}
            <p
              className="text-lead text-graphite leading-relaxed max-w-2xl transition-all duration-1000 transform"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(10px)',
                transitionDelay: '460ms',
              }}
            >
              {subheadingText}
            </p>
          </div>

          {/* Features cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon="🧑"
              title="Patients"
              description="Book appointments in real-time, view summaries, sync to Google Calendar, and stay on top of prescriptions."
              index={0}
              mounted={mounted}
            />
            <FeatureCard
              icon="👨‍⚕️"
              title="Doctors"
              description="Access AI-generated pre-visit summaries, structure clinical notes, write prescriptions, and manage slots."
              index={1}
              mounted={mounted}
            />
            <FeatureCard
              icon="🛡️"
              title="Admins"
              description="Configure doctor profiles, manage leaves, and overview active patient appointments in a clean control center."
              index={2}
              mounted={mounted}
            />
          </div>

          {/* Statistics section */}
          <div
            className={`pt-8 border-t border-fog transition-all duration-700 transform ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
            style={{ transitionDelay: '540ms' }}
          >
            <div className="grid grid-cols-3 gap-6 text-center md:text-left">
              {[
                { target: 250, suffix: '+', label: 'Doctors', delay: 700 },
                { target: 12000, suffix: '+', label: 'Appointments', delay: 850 },
                { target: 98, suffix: '%', label: 'Patient Satisfaction', delay: 1000 },
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[32px] font-bold text-primary leading-none tracking-tight">
                    <Counter target={stat.target} suffix={stat.suffix} delay={stat.delay} />
                  </p>
                  <p className="text-caption text-graphite uppercase tracking-wider font-semibold">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
