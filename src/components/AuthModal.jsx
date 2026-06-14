import { useState } from "react";
import { logoPath } from "../config.js";
import { hasFirebaseConfig, resetPassword, signInWithEmail, signInWithGoogle } from "../services/dataService.js";

export function AuthModal({ mode, onClose, onUser }) {
  const [authMode, setAuthMode] = useState(mode || "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function run(action) {
    setMessage("");
    try {
      const user = await action();
      if (user) onUser(user);
      if (user) onClose();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function sendReset() {
    setMessage("");
    try {
      await resetPassword(email.trim());
      setMessage("Password reset link sent if the email exists.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="auth-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" type="button" onClick={onClose} aria-label="Close login">
          x
        </button>
        <img className="auth-logo" src={logoPath} alt="Delight Banking logo" />
        <p className="eyebrow">{authMode === "signup" ? "Student Signup" : "Secure Login"}</p>
        <h2>{authMode === "signup" ? "Create your account" : "Welcome back"}</h2>
        <button className="google-button" type="button" onClick={() => run(signInWithGoogle)}>
          <span>G</span>
          Continue with Google
        </button>
        {!hasFirebaseConfig && (
          <p className="setup-note">
            Google login is disabled until Firebase keys are added.
          </p>
        )}
        <div className="divider"><span>or</span></div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="student@example.com" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Minimum 6 characters" />
        </label>
        <button className="primary-button full" type="button" onClick={() => run(() => signInWithEmail(email.trim(), password, authMode))}>
          {authMode === "signup" ? "Create Account" : "Login"}
        </button>
        <div className="auth-links">
          <button className="text-button" type="button" onClick={sendReset}>
            Forgot password?
          </button>
          <button className="text-button" type="button" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}>
            {authMode === "signup" ? "Already registered?" : "Create new account"}
          </button>
        </div>
        {message && <p className="form-message">{message}</p>}
      </section>
    </div>
  );
}
