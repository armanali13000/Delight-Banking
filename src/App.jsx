import { useEffect, useState } from "react";
import { load } from "@cashfreepayments/cashfree-js";
import { AuthModal } from "./components/AuthModal.jsx";
import { Brand } from "./components/Brand.jsx";
import { appBase, exams, getPlanVariant, mentorPhotoPath, plans } from "./config.js";
import {
  addResource,
  createPaymentOrder,
  getActiveAccessTags,
  getActiveSubscriptions,
  getAdminActivityLogs,
  getAdminMe,
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
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  updateAdminProfile,
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

const productionSiteUrl = "https://www.delightguidance.com";
const homeTitle = "Delight Banking – Banking Exam Mentorship & Guidance";
const homeDescription = "Prepare for banking and insurance examinations with structured targets, personal mentorship, mock analysis and guidance from Imran Sir.";

function setMetaTag(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonicalLink(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function getStructuredData(path) {
  if (path !== "/" && path !== "/about" && path !== "/privacy-policy") return null;

  const baseGraph = [
    {
      "@context": "https://schema.org",
      "@type": ["Organization", "EducationalOrganization"],
      "@id": `${productionSiteUrl}/#organization`,
      "name": "Delight Banking",
      "url": `${productionSiteUrl}/`,
      "logo": `${productionSiteUrl}/delight-logo.png`,
      "sameAs": []
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${productionSiteUrl}/#website`,
      "name": "Delight Banking",
      "url": `${productionSiteUrl}/`,
      "publisher": { "@id": `${productionSiteUrl}/#organization` }
    }
  ];

  if (path === "/") {
    baseGraph.push({
      "@context": "https://schema.org",
      "@type": "OfferCatalog",
      "name": "Delight Banking mentorship plans",
      "url": `${productionSiteUrl}/#plans`,
      "itemListElement": plans.flatMap((plan) => plan.variants.map((variant) => ({
        "@type": "Offer",
        "name": `${plan.name} - ${variant.durationLabel}`,
        "price": String(variant.priceInRupees),
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
        "url": `${productionSiteUrl}/checkout/${variant.variantId}`,
        "itemOffered": {
          "@type": "Course",
          "name": plan.name,
          "description": plan.description,
          "provider": { "@id": `${productionSiteUrl}/#organization` }
        }
      })))
    });
  }

  if (path === "/about") {
    baseGraph.push({
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${productionSiteUrl}/about#imran-sir`,
      "name": "Imran Sir",
      "jobTitle": "Banking Examination Mentor",
      "image": `${productionSiteUrl}/images/imran-sir-banking-mentor.webp`,
      "worksFor": { "@id": `${productionSiteUrl}/#organization` }
    });
    baseGraph.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${productionSiteUrl}/` },
        { "@type": "ListItem", "position": 2, "name": "About", "item": `${productionSiteUrl}/about` }
      ]
    });
  }

  if (path === "/privacy-policy") {
    baseGraph.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${productionSiteUrl}/` },
        { "@type": "ListItem", "position": 2, "name": "Privacy Policy", "item": `${productionSiteUrl}/privacy-policy` }
      ]
    });
  }

  return baseGraph;
}

function applyPageSeo(path) {
  const normalizedPath = path.replace(/\/$/, "") || "/";
  const isPrivateRoute = normalizedPath.startsWith("/admin") || normalizedPath.startsWith("/checkout") || normalizedPath.startsWith("/payment") || normalizedPath.startsWith("/student-desk") || normalizedPath.startsWith("/dashboard") || normalizedPath.startsWith("/login") || normalizedPath.startsWith("/signup") || normalizedPath.startsWith("/forgot");
  const isPrivacy = normalizedPath === "/privacy-policy";
  const isAbout = normalizedPath === "/about";
  const canonicalPath = isPrivacy ? "/privacy-policy" : isAbout ? "/about" : "/";
  const title = isPrivacy ? "Privacy Policy | Delight Banking" : isAbout ? "Meet Imran Sir | Delight Banking" : homeTitle;
  const description = isPrivacy ? "Privacy information for Delight Banking students using login, payment and mentorship access features." : isAbout ? "Learn about Imran Sir's target-based approach to banking and insurance examination mentorship, preparation strategy and mock analysis at Delight Banking." : homeDescription;
  const canonical = `${productionSiteUrl}${canonicalPath}`;

  document.title = title;
  setCanonicalLink(canonical);
  setMetaTag("name", "description", description);
  setMetaTag("name", "robots", isPrivateRoute ? "noindex, nofollow" : "index, follow");
  setMetaTag("property", "og:site_name", "Delight Banking");
  setMetaTag("property", "og:type", "website");
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:url", canonical);
  setMetaTag("property", "og:image", `${productionSiteUrl}/delight-logo.png`);
  setMetaTag("name", "twitter:card", "summary");
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);

  const structuredData = getStructuredData(isPrivateRoute ? "" : canonicalPath);
  let script = document.head.querySelector('script[type="application/ld+json"][data-delight-seo="true"]');
  if (!structuredData) {
    if (script) script.remove();
    return;
  }
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.delightSeo = "true";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(structuredData);
}
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
  const [verifiedAdmin, setVerifiedAdmin] = useState(null);
  const savedProfile = user?.email ? getUserProfile(user.email) : {};
  const studentName = savedProfile.name || user?.displayName || user?.email?.split("@")[0] || "Student";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("db_theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setVerifiedAdmin(null); return; }
    getAdminMe({ forceRefresh: false }).then((result) => { if (!cancelled) setVerifiedAdmin(result.admin); }).catch(() => { if (!cancelled) setVerifiedAdmin(null); });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <header className="site-header">
      <Brand />
      <nav className="main-nav">
        <a href={appBase}>Home</a>
        <a href={`${appBase}#programs`}>Exams</a>
        <a href={`${appBase}about`}>About</a>
        <a href={`${appBase}#strategy`}>Strategy</a>
        <a href={`${appBase}#plans`}>Plans</a>
        <a href={`${appBase}student-desk`}>Student Desk</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button theme-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? "L" : "D"}</button>
        {user ? (
          <div className="profile-menu">
            <button className={`profile-button ${savedProfile.photo ? "has-photo" : ""}`} type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-label="Open profile menu">
              {savedProfile.photo && <img src={savedProfile.photo} alt="" />}
              <span className="profile-initial">{studentName.slice(0, 1).toUpperCase()}</span>
            </button>
            {profileOpen && <div className="profile-dropdown"><div className="profile-summary"><strong>{studentName}</strong><span>{user.email}</span></div><a className="menu-link" href={`${appBase}student-desk`}>Student Desk</a>{verifiedAdmin && <a className="menu-link" href={`${appBase}admin`}>Admin Panel</a>}<button className="menu-link danger-link" type="button" onClick={onLogout}>Logout</button></div>}
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
      <p className="mentor-byline">Mentorship by Imran Sir</p>
      <p>{plan.description}</p>
      <div className="duration-tabs" role="radiogroup" aria-label={`${plan.name} durations`}>
        {plan.variants.map((variant) => <button className={variant.variantId === selected.variantId ? "active" : ""} key={variant.variantId} type="button" role="radio" aria-checked={variant.variantId === selected.variantId} onClick={() => setSelectedId(variant.variantId)}><strong>{variant.durationLabel}</strong><span>{formatPrice(variant.priceInRupees)}</span></button>)}
      </div>
      <div className="plan-price-row"><div className="price">{formatPrice(selected.priceInRupees)}</div><span className="status-pill">Validity: {selected.durationLabel}</span></div>
      {plan.planId === "personal-coaching" && <div className="plan-mentor-mini"><img src={mentorPhotoPath} width="72" height="72" loading="lazy" alt="Imran Sir, banking examination mentor at Delight Banking" /><div><strong>Imran Sir</strong><span>Banking Examination Mentor</span></div></div>}
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
        <section className="hero" id="home"><div className="hero-copy"><p className="eyebrow">SBI | IBPS | RRB | Insurance</p><h1 className="hero-title">Prepare for Banking Exams with the Right Strategy</h1><p>Structured targets, practical preparation guidance, mock analysis and personal mentorship to help banking and insurance aspirants prepare with confidence.</p><div className="hero-actions"><a className="primary-button" href="#plans">Explore Mentorship Plans</a><a className="ghost-button" href="https://www.youtube.com/@DelightBanking" target="_blank" rel="noreferrer">Watch Free Classes</a></div></div><div className="hero-board mentor-board"><img className="mentor-photo" src={mentorPhotoPath} width="1280" height="1024" fetchpriority="high" alt="Imran Sir, banking examination mentor at Delight Banking" onError={(event) => { event.currentTarget.style.display = "none"; }} /><div className="rank-card main-rank mentor-identity"><span>Imran Sir</span><strong>Banking Examination Mentor</strong></div></div></section>
        <section className="section mentor-section" id="mentor"><div className="mentor-section-media"><img src={mentorPhotoPath} width="1280" height="1024" loading="lazy" alt="Imran Sir, banking examination mentor at Delight Banking" /></div><div className="mentor-section-copy"><p className="eyebrow">Meet Your Mentor</p><h2>Imran Sir</h2><p className="mentor-role">Banking Examination Mentor</p><p>Imran Sir guides banking and insurance examination aspirants through structured preparation targets, practical strategies, mock-test analysis and plan-specific mentorship. His approach focuses on consistency, disciplined execution and identifying the areas where each student needs improvement.</p><div className="mentor-feature-grid">{["Structured preparation strategy", "Daily and weekly targets", "Prelims and Mains guidance", "Mock-test and performance analysis", "Plan-specific personal support", "Banking and insurance examination preparation"].map((item) => <span key={item}>{item}</span>)}</div><a className="primary-button" href="#plans">View Mentorship Plans</a></div></section>
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

function AboutPage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  useEffect(() => { listenToAuth(setUser); }, []);
  return <Shell user={user} onAuth={setAuthMode}><main className="about-page"><section className="section about-hero"><div className="about-copy"><p className="eyebrow">Meet Your Mentor</p><h1 className="page-title">Imran Sir</h1><p className="mentor-role">Banking Examination Mentor</p><p>Imran Sir guides banking and insurance examination aspirants through structured preparation targets, practical strategies, mock-test analysis and plan-specific mentorship.</p><div className="hero-actions"><a className="primary-button" href={`${appBase}#plans`}>View Mentorship Plans</a><a className="ghost-button" href="https://www.youtube.com/@DelightBanking" target="_blank" rel="noreferrer">YouTube Channel</a></div></div><div className="about-photo-wrap"><img src={mentorPhotoPath} width="1280" height="1024" loading="eager" alt="Imran Sir, banking examination mentor at Delight Banking" /></div></section><section className="section about-detail-grid"><article className="premium-card"><h2>Mentor Introduction</h2><p>Students learn through a practical mentorship style focused on preparation discipline, exam-specific planning and regular performance review.</p></article><article className="premium-card"><h2>Teaching Approach</h2><p>The guidance emphasizes clear targets, consistent revision, doubt resolution and honest analysis of weak areas.</p></article><article className="premium-card"><h2>Banking-Exam Preparation Strategy</h2><p>Preparation is organized around prelims speed, mains depth, current affairs retention and exam-day decision making.</p></article><article className="premium-card"><h2>Target-Based Mentorship</h2><p>Daily and weekly targets help aspirants keep their study routine measurable and easier to correct when progress slows.</p></article><article className="premium-card"><h2>Mock-Analysis Approach</h2><p>Mock tests are reviewed for accuracy, time allocation, skipped questions, repeated mistakes and next-step correction targets.</p></article><article className="premium-card"><h2>Delight Banking Mission</h2><p>Delight Banking exists to give banking and insurance aspirants structured guidance, useful resources and plan-based mentorship without result guarantees.</p></article></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}
function PrivacyPolicyPage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  useEffect(() => { listenToAuth(setUser); }, []);
  return <Shell user={user} onAuth={setAuthMode}><main className="policy-page"><section className="section"><div className="section-heading"><p className="eyebrow">Privacy Policy</p><h1 className="page-title">Your data and access</h1><p>Delight Banking uses login information to manage student access, resources, and one-time mentorship subscriptions.</p></div><div className="policy-content"><article className="premium-card"><h3>Payments</h3><p>Payments are for educational mentorship and guidance services. Card, UPI and banking credentials are handled inside the secure checkout and are not stored by Delight Banking.</p></article><article className="premium-card"><h3>Access</h3><p>Access duration begins after verified payment activation. Monthly plans are one-time payments and do not renew automatically.</p></article><article className="premium-card"><h3>Results</h3><p>Examination selection, results or employment are not guaranteed.</p></article><article className="premium-card"><h3>Refund Policy</h3><p>Refund policy details must be completed and reviewed before production payments are enabled.</p></article></div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}

const adminNavItems = [
  ["/admin", "Overview", "admin.dashboard.view"],
  ["/admin/users", "Users", "users.view"],
  ["/admin/subscriptions", "Subscriptions", "subscriptions.view"],
  ["/admin/orders", "Orders", "payments.view"],
  ["/admin/transactions", "Transactions", "payments.view"],
  ["/admin/plans", "Plans", "plans.view"],
  ["/admin/resources", "Resources", "resources.view"],
  ["/admin/targets", "Targets", "resources.view"],
  ["/admin/classes", "Classes", "resources.view"],
  ["/admin/support", "Support", "support.view"],
  ["/admin/refunds", "Refunds", "refunds.manage"],
  ["/admin/disputes", "Disputes", "payments.view"],
  ["/admin/reports", "Reports", "reports.view"],
  ["/admin/activity-logs", "Activity Logs", "admin.activity_logs.view"],
  ["/admin/settings", "Settings", "admins.manage"]
];

function adminHasPermission(admin, permission) {
  return admin?.role === "super_admin" || Boolean(admin?.permissions?.includes(permission));
}

function AdminRoleBadge({ role }) {
  return <span className={`admin-role-badge ${role || "unknown"}`}>{String(role || "unknown").replace(/_/g, " ")}</span>;
}

function AdminLoadingSkeleton() {
  return <main className="admin-portal-page"><section className="admin-loading"><Brand small="Admin Portal" /><div className="admin-skeleton-line wide"></div><div className="admin-skeleton-line"></div><div className="admin-skeleton-grid"><span></span><span></span><span></span></div></section></main>;
}

function AdminErrorState({ message }) {
  return <article className="admin-empty-state"><h3>Unable to load admin area</h3><p>{message}</p><button className="ghost-button" type="button" onClick={() => window.location.reload()}>Refresh session</button></article>;
}

function AdminEmptyState({ title = "Coming in Phase 2", text = "This module will be available in a later admin-panel phase." }) {
  return <article className="admin-empty-state"><h3>{title}</h3><p>{text}</p></article>;
}

function PermissionGate({ admin, permission, children }) {
  if (!adminHasPermission(admin, permission)) return <AdminEmptyState title="Access limited" text="This administrator role cannot access this area." />;
  return children;
}

function ConfirmationDialog({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}><section className="confirmation-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><h3>{title}</h3><p>{message}</p><div className="form-actions"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="button" onClick={onConfirm}>Confirm</button></div></section></div>;
}

function AdminPageHeader({ eyebrow, title, description, admin }) {
  return <div className="admin-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{admin && <AdminRoleBadge role={admin.role} />}</div>;
}

function AdminSidebar({ activePath, admin, onNavigate, onClose }) {
  return <aside className="admin-sidebar"><div className="admin-sidebar-brand"><Brand small="Admin Portal" /></div><nav>{adminNavItems.map(([path, label, permission]) => <button key={path} className={activePath === path ? "active" : ""} type="button" onClick={() => { onNavigate(path); if (onClose) onClose(); }} disabled={!adminHasPermission(admin, permission) && !["/admin/users", "/admin/subscriptions", "/admin/orders", "/admin/transactions", "/admin/plans", "/admin/resources", "/admin/targets", "/admin/classes", "/admin/support", "/admin/refunds", "/admin/disputes", "/admin/reports", "/admin/settings"].includes(path)}>{label}</button>)}</nav></aside>;
}

function AdminProfileMenu({ admin, onLogout }) {
  const [open, setOpen] = useState(false);
  return <div className="admin-profile-menu"><button className="admin-profile-trigger" type="button" onClick={() => setOpen(!open)}><span>{admin.displayName?.slice(0, 1).toUpperCase() || "A"}</span><div><strong>{admin.displayName}</strong><small>{admin.role.replace(/_/g, " ")}</small></div></button>{open && <div className="admin-profile-popover"><a href={`${appBase}admin/profile`}>Admin Profile</a><button type="button" onClick={onLogout}>Sign out</button></div>}</div>;
}

function AdminHeader({ admin, onMenu, onLogout }) {
  return <header className="admin-header"><button className="icon-button admin-menu-button" type="button" onClick={onMenu} aria-label="Open admin navigation">M</button><div><strong>Delight Banking Admin</strong><span>Secure session active</span></div><AdminProfileMenu admin={admin} onLogout={onLogout} /></header>;
}

function AdminMobileNavigation({ open, activePath, admin, onNavigate, onClose }) {
  useEffect(() => { document.body.classList.toggle("admin-drawer-open", open); return () => document.body.classList.remove("admin-drawer-open"); }, [open]);
  if (!open) return null;
  return <div className="admin-mobile-backdrop" role="presentation" onMouseDown={onClose}><div className="admin-mobile-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button close-button" type="button" onClick={onClose} aria-label="Close admin navigation">x</button><AdminSidebar activePath={activePath} admin={admin} onNavigate={onNavigate} onClose={onClose} /></div></div>;
}

function AdminLayout({ admin, activePath, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  async function logout() { await signOutUser(); routeTo(`${appBase}admin/login`); }
  function navigate(path) { routeTo(`${appBase}${path.replace(/^\//, "")}`); }
  return <main className="admin-portal-page"><AdminMobileNavigation open={mobileOpen} activePath={activePath} admin={admin} onNavigate={navigate} onClose={() => setMobileOpen(false)} /><div className="admin-portal-shell"><AdminSidebar activePath={activePath} admin={admin} onNavigate={navigate} /><section className="admin-main"><AdminHeader admin={admin} onMenu={() => setMobileOpen(true)} onLogout={logout} />{children}</section></div></main>;
}

function AdminRouteGuard({ path, children }) {
  const [state, setState] = useState({ loading: true, admin: null, error: "" });
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const result = await getAdminMe({ forceRefresh: true, logAccess: path === "/admin" });
        if (!cancelled) setState({ loading: false, admin: result.admin, error: "" });
      } catch (error) {
        if (cancelled) return;
        if (error.message === "Login required.") routeTo(`${appBase}admin/login`);
        else routeTo(`${appBase}admin/access-denied`);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [path]);
  if (state.loading) return <AdminLoadingSkeleton />;
  if (state.error) return <AdminErrorState message={state.error} />;
  return children(state.admin);
}

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function finishLogin(action) {
    setLoading(true);
    setMessage("");
    try {
      await action();
      await getAdminMe({ forceRefresh: true, logAccess: true });
      routeTo(`${appBase}admin`);
    } catch (error) {
      await signOutUser().catch(() => {});
      setMessage(error.message === "Login required." ? "This account does not have administrative access." : error.message || "This account does not have administrative access.");
    } finally {
      setLoading(false);
    }
  }
  async function forgotPassword() {
    setMessage("");
    try { await resetPassword(email.trim()); setMessage("Password reset link sent if the email exists."); } catch (error) { setMessage(error.message); }
  }
  return <main className="admin-login-page"><section className="admin-login-panel"><Brand small="Admin Portal" /><p className="eyebrow">Secure Administration</p><h1>Delight Banking Admin</h1><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label><label>Password<div className="password-row"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></label><button className="primary-button full" type="button" disabled={loading} onClick={() => finishLogin(() => signInWithEmail(email.trim(), password, "signin"))}>{loading ? "Checking access..." : "Login"}</button><button className="google-button full" type="button" disabled={loading} onClick={() => finishLogin(signInWithGoogle)}><span>G</span>Continue with Google</button><div className="auth-links"><button className="text-button" type="button" onClick={forgotPassword}>Forgot password?</button><a className="text-button" href={appBase}>Back to website</a></div>{message && <p className="form-message">{message === "This account does not have administrative access." ? message : "This account does not have administrative access."}</p>}</section></main>;
}

function AdminOverview({ admin }) {
  const roadmap = ["Secure roles and profile foundation", "Phase 2 analytics and operational modules", "Future role management and audit workflows"];
  return <><AdminPageHeader eyebrow="Overview" title={`Welcome, ${admin.displayName}`} description="The admin foundation is active. Analytics and operations modules will be added in later phases." admin={admin} /><div className="admin-foundation-grid"><article><span>Account status</span><strong>{admin.status}</strong></article><article><span>Secure session</span><strong>Verified</strong></article><article><span>Profile</span><a className="ghost-button" href={`${appBase}admin/profile`}>Open profile</a></article></div><section className="admin-card"><h2>Phase roadmap</h2>{roadmap.map((item) => <p key={item}>{item}</p>)}</section><section className="admin-card"><h2>Security notice</h2><p>Admin access is verified with Firebase custom claims and the server-side adminUsers record. Protected content is not rendered until authorization completes.</p></section><div className="admin-placeholder-grid"><AdminEmptyState title="Analytics" /><AdminEmptyState title="Users" /><AdminEmptyState title="Payments" /></div></>;
}

function AdminProfilePage({ admin, onUpdated }) {
  const [displayName, setDisplayName] = useState(admin.displayName || "");
  const [photoURL, setPhotoURL] = useState(admin.photoURL || "");
  const [message, setMessage] = useState("");
  async function save(event) {
    event.preventDefault();
    setMessage("");
    try { const result = await updateAdminProfile({ displayName, photoURL }); onUpdated?.(result.admin); setMessage("Profile updated."); } catch (error) { setMessage(error.message); }
  }
  async function refreshSession() { await getAdminMe({ forceRefresh: true }); setMessage("Session refreshed."); }
  async function logout() { await signOutUser(); routeTo(`${appBase}admin/login`); }
  return <><AdminPageHeader eyebrow="Admin Profile" title="Profile and session" description="Manage safe profile details. Role, status, permissions and UID are controlled by secure admin processes." admin={admin} /><section className="admin-profile-card"><div className="admin-photo-preview">{photoURL ? <img src={photoURL} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}</div><dl className="student-details"><div><dt>Display name</dt><dd>{admin.displayName}</dd></div><div><dt>Email</dt><dd>{admin.email}</dd></div><div><dt>Firebase UID</dt><dd>{admin.uid}</dd></div><div><dt>Role</dt><dd>{admin.role}</dd></div><div><dt>Status</dt><dd>{admin.status}</dd></div><div><dt>Created</dt><dd>{formatDate(admin.createdAt)}</dd></div><div><dt>Last admin access</dt><dd>{formatDate(admin.lastAdminAccessAt)}</dd></div></dl><form className="profile-edit-panel" onSubmit={save}><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Profile photograph URL<input value={photoURL} onChange={(event) => setPhotoURL(event.target.value)} placeholder="https://..." /></label><div className="form-actions"><button className="primary-button" type="submit">Save Profile</button><button className="ghost-button" type="button" onClick={refreshSession}>Refresh session</button><a className="ghost-button" href={`${appBase}admin`}>Return to admin dashboard</a><button className="text-button" type="button" onClick={logout}>Sign out</button></div>{message && <p className="form-message">{message}</p>}</form></section></>;
}

function AdminActivityLogsPage({ admin }) {
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("Loading activity logs...");
  useEffect(() => { getAdminActivityLogs(25).then((result) => { setLogs(result.logs || []); setMessage(""); }).catch((error) => setMessage(error.message)); }, []);
  return <PermissionGate admin={admin} permission="admin.activity_logs.view"><AdminPageHeader eyebrow="Activity Logs" title="Activity-log foundation" description="Basic recent administrative activity. Filters arrive in a later admin-panel phase." admin={admin} />{message && <AdminEmptyState title="Activity logs" text={message} />}<section className="admin-card admin-log-list">{logs.length ? logs.map((log) => <article key={log.id}><strong>{log.action}</strong><span>{log.adminEmail} | {log.adminRole} | {formatDate(log.createdAt)}</span><p>{log.entityType}: {log.entityId}</p></article>) : !message && <AdminEmptyState title="No activity yet" text="Administrative actions will appear here as the panel grows." />}</section></PermissionGate>;
}

function AdminModulePlaceholder({ admin, title }) {
  return <><AdminPageHeader eyebrow="Admin Module" title={title} description="This module will be available in a later admin-panel phase." admin={admin} /><AdminEmptyState /></>;
}

function AdminAccessDeniedPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  async function logout() { await signOutUser(); routeTo(`${appBase}admin/login`); }
  return <main className="admin-login-page"><section className="admin-login-panel"><Brand small="Admin Portal" /><p className="eyebrow">Access denied</p><h1>Access denied</h1><p>Administrative authorization is required to open this area.</p><div className="form-actions"><a className="primary-button" href={`${appBase}student-desk`}>Return to student dashboard</a><a className="ghost-button" href={appBase}>Return to website</a><button className="text-button" type="button" onClick={() => setConfirmOpen(true)}>Sign out</button></div></section><ConfirmationDialog open={confirmOpen} title="Sign out?" message="This will end the current session on this device." onCancel={() => setConfirmOpen(false)} onConfirm={logout} /></main>;
}

function AdminPage({ path }) {
  return <AdminRouteGuard path={path}>{(admin) => <AdminLayout admin={admin} activePath={path}>{path === "/admin" ? <AdminOverview admin={admin} /> : path === "/admin/profile" ? <AdminProfilePage admin={admin} /> : path === "/admin/activity-logs" ? <AdminActivityLogsPage admin={admin} /> : <AdminModulePlaceholder admin={admin} title={(adminNavItems.find(([itemPath]) => itemPath === path)?.[1]) || "Admin Module"} />}</AdminLayout>}</AdminRouteGuard>;
}
function Footer() {
  return <footer className="site-footer"><div><Brand small="Student guidance for banking exams" /><p>Strategy, study targets, premium resources, and current affairs for serious banking aspirants.</p></div><div><h4>Plans</h4>{plans.slice(0, 4).map((plan) => <a href={`${appBase}#plans`} key={plan.planId}>{plan.name}</a>)}</div><div><h4>Platform</h4><a href={`${appBase}#strategy`}>Strategy</a><a href={`${appBase}#plans`}>Access Plans</a><a href={`${appBase}about`}>About Imran Sir</a><a href={`${appBase}student-desk`}>Student Desk</a><a href={`${appBase}privacy-policy`}>Privacy Policy</a></div><div><h4>Contact</h4><a href="mailto:support@delightguidance.com">support@delightguidance.com</a><span>India</span><span>Copyright {new Date().getFullYear()} Delight Banking</span></div></footer>;
}

export default function App() {
  const [route, setRoute] = useState(() => `${window.location.pathname}${window.location.search}${window.location.hash}`);
  useEffect(() => { const updateRoute = () => setRoute(`${window.location.pathname}${window.location.search}${window.location.hash}`); window.addEventListener("hashchange", updateRoute); window.addEventListener("popstate", updateRoute); return () => { window.removeEventListener("hashchange", updateRoute); window.removeEventListener("popstate", updateRoute); }; }, []);
  const url = new URL(window.location.href);
  const path = url.pathname.replace(appBase, "/");
  useEffect(() => { applyPageSeo(path); }, [path]);
  const checkoutMatch = path.match(/^\/checkout\/([^/]+)\/?$/);
  const paymentMatch = path.match(/^\/payment\/(success|failed|cancelled|processing|verification-failed|pending|status)\/?$/);
  void route;
  if (checkoutMatch) return <CheckoutPage variantId={decodeURIComponent(checkoutMatch[1])} />;
  if (paymentMatch) return <PaymentStatusPage orderId={url.searchParams.get("order_id") || url.searchParams.get("orderId")} />;
  if (path === "/admin/login") return <AdminLoginPage />;
  if (path === "/admin/access-denied") return <AdminAccessDeniedPage />;
  if (path.startsWith("/admin")) return <AdminPage path={path.replace(/\/$/, "") || "/admin"} />;
  if (path.endsWith("/student-desk") || url.hash.includes("student-desk")) return <StudentDeskPage />;
  if (path.endsWith("/about")) return <AboutPage />;
  if (path.endsWith("/privacy-policy") || url.hash === "#privacy-policy") return <PrivacyPolicyPage />;
  return <HomePage />;
}















