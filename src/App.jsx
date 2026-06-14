import { useEffect, useMemo, useState } from "react";
import { AuthModal } from "./components/AuthModal.jsx";
import { Brand } from "./components/Brand.jsx";
import { adminEmails, appBase, exams, paymentConfig, plans } from "./config.js";
import {
  activateAccess,
  addResource,
  deleteResource,
  getResources,
  getAccessMap,
  getStudents,
  getUserProfile,
  hasExamAccess,
  listenToAuth,
  saveUserProfile,
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const activeExams = user?.email ? getAccessMap()[user.email] || [] : [];
  const savedProfile = user?.email ? getUserProfile(user.email) : {};
  const studentName = savedProfile.name || user?.displayName || user?.email?.split("@")[0] || "Student";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("db_theme", theme);
  }, [theme]);

  useEffect(() => {
    const refreshProfile = () => setProfileVersion((value) => value + 1);
    window.addEventListener("profile-updated", refreshProfile);
    return () => window.removeEventListener("profile-updated", refreshProfile);
  }, []);

  void profileVersion;

  return (
    <header className="site-header">
      <Brand />
      <nav className="main-nav">
        <a href={appBase}>Home</a>
        <a href={`${appBase}#programs`}>Exams</a>
        <a href={`${appBase}#strategy`}>Strategy</a>
        <a href={`${appBase}#plans`}>Plans</a>
        <a href={studentDeskUrl}>Student Desk</a>
        <a href={adminUrl}>Admin</a>
      </nav>
      <div className="header-actions">
        <button
          className="icon-button theme-button"
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? (
            <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4V2" />
              <path d="M12 22v-2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M4 12H2" />
              <path d="M22 12h-2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          ) : (
            <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7 7 0 1 0 20.5 14.5Z" />
            </svg>
          )}
        </button>
        {user ? (
          <div className="profile-menu">
            <button
              className={`profile-button ${savedProfile.photo ? "has-photo" : ""}`}
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
            >
              {savedProfile.photo && (
                <img
                  src={savedProfile.photo}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    event.currentTarget.parentElement?.classList.add("avatar-fallback");
                  }}
                />
              )}
              <span className="profile-initial">{(studentName || "D").slice(0, 1).toUpperCase()}</span>
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-summary">
                  <strong>{studentName}</strong>
                  <span>{user.email}</span>
                </div>
                <div className="subscription-box">
                  <span className="menu-label">Subscription</span>
                  {activeExams.length ? (
                    activeExams.map((exam) => <span className="status-pill" key={exam}>{exam}</span>)
                  ) : (
                    <p>No active exam access</p>
                  )}
                </div>
                <a className="menu-link" href={`${studentDeskUrl}-profile`} onClick={() => setProfileOpen(false)}>Profile</a>
                <button className="menu-link danger-link" type="button" onClick={onLogout}>Logout</button>
              </div>
            )}
          </div>
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
  const [accessVersion, setAccessVersion] = useState(0);
  const activeExams = user?.email ? getAccessMap()[user.email] || [] : [];

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
      setAccessVersion((value) => value + 1);
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
        setAccessVersion((value) => value + 1);
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

  void accessVersion;

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
              <a className="primary-button" href={activeExams.length ? "#student-desk" : "#plans"}>
                {activeExams.length ? "Open Student Desk" : "Choose Access"}
              </a>
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
            <h2>{activeExams.length ? "Your access is active" : "Choose access by exam"}</h2>
            <p>
              {activeExams.length
                ? "You already have an active exam plan. Continue to your resources and study dashboard."
                : "Plan details are editable in one React config file whenever you want to change them."}
            </p>
          </div>
          {activeExams.length ? (
            <div className="access-summary-card">
              <div>
                <span className="chip">Active</span>
                <h3>{activeExams.join(", ")}</h3>
                <p>Plans are hidden for subscribed students so you can focus on resources.</p>
              </div>
              <a className="primary-button" href="#student-desk">Open Resources</a>
            </div>
          ) : (
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
          )}
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
  const [profile, setProfile] = useState({});
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    listenToAuth((nextUser) => {
      setUser(nextUser);
      setProfile(nextUser?.email ? getUserProfile(nextUser.email) : {});
    });
    refreshResources();
  }, []);

  async function refreshResources() {
    setResources(await getResources());
  }

  async function logout() {
    await signOutUser();
    setUser(null);
    setProfile({});
  }

  const visibleResources = useMemo(() => resources.filter((item) => item.exam === exam), [resources, exam]);
  const activeExams = user?.email ? getAccessMap()[user.email] || [] : [];
  const isAdminUser = Boolean(user?.email && adminEmails.includes(user.email));
  const unlockedResources = resources.filter((item) => !item.premium || hasExamAccess(user, item.exam)).length;
  const premiumResources = resources.filter((item) => item.premium).length;
  const studentName = profile.name || user?.displayName || user?.email?.split("@")[0] || "Guest Student";

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function saveProfile(event) {
    event.preventDefault();
    if (!user?.email) {
      setAuthMode("signin");
      return;
    }
    saveUserProfile(user.email, profile);
    setProfileMessage("Profile saved.");
  }

  function handleProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateProfile("photo", reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <>
      <Header user={user} onAuth={setAuthMode} onLogout={logout} />
      <main className="desk-page">
        <section className="section desk-hero-section" id="student-desk">
          <div className="desk-hero">
            <div className="section-heading">
              <p className="eyebrow">Student Desk</p>
              <h1 className="page-title">Your study dashboard</h1>
              <p>Track exam access, daily resources, study targets, and profile details from one focused workspace.</p>
            </div>
            {!isAdminUser && (
              <div className="desk-stats">
                <article className="stat-card">
                  <span>Active Plans</span>
                  <strong>{activeExams.length}</strong>
                </article>
                <article className="stat-card">
                  <span>Unlocked Resources</span>
                  <strong>{unlockedResources}</strong>
                </article>
                <article className="stat-card">
                  <span>Premium Library</span>
                  <strong>{premiumResources}</strong>
                </article>
              </div>
            )}
          </div>
          <div className="student-grid professional-desk">
            <aside className="profile-panel">
              {profile.photo ? (
                <img className="profile-photo" src={profile.photo} alt="" />
              ) : (
                <div className="profile-logo">{(studentName || "D").slice(0, 1).toUpperCase()}</div>
              )}
              <h3>{studentName}</h3>
              <p>{user?.email || "Login to sync your access."}</p>
              <div className="subscription-box">
                <span className="menu-label">Subscription</span>
                {activeExams.length ? activeExams.map((item) => (
                  <span className="status-pill" key={item}>{item}</span>
                )) : <p>No active access</p>}
              </div>
              {!user && <button className="primary-button full" type="button" onClick={() => setAuthMode("signin")}>Login to Continue</button>}
              {user && !activeExams.length && <a className="ghost-button full" href={`${appBase}#plans`}>Buy Exam Access</a>}
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
          <form className="profile-edit-panel" id="student-desk-profile" onSubmit={saveProfile}>
            <div>
              <p className="eyebrow">Profile</p>
              <h2>Student profile</h2>
              <p>Keep your profile details updated for guidance and exam planning.</p>
            </div>
            <div className="profile-form-grid">
              <label>Name<input value={profile.name || ""} onChange={(event) => updateProfile("name", event.target.value)} placeholder="Your full name" /></label>
              <label>Phone<input value={profile.phone || ""} onChange={(event) => updateProfile("phone", event.target.value)} placeholder="Mobile number" /></label>
              <label>City<input value={profile.city || ""} onChange={(event) => updateProfile("city", event.target.value)} placeholder="Your city" /></label>
              <label>Target Exam<select value={profile.targetExam || exams[0]} onChange={(event) => updateProfile("targetExam", event.target.value)}>{exams.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Profile Picture<input type="file" accept="image/*" onChange={handleProfilePhoto} /></label>
              <label>Picture URL<input value={profile.photo?.startsWith("data:") ? "" : profile.photo || ""} onChange={(event) => updateProfile("photo", event.target.value)} placeholder="https://..." /></label>
              <label className="wide-field">Address<textarea rows="3" value={profile.address || ""} onChange={(event) => updateProfile("address", event.target.value)} placeholder="Address or study location" /></label>
            </div>
            <button className="primary-button" type="submit">{user ? "Save Profile" : "Login to Save"}</button>
            {profileMessage && <p className="form-message">{profileMessage}</p>}
          </form>
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
        <a href={`${appBase}#privacy-policy`}>Privacy Policy</a>
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

function PrivacyPolicyPage() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    listenToAuth(setUser);
  }, []);

  async function logout() {
    await signOutUser();
    setUser(null);
  }

  return (
    <>
      <Header user={user} onAuth={setAuthMode} onLogout={logout} />
      <main className="policy-page">
        <section className="section">
          <div className="section-heading">
            <p className="eyebrow">Privacy Policy</p>
            <h1 className="page-title">Your data and access</h1>
            <p>Delight Banking uses login information to manage student access, resources, and exam-plan subscriptions.</p>
          </div>
          <div className="policy-content">
            <article className="premium-card">
              <h3>Information We Use</h3>
              <p>We may use your name, email address, login provider details, selected exam plan, and resource access status to provide the learning experience.</p>
            </article>
            <article className="premium-card">
              <h3>Payments</h3>
              <p>Payments are processed by a secure payment provider. Delight Banking should not store your card, UPI, or banking credentials on this website.</p>
            </article>
            <article className="premium-card">
              <h3>Resources</h3>
              <p>Access to premium resources is connected to the exam plan activated on your account.</p>
            </article>
            <article className="premium-card">
              <h3>Contact</h3>
              <p>For privacy or account questions, email support@delightbanking.com.</p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}
    </>
  );
}

function AdminPage() {
  const [user, setUser] = useState(null);
  const [resources, setResources] = useState([]);
  const [students, setStudents] = useState([]);
  const [exam, setExam] = useState("All");
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState(null);
  const isAdmin = Boolean(user?.email && adminEmails.includes(user.email));

  useEffect(() => {
    listenToAuth(setUser);
    refreshResources();
    refreshStudents();
  }, []);

  async function refreshResources() {
    setResources(await getResources());
  }

  async function refreshStudents() {
    setStudents(await getStudents());
  }

  async function publish(event) {
    event.preventDefault();
    setMessage("");
    if (!isAdmin) {
      setMessage("Login with an admin email first.");
      return;
    }
    const data = new FormData(event.currentTarget);
    try {
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
      await refreshStudents();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const list = resources.filter((item) => exam === "All" || item.exam === exam);

  if (!isAdmin) {
    return (
      <>
        <Header user={user} onAuth={setAuthMode} onLogout={async () => { await signOutUser(); setUser(null); }} />
        <main className="admin-gate">
          <section className="gate-card">
            <p className="eyebrow">Admin Access</p>
            <h1>Admin login required</h1>
            <p>
              The Control Room is available only for the Delight Banking admin account.
            </p>
            {user ? (
              <>
                <span className="status-pill">Signed in as {user.email}</span>
                <p className="form-message">This email is not authorized for admin access.</p>
              </>
            ) : (
              <button className="primary-button" type="button" onClick={() => setAuthMode("signin")}>Admin Login</button>
            )}
          </section>
        </main>
        {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onUser={setUser} />}
      </>
    );
  }

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
                    {isAdmin && <button className="ghost-button" type="button" onClick={async () => {
                      try {
                        await deleteResource(item.id);
                        await refreshResources();
                      } catch (error) {
                        setMessage(error.message);
                      }
                    }}>Delete</button>}
                  </header>
                  <div className="meta-row"><span>{item.exam}</span><span>{item.type}</span><span>{item.premium ? "Premium" : "Free"}</span></div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="admin-students-section">
          <div className="resource-toolbar">
            <div>
              <p className="eyebrow">Students</p>
              <h2>Student details</h2>
              <p>View known students, profile details, and active subscription exams.</p>
            </div>
            <button className="ghost-button" type="button" onClick={refreshStudents}>Refresh</button>
          </div>
          <div className="students-grid">
            {students.length ? students.map((student) => (
              <article className="student-card" key={student.email}>
                <header>
                  {student.photo ? (
                    <img src={student.photo} alt="" />
                  ) : (
                    <div className="profile-logo">{(student.name || student.email || "S").slice(0, 1).toUpperCase()}</div>
                  )}
                  <div>
                    <h3>{student.name || "Student"}</h3>
                    <p>{student.email}</p>
                  </div>
                </header>
                <dl className="student-details">
                  <div><dt>Phone</dt><dd>{student.phone || "Not added"}</dd></div>
                  <div><dt>City</dt><dd>{student.city || "Not added"}</dd></div>
                  <div><dt>Target Exam</dt><dd>{student.targetExam || "Not selected"}</dd></div>
                  <div><dt>Address</dt><dd>{student.address || "Not added"}</dd></div>
                </dl>
                <div className="subscription-box">
                  <span className="menu-label">Subscription</span>
                  {student.activeExams?.length ? (
                    student.activeExams.map((item) => <span className="status-pill" key={item}>{item}</span>)
                  ) : (
                    <p>No active subscription</p>
                  )}
                </div>
              </article>
            )) : (
              <article className="resource-item">
                <h3>No student data yet</h3>
                <p>Student records appear after users login or update their profiles.</p>
              </article>
            )}
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
  const isStudentDeskRoute = route.includes("#student-desk") || route.endsWith("/student-desk");
  const isPrivacyRoute = route.endsWith("#privacy-policy") || route.endsWith("/privacy-policy");
  if (isAdminRoute) return <AdminPage />;
  if (isStudentDeskRoute) return <StudentDeskPage />;
  if (isPrivacyRoute) return <PrivacyPolicyPage />;
  return <HomePage />;
}
