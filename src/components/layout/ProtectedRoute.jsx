import { Navigate, Outlet } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

export function ProtectedRoute() {
  const { user, isLoadingAuth } = useAppContext();

  // Show a blank screen or a loading spinner while Supabase checks the session
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If no user is logged in after checking, redirect them to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
