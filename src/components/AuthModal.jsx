import { useState } from "react";
import { logoPath } from "../config.js";
import { getStudentProfile, hasFirebaseConfig, resetPassword, signInWithEmail, signInWithGoogle } from "../services/dataService.js";

export function AuthModal({ mode, onClose, onUser }) {
  const [authMode, setAuthMode] = useState(mode || "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [message, setMessage] = useState("");

  async function run(action, checkProfile = false) {
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
        <button className="google-button" type="button" onClick={() => run(signInWithGoogle, true)}>
          <span>G</span>
          Continue with Google
        </button>
        {!hasFirebaseConfig && (
          <p className="setup-note">
            Google login is disabled until Firebase keys are added.
          </p>
        )}
        <div className="divider"><span>or</span></div>
        {authMode === "signup" && <><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></label><div className="phone-field"><label>Country code<select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}><option value="+91">India +91</option><option value="+1">USA/Canada +1</option><option value="+44">UK +44</option><option value="+61">Australia +61</option><option value="+971">UAE +971</option></select></label><label>Mobile number<input value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" autoComplete="tel-national" required /></label></div><p className="privacy-note">Used for account, mentoring, support, and service-related communication. Marketing is not enabled automatically.</p></>}
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="student@example.com" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Minimum 6 characters" />
        </label>
        <button className="primary-button full" type="button" disabled={authMode === "signup" && (!fullName.trim() || !mobile.trim())} onClick={() => run(() => signInWithEmail(email.trim(), password, authMode, { fullName, mobile, countryCode }))}>
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
        <a className="text-button" href="/contact">Need help? Contact us</a>
        {message && <p className="form-message">{message}</p>}
      </section>
    </div>
  );
}
