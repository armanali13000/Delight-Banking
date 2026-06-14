export const appBase = import.meta.env.BASE_URL || "/Delight-Banking/";
export const logoPath = `${appBase}delight-logo.png`;

export const firebaseConfig = {
  apiKey: "AIzaSyBbV7wiITBK0vCTJ9LOOXlWrmyfha1d3n4",
  authDomain: "delight-banking.firebaseapp.com",
  projectId: "delight-banking",
  storageBucket: "delight-banking.firebasestorage.app",
  messagingSenderId: "598377619885",
  appId: "1:598377619885:web:73745af0dc6ee6e0560124",
  measurementId: "G-SQE0Y2WH6Q"
};

export const paymentConfig = {
  // Add your Razorpay Key ID here. It looks like rzp_test_xxxxx or rzp_live_xxxxx.
  // Do not put the Razorpay Key Secret in this frontend file.
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
