export const ADMIN_ROLES = ["super_admin", "admin", "support", "content_manager"];

export const ADMIN_PERMISSIONS = {
  DASHBOARD_VIEW: "admin.dashboard.view",
  ACTIVITY_LOGS_VIEW: "admin.activity_logs.view",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  SUBSCRIPTIONS_VIEW: "subscriptions.view",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  PAYMENTS_VIEW: "payments.view",
  REFUNDS_MANAGE: "refunds.manage",
  PLANS_VIEW: "plans.view",
  PLANS_MANAGE: "plans.manage",
  RESOURCES_VIEW: "resources.view",
  RESOURCES_MANAGE: "resources.manage",
  SUPPORT_VIEW: "support.view",
  SUPPORT_MANAGE: "support.manage",
  REPORTS_VIEW: "reports.view",
  ADMINS_MANAGE: "admins.manage"
};

export const ROLE_PERMISSIONS = {
  super_admin: Object.values(ADMIN_PERMISSIONS),
  admin: [ADMIN_PERMISSIONS.DASHBOARD_VIEW, ADMIN_PERMISSIONS.ACTIVITY_LOGS_VIEW],
  support: [ADMIN_PERMISSIONS.DASHBOARD_VIEW],
  content_manager: [ADMIN_PERMISSIONS.DASHBOARD_VIEW]
};

export function isValidAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function permissionsForRole(role, explicitPermissions = []) {
  if (role === "super_admin") return ROLE_PERMISSIONS.super_admin;
  const allowed = new Set(ROLE_PERMISSIONS[role] || []);
  return explicitPermissions.filter((permission) => allowed.has(permission));
}
