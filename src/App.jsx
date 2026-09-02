import { useEffect, useRef, useState } from "react";
import { load } from "@cashfreepayments/cashfree-js";
import { AuthModal } from "./components/AuthModal.jsx";
import { Brand } from "./components/Brand.jsx";
import { appBase, exams, getPlanVariant, mentorPhotoPath, plans } from "./config.js";
import {
  addResource,
  createPaymentOrder,
  getAdministrator,
  getAdministrators,
  getActiveAccessTags,
  getActiveSubscriptions,
  getAdminActivityLogs,
  getAdminDashboardOverview,
  getAdminMe,
  getPublicPlans,
  getOrderStatus,
  getPaymentSummary,
  getResources,
  getStudents,
  getStudyTracking,
  getUserProfile,
  hasResourceAccess,
  listenToAuth,
  promoteAdministrator,
  reauthenticateCurrentUser,
  reactivateAdministrator,
  revokeAdministrator,
  saveStudyTracking,
  saveUserProfile,
  searchAdminCandidate,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  updateAdminProfile,
  updateAdministratorRole,
  suspendAdministrator,
  verifyPayment,
  addAdminEntityNote,
  exportAdminReport,
  getAdminOrder,
  getAdminOrders,
  getAdminPlan,
  getAdminPlans,
  getAdminSubscription,
  getAdminSubscriptions,
  getAdminTransaction,
  getAdminTransactions,
  getAdminUser,
  getAdminUsers,
  grantAdminSubscription,
  createAdminPlan,
  updateAdminPlan,
  duplicateAdminPlan,
  setAdminPlanStatus,
  deleteUnusedAdminPlan,
  saveAdminPlanVariant,
  setAdminPlanVariantStatus,
  deleteUnusedAdminPlanVariant,
  mutateAdminSubscription,
  reconcileAdminTransaction,
  updateAdminUser,
  updateAdminUserStatus,
  deleteAdminClass,
  deleteAdminResource,
  deleteAdminTarget,
  duplicateAdminResource,
  getAdminClasses,
  getAdminResource,
  getAdminResources,
  getAdminTargets,
  getStudentClasses,
  getStudentContentDashboard,
  getStudentResource,
  getStudentResources,
  getStudentTarget,
  getStudentTargets,
  joinStudentClass,
  recordStudentResourceView,
  requestStudentFileAccess,
  saveAdminClass,
  saveAdminResource,
  saveAdminTarget,
  setAdminClassStatus,
  setAdminResourceStatus,
  setAdminTargetStatus,
  updateStudentTargetProgress,
  uploadProtectedResourceFile
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
const homeTitle = "Delight Banking - Banking Exam Mentorship & Guidance";
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

function findPlanVariantInCatalog(catalogPlans, variantId) {
  for (const plan of catalogPlans || []) {
    const variant = (plan.variants || []).find((item) => item.variantId === variantId);
    if (variant) return { ...variant, plan };
  }
  return null;
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

function routeTo(path, options = {}) {
  if (options.replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function SunIcon() {
  return <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>;
}

function MoonIcon() {
  return <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.99 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.78 9.79Z" /></svg>;
}
function ShieldIcon() {
  return <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6l-7-3Z" /><path d="M9.7 12.1 11.2 13.6 14.5 10.3" /></svg>;
}

function MenuIcon() {
  return <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
}

function CloseIcon() {
  return <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
}

const publicNavLinks = [
  [appBase, "Home"],
  [`${appBase}#programs`, "Exams"],
  [`${appBase}about`, "About"],
  [`${appBase}#strategy`, "Platform"],
  [`${appBase}#plans`, "Plans"],
  [`${appBase}#contact`, "Contact"]
];

function Header({ user, onAuth, onLogout }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("db_theme") || "light");
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [verifiedAdmin, setVerifiedAdmin] = useState(null);
  const profileRef = useRef(null);
  const mobileRef = useRef(null);
  const savedProfile = user?.email ? getUserProfile(user.email) : {};
  const studentName = savedProfile.name || user?.displayName || user?.email?.split("@")[0] || "Student";
  const isAdmin = Boolean(verifiedAdmin);

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

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") { setMobileOpen(false); setProfileOpen(false); }
    }
    function closeOnOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
      if (mobileOpen && mobileRef.current && !mobileRef.current.contains(event.target)) setMobileOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutside);
    };
  }, [mobileOpen]);

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-locked", mobileOpen);
    return () => document.body.classList.remove("mobile-nav-locked");
  }, [mobileOpen]);

  function closeMenus() {
    setMobileOpen(false);
    setProfileOpen(false);
  }

  function openAuth(mode) {
    closeMenus();
    onAuth(mode);
  }

  async function logout() {
    closeMenus();
    await onLogout();
  }

  function AccountActions({ mobile = false }) {
    if (user && isAdmin) {
      return <div className={mobile ? "mobile-account-actions" : "profile-dropdown"}><div className="profile-summary"><strong>{verifiedAdmin.displayName || studentName}</strong><span>{user.email}</span></div><a className="menu-link" href={`${appBase}admin`} onClick={closeMenus}>Admin Panel</a><a className="menu-link" href={`${appBase}admin/profile`} onClick={closeMenus}>Admin Profile</a><button className="menu-link danger-link" type="button" onClick={logout}>Logout</button></div>;
    }

    if (user) {
      return <div className={mobile ? "mobile-account-actions" : "profile-dropdown"}><div className="profile-summary"><strong>{studentName}</strong><span>{user.email}</span></div><a className="menu-link" href={`${appBase}student-desk`} onClick={closeMenus}>Dashboard</a><a className="menu-link" href={`${appBase}student-desk#profile`} onClick={closeMenus}>Profile</a><button className="menu-link danger-link" type="button" onClick={logout}>Logout</button><div className="menu-separator" /><a className="menu-link admin-login-menu-link" href={`${appBase}admin/login`} onClick={closeMenus}><span><ShieldIcon />Admin Login</span></a></div>;
    }

    return <div className={mobile ? "mobile-account-actions" : "desktop-account-actions"}><button className="ghost-button" type="button" onClick={() => openAuth("signin")}>Login</button><button className="primary-button" type="button" onClick={() => openAuth("signup")}>Create Account</button><div className="menu-separator" /><a className="admin-login-link" href={`${appBase}admin/login`} onClick={closeMenus}><ShieldIcon />Admin Login</a></div>;
  }

  return (
    <header className="site-header">
      <Brand />
      <nav className="main-nav" aria-label="Primary navigation">
        {publicNavLinks.map(([href, label]) => <a href={href} key={label}>{label}</a>)}
        <a href={`${appBase}student-desk`}>Student Desk</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button theme-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme"}>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</button>
        {user ? (
          <div className="profile-menu" ref={profileRef}>
            <button className={`profile-button ${savedProfile.photo ? "has-photo" : ""}`} type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-label="Open profile menu">
              {savedProfile.photo && <img src={savedProfile.photo} alt="" />}
              <span className="profile-initial">{studentName.slice(0, 1).toUpperCase()}</span>
            </button>
            {profileOpen && <AccountActions />}
          </div>
        ) : <AccountActions />}
        <button className="icon-button mobile-menu-button" type="button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-site-menu" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <CloseIcon /> : <MenuIcon />}</button>
      </div>
      <div className={`mobile-nav-backdrop ${mobileOpen ? "open" : ""}`} aria-hidden={!mobileOpen}>
        <aside className="mobile-nav-panel" id="mobile-site-menu" ref={mobileRef} aria-label="Mobile navigation">
          <div className="mobile-nav-head"><Brand small="Menu" /><button className="icon-button" type="button" aria-label="Close navigation menu" onClick={closeMenus}><CloseIcon /></button></div>
          <nav className="mobile-nav-links" aria-label="Mobile primary navigation">
            {publicNavLinks.map(([href, label]) => <a href={href} key={label} onClick={closeMenus}>{label}</a>)}
            <a href={`${appBase}student-desk`} onClick={closeMenus}>Student Desk</a>
          </nav>
          <div className="mobile-account-section"><span className="menu-label">Account</span><AccountActions mobile /></div>
        </aside>
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
  const canPurchase = selected.active !== false && selected.purchaseEnabled !== false && !(selected.requiresAccessEndDate && !selected.accessEndDate);
  const selectedPrice = selected.offerPriceInRupees ?? selected.priceInRupees;
  return (
    <article className={`plan-card mentorship-plan-card ${plan.featured ? "featured" : ""}`}>
      {plan.featured && <span className="featured-badge">Premium Featured</span>}
      {plan.cardImage && <img className="plan-card-image" src={plan.cardImage} loading="lazy" alt={plan.imageAlt || `${plan.name} plan poster`} />}
      <span className="chip">{plan.coverage}</span>
      <h3>{plan.name}</h3>
      <p className="plan-subtitle">{plan.subtitle}</p>
      <p className="mentor-byline">Mentorship by Imran Sir</p>
      <p>{plan.description}</p>
      <div className="duration-tabs" role="radiogroup" aria-label={`${plan.name} durations`}>
        {plan.variants.map((variant) => <button className={variant.variantId === selected.variantId ? "active" : ""} key={variant.variantId} type="button" role="radio" aria-checked={variant.variantId === selected.variantId} onClick={() => setSelectedId(variant.variantId)}><strong>{variant.durationLabel}</strong><span>{variant.active === false || variant.purchaseEnabled === false || (variant.requiresAccessEndDate && !variant.accessEndDate) ? "Configure date" : formatPrice(variant.offerPriceInRupees ?? variant.priceInRupees)}</span></button>)}
      </div>
      <div className="plan-price-row"><div className="price">{canPurchase ? formatPrice(selectedPrice) : "Offer setup pending"}</div><span className="status-pill">Validity: {selected.durationLabel}</span></div>{selected.publicNote && <p className="setup-note">{selected.publicNote}</p>}
      <ul>{plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
      <div className="form-actions"><button className="primary-button full" type="button" disabled={!canPurchase} onClick={() => routeTo(`${appBase}checkout/${selected.variantId}`)}>{canPurchase ? ownsVariant ? "Renew Plan" : "Choose Plan" : "Not Available"}</button><a className="ghost-button full" href={`${appBase}checkout/${selected.variantId}`}>View Details</a></div>
    </article>
  );
}

function PlanGrid({ paymentSummary, catalogPlans = plans }) {
  const ownedVariants = new Set(getActiveSubscriptions(paymentSummary).map((item) => item.variantId));
  return <div className="pricing-grid">{catalogPlans.map((plan) => <PlanCard key={plan.planId} plan={plan} ownedVariants={ownedVariants} />)}</div>;
}

function HomePage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [catalogPlans, setCatalogPlans] = useState(plans);
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
        <section className="section" id="plans"><div className="section-heading"><p className="eyebrow">Mentorship Plans</p><h2>Choose one-time access</h2><p>Monthly plans are one-time payments, not automatic recurring charges. Access starts after verified payment activation.</p></div><PlanGrid paymentSummary={paymentSummary} catalogPlans={catalogPlans} /></section>
      </main>
      <Footer />
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}
    </>
  );
}

function CheckoutPage({ variantId }) {
  const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
  const [dynamicPlans, setDynamicPlans] = useState(null);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const selected = findPlanVariantInCatalog(dynamicPlans || plans, variantId) || getPlanVariant(variantId);
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [accepted, setAccepted] = useState({ terms: false, refund: false, privacy: false });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  useEffect(() => { listenToAuth((nextUser) => { setUser(nextUser); setProfile(nextUser?.email ? getUserProfile(nextUser.email) : {}); if (!nextUser && !previewMode) setAuthMode("signin"); }); }, [previewMode]);
  useEffect(() => { getPublicPlans().then((result) => { setDynamicPlans(result?.plans || plans); setPlansLoaded(true); }).catch(() => { setDynamicPlans(plans); setPlansLoaded(true); }); }, []);
  if (!selected && !plansLoaded) return <Shell user={user} onAuth={setAuthMode}><section className="section"><div className="premium-card"><h1>Loading plan</h1><p>Preparing plan preview.</p></div></section></Shell>;
  if (!selected) return <Shell user={user} onAuth={setAuthMode}><section className="section"><div className="premium-card"><h1>Plan not found</h1><p>This plan variant is not available.</p><a className="primary-button" href={`${appBase}#plans`}>View Plans</a></div></section></Shell>;
  const { plan, ...variant } = selected;
  const canPurchaseVariant = variant.active !== false && variant.purchaseEnabled !== false && !(variant.requiresAccessEndDate && !variant.accessEndDate);
  if (!canPurchaseVariant) return <Shell user={user} onAuth={setAuthMode}><section className="section"><div className="premium-card"><h1>Plan setup pending</h1><p>This plan duration is visible for preview, but purchase is disabled until the access end date is configured by an administrator.</p><a className="primary-button" href={`${appBase}#plans`}>View Plans</a></div></section></Shell>;
  const canPay = !previewMode && user && accepted.terms && accepted.refund && accepted.privacy && status !== "processing";
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
  return <Shell user={user} onAuth={setAuthMode}><main className="checkout-page"><section className="checkout-shell"><article className="checkout-summary premium-card">{previewMode && <span className="admin-preview-banner">Admin Preview</span>}<span className="chip">{previewMode ? "Checkout Preview" : "Secure Checkout"}</span><h1>{plan.name}</h1><p className="plan-subtitle">{plan.subtitle}</p><p>{plan.coverage}</p><div className="plan-price-row"><div className="price">{formatPrice(variant.priceInRupees)}</div><span className="status-pill">{variant.durationLabel}</span></div><p>Access duration begins after verified payment activation. No automatic renewal or automatic debit is created.</p><ul>{plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul></article><article className="checkout-form premium-card"><h2>Student and billing details</h2>{!user && <p className="form-message">Login is required before payment.</p>}<label>Name<input value={profile.name || user?.displayName || ""} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Student name" /></label><label>Email<input value={user?.email || ""} disabled placeholder="Login required" /></label><label>Mobile number<input value={profile.phone || ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="For receipt and support" /></label><label>Billing address<textarea rows="3" value={profile.address || ""} onChange={(event) => setProfile({ ...profile, address: event.target.value })} placeholder="Address for receipt records" /></label><label className="checkbox-row"><input type="checkbox" checked={accepted.terms} onChange={(event) => setAccepted({ ...accepted, terms: event.target.checked })} /> Payments are for educational mentorship and guidance services; exam selection, results or employment are not guaranteed.</label><label className="checkbox-row"><input type="checkbox" checked={accepted.refund} onChange={(event) => setAccepted({ ...accepted, refund: event.target.checked })} /> I understand the refund policy must be reviewed before production payments are enabled.</label><label className="checkbox-row"><input type="checkbox" checked={accepted.privacy} onChange={(event) => setAccepted({ ...accepted, privacy: event.target.checked })} /> Card, UPI and banking credentials are handled inside the secure checkout and are not stored by Delight Banking.</label><button className="primary-button full" type="button" disabled={!canPay} onClick={pay}>{previewMode ? "Payment Disabled in Preview" : "Pay Securely"}</button><p className="setup-note">{previewMode ? "Preview mode never creates a payment order or activates access." : "You will enter card, UPI or banking details only inside the secure checkout."}</p>{message && <p className={`form-message ${status}`}>{message}</p>}</article></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={(nextUser) => { setUser(nextUser); setProfile(getUserProfile(nextUser.email)); }} />}</Shell>;
}

function normalizePaymentState(status) {
  const value = String(status || "pending").toLowerCase();
  if (value === "paid" || value === "success") return "paid";
  if (value === "failed") return "failed";
  if (["cancelled", "canceled", "expired", "user_dropped", "no_payment_attempt"].includes(value)) return "cancelled";
  return "pending";
}

function paymentLabel(status) {
  const value = String(status || "pending").toLowerCase();
  if (value === "paid" || value === "success") return "Paid";
  if (value === "failed") return "Failed";
  if (["cancelled", "canceled", "expired", "user_dropped", "no_payment_attempt"].includes(value)) return "Not Completed";
  if (value.includes("refund")) return "Refunded";
  if (value.includes("dispute")) return "Disputed";
  return "Pending";
}

const paymentStateContent = {
  paid: ["Payment Successful", "Your subscription has been activated."],
  pending: ["Payment Verification in Progress", "We are waiting for confirmation from the payment provider."],
  failed: ["Payment Failed", "Your payment could not be completed. No subscription has been activated."],
  cancelled: ["Payment Not Completed", "Your payment was not completed and no subscription has been activated."]
};

function PaymentStatusPage({ orderId }) {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [order, setOrder] = useState(null);
  const [paymentState, setPaymentState] = useState("pending");
  const [message, setMessage] = useState(orderId ? "Checking payment status..." : "Order id missing.");
  const [checking, setChecking] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 6;

  useEffect(() => { listenToAuth((nextUser) => { setUser(nextUser); setAuthReady(true); if (!nextUser) setAuthMode("signin"); }); }, []);

  async function refreshStatus({ manual = false } = {}) {
    if (!orderId || !user || checking) return;
    setChecking(true);
    if (manual) setMessage("Checking payment status...");
    try {
      const result = await getOrderStatus(orderId);
      const nextOrder = result.order || null;
      const nextState = normalizePaymentState(result.status || nextOrder?.paymentStatus || nextOrder?.orderStatus);
      setOrder(nextOrder);
      setPaymentState(nextState);
      if (nextState === "pending") setMessage(pollCount >= maxPolls ? "Payment confirmation is taking longer than expected." : paymentStateContent.pending[1]);
      else setMessage(paymentStateContent[nextState][1]);
    } catch (error) {
      setMessage(error.message || "Unable to verify payment status.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!authReady || !user || !orderId) return;
    refreshStatus();
  }, [authReady, user, orderId]);

  useEffect(() => {
    if (!user || !orderId || paymentState !== "pending" || checking || pollCount >= maxPolls) return;
    const timer = window.setTimeout(() => {
      setPollCount((current) => current + 1);
      refreshStatus();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [user, orderId, paymentState, checking, pollCount]);

  const [heading, body] = paymentStateContent[paymentState];
  const canRetry = paymentState === "failed" || paymentState === "cancelled";
  const retryVariant = order?.variantId || order?.trustedPlanSnapshot?.variantId;

  return <Shell user={user} onAuth={setAuthMode}><main className="checkout-page"><section className="payment-status-card premium-card"><span className="chip">Payment Verification</span><h1>{orderId ? heading : "Payment Status Unavailable"}</h1><p>{orderId ? body : "We could not find a payment order to verify."}</p>{message && <p className={`form-message ${paymentState === "pending" ? "neutral" : ""}`}>{message}</p>}{checking && <p className="setup-note">Checking with the secure payment server...</p>}{order && <div className="receipt-card" id="receipt"><h2>Payment Receipt</h2><dl className="student-details"><div><dt>Receipt number</dt><dd>{order.internalOrderNumber}</dd></div><div><dt>Student email</dt><dd>{order.userEmail}</dd></div><div><dt>Plan</dt><dd>{order.trustedPlanSnapshot?.name}</dd></div><div><dt>Duration</dt><dd>{order.trustedPlanSnapshot?.durationLabel}</dd></div><div><dt>Amount</dt><dd>{formatPrice(order.amountInRupees || order.amount || (order.amountInPaise / 100))}</dd></div><div><dt>Transaction ID</dt><dd>{order.paymentId || "Not completed"}</dd></div><div><dt>Activation</dt><dd>{formatDate(order.accessStartAt)}</dd></div><div><dt>Expiry</dt><dd>{formatDate(order.accessEndAt)}</dd></div><div><dt>Status</dt><dd>{paymentLabel(order.paymentStatus || paymentState)}</dd></div></dl><p>Delight Banking. Business/contact details placeholder. This is a payment receipt, not a GST tax invoice.</p></div>}<div className="form-actions">{canRetry && retryVariant && <a className="primary-button" href={`${appBase}checkout/${retryVariant}`}>Try Again</a>}{paymentState === "pending" && <button className="primary-button" type="button" disabled={checking} onClick={() => refreshStatus({ manual: true })}>Check Payment Status</button>}<a className="ghost-button" href={`${appBase}#plans`}>Return to Plans</a><a className="ghost-button" href={`${appBase}student-desk`}>Go to Dashboard</a></div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}

function StudentDeskPage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [resources, setResources] = useState([]);
  const [profile, setProfile] = useState({});
  const [profileMessage, setProfileMessage] = useState("");
  const [paymentSummary, setPaymentSummary] = useState({ subscriptions: [], payments: [], orders: [] });
  const [catalogPlans, setCatalogPlans] = useState(plans);
  const [deskView, setDeskView] = useState(() => window.location.hash === "#profile" ? "profile" : "dashboard");
  const [tracking, setTracking] = useState(getStudyTracking(""));
  useEffect(() => { listenToAuth((nextUser) => { setUser(nextUser); setProfile(nextUser?.email ? getUserProfile(nextUser.email) : {}); setTracking(nextUser?.email ? getStudyTracking(nextUser.email) : getStudyTracking("")); setAuthReady(true); }); getResources().then(setResources); getPublicPlans().then((result) => { if (result?.plans?.length) setCatalogPlans(result.plans); }).catch(() => setCatalogPlans(plans)); }, []);
  useEffect(() => { const syncHashView = () => { if (window.location.hash === '#profile') setDeskView('profile'); }; syncHashView(); window.addEventListener('hashchange', syncHashView); return () => window.removeEventListener('hashchange', syncHashView); }, []);
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
  return <Shell user={user} onAuth={setAuthMode} onLogout={logout}><main className="desk-page"><section className="student-dashboard-shell" id="student-desk"><aside className="student-sidebar"><div className="sidebar-profile"><div className="profile-logo">{studentName.slice(0, 1).toUpperCase()}</div><h3>{studentName}</h3><p>{user.email}</p></div><nav className="dashboard-menu"><button className={deskView === "dashboard" ? "active" : ""} onClick={() => setDeskView("dashboard")}>Dashboard</button><button className={deskView === "plans" ? "active" : ""} onClick={() => setDeskView("plans")}>My Plans</button><button className={deskView === "resources" ? "active" : ""} onClick={() => setDeskView("resources")}>Resources</button><button className={deskView === "payments" ? "active" : ""} onClick={() => setDeskView("payments")}>Payment History</button><button className={deskView === "tracking" ? "active" : ""} onClick={() => setDeskView("tracking")}>Study Tracking</button><button className={deskView === "profile" ? "active" : ""} onClick={() => setDeskView("profile")}>Student Profile</button></nav><div className="subscription-box"><span className="menu-label">Active Plans</span>{activeSubscriptions.length ? activeSubscriptions.map((item) => <span className="status-pill" key={item.id}>{item.planName}</span>) : <p>No active mentorship plan yet.</p>}<a className="ghost-button full" href={`${appBase}#plans`}>View Plans</a></div></aside><div className="student-dashboard-main"><div className="dashboard-topbar"><div><p className="eyebrow">Student Desk</p><h1 className="page-title">Your study dashboard</h1><p>{activeSubscriptions.length ? `Active access: ${[...accessTags].slice(0, 4).join(", ")}` : "No active mentorship plan yet."}</p></div><button className="ghost-button" type="button" onClick={refreshPayments}>Refresh</button></div>{deskView === "dashboard" && <div className="dashboard-view">{!activeSubscriptions.length ? <AccessPlansPanel paymentSummary={paymentSummary} catalogPlans={catalogPlans} /> : <><div className="desk-stats"><article className="stat-card"><span>Today Progress</span><strong>{todayPercent}%</strong></article><article className="stat-card"><span>Avg. Weekly Hours</span><strong>{averageWeeklyHours}</strong></article><article className="stat-card"><span>Active Plans</span><strong>{activeSubscriptions.length}</strong></article><article className="stat-card"><span>Resources</span><strong>{visibleResources.length}</strong></article></div><SubscriptionList title="My Plans" subscriptions={activeSubscriptions} /><ResourceList resources={visibleResources.slice(0, 3)} paymentSummary={paymentSummary} /></>}</div>}{deskView === "plans" && <><SubscriptionList title="Active subscriptions" subscriptions={activeSubscriptions} /><SubscriptionList title="Expired subscriptions" subscriptions={expiredSubscriptions} empty="No expired plans." /><AccessPlansPanel paymentSummary={paymentSummary} catalogPlans={catalogPlans} /></>}{deskView === "resources" && <div className="resource-panel"><div className="toolbar"><div><p className="eyebrow">Resources</p><h2>Purchased-plan resources</h2></div></div>{activeSubscriptions.length ? <ResourceList resources={visibleResources} paymentSummary={paymentSummary} /> : <NoPlan />}</div>}{deskView === "payments" && <PaymentHistory payments={paymentSummary.payments} orders={paymentSummary.orders} />}{deskView === "tracking" && <div className="tracking-view">{!activeSubscriptions.length ? <NoPlan /> : <><div className="tracking-controls"><label>Daily Target Hours<input type="number" min="1" max="16" value={tracking.targetHours} onChange={(event) => updateTracking("targetHours", event.target.value)} /></label><label>Completed Hours<input type="number" min="0" max="16" value={tracking.completedHours} onChange={(event) => updateTracking("completedHours", event.target.value)} /></label><label>Mocks Attempted<input type="number" min="0" max="50" value={tracking.mocksAttempted} onChange={(event) => updateTracking("mocksAttempted", event.target.value)} /></label><label>Accuracy %<input type="number" min="0" max="100" value={tracking.accuracy} onChange={(event) => updateTracking("accuracy", event.target.value)} /></label></div><div className="dashboard-grid"><StudyGraph tracking={tracking} /><SubjectProgress subjects={tracking.subjects} /></div></>}</div>}{deskView === "profile" && <ProfileForm profile={profile} user={user} profileMessage={profileMessage} updateProfile={(field, value) => setProfile({ ...profile, [field]: value })} saveProfile={saveProfile} />}</div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}

function AccessPlansPanel({ paymentSummary, catalogPlans = plans }) {
  return <section className="desk-access-panel"><div className="toolbar"><div><p className="eyebrow">Mentorship Access</p><h2>Choose your plan</h2><p>Access unlocks only after verified payment.</p></div></div><PlanGrid paymentSummary={paymentSummary} catalogPlans={catalogPlans} /></section>;
}

function NoPlan() {
  return <article className="resource-item"><h3>No active mentorship plan yet.</h3><p>Choose a plan to unlock purchased-plan resources.</p><a className="primary-button" href={`${appBase}#plans`}>View Plans</a></article>;
}

function NoPlanText({ text }) { return <article className="resource-item"><p>{text}</p></article>; }

function SubscriptionList({ title, subscriptions, empty = "No active mentorship plan yet." }) {
  return <section className="resource-panel"><div className="toolbar"><h2>{title}</h2></div><div className="subscription-grid">{subscriptions.length ? subscriptions.map((item) => <article className="resource-item" key={item.id}><header><div><h3>{item.planName}</h3><p>{item.durationLabel} access</p></div><span className="status-pill">{item.status}</span></header><div className="meta-row"><span>Start: {formatDate(item.accessStartAt)}</span><span>Expiry: {formatDate(item.accessEndAt)}</span><span>{daysRemaining(item.accessEndAt)} days left</span></div><a className="ghost-button" href={`${appBase}checkout/${item.variantId}`}>{item.status === "active" ? "Extend Access" : "Renew Plan"}</a></article>) : <NoPlanText text={empty} />}</div></section>;
}

function PaymentHistory({ payments, orders }) {
  return <section className="resource-panel"><div className="toolbar"><div><p className="eyebrow">Payment History</p><h2>Transactions</h2></div></div><div className="resource-list">{payments.length ? payments.map((payment) => <article className="resource-item" key={payment.id}><header><div><h3>{payment.cashfreePaymentId || payment.providerPaymentId || payment.id}</h3><p>{formatPrice(payment.amount || (payment.amountInPaise / 100))} paid on {formatDate(payment.capturedAt || payment.createdAt)}</p></div><span className="status-pill">{paymentLabel(payment.status)}</span></header><div className="meta-row"><span>{payment.currency}</span><span>{payment.paymentMethod || "Secure Payment"}</span><span>{payment.verified ? "Verified" : "Pending"}</span></div><button className="text-button" type="button" onClick={() => window.print()}>Receipt/invoice action</button></article>) : orders.length ? orders.map((order) => <article className="resource-item" key={order.id}><h3>{order.internalOrderNumber}</h3><p>{paymentLabel(order.paymentStatus || order.orderStatus)}</p></article>) : <NoPlanText text="No payment history yet." />}</div></section>;
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

function StudentContentDeskPage({ path }) {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading student content...");
  const resourceMatch = path.match(/^\/student-desk\/resources\/([^/]+)$/);
  const targetMatch = path.match(/^\/student-desk\/targets\/([^/]+)$/);
  const view = resourceMatch ? "resource" : targetMatch ? "target" : path.includes("/resources") ? "resources" : path.includes("/classes") ? "classes" : path.includes("/targets") ? "targets" : "dashboard";
  useEffect(() => listenToAuth(setUser), []);
  async function loadContent() {
    setMessage("Loading student content...");
    try {
      const result = resourceMatch ? await getStudentResource(decodeURIComponent(resourceMatch[1])) : targetMatch ? await getStudentTarget(decodeURIComponent(targetMatch[1])) : view === "resources" ? await getStudentResources() : view === "classes" ? await getStudentClasses() : view === "targets" ? await getStudentTargets() : await getStudentContentDashboard();
      setData(result);
      setMessage("");
      if (resourceMatch) recordStudentResourceView(decodeURIComponent(resourceMatch[1])).catch(() => {});
    } catch (error) {
      setMessage(error.message);
    }
  }
  useEffect(() => { if (user) loadContent(); }, [user?.uid, path]);
  async function logout() { await signOutUser(); setUser(null); }
  if (!user) return <Shell user={user} onAuth={setAuthMode}><main className="desk-page"><section className="admin-gate"><div className="premium-card gate-card student-login-gate"><Brand small="Student Desk" /><h1>Login to open Student Desk</h1><p>Sign in to view protected resources, classes, targets, subscriptions, and payment history.</p><button className="primary-button" type="button" onClick={() => setAuthMode("signin")}>Login</button></div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
  const resources = data?.resources?.items || data?.resources || [];
  const targets = data?.targets?.items || data?.targets || [];
  const classes = data?.classes?.items || data?.classes || [];
  const resource = data?.resource;
  const target = data?.target;
  return <Shell user={user} onAuth={setAuthMode} onLogout={logout}><main className="desk-page"><section className="student-dashboard-shell" id="student-desk"><aside className="student-sidebar"><div className="sidebar-profile"><div className="profile-logo">{(user.displayName || user.email || "S").slice(0, 1).toUpperCase()}</div><h3>{user.displayName || "Student"}</h3><p>{user.email}</p></div><nav className="dashboard-menu"><a className={view === "dashboard" ? "active" : ""} href={`${appBase}student-desk`}>Dashboard</a><a className={view === "resources" || view === "resource" ? "active" : ""} href={`${appBase}student-desk/resources`}>Resources</a><a className={view === "classes" ? "active" : ""} href={`${appBase}student-desk/classes`}>Classes</a><a className={view === "targets" || view === "target" ? "active" : ""} href={`${appBase}student-desk/targets`}>Targets</a></nav><div className="subscription-box"><span className="menu-label">Active access</span>{data?.access?.active ? data.access.planIds.map((planId) => <span className="status-pill" key={planId}>{planId}</span>) : <p>No active content access found.</p>}</div></aside><div className="student-dashboard-main"><div className="dashboard-topbar"><div><p className="eyebrow">Student Desk</p><h1 className="page-title">{view === "resource" ? resource?.title || "Resource" : view === "target" ? target?.title || "Target" : titleLabel(view)}</h1></div><button className="ghost-button" type="button" onClick={loadContent}>Refresh</button></div>{message ? <AdminEmptyState title="Student content" text={message} onRetry={loadContent} /> : <>{view === "dashboard" && <div className="dashboard-view"><div className="desk-stats"><article className="stat-card"><span>Resources</span><strong>{resources.length}</strong></article><article className="stat-card"><span>Targets</span><strong>{targets.length}</strong></article><article className="stat-card"><span>Classes</span><strong>{classes.length}</strong></article></div><StudentResourceCards resources={resources} /><StudentTargetCards targets={targets} /><StudentClassCards classes={classes} /></div>}{view === "resources" && <StudentResourceCards resources={resources} />}{view === "classes" && <StudentClassCards classes={classes} />}{view === "targets" && <StudentTargetCards targets={targets} />}{view === "resource" && resource && <StudentResourceDetail resource={resource} />}{view === "target" && target && <StudentTargetDetail target={target} progress={data.progress} onSave={async (completedTaskIds) => { await updateStudentTargetProgress(target.id, { completedTaskIds }); await loadContent(); }} />}</>}</div></section></main>{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}</Shell>;
}

function StudentResourceCards({ resources = [] }) {
  return <div className="resource-list">{resources.length ? resources.map((item) => <article className="resource-item" key={item.id}><header><div><h3>{item.title}</h3><p>{item.description || "Published resource"}</p></div><span className="status-pill">{titleLabel(item.type)}</span></header><div className="meta-row"><span>{item.planLabels?.join(", ") || "Plan access"}</span><span>{formatDate(item.publishAt || item.updatedAt)}</span></div><a className="text-button" href={`${appBase}student-desk/resources/${encodeURIComponent(item.id)}`}>Open Resource</a></article>) : <article className="resource-item"><h3>No resources available</h3><p>Published resources for your active plan will appear here.</p></article>}</div>;
}

function StudentResourceDetail({ resource }) {
  const [message, setMessage] = useState("");
  async function openFile(download = false) {
    setMessage("Preparing secure link...");
    try { const result = await requestStudentFileAccess(resource.id, download); window.open(result.file.url, "_blank", "noopener,noreferrer"); setMessage(""); } catch (error) { setMessage(error.message); }
  }
  return <section className="admin-profile-card"><AdminBackButton to="/student-desk/resources" label="Back to Resources" /><p>{resource.description}</p><dl className="student-details"><div><dt>Type</dt><dd>{titleLabel(resource.type)}</dd></div><div><dt>Plans</dt><dd>{resource.planLabels?.join(", ") || "Plan access"}</dd></div><div><dt>Published</dt><dd>{formatDate(resource.publishAt || resource.updatedAt)}</dd></div></dl><div className="form-actions">{resource.externalUrl && <a className="primary-button" href={resource.externalUrl} target="_blank" rel="noreferrer">Open Link</a>}{["pdf", "image"].includes(resource.type) && <><button className="primary-button" type="button" onClick={() => openFile(false)}>Open Secure File</button><button className="ghost-button" type="button" onClick={() => openFile(true)}>Download</button></>}</div>{message && <p className="form-message">{message}</p>}</section>;
}

function StudentTargetCards({ targets = [] }) {
  return <div className="resource-list">{targets.length ? targets.map((item) => <article className="resource-item" key={item.id}><header><div><h3>{item.title}</h3><p>{item.description || `${item.tasks?.length || 0} tasks`}</p></div><span className="status-pill">{titleLabel(item.cadence)}</span></header><div className="meta-row"><span>{item.planLabels?.join(", ") || "Plan access"}</span><span>{formatDate(item.targetDate || item.weekStart)}</span></div><a className="text-button" href={`${appBase}student-desk/targets/${encodeURIComponent(item.id)}`}>Open Target</a></article>) : <article className="resource-item"><h3>No targets available</h3><p>Published targets for your plan will appear here.</p></article>}</div>;
}

function StudentTargetDetail({ target, progress = {}, onSave }) {
  const [done, setDone] = useState(progress.completedTaskIds || []);
  const complete = new Set(done);
  return <section className="admin-profile-card"><AdminBackButton to="/student-desk/targets" label="Back to Targets" /><p>{target.description}</p><div className="target-task-list">{target.tasks?.map((task) => <label key={task.id}><input type="checkbox" checked={complete.has(task.id)} onChange={(event) => { const next = new Set(complete); if (event.target.checked) next.add(task.id); else next.delete(task.id); setDone([...next]); }} />{task.title}</label>)}</div><button className="primary-button" type="button" onClick={() => onSave(done)}>Save Progress</button></section>;
}

function StudentClassCards({ classes = [] }) {
  async function join(item) { const result = await joinStudentClass(item.id); window.open(result.joinUrl, "_blank", "noopener,noreferrer"); }
  return <div className="resource-list">{classes.length ? classes.map((item) => <article className="resource-item" key={item.id}><header><div><h3>{item.title}</h3><p>{item.description || "Plan-protected class"}</p></div><span className="status-pill">{titleLabel(item.status)}</span></header><div className="meta-row"><span>{formatDate(item.startAt)}</span><span>{item.host}</span></div><button className="text-button" type="button" onClick={() => join(item)}>Join/Open</button></article>) : <article className="resource-item"><h3>No classes available</h3><p>Upcoming or recorded classes for your plan will appear here.</p></article>}</div>;
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
  ["/admin/administrators", "Administrators", "admins.manage"],
  ["/admin/subscriptions", "Subscriptions", "subscriptions.view"],
  ["/admin/orders", "Orders", "orders.view"],
  ["/admin/transactions", "Transactions", "payments.view"],
  ["/admin/plans", "Plans", "plans.view"],
  ["/admin/resources", "Resources", "resources.view"],
  ["/admin/targets", "Targets", "resources.view"],
  ["/admin/classes", "Classes", "resources.view"],
  ["/admin/support", "Support", "support.view"],
  ["/admin/refunds", "Refunds", "refunds.view"],
  ["/admin/disputes", "Disputes", "payments.view"],
  ["/admin/reports", "Reports", "reports.view"],
  ["/admin/activity-logs", "Activity Logs", "admin.activity_logs.view"],
  ["/admin/settings", "Settings", "admins.manage"]
];

function adminHasPermission(admin, permission) {
  if (admin?.role === "super_admin") return true;
  const permissions = admin?.permissions || [];
  if (permissions.includes(permission)) return true;
  if (permission?.endsWith(".view")) return permissions.includes(`${permission.split(".")[0]}.manage`);
  return false;
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

function AdminEmptyState({ title = "Coming in Phase 2", text = "This module will be available in a later admin-panel phase.", onRetry = null }) {
  return <article className="admin-empty-state"><h3>{title}</h3><p>{text}</p>{onRetry && <button className="ghost-button" type="button" onClick={onRetry}>Retry</button>}</article>;
}

function AdminBackButton({ to, label }) {
  return <div className="admin-back-row"><a className="ghost-button" href={`${appBase}${to.replace(/^\//, "")}`}>{label}</a></div>;
}

function titleLabel(value) {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Not available";
}

function AdminStatusBadge({ value }) {
  const normalized = String(value || "unknown").toLowerCase().replace(/\s+/g, "_");
  return <span className={`admin-status-badge ${normalized}`}>{titleLabel(value)}</span>;
}

function amountPaidLabel(row) {
  if (row.amountPaidLabel) return row.amountPaidLabel;
  if (Number(row.amountPaid) > 0) return formatPrice(row.amountPaid);
  return "Payment record unavailable";
}

function ShortValue({ value, className = "" }) {
  const text = String(value || "");
  if (!text) return <span>-</span>;
  return <span className={`admin-truncated-value ${className}`} title={text}>{text}</span>;
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
  const visibleItems = adminNavItems.filter(([, , permission]) => adminHasPermission(admin, permission));
  return <aside className="admin-sidebar"><div className="admin-sidebar-brand"><Brand small="Admin Portal" /></div><nav>{visibleItems.map(([path, label]) => <button key={path} className={activePath === path ? "active" : ""} type="button" onClick={() => { onNavigate(path); if (onClose) onClose(); }}>{label}</button>)}</nav></aside>;
}

function AdminProfileMenu({ admin, onLogout }) {
  const [open, setOpen] = useState(false);
  return <div className="admin-profile-menu"><button className="admin-profile-trigger" type="button" onClick={() => setOpen(!open)}><span>{admin.displayName?.slice(0, 1).toUpperCase() || "A"}</span><div><strong>{admin.displayName}</strong><small>{admin.role.replace(/_/g, " ")}</small></div></button>{open && <div className="admin-profile-popover"><a href={`${appBase}admin/profile`}>Admin Profile</a><button type="button" onClick={onLogout}>Sign out</button></div>}</div>;
}

function AdminHeader({ admin, onMenu, onLogout }) {
  return <header className="admin-header"><button className="icon-button admin-menu-button" type="button" onClick={onMenu} aria-label="Open admin navigation"><MenuIcon /></button><div><strong>Delight Banking</strong><span>Admin</span></div><AdminProfileMenu admin={admin} onLogout={onLogout} /></header>;
}

function AdminMobileNavigation({ open, activePath, admin, onNavigate, onClose }) {
  useEffect(() => { document.body.classList.toggle("admin-drawer-open", open); return () => document.body.classList.remove("admin-drawer-open"); }, [open]);
  if (!open) return null;
  return <div className="admin-mobile-backdrop" role="presentation" onMouseDown={onClose}><div className="admin-mobile-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button close-button" type="button" onClick={onClose} aria-label="Close admin navigation"><CloseIcon /></button><AdminSidebar activePath={activePath} admin={admin} onNavigate={onNavigate} onClose={onClose} /></div></div>;
}

function AdminLayout({ admin, activePath, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  async function logout() { await signOutUser(); routeTo(`${appBase}admin/login`); }
  function navigate(path) { routeTo(`${appBase}${path.replace(/^\//, "")}`); }
  return <main className="admin-portal-page"><AdminMobileNavigation open={mobileOpen} activePath={activePath} admin={admin} onNavigate={navigate} onClose={() => setMobileOpen(false)} /><div className="admin-portal-shell"><AdminSidebar activePath={activePath} admin={admin} onNavigate={navigate} /><section className="admin-main"><AdminHeader admin={admin} onMenu={() => setMobileOpen(true)} onLogout={logout} />{children}<footer className="admin-footer-credit">Developed by <a href="mailto:darkdevil7325@gmail.com?subject=Delight%20Guidance%20Website%20Enquiry" title="Contact developer Arman" aria-label="Contact developer Arman">Arman</a></footer></section></div></main>;
}

function AdminRouteGuard({ path, children }) {
  const [state, setState] = useState({ status: "loading", admin: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth = null;

    async function authorize(currentUser) {
      if (!currentUser) {
        if (!cancelled) setState({ status: "unauthenticated", admin: null, error: "" });
        return;
      }
      if (!cancelled) setState((current) => ({ ...current, status: "loading", error: "" }));
      try {
        const result = await getAdminMe({ forceRefresh: false, logAccess: path === "/admin" });
        if (!cancelled) setState({ status: "authenticated_admin", admin: result.admin, error: "" });
      } catch (error) {
        if (cancelled) return;
        if (error.status === 401 || error.message === "Login required.") setState({ status: "unauthenticated", admin: null, error: "" });
        else if (error.status === 403) setState({ status: "authenticated_but_unauthorized", admin: null, error: error.message });
        else setState({ status: "error", admin: null, error: error.message || "Unable to verify administrator access." });
      }
    }

    listenToAuth(authorize).then((unsubscribe) => {
      unsubscribeAuth = unsubscribe;
      if (cancelled && typeof unsubscribeAuth === "function") unsubscribeAuth();
    }).catch((error) => {
      if (!cancelled) setState({ status: "error", admin: null, error: error.message || "Unable to restore Firebase session." });
    });

    return () => {
      cancelled = true;
      if (typeof unsubscribeAuth === "function") unsubscribeAuth();
    };
  }, [path]);

  useEffect(() => {
    if (state.status === "unauthenticated") routeTo(`${appBase}admin/login`, { replace: true });
  }, [state.status]);

  if (state.status === "loading") return <AdminLoadingSkeleton />;
  if (state.status === "unauthenticated") return <AdminLoadingSkeleton />;
  if (state.status === "authenticated_but_unauthorized") return <AdminAccessDeniedPage message={state.error} />;
  if (state.status === "error") return <main className="admin-portal-page"><AdminErrorState message={state.error} /></main>;
  return children(state.admin);
}
function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("Checking admin session...");
  const [accessDenied, setAccessDenied] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth = null;
    listenToAuth(async (currentUser) => {
      if (cancelled) return;
      if (!currentUser) {
        setCheckingSession(false);
        setMessage("");
        setAccessDenied(false);
        return;
      }
      try {
        await getAdminMe({ forceRefresh: true, logAccess: true });
        if (!cancelled) routeTo(`${appBase}admin`);
      } catch {
        if (!cancelled) {
          setCheckingSession(false);
          setAccessDenied(true);
          setMessage("This account does not have administrative access.");
        }
      }
    }).then((unsubscribe) => {
      unsubscribeAuth = unsubscribe;
      if (cancelled && typeof unsubscribeAuth === "function") unsubscribeAuth();
    });
    return () => {
      cancelled = true;
      if (typeof unsubscribeAuth === "function") unsubscribeAuth();
    };
  }, []);

  async function finishLogin(action) {
    setLoading(true);
    setAccessDenied(false);
    setMessage("");
    try {
      await action();
      await getAdminMe({ forceRefresh: true, logAccess: true });
      routeTo(`${appBase}admin`);
    } catch {
      setAccessDenied(true);
      setMessage("This account does not have administrative access.");
    } finally {
      setLoading(false);
      setCheckingSession(false);
    }
  }

  async function useDifferentAccount() {
    setLoading(true);
    setMessage("");
    try {
      await signOutUser();
      setAccessDenied(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      setMessage(error.message || "Could not sign out. Try again.");
    } finally {
      setLoading(false);
      setCheckingSession(false);
    }
  }

  async function forgotPassword() {
    setMessage("");
    try { await resetPassword(email.trim()); setMessage("Password reset link sent if the email exists."); } catch (error) { setMessage(error.message); }
  }

  return <main className="admin-login-page"><section className="admin-login-panel"><Brand small="Admin Portal" /><p className="eyebrow">Secure Administration</p><h1>Delight Banking Admin</h1>{checkingSession ? <p className="form-message neutral">Checking admin authorization...</p> : <><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label><label>Password<div className="password-row"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></label><button className="primary-button full" type="button" disabled={loading} onClick={() => finishLogin(() => signInWithEmail(email.trim(), password, "signin"))}>{loading ? "Checking access..." : "Login"}</button><button className="google-button full" type="button" disabled={loading} onClick={() => finishLogin(() => signInWithGoogle({ selectAccount: true }))}><span>G</span>Continue with Google</button><div className="auth-links"><button className="text-button" type="button" onClick={forgotPassword}>Forgot password?</button><a className="text-button" href={appBase}>Back to website</a></div>{message && <p className={`form-message ${accessDenied ? "" : "neutral"}`}>{message}</p>}{accessDenied && <div className="admin-login-actions"><button className="ghost-button full" type="button" disabled={loading} onClick={useDifferentAccount}>Use a Different Account</button><a className="ghost-button full" href={`${appBase}student-desk`}>Return to Student Dashboard</a></div>}</>}</section></main>;
}
function adminMetricValue(metric) {
  return metric?.currency ? formatPrice(metric.value || 0) : new Intl.NumberFormat("en-IN").format(metric?.value || 0);
}

function DashboardFilters({ filters, setFilters }) {
  const rangeLabels = { today: "Today", last_7_days: "Last 7 days", last_30_days: "Last 30 days", this_month: "This month", previous_month: "Previous month", custom: "Custom", all_time: "All time" };
  return <section className="admin-card admin-filter-bar"><div>{Object.entries(rangeLabels).map(([value, label]) => <button key={value} className={filters.range === value ? "active" : ""} type="button" onClick={() => setFilters({ ...filters, range: value })}>{label}</button>)}</div>{filters.range === "custom" && <div className="admin-date-fields"><label>Start<input type="date" value={filters.start || ""} onChange={(event) => setFilters({ ...filters, start: event.target.value })} /></label><label>End<input type="date" value={filters.end || ""} onChange={(event) => setFilters({ ...filters, end: event.target.value })} /></label></div>}</section>;
}

function MiniBarChart({ title, data = [], valuePrefix = "" }) {
  const max = Math.max(1, ...data.map((item) => Number(item.value || 0)));
  return <section className="admin-card admin-chart"><h2>{title}</h2>{data.length ? <div className="admin-bars" role="list" aria-label={title}>{data.map((item) => <div className="admin-bar-row" key={item.label} role="listitem"><span>{item.label}</span><div><i style={{ width: `${Math.max(4, (Number(item.value || 0) / max) * 100)}%` }}></i></div><strong>{valuePrefix}{new Intl.NumberFormat("en-IN").format(item.value || 0)}</strong></div>)}</div> : <AdminEmptyState title="No data" text="No records match the selected date range." />}</section>;
}

function DistributionChart({ title, data = [] }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  return <section className="admin-card admin-chart"><h2>{title}</h2>{total ? <div className="admin-distribution">{data.filter((item) => item.value).map((item) => <div key={item.label}><span>{item.label.replace(/_/g, " ")}</span><div><i style={{ width: `${(item.value / total) * 100}%` }}></i></div><strong>{item.value}</strong></div>)}</div> : <AdminEmptyState title="No payments" text="No payment records match this date range." />}</section>;
}

function AdminOverview({ admin }) {
  const [filters, setFilters] = useState({ range: "last_30_days", start: "", end: "" });
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState("Loading dashboard...");

  async function loadDashboard() {
    setMessage("Loading dashboard...");
    try {
      const result = await getAdminDashboardOverview(filters);
      setDashboard(result.dashboard);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load dashboard data.");
    }
  }

  useEffect(() => { loadDashboard(); }, [filters.range, filters.start, filters.end]);

  const summary = dashboard?.summary || {};
  const metrics = [
    ["Total registered users", summary.totalRegisteredUsers],
    ["New users", summary.newUsers],
    ["Email/password users", summary.passwordUsers],
    ["Google-login users", summary.googleUsers],
    ["Verified users", summary.verifiedUsers],
    ["Active subscriptions", summary.activeSubscriptions],
    ["Expiring subscriptions", summary.expiringSubscriptions],
    ["Expired subscriptions", summary.expiredSubscriptions],
    ["Successful payments", summary.successfulPayments],
    ["Pending payments", summary.pendingPayments],
    ["Failed payments", summary.failedPayments],
    ["Cancelled/user-dropped", summary.cancelledPayments],
    ["Total verified revenue", summary.totalVerifiedRevenue, true],
    ["Refunds", summary.refunds, true],
    ["Active administrators", summary.activeAdministrators]
  ];
  const quickActions = [["View Users", "/admin/users", "users.view"], ["View Subscriptions", "/admin/subscriptions", "subscriptions.view"], ["View Transactions", "/admin/transactions", "payments.view"], ["Manage Plans", "/admin/plans", "plans.manage"], ["Manage Resources", "/admin/resources", "resources.manage"], ["Add Administrator", "/admin/administrators", "admins.manage"], ["View Activity Logs", "/admin/activity-logs", "admin.activity_logs.view"]].filter(([, , permission]) => adminHasPermission(admin, permission));

  return <><AdminPageHeader eyebrow="Overview" title="Operations dashboard" description="Server-verified administrator source: Firebase ID token custom claims plus the active adminUsers record. Dates are displayed for India using the Asia/Kolkata policy." admin={admin} /><DashboardFilters filters={filters} setFilters={setFilters} />{message && <AdminErrorState message={message} />}{dashboard && <><div className="admin-metric-grid">{metrics.map(([label, value, currency]) => <article className="admin-metric-card" key={label}><span>{label}</span><strong>{adminMetricValue({ value, currency })}</strong></article>)}</div><section className="admin-card admin-quick-actions"><h2>Quick actions</h2><div>{quickActions.map(([label, href]) => <a className="ghost-button" key={label} href={`${appBase}${href.replace(/^\//, "")}`}>{label}</a>)}</div></section><div className="admin-chart-grid"><MiniBarChart title="User registrations over time" data={dashboard.userGrowth} /><MiniBarChart title="Successful revenue over time" data={dashboard.revenueGrowth} valuePrefix="Rs " /><DistributionChart title="Payment status distribution" data={dashboard.paymentDistribution} /><MiniBarChart title="Subscription purchases by plan" data={dashboard.planPerformance.map((item) => ({ label: `${item.planName} ${item.durationLabel}`, value: item.verifiedPurchases }))} /><MiniBarChart title="Active subscriptions by plan" data={dashboard.planPerformance.map((item) => ({ label: `${item.planName} ${item.durationLabel}`, value: item.activeSubscriptions }))} /></div><section className="admin-card admin-table-wrap"><h2>Recent registrations</h2>{dashboard.recentUsers.length ? <table className="admin-table"><thead><tr><th>User</th><th>Email</th><th>Provider</th><th>Verified</th><th>Registered</th><th>Subscription</th><th>Action</th></tr></thead><tbody>{dashboard.recentUsers.map((user) => <tr key={user.uid}><td>{user.photoURL ? <img className="admin-inline-avatar" src={user.photoURL} alt="" /> : <span className="admin-inline-avatar">{(user.displayName || user.email || "U").slice(0, 1).toUpperCase()}</span>} {user.displayName}</td><td>{user.email}</td><td>{user.provider}</td><td>{user.emailVerified ? "Verified" : "Not verified"}</td><td>{formatDate(user.createdAt)}</td><td>{user.subscriptionSummary}</td><td><a className="text-button" href={`${appBase}admin/users/${encodeURIComponent(user.uid)}`}>Open Profile</a></td></tr>)}</tbody></table> : <AdminEmptyState title="No registrations" text="No user registrations match this range." />}</section><section className="admin-card admin-table-wrap"><h2>Recent transactions</h2>{dashboard.recentTransactions.length ? <table className="admin-table"><thead><tr><th>Order</th><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Created</th><th>Verified</th></tr></thead><tbody>{dashboard.recentTransactions.map((item) => <tr key={item.id}><td>{item.internalOrderId}<br /><small>{item.cashfreeOrderId}</small></td><td>{item.userName}<br /><small>{item.userEmail}</small></td><td>{item.planName}<br /><small>{item.durationLabel}</small></td><td>{formatPrice(item.amountInRupees)}</td><td>{paymentLabel(item.status)}</td><td>{formatDate(item.createdAt)}</td><td>{formatDate(item.verifiedAt)}</td></tr>)}</tbody></table> : <AdminEmptyState title="No transactions" text="No transactions match this range." />}</section><section className="admin-card admin-table-wrap"><h2>Expiring subscriptions</h2>{dashboard.expiringSubscriptions.length ? <table className="admin-table"><thead><tr><th>Student</th><th>Plan</th><th>Start</th><th>End</th><th>Days</th><th>Status</th></tr></thead><tbody>{dashboard.expiringSubscriptions.map((item) => <tr key={item.id}><td>{item.student}</td><td>{item.planName}<br /><small>{item.durationLabel}</small></td><td>{formatDate(item.accessStartAt)}</td><td>{formatDate(item.accessEndAt)}</td><td>{item.daysRemaining}</td><td>{item.status}</td></tr>)}</tbody></table> : <AdminEmptyState title="No expiring subscriptions" text="No active subscriptions expire in the next 30 days." />}</section><section className="admin-card admin-table-wrap"><h2>Plan performance</h2><table className="admin-table"><thead><tr><th>Plan</th><th>Duration</th><th>Purchases</th><th>Active</th><th>Expired</th><th>Revenue</th><th>Refunds</th><th>Net</th></tr></thead><tbody>{dashboard.planPerformance.map((item) => <tr key={item.key}><td>{item.planName}</td><td>{item.durationLabel}</td><td>{item.verifiedPurchases}</td><td>{item.activeSubscriptions}</td><td>{item.expiredSubscriptions}</td><td>{formatPrice(item.verifiedRevenue)}</td><td>{formatPrice(item.refundAmount)}</td><td>{formatPrice(item.netVerifiedRevenue)}</td></tr>)}</tbody></table></section></>}</>;
}

function permissionGroup(permission) {
  if (permission.startsWith("users.")) return "Users";
  if (permission.startsWith("subscriptions.")) return "Subscriptions";
  if (permission.startsWith("payments.") || permission.startsWith("refunds.")) return "Payments";
  if (permission.startsWith("resources.") || permission.startsWith("plans.") || permission.startsWith("targets.") || permission.startsWith("classes.")) return "Content";
  if (permission.startsWith("admin.") || permission.startsWith("admins.")) return "Administration";
  return "Other";
}

function groupedPermissions(permissions = []) {
  return permissions.reduce((groups, permission) => {
    const group = permissionGroup(permission);
    groups[group] = [...(groups[group] || []), permission];
    return groups;
  }, {});
}

function AdminProfilePage({ admin, onUpdated }) {
  const [displayName, setDisplayName] = useState(admin.displayName || "");
  const [photoURL, setPhotoURL] = useState(admin.photoURL || "");
  const [businessPhone, setBusinessPhone] = useState(admin.businessPhone || "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const initials = (displayName || admin.email || "A").slice(0, 1).toUpperCase();
  const permissions = groupedPermissions(admin.permissions || []);

  async function save(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await updateAdminProfile({ displayName, photoURL, businessPhone });
      onUpdated?.(result.admin);
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSession() { await getAdminMe({ forceRefresh: true }); setMessage("Session refreshed."); }
  async function logout() { await signOutUser(); routeTo(`${appBase}admin/login`, { replace: true }); }

  return <><AdminPageHeader eyebrow="Admin Profile" title="Profile and session" description="Role, status, permissions and UID are read-only security fields verified by the server." admin={admin} /><section className="admin-profile-card admin-profile-pro"><div className="admin-profile-hero"><div className="admin-photo-preview">{photoURL && !imageFailed ? <img src={photoURL} alt="" onError={() => setImageFailed(true)} /> : <span>{initials}</span>}</div><div><h2>{admin.displayName}</h2><p>{admin.email}</p><div className="admin-badge-row"><AdminRoleBadge role={admin.role} /><span className={`admin-status-badge ${admin.status}`}>{statusLabel(admin.status)}</span></div></div></div><dl className="student-details admin-security-fields"><div><dt>Firebase UID</dt><dd>{admin.uid}</dd></div><div><dt>Authentication provider</dt><dd>{admin.provider || "unknown"}</dd></div><div><dt>Email verification</dt><dd>{admin.emailVerified === null ? "Not available" : admin.emailVerified ? "Verified" : "Not verified"}</dd></div><div><dt>Created date</dt><dd>{formatDate(admin.createdAt)}</dd></div><div><dt>Last admin access</dt><dd>{formatDate(admin.lastAdminAccessAt)}</dd></div><div><dt>Last profile update</dt><dd>{formatDate(admin.updatedAt)}</dd></div></dl><section className="admin-permission-groups"><h3>Assigned permissions</h3>{Object.entries(permissions).map(([group, items]) => <div key={group}><strong>{group}</strong><div className="permission-list">{items.map((permission) => <span key={permission}>{permission}</span>)}</div></div>)}</section><form className="profile-edit-panel" onSubmit={save}><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Profile photograph URL<input value={photoURL} onChange={(event) => { setPhotoURL(event.target.value); setImageFailed(false); }} placeholder="https://..." /></label><label>Business phone<input value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} placeholder="Optional" /></label><div className="form-actions"><button className="primary-button" type="submit" disabled={loading}>{loading ? "Saving..." : "Save Profile"}</button><button className="ghost-button" type="button" onClick={refreshSession}>Refresh session</button><a className="ghost-button" href={`${appBase}admin`}>Return to Dashboard</a><button className="text-button" type="button" onClick={logout}>Sign Out</button></div>{message && <p className="form-message neutral">{message}</p>}</form></section></>;
}

function AdminActivityLogsPage({ admin }) {
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("Loading activity logs...");
  useEffect(() => { getAdminActivityLogs(25).then((result) => { setLogs(result.logs || []); setMessage(""); }).catch((error) => setMessage(error.message)); }, []);
  return <PermissionGate admin={admin} permission="admin.activity_logs.view"><AdminPageHeader eyebrow="Activity Logs" title="Activity-log foundation" description="Basic recent administrative activity. Filters arrive in a later admin-panel phase." admin={admin} />{message && <AdminEmptyState title="Activity logs" text={message} />}<section className="admin-card admin-log-list">{logs.length ? logs.map((log) => <article key={log.id}><strong>{log.action}</strong><span>{log.adminEmail} | {log.adminRole} | {formatDate(log.createdAt)}</span><p>{log.entityType}: {log.entityId}</p></article>) : !message && <AdminEmptyState title="No activity yet" text="Administrative actions will appear here as the panel grows." />}</section></PermissionGate>;
}

const limitedAdminRoles = ["admin", "support", "content_manager"];
const roleLabels = { super_admin: "Super Admin", admin: "Admin", support: "Support", content_manager: "Content Manager" };
const statusLabels = { active: "Active", suspended: "Suspended", revoked: "Revoked" };

function roleLabel(role) {
  return roleLabels[role] || String(role || "Unknown");
}

function statusLabel(status) {
  return statusLabels[status] || String(status || "Unknown");
}

function AddAdministratorDialog({ open, onClose, onAdded }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [candidate, setCandidate] = useState(null);
  const [role, setRole] = useState("admin");
  const [confirmation, setConfirmation] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (!open) { setStep(1); setEmail(""); setCandidate(null); setRole("admin"); setConfirmation(""); setReauthPassword(""); setNeedsReauth(false); setMessage(""); } }, [open]);
  if (!open) return null;
  async function findCandidate(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try { const trimmed = email.trim(); if (!trimmed || !trimmed.includes("@")) throw new Error("Enter a valid exact email address."); const result = await searchAdminCandidate(trimmed); setCandidate(result.user); setStep(2); }
    catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }
  async function submitPromotion() {
    setLoading(true);
    setMessage("");
    try { if (!candidate?.uid) throw new Error("Select a verified user before granting administrator access."); const result = await promoteAdministrator({ uid: candidate.uid, role, confirmation }); setMessage(result.message || `Administrator access granted successfully. Role: ${roleLabel(role)}. The new administrator must sign out and sign in again.`); onAdded?.(result.administrator); setStep(2); }
    catch (error) { setNeedsReauth(error.code === "RECENT_LOGIN_REQUIRED" || error.message.includes("Recent authentication")); setMessage(error.message); }
    finally { setLoading(false); }
  }
  async function refreshAdminSession() {
    setLoading(true);
    setMessage("");
    try {
      await reauthenticateCurrentUser(reauthPassword, { selectAccount: true });
      setNeedsReauth(false);
      setReauthPassword("");
      setMessage("Session refreshed. Grant access again.");
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }
  const cannotPromote = candidate && (!candidate.emailVerified || candidate.disabled || candidate.adminStatus === "active");
  const promoteReason = !candidate ? "" : !candidate.emailVerified ? "Cannot promote: email is not verified." : candidate.disabled ? "Cannot promote: Firebase account is disabled." : candidate.adminStatus === "active" ? "Cannot promote: this user is already an active administrator." : candidate.adminStatus ? `Ready to promote. Previous admin status: ${candidate.adminStatus}.` : "Ready to promote.";
  const permissions = candidate ? limitedAdminRoles.includes(role) ? role === "admin" ? ["users.view", "users.manage", "subscriptions.view", "subscriptions.manage", "orders.view", "payments.view", "payments.reconcile", "refunds.view", "plans.view", "resources.manage", "support.manage", "reports.view", "reports.export"] : role === "support" ? ["users.view", "subscriptions.view", "payments.view_limited", "support.manage"] : ["plans.view", "resources.manage", "targets.manage", "classes.manage"] : [] : [];
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="admin-management-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button close-button" type="button" onClick={onClose} aria-label="Close dialog">x</button><p className="eyebrow">Add Administrator</p><h2>Promote an existing verified user</h2>{step === 1 && <form onSubmit={findCandidate} className="admin-dialog-step"><label>Exact verified email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" required /></label><button className="primary-button" disabled={loading} type="submit">Find Account</button></form>}{step >= 2 && candidate && <div className="admin-dialog-step"><dl className="student-details"><div><dt>Name</dt><dd>{candidate.displayName}</dd></div><div><dt>Email</dt><dd>{candidate.email}</dd></div><div><dt>Verified</dt><dd>{candidate.emailVerified ? "Yes" : "No"}</dd></div><div><dt>Provider</dt><dd>{candidate.provider}</dd></div><div><dt>Created</dt><dd>{formatDate(candidate.createdAt)}</dd></div><div><dt>Admin status</dt><dd>{candidate.adminStatus || "Not administrator"}</dd></div></dl>{promoteReason && <p className={`form-message ${cannotPromote ? "" : "neutral"}`}>{promoteReason}</p>}{step === 2 && !cannotPromote && <button className="primary-button" type="button" onClick={() => setStep(3)}>Continue</button>}</div>}{step >= 3 && candidate && <div className="admin-dialog-step"><label>Limited administrator role<select value={role} onChange={(event) => setRole(event.target.value)}>{limitedAdminRoles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}</select></label>{step === 3 && <button className="primary-button" type="button" onClick={() => setStep(4)}>Review Permissions</button>}</div>}{step >= 4 && <div className="admin-dialog-step"><h3>Permissions</h3><div className="permission-list">{permissions.map((permission) => <span key={permission}>{permission}</span>)}</div>{step === 4 && <button className="primary-button" type="button" onClick={() => setStep(5)}>Continue to Confirm</button>}</div>}{step === 5 && <div className="admin-dialog-step"><label>Type ADD ADMIN to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{needsReauth && <div className="admin-reauth-box"><label>Password for email admins<input type="password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} placeholder="Google admins can leave this blank" /></label><button className="ghost-button" type="button" disabled={loading} onClick={refreshAdminSession}>Refresh Session</button></div>}<button className="primary-button" type="button" disabled={loading || cannotPromote || !candidate?.uid || confirmation !== "ADD ADMIN"} onClick={submitPromotion}>{loading ? "Granting..." : "Grant Access"}</button></div>}{message && <p className="form-message">{message}</p>}</section></div>;
}

function AdminActionDialog({ action, adminUser, onCancel, onDone }) {
  const [role, setRole] = useState(adminUser?.role === "admin" ? "support" : "admin");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!adminUser || !action) return;
    setRole(adminUser.role === "admin" ? "support" : "admin");
    setReason("");
    setConfirmation("");
    setReauthPassword("");
    setNeedsReauth(false);
    setMessage("");
  }, [adminUser?.uid, action]);
  if (!action || !adminUser) return null;
  const isRole = action === "role";
  const isRevoke = action === "revoke";
  const title = isRole ? "Change administrator role" : action === "suspend" ? "Suspend administrator" : action === "reactivate" ? "Reactivate administrator" : "Revoke administrator access";
  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const payload = { reason, confirmation };
      const result = isRole ? await updateAdministratorRole(adminUser.uid, { role, reason }) : action === "suspend" ? await suspendAdministrator(adminUser.uid, payload) : action === "reactivate" ? await reactivateAdministrator(adminUser.uid, { reason }) : await revokeAdministrator(adminUser.uid, payload);
      setMessage(result.message);
      onDone?.(result.administrator);
    } catch (error) { setNeedsReauth(error.code === "RECENT_LOGIN_REQUIRED" || error.message.includes("Recent authentication")); setMessage(error.message); }
    finally { setLoading(false); }
  }
  async function refreshAdminSession() {
    setLoading(true);
    setMessage("");
    try {
      await reauthenticateCurrentUser(reauthPassword, { selectAccount: true });
      setNeedsReauth(false);
      setReauthPassword("");
      setMessage("Session refreshed. Confirm the action again.");
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}><section className="confirmation-dialog admin-management-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><h3>{title}</h3><p>{adminUser.email}</p>{isRole && <><label>New limited role<select value={role} onChange={(event) => setRole(event.target.value)}>{limitedAdminRoles.filter((item) => item !== adminUser.role).map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}</select></label><div className="permission-list"><span>Current: {roleLabel(adminUser.role)}</span><span>New: {roleLabel(role)}</span></div></>}<label>Reason<textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for audit logs" /></label>{isRevoke && <label>Type REVOKE ADMIN<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}{needsReauth && <div className="admin-reauth-box"><label>Password for email admins<input type="password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} placeholder="Google admins can leave this blank" /></label><button className="ghost-button" type="button" disabled={loading} onClick={refreshAdminSession}>Refresh Session</button></div>}<div className="form-actions"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className={isRevoke || action === "suspend" ? "primary-button danger-action" : "primary-button"} type="button" disabled={loading || reason.trim().length < 3 || (isRevoke && confirmation !== "REVOKE ADMIN")} onClick={submit}>Confirm</button></div>{message && <p className="form-message">{message}</p>}</section></div>;
}

function AdministratorsTable({ administrators, currentAdmin, onOpen, onAction }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Created by</th><th>Last access</th><th>Provider</th><th>Actions</th></tr></thead><tbody>{administrators.map((item) => <tr key={item.uid}><td>{item.displayName}</td><td>{item.email}</td><td><span className={`admin-role-badge ${item.role}`}>{roleLabel(item.role)}</span></td><td><span className={`admin-status-badge ${item.status}`}>{statusLabel(item.status)}</span></td><td>{formatDate(item.createdAt)}</td><td>{item.createdByEmail || "Bootstrap"}</td><td>{formatDate(item.lastAdminAccessAt)}</td><td>{item.provider}</td><td><div className="admin-row-actions"><button className="text-button" type="button" onClick={() => onOpen(item.uid)}>Open</button>{item.uid !== currentAdmin.uid && item.role !== "super_admin" && item.status === "active" && <button className="text-button" type="button" onClick={() => onAction("role", item)}>Role</button>}{item.uid !== currentAdmin.uid && item.status === "active" && <button className="text-button danger-link" type="button" onClick={() => onAction("suspend", item)}>Suspend</button>}{item.status === "suspended" && <button className="text-button" type="button" onClick={() => onAction("reactivate", item)}>Reactivate</button>}{item.uid !== currentAdmin.uid && item.status !== "revoked" && <button className="text-button danger-link" type="button" onClick={() => onAction("revoke", item)}>Revoke</button>}</div></td></tr>)}</tbody></table><div className="admin-mobile-list">{administrators.map((item) => <article className="admin-mobile-card" key={item.uid}><header><div><strong>{item.displayName}</strong><span>{item.email}</span></div><span className={`admin-status-badge ${item.status}`}>{statusLabel(item.status)}</span></header><p>{roleLabel(item.role)} | {item.provider} | Created {formatDate(item.createdAt)}</p><div className="admin-row-actions"><button className="ghost-button" type="button" onClick={() => onOpen(item.uid)}>Open</button>{item.uid !== currentAdmin.uid && item.role !== "super_admin" && item.status === "active" && <button className="ghost-button" type="button" onClick={() => onAction("role", item)}>Role</button>}{item.uid !== currentAdmin.uid && item.status === "active" && <button className="ghost-button" type="button" onClick={() => onAction("suspend", item)}>Suspend</button>}{item.status === "suspended" && <button className="ghost-button" type="button" onClick={() => onAction("reactivate", item)}>Reactivate</button>}{item.uid !== currentAdmin.uid && item.status !== "revoked" && <button className="ghost-button" type="button" onClick={() => onAction("revoke", item)}>Revoke</button>}</div></article>)}</div></div>;
}

function AdminAdministratorsPage({ admin }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("Loading administrators...");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [action, setAction] = useState(null);
  const pageSize = 10;
  async function loadAdmins() { setMessage("Loading administrators..."); try { const result = await getAdministrators(); setItems(result.administrators || []); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { loadAdmins(); }, []);
  const filtered = items.filter((item) => { const text = `${item.displayName} ${item.email}`.toLowerCase(); return text.includes(query.toLowerCase()) && (role === "all" || item.role === role) && (status === "all" || item.status === status); });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  function openDetail(uid) { routeTo(`${appBase}admin/administrators/${uid}`); }
  function replaceItem(next) { if (!next) return loadAdmins(); setItems((current) => current.map((item) => item.uid === next.uid ? next : item)); }
  return <PermissionGate admin={admin} permission="admins.manage"><AdminPageHeader eyebrow="Security" title="Administrators" description="Manage limited administrative access for existing verified Delight Banking users only." admin={admin} /><section className="admin-card admin-management-toolbar"><div className="admin-filter-grid"><label>Search<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name or email" /></label><label>Role<select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="all">All roles</option><option value="super_admin">Super Admin</option>{limitedAdminRoles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}</select></label><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></label></div><button className="primary-button" type="button" onClick={() => setAddOpen(true)}>Add Administrator</button></section>{message ? <AdminEmptyState title="Administrators" text={message} /> : visible.length ? <AdministratorsTable administrators={visible} currentAdmin={admin} onOpen={openDetail} onAction={(nextAction, item) => setAction({ action: nextAction, item })} /> : <AdminEmptyState title="No administrators found" text="No administrator records match the current filters." />}<div className="admin-pagination"><button className="ghost-button" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="ghost-button" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div><AddAdministratorDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={(item) => { replaceItem(item); setAddOpen(false); }} /><AdminActionDialog action={action?.action} adminUser={action?.item} onCancel={() => setAction(null)} onDone={(item) => { replaceItem(item); setAction(null); }} /></PermissionGate>;
}

function AdminAdministratorDetailPage({ admin, uid }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("Loading administrator...");
  const [action, setAction] = useState(null);
  async function loadDetail() { setMessage("Loading administrator..."); try { const result = await getAdministrator(uid); setDetail(result); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { loadDetail(); }, [uid]);
  const item = detail?.administrator;
  function applyUpdate(next) { setDetail((current) => ({ ...(current || {}), administrator: next, activity: current?.activity || [] })); }
  return <PermissionGate admin={admin} permission="admins.manage"><AdminPageHeader eyebrow="Administrator" title="Administrator details" description="Review profile, access status, permissions and recent safe activity." admin={admin} />{message ? <AdminEmptyState title="Administrator details" text={message} /> : item && <><section className="admin-profile-card"><div className="admin-detail-heading"><div><h2>{item.displayName}</h2><p>{item.email}</p></div><span className={`admin-status-badge ${item.status}`}>{statusLabel(item.status)}</span></div><dl className="student-details"><div><dt>UID</dt><dd>{item.uid}</dd></div><div><dt>Role</dt><dd>{roleLabel(item.role)}</dd></div><div><dt>Provider</dt><dd>{item.provider}</dd></div><div><dt>Email verified</dt><dd>{item.emailVerified === null ? "Not available" : item.emailVerified ? "Yes" : "No"}</dd></div><div><dt>Created by</dt><dd>{item.createdByEmail || "Bootstrap"}</dd></div><div><dt>Created</dt><dd>{formatDate(item.createdAt)}</dd></div><div><dt>Last access</dt><dd>{formatDate(item.lastAdminAccessAt)}</dd></div><div><dt>Updated</dt><dd>{formatDate(item.updatedAt)}</dd></div><div><dt>Suspension</dt><dd>{item.suspensionReason || "None"}</dd></div><div><dt>Revocation</dt><dd>{item.revocationReason || "None"}</dd></div></dl><div className="permission-list">{item.permissions.map((permission) => <span key={permission}>{permission}</span>)}</div><div className="form-actions">{item.uid !== admin.uid && item.role !== "super_admin" && item.status === "active" && <button className="ghost-button" type="button" onClick={() => setAction("role")}>Change Role</button>}{item.uid !== admin.uid && item.status === "active" && <button className="ghost-button" type="button" onClick={() => setAction("suspend")}>Suspend</button>}{item.status === "suspended" && <button className="ghost-button" type="button" onClick={() => setAction("reactivate")}>Reactivate</button>}{item.uid !== admin.uid && item.status !== "revoked" && <button className="primary-button danger-action" type="button" onClick={() => setAction("revoke")}>Revoke Access</button>}<a className="ghost-button" href={`${appBase}admin/administrators`}>Back</a></div></section><section className="admin-card admin-log-list"><h2>Recent safe activity</h2>{detail.activity?.length ? detail.activity.map((log) => <article key={log.id}><strong>{log.action}</strong><span>{formatDate(log.createdAt)}</span><p>{log.reason || log.safeMetadata?.reason || "No reason recorded."}</p></article>) : <AdminEmptyState title="No activity" text="No administrator-management activity has been recorded for this account yet." />}</section><AdminActionDialog action={action} adminUser={item} onCancel={() => setAction(null)} onDone={(next) => { applyUpdate(next); setAction(null); loadDetail(); }} /></>}</PermissionGate>;
}
function downloadTextFile(filename, text, type = "text/csv") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function AdminPager({ page, pageSize, total, hasMore, onPage }) {
  return <div className="admin-pagination"><button className="ghost-button" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} | {total} records</span><button className="ghost-button" type="button" disabled={!hasMore} onClick={() => onPage(page + 1)}>Next</button></div>;
}

function AdminOperationalFilters({ filters, setFilters, type, onExport, canExport }) {
  return <section className="admin-card admin-management-toolbar phase3-toolbar"><div className="admin-filter-grid"><label>Search<input value={filters.q || ""} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })} placeholder="Name, email, ID or phone" /></label>{type === "users" && <><label>Provider<select value={filters.provider || ""} onChange={(event) => setFilters({ ...filters, provider: event.target.value, page: 1 })}><option value="">All providers</option><option value="google.com">Google</option><option value="password">Email/password</option></select></label><label>Verified<select value={filters.verified || ""} onChange={(event) => setFilters({ ...filters, verified: event.target.value, page: 1 })}><option value="">All</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select></label><label>Status<select value={filters.status || ""} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="blocked">Blocked</option></select></label><label>Subscription<select value={filters.subscriptionStatus || ""} onChange={(event) => setFilters({ ...filters, subscriptionStatus: event.target.value, page: 1 })}><option value="">All</option><option value="active">Active plan</option><option value="none">No active plan</option></select></label></>}{["subscriptions", "orders", "transactions"].includes(type) && <><label>Status<select value={filters.status || ""} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}><option value="">All statuses</option><option value="active">Active</option><option value="expired">Expired</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="successful">Successful</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="user_dropped">User dropped</option><option value="revoked">Revoked</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option></select></label><label>Plan<select value={filters.plan || ""} onChange={(event) => setFilters({ ...filters, plan: event.target.value, page: 1 })}><option value="">All plans</option>{plans.flatMap((plan) => plan.variants.map((variant) => <option value={variant.variantId} key={variant.variantId}>{plan.name} {variant.durationLabel}</option>))}</select></label><label>Start<input type="date" value={filters.start || ""} onChange={(event) => setFilters({ ...filters, start: event.target.value, page: 1 })} /></label><label>End<input type="date" value={filters.end || ""} onChange={(event) => setFilters({ ...filters, end: event.target.value, page: 1 })} /></label></>}{type === "subscriptions" && <><label>Source<select value={filters.source || ""} onChange={(event) => setFilters({ ...filters, source: event.target.value, page: 1 })}><option value="">All sources</option><option value="cashfree_payment">Cashfree payment</option><option value="admin_granted">Admin granted</option><option value="complimentary">Complimentary</option><option value="migration">Migration</option></select></label><label>Expiry<select value={filters.expiry || ""} onChange={(event) => setFilters({ ...filters, expiry: event.target.value, page: 1 })}><option value="">Any expiry</option><option value="next_30">Next 30 days</option></select></label></>}</div><div className="form-actions"><button className="ghost-button" type="button" onClick={() => setFilters({ page: 1, pageSize: 20 })}>Reset filters</button>{canExport && <button className="ghost-button" type="button" onClick={onExport}>Export CSV</button>}</div></section>;
}

function Phase3ActionDialog({ open, title, fields = [], onCancel, onConfirm }) {
  const [values, setValues] = useState({ reason: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (open) { setValues({ reason: "" }); setMessage(""); } }, [open, title]);
  if (!open) return null;
  async function submit() {
    setLoading(true);
    setMessage("");
    const payload = { ...values };
    fields.forEach((field) => {
      if ((payload[field.name] === undefined || payload[field.name] === "") && field.type === "select") payload[field.name] = field.defaultValue || field.options?.[0]?.value || "";
    });
    try { await onConfirm(payload); onCancel(); } catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}><section className="confirmation-dialog admin-management-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><h3>{title}</h3>{fields.map((field) => <label key={field.name}>{field.label}{field.type === "select" ? <select value={values[field.name] || field.defaultValue || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}>{field.options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select> : <input type={field.type || "text"} value={values[field.name] || ""} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}</label>)}<label>Reason<textarea rows="3" value={values.reason || ""} onChange={(event) => setValues({ ...values, reason: event.target.value })} placeholder="Required for audit log" /></label><div className="form-actions"><button className="ghost-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="button" disabled={loading || !values.reason?.trim()} onClick={submit}>{loading ? "Working..." : "Confirm"}</button></div>{message && <p className="form-message">{message}</p>}</section></div>;
}

function AdminUsersPage({ admin }) {
  const [filters, setFilters] = useState({ page: 1, pageSize: 20 });
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading users...");
  useEffect(() => { let active = true; setMessage("Loading users..."); getAdminUsers(filters).then((result) => { if (active) { setData(result.users); setMessage(""); } }).catch((error) => active && setMessage(error.message)); return () => { active = false; }; }, [JSON.stringify(filters)]);
  async function exportCsv() { const result = await exportAdminReport("users", filters); downloadTextFile(result.filename, result.csv); }
  return <PermissionGate admin={admin} permission="users.view"><AdminPageHeader eyebrow="Users" title="Registered users" description="Firebase Authentication users merged with safe Firestore profile and subscription state." admin={admin} /><AdminOperationalFilters filters={filters} setFilters={setFilters} type="users" onExport={exportCsv} canExport={adminHasPermission(admin, "reports.export")} />{message ? <AdminEmptyState title="Users" text={message} /> : data?.items?.length ? <><section className="admin-card admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Provider</th><th>Verified</th><th>Status</th><th>Registered</th><th>Last sign-in</th><th>Active plans</th><th>Current plan</th><th>Expiry</th><th>Action</th></tr></thead><tbody>{data.items.map((user) => <tr key={user.uid}><td>{user.photoURL ? <img className="admin-inline-avatar" src={user.photoURL} alt="" /> : <span className="admin-inline-avatar">{(user.displayName || "U").slice(0, 1)}</span>}{user.displayName}</td><td>{user.email}</td><td>{user.phone || "-"}</td><td>{user.provider}</td><td>{user.emailVerified ? "Verified" : "Unverified"}</td><td><span className={`admin-status-badge ${user.accountStatus}`}>{user.accountStatus}</span></td><td>{formatDate(user.createdAt)}</td><td>{formatDate(user.lastSignInAt)}</td><td>{user.activeSubscriptionCount}</td><td>{user.currentPlan}</td><td>{formatDate(user.subscriptionExpiry)}</td><td><a className="text-button" href={`${appBase}admin/users/${encodeURIComponent(user.uid)}`}>Open Profile</a></td></tr>)}</tbody></table></section><AdminPager {...data} onPage={(page) => setFilters({ ...filters, page })} /></> : <AdminEmptyState title="No users found" text="No registered users match the selected filters." />}</PermissionGate>;
}

function DetailTable({ title, rows, columns, empty = "No records." }) {
  const items = rows || [];
  return <section className="admin-card admin-table-wrap"><h2>{title}</h2>{items.length ? <><table className="admin-table"><thead><tr>{columns.map((column) => <th className={column.className || ""} key={`${column.key}-${column.label}`}>{column.label}</th>)}</tr></thead><tbody>{items.map((row) => <tr key={row.id || row.uid || row.orderId || row.transactionId || row.classId || row.targetId || row.resourceId}>{columns.map((column) => <td className={column.className || ""} key={`${column.key}-${column.label}`}>{column.render ? column.render(row) : row[column.key] || "-"}</td>)}</tr>)}</tbody></table><div className="admin-mobile-list">{items.map((row) => <article className="admin-mobile-card" key={row.id || row.uid || row.orderId || row.transactionId || row.classId || row.targetId || row.resourceId}>{columns.map((column) => <div className="admin-mobile-field" key={`${column.key}-${column.label}`}><span>{column.label}</span><strong>{column.render ? column.render(row) : row[column.key] || "-"}</strong></div>)}</article>)}</div></> : <AdminEmptyState title={title} text={empty} />}</section>;
}

function AdminUserDetailPage({ admin, uid }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("Loading user profile...");
  const [action, setAction] = useState(null);
  const [note, setNote] = useState("");
  const [profile, setProfile] = useState({});
  async function load() { setMessage("Loading user profile..."); try { const result = await getAdminUser(uid); setDetail(result); setProfile(result.user || {}); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [uid]);
  const user = detail?.user;
  async function saveProfile(event) { event.preventDefault(); const result = await updateAdminUser(uid, profile); setDetail(result); setProfile(result.user); }
  async function saveNote() { if (!note.trim()) return; await addAdminEntityNote("user", uid, { text: note }); setNote(""); await load(); }
  return <PermissionGate admin={admin} permission="users.view"><AdminBackButton to="/admin/users" label="Back to Users" /><AdminPageHeader eyebrow="User Profile" title={user?.displayName || "Student/user details"} description="Safe Firebase and Firestore profile, subscriptions, transactions, and administrative history." admin={admin} />{message ? <AdminEmptyState title="User details" text={message} onRetry={load} /> : user && <><section className="admin-profile-card admin-profile-pro"><div className="admin-profile-hero"><div className="admin-photo-preview">{user.photoURL ? <img src={user.photoURL} alt="" /> : <span>{(user.displayName || "U").slice(0, 1)}</span>}</div><div><h2>{user.displayName}</h2><p>{user.email}</p><div className="admin-badge-row"><span className={`admin-status-badge ${user.accountStatus}`}>{user.accountStatus}</span><span className="status-pill">{user.provider}</span><span className="status-pill">{user.emailVerified ? "Verified email" : "Unverified email"}</span></div></div></div><dl className="student-details admin-security-fields"><div><dt>Firebase UID</dt><dd><ShortValue value={user.uid} /></dd></div><div><dt>Profile</dt><dd>{detail.profileStatus === "incomplete" ? "Profile record incomplete" : "Profile record complete"}</dd></div><div><dt>Phone</dt><dd>{user.phone || "Not collected"}</dd></div><div><dt>Registered</dt><dd>{formatDate(user.createdAt)}</dd></div><div><dt>Last sign-in</dt><dd>{formatDate(user.lastSignInAt)}</dd></div><div><dt>Last website activity</dt><dd>{formatDate(user.lastWebsiteActivityAt)}</dd></div><div><dt>City/state</dt><dd>{[user.city, user.state].filter(Boolean).join(", ") || "Not collected"}</dd></div><div><dt>Target exams</dt><dd>{user.targetExams?.join(", ") || "Not collected"}</dd></div><div><dt>Preparation level</dt><dd>{user.preparationLevel || "Not collected"}</dd></div></dl>{adminHasPermission(admin, "users.manage") && <form className="profile-edit-panel" onSubmit={saveProfile}><label>Display name<input value={profile.displayName || profile.name || ""} onChange={(event) => setProfile({ ...profile, displayName: event.target.value, name: event.target.value })} /></label><label>Mobile number<input value={profile.phone || ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label><label>City<input value={profile.city || ""} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></label><label>State<input value={profile.state || ""} onChange={(event) => setProfile({ ...profile, state: event.target.value })} /></label><label>Target exam<input value={profile.targetExam || ""} onChange={(event) => setProfile({ ...profile, targetExam: event.target.value })} /></label><div className="form-actions"><button className="primary-button" type="submit">Save Profile</button><button className="ghost-button" type="button" onClick={() => setAction("suspended")}>Suspend</button><button className="ghost-button" type="button" onClick={() => setAction("active")}>Reactivate</button><button className="primary-button danger-action" type="button" onClick={() => setAction("blocked")}>Block</button></div></form>}</section><DetailTable title="Subscriptions" rows={detail.subscriptions} columns={[{ key: "planName", label: "Plan" }, { key: "durationLabel", label: "Duration" }, { key: "status", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.status} /> }, { key: "source", label: "Source", className: "admin-nowrap", render: (row) => row.accessSourceLabel || titleLabel(row.source) }, { key: "accessStartAt", label: "Start", render: (row) => formatDate(row.accessStartAt) }, { key: "accessEndAt", label: "End", render: (row) => formatDate(row.accessEndAt) }, { key: "id", label: "Action", render: (row) => <a className="text-button" href={`${appBase}admin/subscriptions/${encodeURIComponent(row.id)}`}>Open Subscription</a> }]} /><DetailTable title="Transactions" rows={detail.transactions} columns={[{ key: "internalTransactionId", label: "Transaction", className: "admin-id-cell", render: (row) => <ShortValue value={row.internalTransactionId} /> }, { key: "cashfreePaymentId", label: "Cashfree payment", className: "admin-id-cell", render: (row) => <ShortValue value={row.cashfreePaymentId} /> }, { key: "amount", label: "Amount", render: (row) => formatPrice(row.amount) }, { key: "normalizedStatus", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.normalizedStatus} /> }, { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) }, { key: "id", label: "Action", render: (row) => <a className="text-button" href={`${appBase}admin/transactions/${encodeURIComponent(row.id)}`}>Open Transaction</a> }]} /><DetailTable title="Administrative history" rows={detail.activity} columns={[{ key: "action", label: "Action" }, { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) }, { key: "reason", label: "Reason" }]} />{adminHasPermission(admin, "users.manage") && <section className="admin-card profile-edit-panel"><h2>Internal note</h2><textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Student cannot see this note" /><button className="primary-button" type="button" onClick={saveNote}>Add Note</button></section>}<Phase3ActionDialog open={Boolean(action)} title={`${action} user`} onCancel={() => setAction(null)} onConfirm={async (values) => { await updateAdminUserStatus(uid, { status: action, reason: values.reason }); await load(); }} /></>}</PermissionGate>;
}

function AdminSubscriptionsPage({ admin }) {
  const [filters, setFilters] = useState({ page: 1, pageSize: 20 });
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading subscriptions...");
  const [grantOpen, setGrantOpen] = useState(false);
  useEffect(() => { let active = true; setMessage("Loading subscriptions..."); getAdminSubscriptions(filters).then((result) => { if (active) { setData(result.subscriptions); setMessage(""); } }).catch((error) => active && setMessage(error.message)); return () => { active = false; }; }, [JSON.stringify(filters)]);
  async function exportCsv() { const result = await exportAdminReport("subscriptions", filters); downloadTextFile(result.filename, result.csv); }
  return <PermissionGate admin={admin} permission="subscriptions.view"><AdminPageHeader eyebrow="Subscriptions" title="Subscription management" description="Real entitlements from Cashfree payments, manual grants, complimentary access, and migrations." admin={admin} /><AdminOperationalFilters filters={filters} setFilters={setFilters} type="subscriptions" onExport={exportCsv} canExport={adminHasPermission(admin, "reports.export")} />{adminHasPermission(admin, "subscriptions.manage") && <section className="admin-card"><button className="primary-button" type="button" onClick={() => setGrantOpen(true)}>Grant Manual Subscription</button></section>}{message ? <AdminEmptyState title="Subscriptions" text={message} /> : data?.items?.length ? <><DetailTable title="Subscriptions" rows={data.items} columns={[{ key: "id", label: "Subscription ID", className: "admin-id-cell", render: (row) => <ShortValue value={row.subscriptionId || row.id} /> }, { key: "studentName", label: "Student" }, { key: "userEmail", label: "Email" }, { key: "planName", label: "Plan" }, { key: "durationLabel", label: "Duration" }, { key: "amountPaid", label: "Paid", className: "admin-nowrap", render: (row) => amountPaidLabel(row) }, { key: "source", label: "Source", className: "admin-nowrap", render: (row) => row.accessSourceLabel || titleLabel(row.source) }, { key: "accessEndAt", label: "Expiry", render: (row) => formatDate(row.accessEndAt) }, { key: "daysRemaining", label: "Days" }, { key: "status", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.status} /> }, { key: "autoRenew", label: "Auto-renew", render: () => "Not active" }, { key: "id", label: "Action", render: (row) => <a className="text-button" href={`${appBase}admin/subscriptions/${encodeURIComponent(row.id)}`}>Open</a> }]} /><AdminPager {...data} onPage={(page) => setFilters({ ...filters, page })} /></> : <AdminEmptyState title="No subscriptions found" text="No subscriptions match the selected filters." />}<Phase3ActionDialog open={grantOpen} title="Grant manual subscription" fields={[{ name: "userId", label: "Verified Firebase UID" }, { name: "variantId", label: "Plan duration", type: "select", options: plans.flatMap((plan) => plan.variants.map((variant) => ({ value: variant.variantId, label: `${plan.name} ${variant.durationLabel}` }))) }, { name: "source", label: "Access source", type: "select", options: [{ value: "admin_granted", label: "Admin granted" }, { value: "complimentary", label: "Complimentary" }] }, { name: "startDate", label: "Start date", type: "date" }]} onCancel={() => setGrantOpen(false)} onConfirm={async (values) => { await grantAdminSubscription(values); setGrantOpen(false); setFilters({ ...filters }); }} /></PermissionGate>;
}

function AdminSubscriptionDetailPage({ admin, id }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("Loading subscription...");
  const [action, setAction] = useState(null);
  async function load() { setMessage("Loading subscription..."); try { setDetail(await getAdminSubscription(id)); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [id]);
  const sub = detail?.subscription;
  const fields = action === "extend" || action === "reactivate" ? [{ name: "variantId", label: "Duration", type: "select", options: plans.flatMap((plan) => plan.variants.map((variant) => ({ value: variant.variantId, label: `${plan.name} ${variant.durationLabel}` }))) }] : [];
  return <PermissionGate admin={admin} permission="subscriptions.view"><AdminBackButton to="/admin/subscriptions" label="Back to Subscriptions" /><AdminPageHeader eyebrow="Subscription" title={sub?.planName || "Subscription details"} description="Safe entitlement details, linked payment/order evidence, and administrative history." admin={admin} />{message ? <AdminEmptyState title="Subscription details" text={message} onRetry={load} /> : sub && <><section className="admin-profile-card"><dl className="student-details admin-security-fields"><div><dt>Subscription ID</dt><dd><ShortValue value={sub.subscriptionId || sub.id} /></dd></div><div><dt>User</dt><dd>{sub.studentName} | {sub.userEmail}</dd></div><div><dt>Plan</dt><dd>{sub.planName}</dd></div><div><dt>Duration</dt><dd>{sub.durationLabel}</dd></div><div><dt>Amount paid</dt><dd>{amountPaidLabel(sub)}</dd></div><div><dt>Source</dt><dd>{sub.accessSourceLabel || titleLabel(sub.source)}</dd></div><div><dt>Status</dt><dd><AdminStatusBadge value={sub.status} /></dd></div><div><dt>Start</dt><dd>{formatDate(sub.accessStartAt)}</dd></div><div><dt>End</dt><dd>{formatDate(sub.accessEndAt)}</dd></div><div><dt>Order</dt><dd>{detail.linkedOrderMissing ? "Linked order unavailable" : <ShortValue value={sub.orderId || "None"} />}</dd></div><div><dt>Transaction</dt><dd>{detail.linkedTransactionMissing ? "Payment record unavailable" : <ShortValue value={sub.transactionId || sub.paymentId || "None"} />}</dd></div><div><dt>Reason</dt><dd>{sub.reason || "None"}</dd></div></dl><div className="form-actions"><a className="ghost-button" href={`${appBase}admin/users/${encodeURIComponent(sub.userId)}`}>Open User</a>{sub.orderId && <a className="ghost-button" href={`${appBase}admin/orders/${encodeURIComponent(sub.orderId)}`}>Open Order</a>}{sub.paymentId && <a className="ghost-button" href={`${appBase}admin/transactions/${encodeURIComponent(sub.paymentId)}`}>Open Transaction</a>}{adminHasPermission(admin, "subscriptions.manage") && <><button className="ghost-button" type="button" onClick={() => setAction("extend")}>Extend</button><button className="ghost-button" type="button" onClick={() => setAction("cancel")}>Cancel</button><button className="primary-button danger-action" type="button" onClick={() => setAction("revoke")}>Revoke</button><button className="ghost-button" type="button" onClick={() => setAction("reactivate")}>Reactivate</button></>}</div></section><DetailTable title="Safe history" rows={detail.activity} columns={[{ key: "action", label: "Action" }, { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) }, { key: "reason", label: "Reason" }]} /><Phase3ActionDialog open={Boolean(action)} title={`${action} subscription`} fields={fields} onCancel={() => setAction(null)} onConfirm={async (values) => { await mutateAdminSubscription(id, action, values); await load(); }} /></>}</PermissionGate>;
}

function AdminOrdersPage({ admin }) {
  const [filters, setFilters] = useState({ page: 1, pageSize: 20 });
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading orders...");
  useEffect(() => { let active = true; setMessage("Loading orders..."); getAdminOrders(filters).then((result) => { if (active) { setData(result.orders); setMessage(""); } }).catch((error) => active && setMessage(error.message)); return () => { active = false; }; }, [JSON.stringify(filters)]);
  async function exportCsv() { const result = await exportAdminReport("orders", filters); downloadTextFile(result.filename, result.csv); }
  return <PermissionGate admin={admin} permission="orders.view"><AdminPageHeader eyebrow="Orders" title="Orders" description="Trusted internal and Cashfree order records. Successful payment evidence remains immutable." admin={admin} /><AdminOperationalFilters filters={filters} setFilters={setFilters} type="orders" onExport={exportCsv} canExport={adminHasPermission(admin, "reports.export")} />{message ? <AdminEmptyState title="Orders" text={message} /> : data?.items?.length ? <><DetailTable title="Orders" rows={data.items} columns={[{ key: "internalOrderId", label: "Internal order" }, { key: "cashfreeOrderId", label: "Cashfree order", className: "admin-id-cell", render: (row) => <ShortValue value={row.cashfreeOrderId} /> }, { key: "studentName", label: "User" }, { key: "userEmail", label: "Email" }, { key: "planName", label: "Plan" }, { key: "durationLabel", label: "Duration" }, { key: "expectedAmount", label: "Amount", render: (row) => formatPrice(row.expectedAmount) }, { key: "currency", label: "Currency" }, { key: "orderStatus", label: "Order" }, { key: "paymentStatus", label: "Payment" }, { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) }, { key: "id", label: "Action", render: (row) => <a className="text-button" href={`${appBase}admin/orders/${encodeURIComponent(row.id)}`}>Open</a> }]} /><AdminPager {...data} onPage={(page) => setFilters({ ...filters, page })} /></> : <AdminEmptyState title="No orders found" text="No orders match the selected filters." />}</PermissionGate>;
}

function AdminOrderDetailPage({ admin, id }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("Loading order...");
  useEffect(() => { getAdminOrder(id).then((result) => { setDetail(result); setMessage(""); }).catch((error) => setMessage(error.message)); }, [id]);
  const order = detail?.order;
  return <PermissionGate admin={admin} permission="orders.view"><AdminBackButton to="/admin/orders" label="Back to Orders" /><AdminPageHeader eyebrow="Order" title={order?.internalOrderId || "Order details"} description="Safe order, linked transactions, subscriptions, and consistency warnings." admin={admin} />{message ? <AdminEmptyState title="Order details" text={message} /> : order && <><section className="admin-profile-card"><dl className="student-details admin-security-fields"><div><dt>Internal order</dt><dd>{order.internalOrderId}</dd></div><div><dt>Cashfree order</dt><dd>{order.cashfreeOrderId || "None"}</dd></div><div><dt>User</dt><dd>{order.studentName} | {order.userEmail}</dd></div><div><dt>Plan</dt><dd>{order.planName} {order.durationLabel}</dd></div><div><dt>Expected amount</dt><dd>{formatPrice(order.expectedAmount)} {order.currency}</dd></div><div><dt>Order status</dt><dd>{order.orderStatus}</dd></div><div><dt>Payment status</dt><dd>{order.paymentStatus}</dd></div><div><dt>Created</dt><dd>{formatDate(order.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatDate(order.updatedAt)}</dd></div></dl></section><DetailTable title="Consistency warnings" rows={detail.warnings || []} columns={[{ key: "type", label: "Warning" }, { key: "entityType", label: "Entity" }, { key: "entityId", label: "ID" }]} /><DetailTable title="Transactions" rows={detail.transactions} columns={[{ key: "id", label: "Transaction" }, { key: "normalizedStatus", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.normalizedStatus} /> }, { key: "amount", label: "Amount", render: (row) => formatPrice(row.amount) }, { key: "id", label: "Action", render: (row) => <a className="text-button" href={`${appBase}admin/transactions/${encodeURIComponent(row.id)}`}>Open Transaction</a> }]} /></>}</PermissionGate>;
}

function AdminTransactionsPage({ admin }) {
  const [filters, setFilters] = useState({ page: 1, pageSize: 20 });
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading transactions...");
  useEffect(() => { let active = true; setMessage("Loading transactions..."); getAdminTransactions(filters).then((result) => { if (active) { setData(result.transactions); setMessage(""); } }).catch((error) => active && setMessage(error.message)); return () => { active = false; }; }, [JSON.stringify(filters)]);
  async function exportCsv() { const result = await exportAdminReport("transactions", filters); downloadTextFile(result.filename, result.csv); }
  return <PermissionGate admin={admin} permission="payments.view"><AdminPageHeader eyebrow="Transactions" title="Transactions" description="Safe Cashfree payment records, webhook state, activation state, and reconciliation tools." admin={admin} /><AdminOperationalFilters filters={filters} setFilters={setFilters} type="transactions" onExport={exportCsv} canExport={adminHasPermission(admin, "reports.export")} />{message ? <AdminEmptyState title="Transactions" text={message} /> : data?.items?.length ? <><DetailTable title="Transactions" rows={data.items} columns={[{ key: "internalTransactionId", label: "Transaction", className: "admin-id-cell", render: (row) => <ShortValue value={row.internalTransactionId} /> }, { key: "cashfreePaymentId", label: "Cashfree payment", className: "admin-id-cell", render: (row) => <ShortValue value={row.cashfreePaymentId} /> }, { key: "cashfreeOrderId", label: "Cashfree order", className: "admin-id-cell", render: (row) => <ShortValue value={row.cashfreeOrderId} /> }, { key: "userEmail", label: "User" }, { key: "amount", label: "Amount", render: (row) => formatPrice(row.amount) }, { key: "currency", label: "Currency" }, { key: "paymentMethod", label: "Method" }, { key: "normalizedStatus", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.normalizedStatus} /> }, { key: "webhookVerified", label: "Webhook", className: "admin-nowrap", render: (row) => row.webhookState === "server_verified" ? "Server verified" : titleLabel(row.webhookState || (row.webhookVerified ? "verified" : "pending")) }, { key: "subscriptionActivated", label: "Access", className: "admin-nowrap", render: (row) => row.subscriptionActivated ? "Activated" : "Not activated" }, { key: "id", label: "Action", render: (row) => <a className="text-button" href={`${appBase}admin/transactions/${encodeURIComponent(row.id)}`}>Open</a> }]} /><AdminPager {...data} onPage={(page) => setFilters({ ...filters, page })} /></> : <AdminEmptyState title="No transactions found" text="No transactions match the selected filters." />}</PermissionGate>;
}

function AdminTransactionDetailPage({ admin, id }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("Loading transaction...");
  async function load() { setMessage("Loading transaction..."); try { setDetail(await getAdminTransaction(id)); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [id]);
  const transaction = detail?.transaction;
  async function reconcile() { setMessage("Reconciling with Cashfree..."); try { await reconcileAdminTransaction(id); await load(); } catch (error) { setMessage(error.message); } }
  return <PermissionGate admin={admin} permission="payments.view"><AdminBackButton to="/admin/transactions" label="Back to Transactions" /><AdminPageHeader eyebrow="Transaction" title={transaction?.internalTransactionId || "Transaction details"} description="Safe payment identifiers only. Full gateway payloads and secrets are never shown." admin={admin} />{message ? <AdminEmptyState title="Transaction details" text={message} onRetry={load} /> : transaction && <><section className="admin-profile-card"><dl className="student-details admin-security-fields"><div><dt>Internal transaction ID</dt><dd><ShortValue value={transaction.internalTransactionId} /></dd></div><div><dt>Cashfree payment</dt><dd>{transaction.cashfreePaymentId || "None"}</dd></div><div><dt>Cashfree order</dt><dd>{transaction.cashfreeOrderId || "None"}</dd></div><div><dt>User</dt><dd>{transaction.userEmail || "Unknown"}</dd></div><div><dt>Amount</dt><dd>{formatPrice(transaction.amount)} {transaction.currency}</dd></div><div><dt>Status</dt><dd><AdminStatusBadge value={transaction.normalizedStatus} /></dd></div><div><dt>Cashfree status</dt><dd>{titleLabel(transaction.cashfreeStatus)}</dd></div><div><dt>Webhook</dt><dd>{transaction.webhookState === "server_verified" ? "Server verified" : titleLabel(transaction.webhookState)}</dd></div><div><dt>Signature verification</dt><dd>{transaction.signatureVerified ? "Verified" : "Not verified"}</dd></div><div><dt>Subscription activation</dt><dd>{transaction.subscriptionActivated ? "Activated" : "Not activated"}</dd></div><div><dt>Captured</dt><dd>{formatDate(transaction.capturedAt)}</dd></div><div><dt>Last reconciliation</dt><dd>{formatDate(transaction.lastReconciledAt)}</dd></div></dl>{adminHasPermission(admin, "payments.reconcile") && <button className="primary-button" type="button" onClick={reconcile}>Reconcile with Cashfree</button>}</section><DetailTable title="Safe event timeline" rows={detail.timeline || []} columns={[{ key: "label", label: "Event" }, { key: "at", label: "Date", render: (row) => formatDate(row.at) }]} /></>}</PermissionGate>;
}
function csvList(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function contentPlanOptions() {
  return plans.map((plan) => ({ value: plan.planId, label: plan.name === "PICK UP" ? "PICK UP DAILY TARGETS" : plan.name }));
}

function planCheckboxes(selected = [], onChange) {
  const current = new Set(selected);
  return <div className="content-check-grid">{contentPlanOptions().map((option) => <label key={option.value}><input type="checkbox" checked={current.has(option.value)} onChange={(event) => { const next = new Set(current); if (event.target.checked) next.add(option.value); else next.delete(option.value); onChange([...next]); }} />{option.label}</label>)}</div>;
}

function ContentEditorDialog({ open, kind, item, onClose, onSave, onUpload }) {
  const [form, setForm] = useState({});
  const [message, setMessage] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  useEffect(() => { if (open) { setForm(item || { status: "draft", type: "external_link", mode: "live", cadence: "daily", accessScope: "plan", planIds: [] }); setMessage(""); setUploadPercent(0); } }, [open, item, kind]);
  if (!open) return null;
  const title = `${item?.id ? "Edit" : "Create"} ${kind}`;
  async function submit(event) {
    event.preventDefault();
    setMessage("Saving...");
    try {
      const payload = kind === "target" ? { ...form, tasks: splitList(form.taskText).map((task, index) => ({ id: `task-${index + 1}`, title: task })) } : form;
      await onSave(payload);
      onClose();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function uploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Uploading...");
    try {
      const uploaded = await onUpload(file, { kind }, setUploadPercent);
      setForm((current) => ({ ...current, ...uploaded, type: file.type === "application/pdf" ? "pdf" : "image" }));
      setMessage("Upload ready. Save the resource to attach it.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="confirmation-dialog admin-management-dialog content-editor" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><h3>{title}</h3><form onSubmit={submit}><label>Title<input value={form.title || ""} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Description<textarea rows="3" value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>{kind === "resource" && <><label>Type<select value={form.type || "external_link"} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="external_link">External link</option><option value="video">Video</option><option value="pdf">PDF</option><option value="image">Image</option></select></label>{["external_link", "video"].includes(form.type || "external_link") && <label>Secure URL<input value={form.externalUrl || ""} onChange={(event) => setForm({ ...form, externalUrl: event.target.value })} placeholder="https://" /></label>}{["pdf", "image"].includes(form.type || "external_link") && <label>PDF/Image upload<input type="file" accept="application/pdf,image/*" onChange={uploadFile} /></label>}{form.storagePath && <p className="form-message">Attached: {form.fileName || form.storagePath}</p>}{uploadPercent > 0 && uploadPercent < 100 && <p className="form-message">Upload {uploadPercent}%</p>}<label>Tags<input value={csvList(form.tags)} onChange={(event) => setForm({ ...form, tags: splitList(event.target.value) })} /></label></>}{kind === "target" && <><label>Cadence<select value={form.cadence || "daily"} onChange={(event) => setForm({ ...form, cadence: event.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label>Target date<input type="date" value={(form.targetDate || "").slice(0, 10)} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label><label>Tasks<textarea rows="5" value={form.taskText ?? (form.tasks || []).map((task) => task.title).join(", ")} onChange={(event) => setForm({ ...form, taskText: event.target.value })} /></label></>}{kind === "class" && <><label>Mode<select value={form.mode || "live"} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="live">Live</option><option value="recorded">Recorded</option></select></label><label>Status<select value={form.status || "upcoming"} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="recorded">Recorded</option><option value="cancelled">Cancelled</option></select></label><label>Start<input type="datetime-local" value={(form.startAt || "").slice(0, 16)} onChange={(event) => setForm({ ...form, startAt: event.target.value })} /></label><label>End<input type="datetime-local" value={(form.endAt || "").slice(0, 16)} onChange={(event) => setForm({ ...form, endAt: event.target.value })} /></label><label>Meeting URL<input value={form.meetingUrl || ""} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} placeholder="https://" /></label><label>Recorded URL<input value={form.recordedVideoUrl || ""} onChange={(event) => setForm({ ...form, recordedVideoUrl: event.target.value })} placeholder="https://" /></label></>}{kind !== "class" && <label>Status<select value={form.status || "draft"} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="unpublished">Unpublished</option><option value="archived">Archived</option></select></label>}<label>Publish date<input type="datetime-local" value={(form.publishAt || "").slice(0, 16)} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} /></label><div><span className="menu-label">Assigned plans</span>{planCheckboxes(form.planIds || [], (planIds) => setForm({ ...form, planIds }))}</div><div className="form-actions"><button className="ghost-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save</button></div>{message && <p className="form-message">{message}</p>}</form></section></div>;
}

function ContentRowActions({ item, kind, onEdit, onDuplicate, onStatus, onDelete }) {
  const status = item.status || "draft";
  const canEdit = !["archived", "deleted"].includes(status);
  const canTogglePublish = !["archived", "deleted", "cancelled"].includes(status);
  const publishLabel = status === "published" || status === "upcoming" || status === "live" || status === "recorded" ? "Unpublish" : "Publish";
  const publishStatus = publishLabel === "Unpublish" ? "unpublished" : "published";
  return <div className="table-actions"><button className="text-button" type="button" disabled={!canEdit} onClick={() => onEdit(item)}>Edit</button>{kind === "resource" && canEdit && <button className="text-button" type="button" onClick={() => onDuplicate(item.id)}>Duplicate</button>}{canTogglePublish && <button className="text-button" type="button" onClick={() => onStatus(item, publishStatus)}>{publishLabel}</button>}{kind === "target" && status === "published" && <button className="text-button" type="button" onClick={() => onStatus(item, "completed")}>Complete</button>}{kind === "class" && ["published", "upcoming", "live"].includes(status) && <button className="text-button" type="button" onClick={() => onStatus(item, "cancelled")}>Cancel</button>}{status !== "archived" && status !== "deleted" && <button className="text-button" type="button" onClick={() => onStatus(item, "archived")}>Archive</button>}{["archived", "deleted", "cancelled"].includes(status) && <button className="text-button" type="button" onClick={() => onStatus(item, "draft")}>Restore</button>}<button className="text-button danger-link" type="button" onClick={() => onDelete(item)}>Delete</button></div>;
}
function AdminResourcesPage({ admin }) {
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading resources...");
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  async function load() { setMessage("Loading resources..."); try { const result = await getAdminResources(filters); setData(result.resources); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [JSON.stringify(filters)]);
  async function save(payload) { await saveAdminResource(payload); await load(); }
  async function status(item, next) { setConfirmAction({ item, next, title: `${next === "draft" ? "Restore" : titleLabel(next)} resource`, message: `${item.title} will move to ${titleLabel(next)}.` }); }
  async function duplicate(id) { await duplicateAdminResource(id); await load(); }
  async function remove(item) { setConfirmAction({ item, delete: true, title: "Delete resource", message: `${item.title} will be moved to deleted status and removed from Student Desk.` }); }
  async function runConfirm() { const action = confirmAction; if (!action) return; if (action.delete) await deleteAdminResource(action.item.id, { reason: action.title }); else await setAdminResourceStatus(action.item.id, action.next, { reason: action.title }); setConfirmAction(null); await load(); }
  return <PermissionGate admin={admin} permission="resources.view"><AdminPageHeader eyebrow="Content" title="Resources" description="Protected learning content assigned to paid plans and served to students through server-verified access." admin={admin} /><section className="admin-card admin-management-toolbar phase3-toolbar"><div className="admin-filter-grid"><label>Search<input value={filters.search || ""} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label><label>Status<select value={filters.status || ""} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="unpublished">Unpublished</option><option value="archived">Archived</option><option value="deleted">Deleted</option></select></label><label>Type<select value={filters.type || ""} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All</option><option value="pdf">PDF</option><option value="image">Image</option><option value="external_link">External link</option><option value="video">Video</option></select></label></div>{adminHasPermission(admin, "resources.manage") && <button className="primary-button" type="button" onClick={() => setEditing({})}>Create Resource</button>}</section>{message ? <AdminEmptyState title="Resources" text={message} onRetry={load} /> : <DetailTable title="Learning resources" rows={data?.items || []} columns={[{ key: "resourceId", label: "ID", className: "admin-id-cell", render: (row) => <ShortValue value={row.resourceId} /> }, { key: "title", label: "Title" }, { key: "type", label: "Type", render: (row) => titleLabel(row.type) }, { key: "planLabels", label: "Plans", render: (row) => row.planLabels?.join(", ") || "Unassigned" }, { key: "status", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.status} /> }, { key: "analytics", label: "Views", render: (row) => row.analytics?.views || 0 }, { key: "updatedAt", label: "Updated", render: (row) => formatDate(row.updatedAt) }, { key: "id", label: "Actions", className: "admin-nowrap", render: (row) => <ContentRowActions item={row} kind="resource" onEdit={setEditing} onDuplicate={duplicate} onStatus={status} onDelete={remove} /> }]} /> }<ContentEditorDialog open={Boolean(editing)} kind="resource" item={editing} onClose={() => setEditing(null)} onSave={save} onUpload={uploadProtectedResourceFile} /><ConfirmationDialog open={Boolean(confirmAction)} title={confirmAction?.title || "Confirm action"} message={confirmAction?.message || "Confirm this content action."} onCancel={() => setConfirmAction(null)} onConfirm={runConfirm} /></PermissionGate>;
}

function AdminResourceDetailPage({ admin, id }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("Loading resource...");
  async function load() { setMessage("Loading resource..."); try { setDetail(await getAdminResource(id)); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [id]);
  const resource = detail?.resource;
  return <PermissionGate admin={admin} permission="resources.view"><AdminBackButton to="/admin/resources" label="Back to Resources" /><AdminPageHeader eyebrow="Resource" title={resource?.title || "Resource details"} description="Protected content metadata, assignment, storage path, and safe activity." admin={admin} />{message ? <AdminEmptyState title="Resource details" text={message} onRetry={load} /> : resource && <><section className="admin-profile-card"><dl className="student-details admin-security-fields"><div><dt>Resource ID</dt><dd><ShortValue value={resource.resourceId} /></dd></div><div><dt>Type</dt><dd>{titleLabel(resource.type)}</dd></div><div><dt>Status</dt><dd><AdminStatusBadge value={resource.status} /></dd></div><div><dt>Access</dt><dd>{resource.accessScope === "public" ? "Public" : "Plan assigned"}</dd></div><div><dt>Plans</dt><dd>{resource.planLabels?.join(", ") || "Unassigned"}</dd></div><div><dt>Storage path</dt><dd><ShortValue value={resource.storagePath || "No file attached"} /></dd></div><div><dt>Secure URL</dt><dd>{resource.externalUrl ? <a href={resource.externalUrl} target="_blank" rel="noreferrer">Open link</a> : "None"}</dd></div><div><dt>Views</dt><dd>{resource.analytics?.views || 0}</dd></div><div><dt>Downloads</dt><dd>{resource.analytics?.downloads || 0}</dd></div><div><dt>Updated</dt><dd>{formatDate(resource.updatedAt)}</dd></div></dl></section><DetailTable title="Safe content events" rows={detail.events || []} columns={[{ key: "action", label: "Action" }, { key: "uid", label: "User", className: "admin-id-cell", render: (row) => <ShortValue value={row.uid} /> }, { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt) }]} /></>}</PermissionGate>;
}
function AdminTargetsPage({ admin }) {
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading targets...");
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  async function load() { setMessage("Loading targets..."); try { const result = await getAdminTargets(filters); setData(result.targets); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [JSON.stringify(filters)]);
  async function status(item, next) { setConfirmAction({ item, next, title: `${next === "draft" ? "Restore" : titleLabel(next)} target`, message: `${item.title} will move to ${titleLabel(next)}.` }); }
  async function remove(item) { setConfirmAction({ item, delete: true, title: "Delete target", message: `${item.title} will be moved to deleted status. Existing student progress is preserved.` }); }
  async function runConfirm() { const action = confirmAction; if (!action) return; if (action.delete) await deleteAdminTarget(action.item.id, { reason: action.title }); else await setAdminTargetStatus(action.item.id, action.next, { reason: action.title }); setConfirmAction(null); await load(); }
  return <PermissionGate admin={admin} permission="targets.view"><AdminPageHeader eyebrow="Execution" title="Daily and weekly targets" description="Plan-assigned preparation targets for active students." admin={admin} /><section className="admin-card admin-management-toolbar phase3-toolbar"><div className="admin-filter-grid"><label>Status<select value={filters.status || ""} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="unpublished">Unpublished</option><option value="completed">Completed</option><option value="archived">Archived</option><option value="deleted">Deleted</option></select></label></div><button className="primary-button" type="button" onClick={() => setEditing({})}>Create Target</button></section>{message ? <AdminEmptyState title="Targets" text={message} onRetry={load} /> : <DetailTable title="Targets" rows={data?.items || []} columns={[{ key: "targetId", label: "ID", className: "admin-id-cell", render: (row) => <ShortValue value={row.targetId} /> }, { key: "title", label: "Title" }, { key: "cadence", label: "Cadence" }, { key: "planLabels", label: "Plans", render: (row) => row.planLabels?.join(", ") || "Unassigned" }, { key: "tasks", label: "Tasks", render: (row) => row.tasks?.length || 0 }, { key: "status", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.status} /> }, { key: "targetDate", label: "Date", render: (row) => formatDate(row.targetDate || row.startAt || row.weekStart) }, { key: "id", label: "Actions", className: "admin-nowrap", render: (row) => <ContentRowActions item={row} kind="target" onEdit={setEditing} onStatus={status} onDelete={remove} /> }]} />}<ContentEditorDialog open={Boolean(editing)} kind="target" item={editing} onClose={() => setEditing(null)} onSave={async (payload) => { await saveAdminTarget(payload); await load(); }} /><ConfirmationDialog open={Boolean(confirmAction)} title={confirmAction?.title || "Confirm action"} message={confirmAction?.message || "Confirm this target action."} onCancel={() => setConfirmAction(null)} onConfirm={runConfirm} /></PermissionGate>;
}
function AdminClassesPage({ admin }) {
  const [filters, setFilters] = useState({});
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading classes...");
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  async function load() { setMessage("Loading classes..."); try { const result = await getAdminClasses(filters); setData(result.classes); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [JSON.stringify(filters)]);
  async function status(item, next) { setConfirmAction({ item, next, title: `${next === "draft" ? "Restore" : titleLabel(next)} class`, message: `${item.title} will move to ${titleLabel(next)}.` }); }
  async function remove(item) { setConfirmAction({ item, delete: true, title: "Delete class", message: `${item.title} will be moved to deleted status and removed from Student Desk.` }); }
  async function runConfirm() { const action = confirmAction; if (!action) return; if (action.delete) await deleteAdminClass(action.item.id, { reason: action.title }); else await setAdminClassStatus(action.item.id, action.next, { reason: action.title }); setConfirmAction(null); await load(); }
  return <PermissionGate admin={admin} permission="classes.view"><AdminPageHeader eyebrow="Classes" title="Live and recorded classes" description="Schedule protected sessions and publish recordings for entitled students." admin={admin} /><section className="admin-card admin-management-toolbar phase3-toolbar"><div className="admin-filter-grid"><label>Status<select value={filters.status || ""} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option value="draft">Draft</option><option value="published">Published</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="recorded">Recorded</option><option value="unpublished">Unpublished</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option><option value="deleted">Deleted</option></select></label></div><button className="primary-button" type="button" onClick={() => setEditing({})}>Create Class</button></section>{message ? <AdminEmptyState title="Classes" text={message} onRetry={load} /> : <DetailTable title="Classes" rows={data?.items || []} columns={[{ key: "classId", label: "ID", className: "admin-id-cell", render: (row) => <ShortValue value={row.classId} /> }, { key: "title", label: "Title" }, { key: "mode", label: "Mode" }, { key: "planLabels", label: "Plans", render: (row) => row.planLabels?.join(", ") || "Unassigned" }, { key: "startAt", label: "Start", render: (row) => formatDate(row.startAt) }, { key: "status", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.status} /> }, { key: "id", label: "Actions", className: "admin-nowrap", render: (row) => <ContentRowActions item={row} kind="class" onEdit={setEditing} onStatus={status} onDelete={remove} /> }]} />}<ContentEditorDialog open={Boolean(editing)} kind="class" item={editing} onClose={() => setEditing(null)} onSave={async (payload) => { await saveAdminClass(payload); await load(); }} /><ConfirmationDialog open={Boolean(confirmAction)} title={confirmAction?.title || "Confirm action"} message={confirmAction?.message || "Confirm this class action."} onCancel={() => setConfirmAction(null)} onConfirm={runConfirm} /></PermissionGate>;
}
function PlanActionButtons({ plan, admin, onRefresh }) {
  const canManage = adminHasPermission(admin, "plans.manage");
  async function status(next) { await setAdminPlanStatus(plan.planId, next); await onRefresh?.(); }
  async function duplicate() { const result = await duplicateAdminPlan(plan.planId); routeTo(`${appBase}admin/plans/${encodeURIComponent(result.plan.planId)}/edit`); }
  async function remove() { await setAdminPlanStatus(plan.planId, "trashed"); await onRefresh?.(); }
  return <div className="table-actions"><a className="text-button" href={`${appBase}admin/plans/${encodeURIComponent(plan.planId)}`}>View</a>{canManage && <a className="text-button" href={`${appBase}admin/plans/${encodeURIComponent(plan.planId)}/edit`}>Edit</a>}<a className="text-button" href={`${appBase}checkout/${encodeURIComponent(plan.variants?.[0]?.variantId || "")}?preview=1&return=${encodeURIComponent(`/admin/plans/${plan.planId}`)}`}>Preview</a>{canManage && <button className="text-button" type="button" onClick={duplicate}>Duplicate</button>}{canManage && (plan.status === "active" || plan.status === "published" ? <button className="text-button" type="button" onClick={() => status("unpublished")}>Unpublish</button> : <button className="text-button" type="button" onClick={() => status("active")}>Publish</button>)}{canManage && plan.status !== "archived" && <button className="text-button" type="button" onClick={() => status("archived")}>Archive</button>}{canManage && ["archived", "trashed", "unpublished", "draft"].includes(plan.status) && <button className="text-button" type="button" onClick={() => status("draft")}>Restore</button>}{canManage && <button className="text-button danger-link" type="button" onClick={remove}>Delete</button>}</div>;
}

function AdminPlansPage({ admin }) {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("Loading plans...");
  async function load() { setMessage("Loading plans..."); try { const result = await getAdminPlans(); setData(result.plans); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, []);
  const rows = data?.items || [];
  return <PermissionGate admin={admin} permission="plans.view"><AdminPageHeader eyebrow="Plans" title="Plan catalogue" description="Create, edit, publish, archive, and safely delete mentorship plans and variants." admin={admin} /><section className="admin-card admin-management-toolbar phase3-toolbar"><div><strong>{rows.length} plans</strong><p>Published plans appear on the public website and checkout after server validation.</p></div>{adminHasPermission(admin, "plans.manage") && <a className="primary-button" href={`${appBase}admin/plans/new`}>Create New Plan</a>}</section>{message ? <AdminEmptyState title="Plans" text={message} onRetry={load} /> : <DetailTable title="Plans" rows={rows} columns={[{ key: "planId", label: "Plan ID", className: "admin-id-cell", render: (row) => <ShortValue value={row.planId} /> }, { key: "name", label: "Plan" }, { key: "subtitle", label: "Subtitle" }, { key: "status", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.status} /> }, { key: "variants", label: "Variants", render: (row) => row.variants?.length || 0 }, { key: "flags", label: "Flags", render: (row) => [row.featured ? "Featured" : "", row.temporary ? "Temporary" : "", row.homepageVisible === false ? "Hidden" : "Homepage"].filter(Boolean).join(", ") }, { key: "id", label: "Actions", className: "admin-nowrap", render: (row) => <PlanActionButtons plan={row} admin={admin} onRefresh={load} /> }]} />}</PermissionGate>;
}

function AdminPlanDetailPage({ admin, id }) {
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("Loading plan...");
  async function load() { setMessage("Loading plan..."); try { setDetail(await getAdminPlan(id)); setMessage(""); } catch (error) { setMessage(error.message); } }
  useEffect(() => { load(); }, [id]);
  const plan = detail?.plan;
  return <PermissionGate admin={admin} permission="plans.view"><AdminBackButton to="/admin/plans" label="Back to Plans" /><AdminPageHeader eyebrow="Plan" title={plan?.name || "Plan details"} description="Public plan information, variants, visibility, metrics, and dependency safety." admin={admin} />{message ? <AdminEmptyState title="Plan details" text={message} onRetry={load} /> : plan && <><section className="admin-profile-card"><dl className="student-details admin-security-fields"><div><dt>Plan ID</dt><dd><ShortValue value={plan.planId} /></dd></div><div><dt>Slug</dt><dd>{plan.slug}</dd></div><div><dt>Subtitle</dt><dd>{plan.subtitle || "Not set"}</dd></div><div><dt>Description</dt><dd>{plan.description || "Not set"}</dd></div><div><dt>Mentor</dt><dd>{plan.mentorName || "Not set"}</dd></div><div><dt>Exams</dt><dd>{plan.examCategories?.join(", ") || "Not set"}</dd></div><div><dt>Status</dt><dd><AdminStatusBadge value={plan.status} /></dd></div><div><dt>Visibility</dt><dd>{plan.homepageVisible === false ? "Hidden from homepage" : "Homepage visible"}</dd></div><div><dt>Temporary</dt><dd>{plan.temporary ? "Temporary/festival plan" : "Permanent plan"}</dd></div><div><dt>Created</dt><dd>{formatDate(plan.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatDate(plan.updatedAt)}</dd></div><div><dt>Dependencies</dt><dd>{plan.dependencySummary?.join(", ") || "None found"}</dd></div></dl><PlanActionButtons plan={plan} admin={admin} onRefresh={load} /></section><DetailTable title="Variants" rows={plan.variants || []} columns={[{ key: "variantId", label: "Variant ID", className: "admin-id-cell", render: (row) => <ShortValue value={row.variantId} /> }, { key: "durationLabel", label: "Label" }, { key: "priceInRupees", label: "Price", className: "admin-nowrap", render: (row) => formatPrice(row.priceInRupees) }, { key: "durationMonths", label: "Validity" }, { key: "status", label: "Status", className: "admin-nowrap", render: (row) => <AdminStatusBadge value={row.status} /> }, { key: "purchaseEnabled", label: "Checkout", render: (row) => row.purchaseEnabled ? "Enabled" : "Disabled" }]} /></>}</PermissionGate>;
}

function defaultPlanForm() {
  return { name: "", shortName: "", slug: "", subtitle: "", coverage: "", description: "", eligibility: "", mentorName: "Imran Sir", badgeText: "", terms: "", status: "draft", temporary: false, featured: false, homepageVisible: true, purchaseVisible: true, displayOrder: 100, examCategories: [], accessTags: [], features: [], benefits: [], variants: [{ variantId: "", durationLabel: "1 month", durationMonths: 1, priceInRupees: 0, regularPriceInRupees: 0, offerPriceInRupees: 0, currency: "INR", validityMode: "fixed_months", validityValue: 1, purchaseEnabled: true, status: "active", sortOrder: 1 }] };
}

function AdminPlanEditorPage({ admin, id }) {
  const isNew = id === "new";
  const [form, setForm] = useState(defaultPlanForm());
  const [message, setMessage] = useState(isNew ? "" : "Loading plan...");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!isNew) getAdminPlan(id).then((result) => { setForm({ ...defaultPlanForm(), ...result.plan }); setMessage(""); }).catch((error) => setMessage(error.message)); }, [id, isNew]);
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function updateList(field, value) { update(field, splitList(value)); }
  function variant(index, field, value) { setForm((current) => ({ ...current, variants: current.variants.map((item, i) => i === index ? { ...item, [field]: value } : item) })); }
  function addVariant() { setForm((current) => ({ ...current, variants: [...current.variants, { variantId: `${current.slug || "plan"}-${current.variants.length + 1}`, durationLabel: "1 month", durationMonths: 1, priceInRupees: 0, regularPriceInRupees: 0, offerPriceInRupees: 0, currency: "INR", validityMode: "fixed_months", validityValue: 1, purchaseEnabled: true, status: "active", sortOrder: current.variants.length + 1 }] })); }
  async function save(status) { setSaving(true); setMessage("Saving plan..."); try { const payload = { ...form, status: status || form.status }; const result = isNew ? await createAdminPlan(payload) : await updateAdminPlan(id, payload); setMessage("Plan saved."); if (isNew) routeTo(`${appBase}admin/plans/${encodeURIComponent(result.plan.planId)}/edit`, { replace: true }); else setForm({ ...defaultPlanForm(), ...result.plan }); } catch (error) { setMessage(error.message); } finally { setSaving(false); } }
  return <PermissionGate admin={admin} permission="plans.manage"><AdminBackButton to="/admin/plans" label="Back to Plans" /><AdminPageHeader eyebrow="Plan Editor" title={isNew ? "Create New Plan" : `Edit ${form.name || id}`} description="Create temporary/festival plans and variants without code changes." admin={admin} /><section className="admin-card content-editor plan-editor"><div className="admin-filter-grid"><label>Name<input value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label>Short name<input value={form.shortName || ""} onChange={(event) => update("shortName", event.target.value)} /></label><label>Slug<input value={form.slug || ""} onChange={(event) => update("slug", event.target.value)} /></label><label>Status<select value={form.status || "draft"} onChange={(event) => update("status", event.target.value)}><option value="draft">Draft</option><option value="active">Published</option><option value="unpublished">Unpublished</option><option value="archived">Archived</option></select></label><label>Subtitle<input value={form.subtitle || ""} onChange={(event) => update("subtitle", event.target.value)} /></label><label>Coverage<input value={form.coverage || ""} onChange={(event) => update("coverage", event.target.value)} /></label><label>Mentor<input value={form.mentorName || ""} onChange={(event) => update("mentorName", event.target.value)} /></label><label>Badge<input value={form.badgeText || ""} onChange={(event) => update("badgeText", event.target.value)} /></label><label className="wide-field">Description<textarea rows="3" value={form.description || ""} onChange={(event) => update("description", event.target.value)} /></label><label className="wide-field">Eligibility<textarea rows="2" value={form.eligibility || ""} onChange={(event) => update("eligibility", event.target.value)} /></label><label>Exams<input value={csvList(form.examCategories)} onChange={(event) => updateList("examCategories", event.target.value)} /></label><label>Access tags<input value={csvList(form.accessTags)} onChange={(event) => updateList("accessTags", event.target.value)} /></label><label className="wide-field">Features<textarea rows="3" value={csvList(form.features)} onChange={(event) => updateList("features", event.target.value)} /></label><label className="wide-field">Benefits<textarea rows="3" value={csvList(form.benefits)} onChange={(event) => updateList("benefits", event.target.value)} /></label><label className="wide-field">Terms<textarea rows="2" value={form.terms || ""} onChange={(event) => update("terms", event.target.value)} /></label><label><input type="checkbox" checked={Boolean(form.temporary)} onChange={(event) => update("temporary", event.target.checked)} /> Temporary/festival</label><label><input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => update("featured", event.target.checked)} /> Featured</label><label><input type="checkbox" checked={form.homepageVisible !== false} onChange={(event) => update("homepageVisible", event.target.checked)} /> Homepage visible</label><label><input type="checkbox" checked={form.purchaseVisible !== false} onChange={(event) => update("purchaseVisible", event.target.checked)} /> Purchase visible</label></div><h3>Variants</h3><div className="plan-variant-editor">{(form.variants || []).map((item, index) => <article className="resource-item" key={`${item.variantId}-${index}`}><div className="admin-filter-grid"><label>Variant ID<input value={item.variantId || ""} onChange={(event) => variant(index, "variantId", event.target.value)} /></label><label>Label<input value={item.durationLabel || ""} onChange={(event) => variant(index, "durationLabel", event.target.value)} /></label><label>Price<input type="number" value={item.priceInRupees || 0} onChange={(event) => { variant(index, "priceInRupees", Number(event.target.value)); variant(index, "offerPriceInRupees", Number(event.target.value)); }} /></label><label>Regular price<input type="number" value={item.regularPriceInRupees || 0} onChange={(event) => variant(index, "regularPriceInRupees", Number(event.target.value))} /></label><label>Months<input type="number" value={item.durationMonths || 1} onChange={(event) => { variant(index, "durationMonths", Number(event.target.value)); variant(index, "validityValue", Number(event.target.value)); }} /></label><label>Status<select value={item.status || "active"} onChange={(event) => variant(index, "status", event.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="disabled">Disabled</option><option value="archived">Archived</option></select></label><label><input type="checkbox" checked={item.purchaseEnabled !== false} onChange={(event) => variant(index, "purchaseEnabled", event.target.checked)} /> Checkout enabled</label></div></article>)}</div><div className="form-actions"><button className="ghost-button" type="button" onClick={addVariant}>Add Variant</button><button className="ghost-button" type="button" disabled={saving} onClick={() => save("draft")}>Save Draft</button><button className="primary-button" type="button" disabled={saving} onClick={() => save("active")}>Publish</button><a className="ghost-button" href={`${appBase}admin/plans`}>Cancel</a></div>{message && <p className="form-message">{message}</p>}</section></PermissionGate>;
}
function AdminModulePlaceholder({ admin, title, permission }) {
  return <PermissionGate admin={admin} permission={permission}><AdminPageHeader eyebrow="Admin Module" title={title} description="This module is routed and protected. Operational tools for this area continue in the next build phase." admin={admin} /><AdminEmptyState title="Module ready" text="Dashboard analytics are live; this detailed module will expand in the next admin phase." /></PermissionGate>;
}

function AdminAccessDeniedPage({ message = "Administrative authorization is required to open this area." }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  async function logout() { await signOutUser(); routeTo(`${appBase}admin/login`, { replace: true }); }
  return <main className="admin-login-page"><section className="admin-login-panel"><Brand small="Admin Portal" /><p className="eyebrow">Access denied</p><h1>Access denied</h1><p>{message}</p><div className="form-actions"><a className="primary-button" href={`${appBase}admin/login`}>Admin Login</a><a className="ghost-button" href={appBase}>Return to website</a><button className="text-button" type="button" onClick={() => setConfirmOpen(true)}>Sign out</button></div></section><ConfirmationDialog open={confirmOpen} title="Sign out?" message="This will end the current session on this device." onCancel={() => setConfirmOpen(false)} onConfirm={logout} /></main>;
}

function AdminPage({ path }) {
  const administratorDetailMatch = path.match(/^\/admin\/administrators\/([^/]+)$/);
  const userDetailMatch = path.match(/^\/admin\/users\/([^/]+)$/);
  const subscriptionDetailMatch = path.match(/^\/admin\/subscriptions\/([^/]+)$/);
  const orderDetailMatch = path.match(/^\/admin\/orders\/([^/]+)$/);
  const transactionDetailMatch = path.match(/^\/admin\/transactions\/([^/]+)$/);
  const resourceDetailMatch = path.match(/^\/admin\/resources\/([^/]+)$/);
  const navItem = adminNavItems.find(([itemPath]) => itemPath === path);
  const activePath = administratorDetailMatch ? "/admin/administrators" : userDetailMatch ? "/admin/users" : subscriptionDetailMatch ? "/admin/subscriptions" : orderDetailMatch ? "/admin/orders" : transactionDetailMatch ? "/admin/transactions" : planNewMatch || planEditMatch || planDetailMatch ? "/admin/plans" : resourceDetailMatch ? "/admin/resources" : path;
  return <AdminRouteGuard path={path}>{(admin) => <AdminLayout admin={admin} activePath={activePath}>{path === "/admin" ? <AdminOverview admin={admin} /> : path === "/admin/profile" ? <AdminProfilePage admin={admin} /> : path === "/admin/activity-logs" ? <AdminActivityLogsPage admin={admin} /> : path === "/admin/administrators" ? <AdminAdministratorsPage admin={admin} /> : path === "/admin/users" ? <AdminUsersPage admin={admin} /> : path === "/admin/subscriptions" ? <AdminSubscriptionsPage admin={admin} /> : path === "/admin/orders" ? <AdminOrdersPage admin={admin} /> : path === "/admin/transactions" ? <AdminTransactionsPage admin={admin} /> : path === "/admin/plans" ? <AdminPlansPage admin={admin} /> : planNewMatch ? <AdminPlanEditorPage admin={admin} id="new" /> : planEditMatch ? <AdminPlanEditorPage admin={admin} id={decodeURIComponent(planEditMatch[1])} /> : planDetailMatch ? <AdminPlanDetailPage admin={admin} id={decodeURIComponent(planDetailMatch[1])} /> : path === "/admin/resources" ? <AdminResourcesPage admin={admin} /> : path === "/admin/targets" ? <AdminTargetsPage admin={admin} /> : path === "/admin/classes" ? <AdminClassesPage admin={admin} /> : administratorDetailMatch ? <AdminAdministratorDetailPage admin={admin} uid={decodeURIComponent(administratorDetailMatch[1])} /> : userDetailMatch ? <AdminUserDetailPage admin={admin} uid={decodeURIComponent(userDetailMatch[1])} /> : subscriptionDetailMatch ? <AdminSubscriptionDetailPage admin={admin} id={decodeURIComponent(subscriptionDetailMatch[1])} /> : orderDetailMatch ? <AdminOrderDetailPage admin={admin} id={decodeURIComponent(orderDetailMatch[1])} /> : transactionDetailMatch ? <AdminTransactionDetailPage admin={admin} id={decodeURIComponent(transactionDetailMatch[1])} /> : resourceDetailMatch ? <AdminResourceDetailPage admin={admin} id={decodeURIComponent(resourceDetailMatch[1])} /> : <AdminModulePlaceholder admin={admin} title={navItem?.[1] || "Admin Module"} permission={navItem?.[2] || "admin.dashboard.view"} />}</AdminLayout>}</AdminRouteGuard>;
}
function Footer() {
  return <footer className="site-footer" id="contact"><div><Brand small="Student guidance for banking exams" /><p>Strategy, study targets, premium resources, and current affairs for serious banking aspirants.</p></div><div><h4>Plans</h4>{plans.slice(0, 4).map((plan) => <a href={`${appBase}#plans`} key={plan.planId}>{plan.name}</a>)}</div><div><h4>Platform</h4><a href={`${appBase}#strategy`}>Strategy</a><a href={`${appBase}#plans`}>Access Plans</a><a href={`${appBase}about`}>About Imran Sir</a><a href={`${appBase}student-desk`}>Student Desk</a><a href={`${appBase}privacy-policy`}>Privacy Policy</a></div><div><h4>Contact</h4><a href="mailto:support@delightguidance.com">support@delightguidance.com</a><span>India</span><span>Copyright {new Date().getFullYear()} Delight Banking</span><p className="developer-credit">Developed by <a href="mailto:darkdevil7325@gmail.com?subject=Delight%20Guidance%20Website%20Enquiry" title="Contact developer Arman" aria-label="Contact developer Arman">Arman</a></p></div></footer>;
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
  if (path.startsWith("/student-desk") || url.hash.includes("student-desk")) return <StudentContentDeskPage path={path.replace(/\/$/, "") || "/student-desk"} />;
  if (path.endsWith("/about")) return <AboutPage />;
  if (path.endsWith("/privacy-policy") || url.hash === "#privacy-policy") return <PrivacyPolicyPage />;
  return <HomePage />;
}


















































