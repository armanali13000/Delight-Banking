const admin = require("firebase-admin");
const catalog = require("../data/plans.json");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n")
  })
});

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

async function run() {
  const batch = db.batch();
  for (const plan of catalog.plans) {
    const { variants, ...planData } = plan;
    batch.set(db.collection("plans").doc(plan.planId), { ...planData, createdAt: now, updatedAt: now }, { merge: true });
    for (const variant of variants) {
      batch.set(db.collection("planVariants").doc(variant.variantId), {
        ...variant,
        planId: plan.planId,
        priceInPaise: variant.priceInRupees * 100,
        createdAt: now,
        updatedAt: now
      }, { merge: true });
    }
  }
  await batch.commit();
  console.log(`Seeded ${catalog.plans.length} plans and ${catalog.plans.flatMap((plan) => plan.variants).length} variants.`);
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
