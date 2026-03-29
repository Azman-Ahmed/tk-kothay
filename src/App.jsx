import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { Income } from "./pages/Income";
import { Expenses } from "./pages/Expenses";
import { OneTimePayments } from "./pages/OneTimePayments";
import { DailySpend } from "./pages/DailySpend";
import { Savings } from "./pages/Savings";
import { Loans } from "./pages/Loans";
import { BalanceSheet } from "./pages/BalanceSheet";
import { Reports } from "./pages/Reports";
import { Login } from "./pages/auth/Login";
import { Signup } from "./pages/auth/Signup";
import { Callback } from "./pages/auth/Callback";

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          <Route path="/auth/callback" element={<Callback />} />

          {/* Main App Routes (Protected) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="income" element={<Income />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="one-time" element={<OneTimePayments />} />
              <Route path="daily" element={<DailySpend />} />
              <Route path="savings" element={<Savings />} />
              <Route path="loans" element={<Loans />} />
              <Route path="reports" element={<Reports />} />
              <Route path="balance" element={<BalanceSheet />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
