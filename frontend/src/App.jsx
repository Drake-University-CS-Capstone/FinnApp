import Home from "./pages/Home";
import Navbar from "./components/Navbar";

/**
 * Main App component
 * Handles routing and layout
 */
function App() {
  return (
    <>
      
      <main
      style={{
        paddingTop: "4rem", // ensure content sits below fixed nav
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#7cbcec",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
      >
        <Home />
      </main>
    </>
  );
}

export default App;
