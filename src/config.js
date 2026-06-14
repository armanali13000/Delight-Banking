export const logoPath = "/delight-logo.png";

export const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "PASTE_FIREBASE_AUTH_DOMAIN",
  projectId: "PASTE_FIREBASE_PROJECT_ID",
  storageBucket: "PASTE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "PASTE_FIREBASE_APP_ID"
};

export const paymentConfig = {
  key: "PASTE_PAYMENT_KEY_ID",
  businessName: "Delight Banking",
  description: "Exam access activation"
};

export const adminEmails = ["admin@delightbanking.com"];

export const exams = ["SBI PO", "SBI Clerk", "IBPS PO", "IBPS Clerk", "RRB PO", "RRB Clerk"];

export const plans = [
  {
    id: "sbi-po",
    exam: "SBI PO",
    title: "SBI PO Elite",
    price: 999,
    featured: true,
    benefits: ["Prelims to interview roadmap", "Mains mock review system", "Daily banking awareness"]
  },
  {
    id: "sbi-clerk",
    exam: "SBI Clerk",
    title: "SBI Clerk Sprint",
    price: 699,
    benefits: ["Speed-building drills", "Sectional target sheets", "Revision calendar"]
  },
  {
    id: "ibps-po",
    exam: "IBPS PO",
    title: "IBPS PO Prime",
    price: 899,
    featured: true,
    benefits: ["Mains-focused strategy", "GA and banking plan", "Weekly mentor targets"]
  },
  {
    id: "ibps-clerk",
    exam: "IBPS Clerk",
    title: "IBPS Clerk Plus",
    price: 649,
    benefits: ["Foundation study path", "Accuracy improvement routine", "Daily practice goals"]
  },
  {
    id: "rrb-po",
    exam: "RRB PO",
    title: "RRB PO Command",
    price: 799,
    benefits: ["Regional bank focus", "Financial awareness notes", "Interview guidance"]
  },
  {
    id: "rrb-clerk",
    exam: "RRB Clerk",
    title: "RRB Clerk Focus",
    price: 599,
    benefits: ["Cut-off based planning", "Daily study targets", "Current affairs revision"]
  }
];

export const seedResources = [
  {
    id: "seed-current-affairs",
    title: "Daily Current Affairs Pack",
    exam: "SBI PO",
    type: "Current Affairs",
    premium: true,
    url: "",
    description: "Banking, economy, finance, and national updates prepared for quick exam revision."
  },
  {
    id: "seed-study-plan",
    title: "30-Day Prelims Study Plan",
    exam: "IBPS Clerk",
    type: "Study Plan",
    premium: true,
    url: "",
    description: "A disciplined study map for Quant, Reasoning, English, revision, and mock tests."
  },
  {
    id: "seed-strategy",
    title: "Mock Test Analysis Method",
    exam: "RRB PO",
    type: "Strategy",
    premium: false,
    url: "",
    description: "A free preview explaining score review, error logs, and next-day correction targets."
  }
];
