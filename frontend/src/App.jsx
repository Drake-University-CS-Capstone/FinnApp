import Home from "./pages/Home";
import DatabasePage from "./pages/Database";
import PlaidIntegration from "./components/PlaidIntegration";

/**
 * Main App component
 * Handles routing and layout
 */
function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a, #020617)",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <PlaidIntegration />
      
      <DatabasePage />
      
    </main>
  );
}

export default App;
