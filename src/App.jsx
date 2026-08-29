import { useEffect, useState } from "react";
import { load } from "@cashfreepayments/cashfree-js";
import { AuthModal } from "./components/AuthModal.jsx";
import { Brand } from "./components/Brand.jsx";
import { adminEmails, appBase, exams, getPlanVariant, mentorPhotoPath, plans } from "./config.js";
import {
  addResource,
  createPaymentOrder,
  getActiveAccessTags,
  getActiveSubscriptions,
  getOrderStatus,
  getPaymentSummary,
  getResources,
  getStudents,
  getStudyTracking,
  getUserProfile,
  hasResourceAccess,
  listenToAuth,
  saveStudyTracking,
  saveUserProfile,
  signOutUser,
  verifyPayment
} from "./services/dataService.js";

const examCards = [
  ["SBI", "SBI PO", "Prelims, mains, descriptive practice, interview approach, and mock strategy."],
  ["SBI", "SBI Clerk", "Speed building, accuracy routine, sectional timing, and daily practice targets."],
  ["IBPS", "IBPS PO", "Banking awareness, mains analysis, smart mock review, and study plan discipline."],
  ["IBPS", "IBPS Clerk", "Foundation drills, calculation speed, sectional revision, and exam-day confidence."],
  ["RRB", "RRB PO", "Regional bank focus, financial awareness, mains score improvement, and interview prep."],
  ["RRB", "RRB Clerk", "Daily topic targets, cut-off based preparation, and high-retention revision cycles."]
];

function formatPrice(rupees) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function daysRemaining(value) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}

function routeTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Header({ user, onAuth, onLogout }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("db_theme") || "light");
  const [profileOpen, setProfileOpen] = useState(false);
  const savedProfile = user?.email ? getUserProfile(user.email) : {};
  const studentName = savedProfile.name || user?.displayName || user?.email?.split("@")[0] || "Student";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("db_theme", theme);
  }, [theme]);

  return (
    <header className="site-header">
      <Brand />
      <nav className="main-nav">
        <a href={appBase}>Home</a>
        <a href={`${appBase}#programs`}>Exams</a>
        <a href={`${appBase}#strategy`}>Strategy</a>
        <a href={`${appBase}#plans`}>Plans</a>
        <a href={`${appBase}student-desk`}>Student Desk</a>
        <a href={`${appBase}admin`}>Admin</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button theme-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? "L" : "D"}</button>
        {user ? (
          <div className="profile-menu">
            <button className={`profile-button ${savedProfile.photo ? "has-photo" : ""}`} type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-label="Open profile menu">
              {savedProfile.photo && <img src={savedProfile.photo} alt="" />}
              <span className="profile-initial">{studentName.slice(0, 1).toUpperCase()}</span>
            </button>
            {profileOpen && <div className="profile-dropdown"><div className="profile-summary"><strong>{studentName}</strong><span>{user.email}</span></div><a className="menu-link" href={`${appBase}student-desk`}>Student Desk</a><button className="menu-link danger-link" type="button" onClick={onLogout}>Logout</button></div>}
          </div>
        ) : <><button className="ghost-button" type="button" onClick={() => onAuth("signin")}>Login</button><button className="primary-button" type="button" onClick={() => onAuth("signup")}>Start</button></>}
      </div>
    </header>
  );
}

function Shell({ user, onAuth, onLogout, children }) {
  async function fallbackLogout() { await signOutUser(); window.location.reload(); }
  return <><Header user={user} onAuth={onAuth} onLogout={onLogout || fallbackLogout} />{children}<Footer /></>;
}

function PlanCard({ plan, ownedVariants = new Set() }) {
  const [selectedId, setSelectedId] = useState(plan.variants[0].variantId);
  const selected = plan.variants.find((variant) => variant.variantId === selectedId) || plan.variants[0];
  const ownsVariant = ownedVariants.has(selected.variantId);
  return (
    <article className={`plan-card mentorship-plan-card ${plan.featured ? "featured" : ""}`}>
      {plan.featured && <span className="featured-badge">Premium Featured</span>}
      <span className="chip">{plan.coverage}</span>
      <h3>{plan.name}</h3>
      <p className="plan-subtitle">{plan.subtitle}</p>
      <p>{plan.description}</p>
      <div className="duration-tabs" role="radiogroup" aria-label={`${plan.name} durations`}>
        {plan.variants.map((variant) => <button className={variant.variantId === selected.variantId ? "active" : ""} key={variant.variantId} type="button" role="radio" aria-checked={variant.variantId === selected.variantId} onClick={() => setSelectedId(variant.variantId)}><strong>{variant.durationLabel}</strong><span>{formatPrice(variant.priceInRupees)}</span></button>)}
      </div>
      <div className="plan-price-row"><div className="price">{formatPrice(selected.priceInRupees)}</div><span className="status-pill">Validity: {selected.durationLabel}</span></div>
      <ul>{plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
      <div className="form-actions"><button className="primary-button full" type="button" onClick={() => routeTo(`${appBase}checkout/${selected.variantId}`)}>{ownsVariant ? "Renew Plan" : "Choose Plan"}</button><a className="ghost-button full" href={`${appBase}checkout/${selected.variantId}`}>View Details</a></div>
    </article>
  );
}

function PlanGrid({ paymentSummary }) {
  const ownedVariants = new Set(getActiveSubscriptions(paymentSummary).map((item) => item.variantId));
  return <div className="pricing-grid">{plans.map((plan) => <PlanCard key={plan.planId} plan={plan} ownedVariants={ownedVariants} />)}</div>;
}

function HomePage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  useEffect(() => { listenToAuth(setUser); }, []);
  useEffect(() => { if (user) getPaymentSummary().then(setPaymentSummary).catch(() => setPaymentSummary(null)); }, [user]);
  async function logout() { await signOutUser(); setUser(null); setPaymentSummary(null); }
  return (
    <>
      <Header user={user} onAuth={setAuthMode} onLogout={logout} />
      <main>
        <section className="hero" id="home"><div className="hero-copy"><p className="eyebrow">SBI | IBPS | RRB</p><h1>Delight Banking</h1><p>Premium banking exam guidance with mentor strategy, study targets, current affairs, and plan-based resources unlocked only after verified payment.</p><div className="hero-actions"><a className="primary-button" href="#plans">Choose Mentorship</a><a className="ghost-button" href={`${appBase}student-desk`}>Student Desk</a></div></div><div className="hero-board mentor-board"><img className="mentor-photo" src={mentorPhotoPath} alt="Imran Sir - Delight Banking Mentor" onError={(event) => { event.currentTarget.style.display = "none"; }} /><div className="rank-card main-rank"><span>Mentor</span><strong>Imran Sir</strong><small>Banking exam strategy and personal guidance</small></div></div></section>
        <section className="section" id="programs"><div className="section-heading"><p className="eyebrow">Exam Tracks</p><h2>Guidance built around your target exam</h2><p>Focused preparation for prelims, mains, current affairs, revision, and mock-test analysis.</p></div><div className="program-grid">{examCards.map(([tag, title, text]) => <article className="premium-card" key={title}><span className="chip">{tag}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
        <section className="strategy-band" id="strategy"><div><p className="eyebrow">Mentor Guidance</p><h2>Strategy, study plans, and daily execution with Imran Sir</h2><p>Students receive plan-specific guidance and resources after secure payment verification.</p></div>{["How to clear exams", "Study plans", "Daily current affairs"].map((title, index) => <article className="strategy-item" key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{index === 0 ? "Attempt planning, mock analysis, score tracking, and sectional decision rules." : index === 1 ? "Weekly preparation maps for Quant, Reasoning, English, GA, and banking awareness." : "Exam-focused updates with banking, finance, economy, and national revision tags."}</p></article>)}</section>
        <section className="section" id="plans"><div className="section-heading"><p className="eyebrow">Mentorship Plans</p><h2>Choose one-time access</h2><p>Monthly plans are one-time payments, not automatic recurring charges. Access starts after verified payment activation.</p></div><PlanGrid paymentSummary={paymentSummary} /></section>
      </main>
      <Footer />
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}
    </>
  );
}

function CheckoutPage({ variantId }) {
  const selected = getPlanVariant(variantId);
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [accepted, setAccepted] = useState({ terms: false, refund: false, privacy: false });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  useEffect(() => { listenToAuth((nextUser) => { setUser(nextUser); setProfile(nextUser?.email ? getUserProfile(nextUser.email) : {}); if (!nextUser) setAuthMode("signin"); }); }, []);
  if (!selected) return <Shell user={user} onAuth={setAuthMode}><section className="section"><div className="premium-card"><h1>Plan not found</h1><p>This plan variant is not available.</p><a className="primary-button" href={`${appBase}#plans`}>View Plans</a></div></section></Shell>;
  const { plan, ...variant } = selected;
  const canPay = user && accepted.terms && accepted.refund && accepted.privacy && status !== "processing";
  async function pay() {
    if (!user) { setAuthMode("signin"); return; }
    if (!canPay) return;
    setStatus("processing");
    setMessage("Creating secure payment order...");
    try {
      const order = await createPaymentOrder(variant.variantId, { name: profile.name, phone: profile.phone, address: profile.address });
      if (!order.paymentSessionId) throw new Error("Secure checkout session was not created. Please try again.");
      const cashfree = await load({ mode: order.environment === "production" ? "production" : "sandbox" });
      setMessage("Opening secure checkout...");
      await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_self" });
    } catch (error) { setStatus("failed"); setMessage(error.message); }
  }
  return <Shell user={user} onAuth={setAuthMode}><main className="checkout-page"><section className="checkout-shell"><article className="checkout-summary premium-card"><span className="chip">Secure Checkout</span><h1>{plan.name}</h1><p className="plan-subtitle">{plan.subtitle}</p><p>{plan.coverage}</p><div className="plan-price-row"><div className="price">{formatPrice(variant.priceInRupees)}</div><span className="status-pill">{variant.durationLabel}</span></div><p>Access duration begins after verified payment activation. No automatic renewal or automatic debit is created.</p><ul>{plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul></article><article className="checkout-form premium-card"><h2>Student and billing details</h2>{!user && <p className="form-message">Login is required before payment.</p>}<label>Name<input value={profile.name || user?.displayName || ""} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Student name" /></label><label>Email<input value={user?.email || ""} disabled placeholder="Login required" /></label><label>Mobile number<input value={profile.phone || ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="For receipt and support" /></label><label>Billing address<textarea rows="3" value={profile.address || ""} onChange={(event) => setProfile({ ...profile, address: event.target.value })} placeholder="Address for receipt records" /></label><label className="checkbox-row"><input type="checkbox" checked={accepted.terms} onChange={(event) => setAccepted({ ...accepted, terms: event.target.checked })} /> Payments are for educational mentorship and guidance services; exam selection, results or employment are not guaranteed.</label><label className="checkbox-row"><input type="checkbox" checked={accepted.refund} onChange={(event) => setAccepted({ ...accepted, refund: event.target.checked })} /> I understand the refund policy must be reviewed before production payments are enabled.</label><label className="checkbox-row"><input type="checkbox" checked={accepted.privacy} onChange={(event) => setAccepted({ ...accepted, privacy: event.target.checked })} /> Card, UPI and banking credentials are handled inside the secure checkout and are not stored by Delight Banking.</label><button className="primary-button full" type="button" disabled={!canPay} onClick={pay}>Pay Securely</button><p className="setup-note">You will enter card, UPI or banking details only inside the secure checkout.</p>{message && <p className={`form-message ${status}`}>{message}</p>}</article></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={(nextUser) => { setUser(nextUser); setProfile(getUserProfile(nextUser.email)); }} />}</Shell>;
}

function PaymentStatusPage({ orderId }) {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState("Verifying payment...");
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => { listenToAuth(setUser); }, []);
  useEffect(() => {
    if (!user || !orderId) return;
    let cancelled = false;
    let attempts = 0;
    async function check(useVerify = false) {
      try {
        const result = useVerify ? await verifyPayment({ orderId }) : await getOrderStatus(orderId);
        const nextOrder = result.order || result;
        if (cancelled) return;
        setOrder(nextOrder);
        const nextStatus = result.status || nextOrder.paymentStatus || "pending";
        if (nextStatus === "paid") { setMessage("Payment successful"); return; }
        if (["failed", "expired"].includes(nextStatus)) { setMessage("Payment failed"); return; }
        if (nextStatus === "cancelled") { setMessage("Payment cancelled"); return; }
        attempts += 1;
        setMessage("Payment pending");
        if (attempts >= 10) { setTimedOut(true); return; }
        window.setTimeout(() => check(false), 4000);
      } catch (error) {
        if (!cancelled) setMessage(error.message || "Unable to verify payment");
      }
    }
    check(true);
    return () => { cancelled = true; };
  }, [user, orderId]);
  const status = order?.paymentStatus || "pending";
  const heading = status === "paid" ? "Payment successful" : status === "failed" || status === "expired" ? "Payment failed" : status === "cancelled" ? "Payment cancelled" : timedOut ? "Unable to verify payment" : "Verifying payment";
  return <Shell user={user} onAuth={setAuthMode}><main className="checkout-page"><section className="payment-status-card premium-card"><span className="chip">Payment Verification</span><h1>{heading}</h1>{message && <p className="form-message">{timedOut ? "Payment is still pending. Refresh this page or check again from your dashboard." : message}</p>}{order && <div className="receipt-card" id="receipt"><h2>Payment Receipt</h2><dl className="student-details"><div><dt>Receipt number</dt><dd>{order.internalOrderNumber}</dd></div><div><dt>Student email</dt><dd>{order.userEmail}</dd></div><div><dt>Plan</dt><dd>{order.trustedPlanSnapshot?.name}</dd></div><div><dt>Duration</dt><dd>{order.trustedPlanSnapshot?.durationLabel}</dd></div><div><dt>Amount</dt><dd>{formatPrice(order.amountInRupees || order.amount || (order.amountInPaise / 100))}</dd></div><div><dt>Transaction ID</dt><dd>{order.paymentId || "Pending"}</dd></div><div><dt>Activation</dt><dd>{formatDate(order.accessStartAt)}</dd></div><div><dt>Expiry</dt><dd>{formatDate(order.accessEndAt)}</dd></div><div><dt>Status</dt><dd>{order.paymentStatus}</dd></div></dl><p>Delight Banking. Business/contact details placeholder. This is a payment receipt, not a GST tax invoice.</p></div>}<div className="form-actions"><a className="primary-button" href={`${appBase}student-desk`}>Return to dashboard</a><a className="ghost-button" href={`${appBase}#plans`}>Try again</a></div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}
function StudentDeskPage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [resources, setResources] = useState([]);
  const [profile, setProfile] = useState({});
  const [profileMessage, setProfileMessage] = useState("");
  const [paymentSummary, setPaymentSummary] = useState({ subscriptions: [], payments: [], orders: [] });
  const [deskView, setDeskView] = useState("dashboard");
  const [tracking, setTracking] = useState(getStudyTracking(""));
  useEffect(() => { listenToAuth((nextUser) => { setUser(nextUser); setProfile(nextUser?.email ? getUserProfile(nextUser.email) : {}); setTracking(nextUser?.email ? getStudyTracking(nextUser.email) : getStudyTracking("")); setAuthReady(true); }); getResources().then(setResources); }, []);
  useEffect(() => { if (user) refreshPayments(); }, [user]);
  async function refreshPayments() { setPaymentSummary(await getPaymentSummary()); }
  async function logout() { await signOutUser(); setUser(null); setPaymentSummary({ subscriptions: [], payments: [], orders: [] }); }
  const activeSubscriptions = getActiveSubscriptions(paymentSummary);
  const expiredSubscriptions = paymentSummary.subscriptions.filter((item) => item.status === "expired");
  const accessTags = getActiveAccessTags(paymentSummary);
  const visibleResources = resources.filter((item) => hasResourceAccess(item, paymentSummary));
  const studentName = profile.name || user?.displayName || user?.email?.split("@")[0] || "Guest Student";
  const todayPercent = Math.min(100, Math.round((Number(tracking.completedHours || 0) / Number(tracking.targetHours || 1)) * 100));
  const averageWeeklyHours = Math.round((tracking.weeklyHours.reduce((sum, item) => sum + Number(item || 0), 0) / tracking.weeklyHours.length) * 10) / 10;
  function saveProfile(event) { event.preventDefault(); if (!user?.email) { setAuthMode("signin"); return; } saveUserProfile(user.email, profile); setProfileMessage("Profile saved."); }
  function updateTracking(field, value) { const numericValue = Number(value); const next = { ...tracking, [field]: numericValue }; if (field === "completedHours") { const todayIndex = (new Date().getDay() + 6) % 7; next.weeklyHours = tracking.weeklyHours.map((hours, index) => index === todayIndex ? numericValue : hours); } setTracking(next); if (user?.email) saveStudyTracking(user.email, next); }
  if (!authReady) return <Shell user={user} onAuth={setAuthMode}><main className="desk-page"><section className="admin-gate"><div className="premium-card gate-card"><Brand small="Student Desk" /><h1>Loading desk</h1></div></section></main></Shell>;
  if (!user) return <Shell user={user} onAuth={setAuthMode}><main className="desk-page"><section className="admin-gate"><div className="premium-card gate-card student-login-gate"><Brand small="Student Desk" /><h1>Login to open Student Desk</h1><p>Sign in to view subscriptions, payment history, resources, profile, and study tracking.</p><button className="primary-button" type="button" onClick={() => setAuthMode("signin")}>Login</button></div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
  return <Shell user={user} onAuth={setAuthMode} onLogout={logout}><main className="desk-page"><section className="student-dashboard-shell" id="student-desk"><aside className="student-sidebar"><div className="sidebar-profile"><div className="profile-logo">{studentName.slice(0, 1).toUpperCase()}</div><h3>{studentName}</h3><p>{user.email}</p></div><nav className="dashboard-menu"><button className={deskView === "dashboard" ? "active" : ""} onClick={() => setDeskView("dashboard")}>Dashboard</button><button className={deskView === "plans" ? "active" : ""} onClick={() => setDeskView("plans")}>My Plans</button><button className={deskView === "resources" ? "active" : ""} onClick={() => setDeskView("resources")}>Resources</button><button className={deskView === "payments" ? "active" : ""} onClick={() => setDeskView("payments")}>Payment History</button><button className={deskView === "tracking" ? "active" : ""} onClick={() => setDeskView("tracking")}>Study Tracking</button><button className={deskView === "profile" ? "active" : ""} onClick={() => setDeskView("profile")}>Student Profile</button></nav><div className="subscription-box"><span className="menu-label">Active Plans</span>{activeSubscriptions.length ? activeSubscriptions.map((item) => <span className="status-pill" key={item.id}>{item.planName}</span>) : <p>No active mentorship plan yet.</p>}<a className="ghost-button full" href={`${appBase}#plans`}>View Plans</a></div></aside><div className="student-dashboard-main"><div className="dashboard-topbar"><div><p className="eyebrow">Student Desk</p><h1 className="page-title">Your study dashboard</h1><p>{activeSubscriptions.length ? `Active access: ${[...accessTags].slice(0, 4).join(", ")}` : "No active mentorship plan yet."}</p></div><button className="ghost-button" type="button" onClick={refreshPayments}>Refresh</button></div>{deskView === "dashboard" && <div className="dashboard-view">{!activeSubscriptions.length ? <AccessPlansPanel paymentSummary={paymentSummary} /> : <><div className="desk-stats"><article className="stat-card"><span>Today Progress</span><strong>{todayPercent}%</strong></article><article className="stat-card"><span>Avg. Weekly Hours</span><strong>{averageWeeklyHours}</strong></article><article className="stat-card"><span>Active Plans</span><strong>{activeSubscriptions.length}</strong></article><article className="stat-card"><span>Resources</span><strong>{visibleResources.length}</strong></article></div><SubscriptionList title="My Plans" subscriptions={activeSubscriptions} /><ResourceList resources={visibleResources.slice(0, 3)} paymentSummary={paymentSummary} /></>}</div>}{deskView === "plans" && <><SubscriptionList title="Active subscriptions" subscriptions={activeSubscriptions} /><SubscriptionList title="Expired subscriptions" subscriptions={expiredSubscriptions} empty="No expired plans." /><AccessPlansPanel paymentSummary={paymentSummary} /></>}{deskView === "resources" && <div className="resource-panel"><div className="toolbar"><div><p className="eyebrow">Resources</p><h2>Purchased-plan resources</h2></div></div>{activeSubscriptions.length ? <ResourceList resources={visibleResources} paymentSummary={paymentSummary} /> : <NoPlan />}</div>}{deskView === "payments" && <PaymentHistory payments={paymentSummary.payments} orders={paymentSummary.orders} />}{deskView === "tracking" && <div className="tracking-view">{!activeSubscriptions.length ? <NoPlan /> : <><div className="tracking-controls"><label>Daily Target Hours<input type="number" min="1" max="16" value={tracking.targetHours} onChange={(event) => updateTracking("targetHours", event.target.value)} /></label><label>Completed Hours<input type="number" min="0" max="16" value={tracking.completedHours} onChange={(event) => updateTracking("completedHours", event.target.value)} /></label><label>Mocks Attempted<input type="number" min="0" max="50" value={tracking.mocksAttempted} onChange={(event) => updateTracking("mocksAttempted", event.target.value)} /></label><label>Accuracy %<input type="number" min="0" max="100" value={tracking.accuracy} onChange={(event) => updateTracking("accuracy", event.target.value)} /></label></div><div className="dashboard-grid"><StudyGraph tracking={tracking} /><SubjectProgress subjects={tracking.subjects} /></div></>}</div>}{deskView === "profile" && <ProfileForm profile={profile} user={user} profileMessage={profileMessage} updateProfile={(field, value) => setProfile({ ...profile, [field]: value })} saveProfile={saveProfile} />}</div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}

function AccessPlansPanel({ paymentSummary }) {
  return <section className="desk-access-panel"><div className="toolbar"><div><p className="eyebrow">Mentorship Access</p><h2>Choose your plan</h2><p>Access unlocks only after verified payment.</p></div></div><PlanGrid paymentSummary={paymentSummary} /></section>;
}

function NoPlan() {
  return <article className="resource-item"><h3>No active mentorship plan yet.</h3><p>Choose a plan to unlock purchased-plan resources.</p><a className="primary-button" href={`${appBase}#plans`}>View Plans</a></article>;
}

function NoPlanText({ text }) { return <article className="resource-item"><p>{text}</p></article>; }

function SubscriptionList({ title, subscriptions, empty = "No active mentorship plan yet." }) {
  return <section className="resource-panel"><div className="toolbar"><h2>{title}</h2></div><div className="subscription-grid">{subscriptions.length ? subscriptions.map((item) => <article className="resource-item" key={item.id}><header><div><h3>{item.planName}</h3><p>{item.durationLabel} access</p></div><span className="status-pill">{item.status}</span></header><div className="meta-row"><span>Start: {formatDate(item.accessStartAt)}</span><span>Expiry: {formatDate(item.accessEndAt)}</span><span>{daysRemaining(item.accessEndAt)} days left</span></div><a className="ghost-button" href={`${appBase}checkout/${item.variantId}`}>{item.status === "active" ? "Extend Access" : "Renew Plan"}</a></article>) : <NoPlanText text={empty} />}</div></section>;
}

function PaymentHistory({ payments, orders }) {
  return <section className="resource-panel"><div className="toolbar"><div><p className="eyebrow">Payment History</p><h2>Transactions</h2></div></div><div className="resource-list">{payments.length ? payments.map((payment) => <article className="resource-item" key={payment.id}><header><div><h3>{payment.cashfreePaymentId || payment.providerPaymentId || payment.id}</h3><p>{formatPrice(payment.amount || (payment.amountInPaise / 100))} paid on {formatDate(payment.capturedAt || payment.createdAt)}</p></div><span className="status-pill">{payment.status}</span></header><div className="meta-row"><span>{payment.currency}</span><span>{payment.paymentMethod || "Secure Payment"}</span><span>{payment.verified ? "Verified" : "Pending"}</span></div><button className="text-button" type="button" onClick={() => window.print()}>Receipt/invoice action</button></article>) : orders.length ? orders.map((order) => <article className="resource-item" key={order.id}><h3>{order.internalOrderNumber}</h3><p>{order.paymentStatus}</p></article>) : <NoPlanText text="No payment history yet." />}</div></section>;
}

function ResourceList({ resources, paymentSummary }) {
  return <div className="resource-list">{resources.length ? resources.map((item) => { const locked = item.premium && !hasResourceAccess(item, paymentSummary); return <article className={`resource-item ${locked ? "locked" : ""}`} key={item.id}><header><div><h3>{item.title}</h3><p>{locked ? "This premium resource unlocks after verified plan access." : item.description}</p></div><span className="status-pill">{locked ? "Locked" : "Open"}</span></header><div className="meta-row"><span>{item.exam}</span><span>{item.type}</span><span>{item.premium ? "Premium" : "Free Preview"}</span></div>{!locked && item.url && <a className="text-button" href={item.url} target="_blank" rel="noreferrer">Open Resource</a>}</article>; }) : <article className="resource-item"><h3>No resources yet</h3><p>Your guide can publish resources from the admin page.</p></article>}</div>;
}

function StudyGraph({ tracking }) {
  const maxHours = Math.max(...tracking.weeklyHours, Number(tracking.targetHours || 1), 1);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return <section className="graph-card"><div className="toolbar"><div><p className="eyebrow">Study Tracking</p><h2>Weekly study graph</h2></div><span className="status-pill">{tracking.completedHours}/{tracking.targetHours}h today</span></div><div className="bar-graph">{tracking.weeklyHours.map((hours, index) => <div className="bar-column" key={`${days[index]}-${index}`}><div className="bar-track"><span style={{ height: hours > 0 ? `${Math.max(8, (hours / maxHours) * 100)}%` : "0%" }}></span></div><strong>{days[index]}</strong><small>{hours}h</small></div>)}</div></section>;
}

function SubjectProgress({ subjects }) {
  return <section className="subject-card"><p className="eyebrow">Subject Strength</p><h2>Preparation balance</h2><div className="subject-list">{Object.entries(subjects).map(([subject, value]) => <div className="subject-row" key={subject}><div><strong>{subject}</strong><span>{value}%</span></div><div className="progress-line"><i style={{ width: `${value}%` }}></i></div></div>)}</div></section>;
}

function ProfileForm({ profile, user, profileMessage, updateProfile, saveProfile }) {
  return <form className="profile-edit-panel" onSubmit={saveProfile}><div><p className="eyebrow">Profile</p><h2>Student profile</h2><p>Keep your profile details updated for guidance, receipts, and exam planning.</p></div><div className="profile-form-grid"><label>Name<input value={profile.name || ""} onChange={(event) => updateProfile("name", event.target.value)} placeholder="Your full name" /></label><label>Phone<input value={profile.phone || ""} onChange={(event) => updateProfile("phone", event.target.value)} placeholder="Mobile number" /></label><label>City<input value={profile.city || ""} onChange={(event) => updateProfile("city", event.target.value)} placeholder="Your city" /></label><label>Target Exam<select value={profile.targetExam || exams[0]} onChange={(event) => updateProfile("targetExam", event.target.value)}>{exams.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide-field">Address<textarea rows="3" value={profile.address || ""} onChange={(event) => updateProfile("address", event.target.value)} placeholder="Address or study location" /></label></div><button className="primary-button" type="submit">{user ? "Save Profile" : "Login to Save"}</button>{profileMessage && <p className="form-message">{profileMessage}</p>}</form>;
}

function PrivacyPolicyPage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  useEffect(() => { listenToAuth(setUser); }, []);
  return <Shell user={user} onAuth={setAuthMode}><main className="policy-page"><section className="section"><div className="section-heading"><p className="eyebrow">Privacy Policy</p><h1 className="page-title">Your data and access</h1><p>Delight Banking uses login information to manage student access, resources, and one-time mentorship subscriptions.</p></div><div className="policy-content"><article className="premium-card"><h3>Payments</h3><p>Payments are for educational mentorship and guidance services. Card, UPI and banking credentials are handled inside the secure checkout and are not stored by Delight Banking.</p></article><article className="premium-card"><h3>Access</h3><p>Access duration begins after verified payment activation. Monthly plans are one-time payments and do not renew automatically.</p></article><article className="premium-card"><h3>Results</h3><p>Examination selection, results or employment are not guaranteed.</p></article><article className="premium-card"><h3>Refund Policy</h3><p>Refund policy details must be completed and reviewed before production payments are enabled.</p></article></div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}

function AdminPage() {
  const [user, setUser] = useState(null);
  const [resources, setResources] = useState([]);
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState(null);
  const isAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()));
  useEffect(() => { listenToAuth(setUser); getResources().then(setResources); getStudents().then(setStudents); }, []);
  async function publish(event) {
    event.preventDefault();
    if (!isAdmin) { setMessage("Login with an admin email first."); return; }
    const data = new FormData(event.currentTarget);
    await addResource({ title: data.get("title").trim(), exam: data.get("exam"), type: data.get("type"), url: data.get("url").trim(), description: data.get("description").trim(), premium: data.get("premium") === "on" });
    event.currentTarget.reset();
    setResources(await getResources());
    setMessage("Resource published.");
  }
  const adminSummary = { subscriptions: plans.map((plan) => ({ planId: plan.planId, accessTags: plan.accessTags, status: "active", accessEndAt: "2999-01-01" })) };
  return <Shell user={user} onAuth={setAuthMode}><main className="admin-shell"><section className="admin-hero"><p className="eyebrow">Control Room</p><h1>Manage Delight Banking resources</h1><p>Basic admin route preserved. Full admin analytics arrive in the next phase.</p><span className="status-pill">{isAdmin ? `Admin active: ${user.email}` : "Admin login required"}</span></section>{isAdmin ? <section className="admin-grid"><form className="admin-form" onSubmit={publish}><h2>Add Resource</h2><label>Title<input name="title" required /></label><label>Exam<select name="exam">{exams.map((item) => <option key={item}>{item}</option>)}</select></label><label>Type<select name="type">{["Strategy", "Study Plan", "Study Target", "Current Affairs", "PDF Resource", "Video Class"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Resource Link<input name="url" type="url" /></label><label>Description<textarea name="description" rows="5" required /></label><label className="checkbox-row"><input name="premium" type="checkbox" defaultChecked /> Premium resource</label><button className="primary-button full" type="submit">Publish Resource</button>{message && <p className="form-message">{message}</p>}</form><div className="resource-panel"><div className="toolbar"><h2>Published Resources</h2></div><ResourceList resources={resources} paymentSummary={adminSummary} /></div></section> : <section className="admin-gate"><div className="gate-card"><Brand small="Admin Control" /><h1>Admin access</h1><button className="primary-button full" type="button" onClick={() => setAuthMode("signin")}>Admin Login</button></div></section>}<section className="admin-students-section"><div className="resource-toolbar"><div><p className="eyebrow">Students</p><h2>Student details</h2><p>Shows real available login/profile records. Payment analytics are stored for the next admin phase.</p></div></div><div className="students-grid">{students.map((student) => <article className="student-card" key={student.email}><h3>{student.name || "Student"}</h3><p>{student.email}</p></article>)}</div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}

function Footer() {
  return <footer className="site-footer"><div><Brand small="Student guidance for banking exams" /><p>Strategy, study targets, premium resources, and current affairs for serious banking aspirants.</p></div><div><h4>Plans</h4>{plans.slice(0, 4).map((plan) => <a href={`${appBase}#plans`} key={plan.planId}>{plan.name}</a>)}</div><div><h4>Platform</h4><a href={`${appBase}#strategy`}>Strategy</a><a href={`${appBase}#plans`}>Access Plans</a><a href={`${appBase}student-desk`}>Student Desk</a><a href={`${appBase}privacy-policy`}>Privacy Policy</a></div><div><h4>Contact</h4><a href="mailto:support@delightbanking.com">support@delightbanking.com</a><span>India</span><span>Copyright {new Date().getFullYear()} Delight Banking</span></div></footer>;
}

export default function App() {
  const [route, setRoute] = useState(() => `${window.location.pathname}${window.location.search}${window.location.hash}`);
  useEffect(() => { const updateRoute = () => setRoute(`${window.location.pathname}${window.location.search}${window.location.hash}`); window.addEventListener("hashchange", updateRoute); window.addEventListener("popstate", updateRoute); return () => { window.removeEventListener("hashchange", updateRoute); window.removeEventListener("popstate", updateRoute); }; }, []);
  const url = new URL(window.location.href);
  const path = url.pathname.replace(appBase, "/");
  const checkoutMatch = path.match(/^\/checkout\/([^/]+)\/?$/);
  const paymentMatch = path.match(/^\/payment\/(success|failed|cancelled|processing|verification-failed|pending|status)\/?$/);
  void route;
  if (checkoutMatch) return <CheckoutPage variantId={decodeURIComponent(checkoutMatch[1])} />;
  if (paymentMatch) return <PaymentStatusPage orderId={url.searchParams.get("order_id") || url.searchParams.get("orderId")} />;
  if (path.endsWith("/admin") || url.hash === "#admin") return <AdminPage />;
  if (path.endsWith("/student-desk") || url.hash.includes("student-desk")) return <StudentDeskPage />;
  if (path.endsWith("/privacy-policy") || url.hash === "#privacy-policy") return <PrivacyPolicyPage />;
  return <HomePage />;
}








