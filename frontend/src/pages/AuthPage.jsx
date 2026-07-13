import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { connectSocket, disconnectSocket } from "../socket/socket";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | signup
  const [role, setRole] = useState("passenger"); // passenger | driver
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setLoading(true);
      setError("");

      const payload =
        mode === "signup"
          ? { role, email, name, password }
          : { email, password };

      const res = await api.post(`/auth/${mode}`, payload);
      const token = res.data?.token;
      const user = res.data?.user;

      if (!token || !user) {
        throw new Error("Invalid auth response");
      }

      localStorage.setItem("bike-booking-token", token);
      localStorage.setItem("bike-booking-user", JSON.stringify(user));

      // ensure socket reconnects with fresh token
      disconnectSocket();
      connectSocket();

      navigate(user.role === "driver" ? "/driver" : "/passenger");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Authentication</p>
          <h1>{mode === "signup" ? "Create account" : "Sign in"}</h1>
          <p className="hero-text">Login/signup for Passenger and Driver.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Account</p>
            <h2>{mode === "signup" ? "Signup" : "Login"}</h2>
          </div>
          <div className="tab-switcher">
            <button
              className={`tab-button ${mode === "login" ? "tab-button--active" : ""}`}
              type="button"
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              className={`tab-button ${mode === "signup" ? "tab-button--active" : ""}`}
              type="button"
              onClick={() => setMode("signup")}
            >
              Signup
            </button>
          </div>
        </div>

        <div className="form-grid form-grid--three">
          {mode === "signup" ? (
            <label>
              <span>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="passenger">Passenger</option>
                <option value="driver">Driver</option>
              </select>
            </label>
          ) : (
            <div />
          )}

          <label>
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>

          {mode === "signup" ? (
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </label>
          ) : (
            <div />
          )}

          <label>
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 6 characters"
              type="password"
            />
          </label>

          <div className="form-actions">
            <button className="primary-button" type="button" onClick={submit} disabled={loading}>
              {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Login"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                localStorage.removeItem("bike-booking-token");
                localStorage.removeItem("bike-booking-user");
                disconnectSocket();
                setError("");
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {error ? <div className="feedback-banner">{error}</div> : null}
      </section>
    </div>
  );
}

export default AuthPage;

