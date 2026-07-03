import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface PrivateRouteProps {
  allowedRoles?: ('PATIENT' | 'DOCTOR' | 'ADMIN')[];
}

export function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to role-appropriate dashboard
    if (user.role === 'ADMIN') return <Navigate to="/admin/doctors" replace />;
    if (user.role === 'DOCTOR') return <Navigate to="/doctor/schedule" replace />;
    return <Navigate to="/patient/search" replace />;
  }

  return <Outlet />;
}
