import { useState, useEffect } from 'react';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "hover:bg-fog text-ink" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
        borderRadius: '50%',
        transition: 'all 0.2s',
      }}
      className={className}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
