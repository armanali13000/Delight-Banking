import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "..", "..", "data", "plans.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

export const plans = catalog.plans;

export function getVariant(variantId) {
  for (const plan of plans) {
    const variant = plan.variants.find((item) => item.variantId === variantId);
    if (variant && plan.active && variant.active) {
      return { plan, variant };
    }
  }
  return null;
}

export function planSnapshot(plan, variant) {
  return {
    planId: plan.planId,
    name: plan.name,
    subtitle: plan.subtitle,
    coverage: plan.coverage,
    description: plan.description,
    benefits: plan.benefits,
    accessTags: plan.accessTags,
    featured: plan.featured,
    variantId: variant.variantId,
    durationLabel: variant.durationLabel,
    durationMonths: variant.durationMonths,
    priceInRupees: variant.priceInRupees,
    priceInPaise: variant.priceInRupees * 100,
    currency: variant.currency || "INR"
  };
}
