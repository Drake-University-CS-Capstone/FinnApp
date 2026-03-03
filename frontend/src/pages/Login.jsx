import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) throw new Error("Invalid credentials");
      // const data = await resp.json(); // handle token etc.
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-24 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      {error && <div className="text-red-500 mb-3">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block mb-2">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            required
          />
        </label>
        <label className="block mb-4">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            required
          />
        </label>
        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}

export default Login;