import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Other from "./pages/other";
import Reports from "./pages/Reports";
import StockMarket from "./pages/Stock_market";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import FinanceLayout from "./pages/FinanceLayout";
import PlaidIntegration from "./components/Dashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import FinanceAccounts from "./pages/FinanceAccounts";
import FinanceTransactions from "./pages/FinanceTransactions";
import FinancePlanning from "./pages/FinancePlanning";
import FinanceNetWorth from "./pages/FinanceNetWorth";
import FinanceSettings from "./pages/FinanceSettings";
import { FinanceSessionProvider } from "./finance/FinanceSessionContext";

/**
 * Main App component
 * First page is login. Login and signup are public; all other routes are protected.
 */
function AppFrame() {
  const location = useLocation();
  const inFinanceWorkspace = location.pathname.startsWith("/home");
  const inAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <>
      {!inFinanceWorkspace && <Navbar />}
      <main
        style={{
          paddingTop: inFinanceWorkspace ? 0 : "4rem",
          minHeight: inAuthPage ? "calc(100vh - 4rem)" : "100vh",
          background: "#0d1424",
          color: "#e5e7eb",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          display: inAuthPage ? "flex" : "block",
          alignItems: inAuthPage ? "center" : undefined,
          justifyContent: inAuthPage ? "center" : undefined,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/home/*"
            element={(
              <ProtectedRoute>
                <FinanceSessionProvider>
                  <FinanceLayout />
                </FinanceSessionProvider>
              </ProtectedRoute>
            )}
          >
            <Route index element={<PlaidIntegration />} />
            <Route path="dashboard" element={<FinanceDashboard />} />
            <Route path="accounts" element={<FinanceAccounts />} />
            <Route path="transactions" element={<FinanceTransactions />} />
            <Route path="planning" element={<FinancePlanning />} />
            <Route path="net-worth" element={<FinanceNetWorth />} />
            <Route path="settings" element={<FinanceSettings />} />
            <Route path="hub" element={<Navigate to="/home/dashboard" replace />} />
            <Route path="cashflow" element={<Navigate to="/home/planning" replace />} />
            <Route path="activity" element={<Navigate to="/home/transactions" replace />} />
            <Route path="recurring" element={<Navigate to="/home/planning" replace />} />
            <Route path="debt" element={<Navigate to="/home/accounts" replace />} />
            <Route path="investments" element={<Navigate to="/home/accounts" replace />} />
            <Route path="insights" element={<Navigate to="/home/planning" replace />} />
          </Route>
          <Route path="/stock-market" element={<ProtectedRoute><StockMarket /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/other" element={<ProtectedRoute><Other /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppFrame />
    </Router>
  );
}

export default App;
