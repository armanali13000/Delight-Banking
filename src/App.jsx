import { useEffect, useMemo, useState } from "react";
import { AuthModal } from "./components/AuthModal.jsx";
import { Brand } from "./components/Brand.jsx";
import { adminEmails, appBase, exams, paymentConfig, plans } from "./config.js";
import {
  activateAccess,
  addResource,
  deleteResource,
  getResources,
  hasExamAccess,
  listenToAuth,
  signOutUser
} from "./services/dataService.js";

const examCards = [
  ["SBI", "SBI PO", "Prelims, mains, descriptive practice, interview approach, and mock strategy."],
  ["SBI", "SBI Clerk", "Speed building, accuracy routine, sectional timing, and daily practice targets."],
  ["IBPS", "IBPS PO", "Banking awareness, mains analysis, smart mock review, and study plan discipline."],
  ["IBPS", "IBPS Clerk", "Foundation drills, calculation speed, sectional revision, and exam-day confidence."],
  ["RRB", "RRB PO", "Regional bank focus, financial awareness, mains score improvement, and interview prep."],
  ["RRB", "RRB Clerk", "Daily topic targets, cut-off based preparation, and high-retention revision cycles."]
];

function Header({ user, onAuth, onLogout }) {
  const adminUrl = `${appBase}#admin`;
  const studentDeskUrl = `${appBase}#student-desk`;
  const [theme, setTheme] = useState(() => localStorage.getItem("db_theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("db_theme", theme);
  }, [theme]);

  return (
    <header className="site-header">
      <Brand />
      <nav className="main-nav">
        <a href={`${appBase}#programs`}>Exams</a>
        <a href={`${appBase}#strategy`}>Strategy</a>
        <a href={`${appBase}#plans`}>Plans</a>
        <a href={studentDeskUrl}>Student Desk</a>
        <a href={adminUrl}>Admin</a>
      </nav>
      <div className="header-actions">
        <button
          className="ghost-button theme-button"
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        {user ? (
          <button className="ghost-button" type="button" onClick={onLogout}>Logout</button>
        ) : (
          <>
            <button className="ghost-button" type="button" onClick={() => onAuth("signin")}>Login</button>
            <button className="primary-button" type="button" onClick={() => onAuth("signup")}>Start</button>
          </>
        )}
      </div>
    </header>
  );
}

function HomePage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    listenToAuth(setUser);
  }, []);

  async function logout() {
    await signOutUser();
    setUser(null);
  }

  function buyPlan(plan) {
    if (!user) {
      setAuthMode("signin");
      return;
    }

    if (!window.Razorpay || paymentConfig.key.includes("PASTE_")) {
      activateAccess(user, plan.exam);
      setResources([...resources]);
      window.alert(`${plan.exam} access activated in demo mode.`);
      window.location.hash = "student-desk";
      return;
    }

    const checkout = new window.Razorpay({
      key: paymentConfig.key,
      amount: plan.price * 100,
      currency: "INR",
      name: paymentConfig.businessName,
      description: `${plan.exam} access`,
      prefill: { email: user.email, name: user.displayName || user.email },
      theme: { color: "#d21f32" },
      handler: () => {
        activateAccess(user, plan.exam);
        setResources([...resources]);
        window.alert(`${plan.exam} access is active.`);
        window.location.hash = "student-desk";
      },
      modal: {
        ondismiss: () => {
          window.alert("Payment window closed. Access was not activated.");
        }
      },
      retry: {
        enabled: true
      }
    });
    checkout.on("payment.failed", (response) => {
      window.alert(response.error?.description || "Payment failed. Please try again.");
    });
    checkout.open();
  }

  return (
    <>
      <Header user={user} onAuth={setAuthMode} onLogout={logout} />
      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <p className="eyebrow">SBI | IBPS | RRB</p>
            <h1>Delight Banking</h1>
            <p>
              Premium banking exam guidance with mentor strategy, study targets,
              current affairs, and resources that unlock after access activation.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#plans">Choose Access</a>
              <a className="ghost-button" href="#student-desk">Student Desk</a>
            </div>
          </div>
          <div className="hero-board" aria-hidden="true">
            <div className="rank-card main-rank">
              <span>Today Target</span>
              <strong>82%</strong>
              <small>Quant | Reasoning | Current Affairs</small>
            </div>
            <div className="rank-card">
              <span>Mock Review</span>
              <strong>+18</strong>
              <small>Marks improvement cycle</small>
            </div>
            <div className="rank-card">
              <span>Exam Focus</span>
              <strong>6</strong>
              <small>Banking tracks</small>
            </div>
          </div>
        </section>

        <section className="section" id="programs">
          <div className="section-heading">
            <p className="eyebrow">Exam Tracks</p>
            <h2>Guidance built around your target exam</h2>
            <p>Focused preparation for prelims, mains, interview, current affairs, and revision.</p>
          </div>
          <div className="program-grid">
            {examCards.map(([tag, title, text]) => (
              <article className="premium-card" key={title}>
                <span className="chip">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="strategy-band" id="strategy">
          <div>
            <p className="eyebrow">Mentor Guidance</p>
            <h2>Strategy, study plans, and daily execution</h2>
            <p>Guides can publish resources from the admin area. Students see locked previews until they activate access.</p>
          </div>
          {["How to clear exams", "Study plans", "Daily current affairs"].map((title, index) => (
            <article className="strategy-item" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{index === 0 ? "Attempt planning, mock analysis, score tracking, and sectional decision rules." : index === 1 ? "Weekly preparation maps for Quant, Reasoning, English, GA, and banking awareness." : "Exam-focused updates with banking, finance, economy, and national revision tags."}</p>
            </article>
          ))}
        </section>

        <section className="section" id="plans">
          <div className="section-heading">
            <p className="eyebrow">Access Plans</p>
            <h2>Choose access by exam</h2>
            <p>Plan details are editable in one React config file whenever you want to change them.</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.id}>
                <span className="chip">{plan.exam}</span>
                <h3>{plan.title}</h3>
                <div className="price">Rs. {plan.price}</div>
                <ul>{plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
                <button className="primary-button full" type="button" onClick={() => buyPlan(plan)}>Buy Access</button>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onUser={(nextUser) => {
            setUser(nextUser);
            window.location.hash = "student-desk";
          }}
        />
      )}
    </>
  );
}

function StudentDeskPage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [resources, setResources] = useState([]);
  const [exam, setExam] = useState(exams[0]);

  useEffect(() => {
    listenToAuth(setUser);
    refreshResources();
  }, []);

  async function refreshResources() {
    setResources(await getResources());
  }

  async function logout() {
    await signOutUser();
    setUser(null);
  }

  const visibleResources = useMemo(() => resources.filter((item) => item.exam === exam), [resources, exam]);

  return (
    <>
      <Header user={user} onAuth={setAuthMode} onLogout={logout} />
      <main className="desk-page">
        <section className="section" id="student-desk">
          <div className="section-heading">
            <p className="eyebrow">Student Desk</p>
            <h1 className="page-title">Your study dashboard</h1>
            <p>Login and activate an exam plan to view mentor resources, study targets, and current affairs.</p>
          </div>
          <div className="student-grid">
            <aside className="profile-panel">
              <div className="profile-logo">{(user?.displayName || user?.email || "D").slice(0, 1).toUpperCase()}</div>
              <h3>{user?.displayName || user?.email?.split("@")[0] || "Guest Student"}</h3>
              <p>{user?.email || "Login to sync your access."}</p>
              <span className="status-pill">{hasExamAccess(user, exam) ? `${exam} active` : "No active access"}</span>
              {!user && <button className="primary-button full" type="button" onClick={() => setAuthMode("signin")}>Login to Continue</button>}
              {user && <a className="ghost-button full" href={`${appBase}#plans`}>Buy Exam Access</a>}
            </aside>
            <div className="resource-panel">
              <div className="toolbar">
                <label htmlFor="exam">Exam</label>
                <select id="exam" value={exam} onChange={(event) => setExam(event.target.value)}>
                  {exams.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="resource-list">
                {visibleResources.length ? visibleResources.map((item) => {
                  const locked = item.premium && !hasExamAccess(user, item.exam);
                  return (
                    <article className={`resource-item ${locked ? "locked" : ""}`} key={item.id}>
                      <header>
                        <div>
                          <h3>{item.title}</h3>
                          <p>{locked ? "This premium resource unlocks after access activation." : item.description}</p>
                        </div>
                        <span className="status-pill">{locked ? "Locked" : "Open"}</span>
                      </header>
                      <div className="meta-row">
                        <span>{item.exam}</span>
                        <span>{item.type}</span>
                        <span>{item.premium ? "Premium" : "Free Preview"}</span>
                      </div>
                      {!locked && item.url && <a className="text-button" href={item.url} target="_blank" rel="noreferrer">Open Resource</a>}
                    </article>
                  );
                }) : <article className="resource-item"><h3>No resources yet</h3><p>Your guide can publish resources from the admin page.</p></article>}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onUser={(nextUser) => {
            setUser(nextUser);
            window.location.hash = "student-desk";
          }}
        />
      )}
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Brand small="Student guidance for banking exams" />
        <p>Strategy, study targets, premium resources, and current affairs for serious banking aspirants.</p>
      </div>
      <div>
        <h4>Exams</h4>
        {exams.slice(0, 4).map((exam) => <a href={`${appBase}#programs`} key={exam}>{exam}</a>)}
      </div>
      <div>
        <h4>Platform</h4>
        <a href={`${appBase}#strategy`}>Strategy</a>
        <a href={`${appBase}#plans`}>Access Plans</a>
        <a href={`${appBase}#student-desk`}>Student Desk</a>
        <a href={`${appBase}#admin`}>Admin</a>
      </div>
      <div>
        <h4>Contact</h4>
        <a href="mailto:support@delightbanking.com">support@delightbanking.com</a>
        <span>India</span>
        <span>Copyright {new Date().getFullYear()} Delight Banking</span>
      </div>
    </footer>
  );
}

function AdminPage() {
  const [user, setUser] = useState(null);
  const [resources, setResources] = useState([]);
  const [exam, setExam] = useState("All");
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState(null);
  const isAdmin = Boolean(user?.email && adminEmails.includes(user.email));

  useEffect(() => {
    listenToAuth(setUser);
    refreshResources();
  }, []);

  async function refreshResources() {
    setResources(await getResources());
  }

  async function publish(event) {
    event.preventDefault();
    if (!isAdmin) {
      setMessage("Login with an admin email first.");
      return;
    }
    const data = new FormData(event.currentTarget);
    await addResource({
      title: data.get("title").trim(),
      exam: data.get("exam"),
      type: data.get("type"),
      url: data.get("url").trim(),
      description: data.get("description").trim(),
      premium: data.get("premium") === "on"
    });
    event.currentTarget.reset();
    event.currentTarget.elements.premium.checked = true;
    setMessage("Resource published.");
    await refreshResources();
  }

  const list = resources.filter((item) => exam === "All" || item.exam === exam);

  return (
    <>
      <Header user={user} onAuth={setAuthMode} onLogout={async () => { await signOutUser(); setUser(null); }} />
      <main className="admin-shell">
        <section className="admin-hero">
          <p className="eyebrow">Control Room</p>
          <h1>Manage Delight Banking resources</h1>
          <p>Add current affairs, study plans, strategy notes, and premium links for students.</p>
          <span className="status-pill">{isAdmin ? `Admin active: ${user.email}` : user ? "This email is not admin" : "Admin login required"}</span>
        </section>
        <section className="admin-grid">
          <form className="admin-form" onSubmit={publish}>
            <h2>Add Resource</h2>
            <label>Title<input name="title" required placeholder="Daily Current Affairs" disabled={!isAdmin} /></label>
            <label>Exam<select name="exam" disabled={!isAdmin}>{exams.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Type<select name="type" disabled={!isAdmin}>{["Strategy", "Study Plan", "Study Target", "Current Affairs", "PDF Resource", "Video Class"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Resource Link<input name="url" type="url" placeholder="https://..." disabled={!isAdmin} /></label>
            <label>Description<textarea name="description" rows="5" required disabled={!isAdmin} /></label>
            <label className="checkbox-row"><input name="premium" type="checkbox" defaultChecked disabled={!isAdmin} /> Premium resource</label>
            <button className="primary-button full" type="submit" disabled={!isAdmin}>Publish Resource</button>
            {message && <p className="form-message">{message}</p>}
          </form>
          <div className="resource-panel">
            <div className="toolbar">
              <h2>Published Resources</h2>
              <select value={exam} onChange={(event) => setExam(event.target.value)}>
                <option>All</option>
                {exams.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="resource-list">
              {list.map((item) => (
                <article className="resource-item" key={item.id}>
                  <header>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    {isAdmin && <button className="ghost-button" type="button" onClick={async () => { await deleteResource(item.id); await refreshResources(); }}>Delete</button>}
                  </header>
                  <div className="meta-row"><span>{item.exam}</span><span>{item.type}</span><span>{item.premium ? "Premium" : "Free"}</span></div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => `${window.location.pathname}${window.location.hash}`);

  useEffect(() => {
    const updateRoute = () => setRoute(`${window.location.pathname}${window.location.hash}`);
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  const isAdminRoute = route.endsWith("#admin") || route.endsWith("/admin");
  const isStudentDeskRoute = route.endsWith("#student-desk") || route.endsWith("/student-desk");
  if (isAdminRoute) return <AdminPage />;
  if (isStudentDeskRoute) return <StudentDeskPage />;
  return <HomePage />;
}
