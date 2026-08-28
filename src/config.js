import catalog from "../data/plans.json";

export const appBase = import.meta.env.BASE_URL || "/";
export const logoPath = `${appBase}delight-logo.png`;
export const mentorPhotoPath = `${appBase}imran-sir-mentor.jpg`;

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBbV7wiITBK0vCTJ9LOOXlWrmyfha1d3n4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "delight-banking.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "delight-banking",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "delight-banking.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "598377619885",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:598377619885:web:73745af0dc6ee6e0560124",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-SQE0Y2WH6Q"
};

export const paymentConfig = {
  key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
  businessName: "Delight Banking",
  description: "Educational mentorship and guidance services"
};

export const adminEmails = ["darkdevil7325@gmail.com"];
export const exams = ["SBI PO", "SBI Clerk", "IBPS PO", "IBPS Clerk", "RRB PO", "RRB Clerk"];
export const plans = catalog.plans;
export const planVariants = plans.flatMap((plan) => plan.variants.map((variant) => ({ ...variant, plan })));

export function getPlanVariant(variantId) {
  return planVariants.find((item) => item.variantId === variantId) || null;
}

export const seedResources = [
  {
    id: "seed-current-affairs",
    title: "Daily Current Affairs Pack",
    exam: "SBI PO",
    planTags: ["jigra", "gati", "personal-coaching", "pickup"],
    type: "Current Affairs",
    premium: true,
    url: "",
    description: "Banking, economy, finance, and national updates prepared for quick exam revision."
  },
  {
    id: "seed-study-plan",
    title: "30-Day Prelims Study Plan",
    exam: "IBPS Clerk",
    planTags: ["gati", "begin", "personal-coaching", "pickup"],
    type: "Study Plan",
    premium: true,
    url: "",
    description: "A disciplined study map for Quant, Reasoning, English, revision, and mock tests."
  },
  {
    id: "seed-strategy",
    title: "Mock Test Analysis Method",
    exam: "RRB PO",
    planTags: ["jigra", "gati", "personal-coaching"],
    type: "Strategy",
    premium: false,
    url: "",
    description: "A free preview explaining score review, error logs, and next-day correction targets."
  }
];
