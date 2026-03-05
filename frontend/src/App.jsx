import Home from "./pages/Home";

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
<<<<<<< HEAD
      <PlaidIntegration />
      
      <DatabasePage />
      
=======
      <Home />
>>>>>>> parent of 2ff3d57 (Got working Plaid integration with our App)
    </main>
  );
}

export default App;
