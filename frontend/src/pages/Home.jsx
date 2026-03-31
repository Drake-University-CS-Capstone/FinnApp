import PlaidIntegration from "../components/Dashboard";

function Home() {
  return (
    <div style={{
      minHeight: "100vh",
      background: Text.background,
      padding: "2.5rem",
    }}>
      <PlaidIntegration />
    </div>
  );
}

export default Home;