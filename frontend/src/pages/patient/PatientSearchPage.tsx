import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doctorsApi } from '../../api';

interface Doctor {
  id: string;
  specialisation: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  slotDurationMinutes: number;
  user: { name: string; email: string };
}

// Curated high-resolution Unsplash doctor profile photos (Real healthcare portals style)
const avatarImages: Record<string, string> = {
  'Dr. Priya Sharma': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&h=150&q=80',
  'Dr. Rohan Mehta': 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&h=150&q=80',
  'Dr. Utkarsh Mishra': 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=150&h=150&q=80',
};

// Specialty badge color-coding styles (Distinct, subtle colors per specialty)
const getSpecialtyBadgeStyle = (spec: string) => {
  const cleanSpec = spec.toLowerCase();
  if (cleanSpec.includes('cardio')) {
    return {
      bg: 'rgba(239, 68, 68, 0.08)',
      text: '#f87171', // Brighter red for accessibility in dark, clear in light
      textLight: '#ef4444',
      border: 'rgba(239, 68, 68, 0.18)',
    };
  } else if (cleanSpec.includes('general') || cleanSpec.includes('medicine')) {
    return {
      bg: 'rgba(59, 130, 246, 0.08)',
      text: '#60a5fa', // Brighter blue
      textLight: '#3b82f6',
      border: 'rgba(59, 130, 246, 0.18)',
    };
  } else if (cleanSpec.includes('gyne') || cleanSpec.includes('gynae')) {
    return {
      bg: 'rgba(168, 85, 247, 0.08)',
      text: '#c084fc', // Brighter purple
      textLight: '#a855f7',
      border: 'rgba(168, 85, 247, 0.18)',
    };
  } else {
    return {
      bg: 'rgba(107, 114, 128, 0.08)',
      text: '#a1a1aa',
      textLight: '#6b7280',
      border: 'rgba(107, 114, 128, 0.18)',
    };
  }
};

export function PatientSearchPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDoctors = async (q?: string) => {
    setLoading(true);
    try {
      const data = await doctorsApi.search(q ? { specialisation: q } : {});
      setDoctors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDoctors(search);
  };

  // Filter out dummy doctor entries named 'hh' or with specialisation 'hh'
  const cleanDoctors = doctors.filter(
    (d) => d.specialisation.toLowerCase() !== 'hh' && d.user.name.toLowerCase() !== 'hh'
  );

  const specialisations = [...new Set(cleanDoctors.map((d) => d.specialisation))];

  const handleFilterClick = (s: string) => {
    if (activeFilter === s) {
      setActiveFilter('');
      setSearch('');
      fetchDoctors();
    } else {
      setActiveFilter(s);
      setSearch(s);
      fetchDoctors(s);
    }
  };

  const getAvatarUrl = (name: string, index: number) => {
    if (avatarImages[name]) return avatarImages[name];
    const fallbacks = [
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&w=150&h=150&q=80',
    ];
    return fallbacks[index % fallbacks.length];
  };

  return (
    <div className="doctor-search-page-bg">
      {/* ── Hero band (custom premium gradient background) ── */}
      <div className="doctor-search-hero">
        <div className="max-w-6xl mx-auto px-8 py-12">
          <h1 className="text-[44px] font-medium text-ink leading-none mb-2">
            Find a Doctor
          </h1>
          <p className="text-[16px] text-graphite mb-8">
            Search by specialisation and book an appointment instantly.
          </p>

          {/* Pill search bar */}
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
            <div className="flex-1 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-graphite">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                id="doctor-search"
                type="text"
                className="input w-full pr-12"
                style={{ borderRadius: 9999, height: 52, paddingLeft: 44 }}
                placeholder="Search by specialisation (e.g. Cardiology)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-primary flex-shrink-0"
              style={{ borderRadius: 9999, height: 52, padding: '0 28px' }}
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                className="btn-secondary flex-shrink-0"
                style={{ borderRadius: 9999, height: 52 }}
                onClick={() => {
                  setSearch('');
                  setActiveFilter('');
                  fetchDoctors();
                }}
              >
                Clear
              </button>
            )}
          </form>

          {/* Specialisation filter chips */}
          {specialisations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {specialisations.map((s) => {
                const isSelected = activeFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleFilterClick(s)}
                    className="text-[14px] font-medium transition-all px-[18px] py-[6px] rounded-full border"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-canvas)',
                      color: isSelected ? '#ffffff' : 'var(--color-graphite)',
                      borderColor: isSelected ? 'var(--color-primary-active)' : 'var(--color-fog)',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      <div className="max-w-6xl mx-auto px-8 py-10">
        {loading ? (
          /* Premium Loading Skeletons */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-6 border"
                style={{
                  borderRadius: 20,
                  backgroundColor: 'var(--color-cloud)',
                  borderColor: 'var(--color-fog)',
                }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-steel/20 flex-shrink-0" />
                  <div className="flex-1 space-y-2 mt-2">
                    <div className="h-4 bg-steel/20 rounded w-1/3" />
                    <div className="h-5 bg-steel/20 rounded w-3/4" />
                    <div className="h-4 bg-steel/20 rounded w-1/2" />
                  </div>
                </div>
                <div
                  className="grid grid-cols-2 gap-4 py-4 my-4 border-t border-b"
                  style={{ borderColor: 'var(--color-fog)' }}
                >
                  <div className="space-y-1">
                    <div className="h-3 bg-steel/20 rounded w-1/2" />
                    <div className="h-4 bg-steel/20 rounded w-4/5" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-steel/20 rounded w-1/2" />
                    <div className="h-4 bg-steel/20 rounded w-4/5" />
                  </div>
                </div>
                <div className="h-10 bg-steel/20 rounded-full w-full mt-4" />
              </div>
            ))}
          </div>
        ) : cleanDoctors.length === 0 ? (
          /* Premium Empty State */
          <div
            className="text-center py-16 px-8 border"
            style={{
              borderRadius: 20,
              backgroundColor: 'var(--color-cloud)',
              borderColor: 'var(--color-fog)',
            }}
          >
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[20px] font-bold text-ink mb-2">No Doctors Found</p>
            <p className="text-[15px] text-graphite mb-6 max-w-md mx-auto">
              We couldn't find any doctors matching "{search || activeFilter}". Try searching for another specialisation like Cardiology or General Medicine.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setActiveFilter('');
                fetchDoctors();
              }}
              className="btn-primary"
              style={{ borderRadius: 9999, height: 44, padding: '0 24px' }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <p className="text-[14px] text-graphite mb-6 uppercase tracking-wide font-semibold">
              {cleanDoctors.length} doctor{cleanDoctors.length !== 1 ? 's' : ''} available
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cleanDoctors.map((doc, idx) => {
                // Generate deterministic mock rating/reviews for visual richness
                const code0 = doc.id.charCodeAt(0) || 65;
                const codeLast = doc.id.charCodeAt(doc.id.length - 1) || 90;
                const rating = (4.5 + (code0 % 5) * 0.1).toFixed(1);
                const reviews = (codeLast % 40) + 12;

                const avatarUrl = getAvatarUrl(doc.user.name, idx);
                const badgeStyle = getSpecialtyBadgeStyle(doc.specialisation);

                return (
                  <div
                    key={doc.id}
                    className="doctor-card flex flex-col relative overflow-hidden"
                    style={{
                      borderRadius: 20,
                      padding: 24,
                    }}
                  >
                    {/* Top Right Available Badge */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-bold tracking-wider uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Available
                    </div>

                    {/* Doctor avatar + info */}
                    <div className="flex items-start gap-4 mb-3.5">
                      <img
                        src={avatarUrl}
                        alt={doc.user.name}
                        className="w-16 h-16 flex-shrink-0 object-cover relative overflow-hidden shadow-inner border"
                        style={{
                          borderRadius: 16,
                          borderColor: 'var(--color-fog)',
                        }}
                      />
                      <div className="flex-1 min-w-0 pr-16">
                        {/* Custom specialty badge coloring */}
                        <span
                          className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md inline-block mb-1 border"
                          style={{
                            backgroundColor: badgeStyle.bg,
                            color: document.documentElement.classList.contains('dark') ? badgeStyle.text : badgeStyle.textLight,
                            borderColor: badgeStyle.border,
                          }}
                        >
                          {doc.specialisation}
                        </span>
                        <h3 className="text-[19px] font-bold text-ink leading-snug truncate">
                          {doc.user.name}
                        </h3>
                        <div className="flex items-center gap-1 mt-1 text-[13px]">
                          <span className="text-amber-500 font-bold">★</span>
                          <span className="font-semibold text-charcoal">{rating}</span>
                          <span className="text-graphite">({reviews} reviews)</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Metadata Block - High contrast labels */}
                    <div
                      className="grid grid-cols-2 gap-4 py-3.5 my-4 border-t border-b text-[13px]"
                      style={{
                        borderColor: 'var(--color-fog)',
                      }}
                    >
                      <div>
                        <span className="block text-[11px] uppercase tracking-wider font-bold text-charcoal mb-1">
                          Working Hours
                        </span>
                        <span className="font-semibold text-ink block truncate">
                          🕒 {doc.workingHoursStart} – {doc.workingHoursEnd}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] uppercase tracking-wider font-bold text-charcoal mb-1">
                          Consultation
                        </span>
                        <span className="font-semibold text-ink block truncate">
                          ⏱️ {doc.slotDurationMinutes} mins
                        </span>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="mt-auto pt-2">
                      <Link
                        to={`/patient/doctor/${doc.id}`}
                        className="doctor-card-btn w-full flex items-center justify-center gap-2 group transition-all duration-350"
                        style={{
                          borderRadius: 9999,
                          height: 48,
                          fontWeight: 600,
                          fontSize: 15,
                        }}
                      >
                        <span>Book Appointment</span>
                        <svg
                          className="w-4 h-4 transform transition-transform duration-200 group-hover:translate-x-1"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
