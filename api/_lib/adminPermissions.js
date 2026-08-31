export const ADMIN_ROLES = ["super_admin", "admin", "support", "content_manager"];
export const LIMITED_ADMIN_ROLES = ["admin", "support", "content_manager"];

export const ADMIN_PERMISSIONS = {
  DASHBOARD_VIEW: "admin.dashboard.view",
  ACTIVITY_LOGS_VIEW: "admin.activity_logs.view",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  SUBSCRIPTIONS_VIEW: "subscriptions.view",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_VIEW_LIMITED: "payments.view_limited",
  REFUNDS_MANAGE: "refunds.manage",
  PLANS_VIEW: "plans.view",
  PLANS_MANAGE: "plans.manage",
  RESOURCES_VIEW: "resources.view",
  RESOURCES_MANAGE: "resources.manage",
  TARGETS_VIEW: "targets.view",
  TARGETS_MANAGE: "targets.manage",
  CLASSES_VIEW: "classes.view",
  CLASSES_MANAGE: "classes.manage",
  SUPPORT_VIEW: "support.view",
  SUPPORT_MANAGE: "support.manage",
  REPORTS_VIEW: "reports.view",
  ADMINS_MANAGE: "admins.manage",
  SECURITY_SETTINGS_MANAGE: "security.settings.manage"
};

export const ROLE_PERMISSIONS = {
  super_admin: Object.values(ADMIN_PERMISSIONS),
  admin: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.USERS_VIEW,
    ADMIN_PERMISSIONS.USERS_MANAGE,
    ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW,
    ADMIN_PERMISSIONS.SUBSCRIPTIONS_MANAGE,
    ADMIN_PERMISSIONS.PAYMENTS_VIEW,
    ADMIN_PERMISSIONS.PLANS_VIEW,
    ADMIN_PERMISSIONS.RESOURCES_VIEW,
    ADMIN_PERMISSIONS.RESOURCES_MANAGE,
    ADMIN_PERMISSIONS.SUPPORT_VIEW,
    ADMIN_PERMISSIONS.SUPPORT_MANAGE,
    ADMIN_PERMISSIONS.REPORTS_VIEW
  ],
  support: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.USERS_VIEW,
    ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW,
    ADMIN_PERMISSIONS.PAYMENTS_VIEW_LIMITED,
    ADMIN_PERMISSIONS.SUPPORT_VIEW,
    ADMIN_PERMISSIONS.SUPPORT_MANAGE
  ],
  content_manager: [
    ADMIN_PERMISSIONS.DASHBOARD_VIEW,
    ADMIN_PERMISSIONS.PLANS_VIEW,
    ADMIN_PERMISSIONS.RESOURCES_VIEW,
    ADMIN_PERMISSIONS.RESOURCES_MANAGE,
    ADMIN_PERMISSIONS.TARGETS_VIEW,
    ADMIN_PERMISSIONS.TARGETS_MANAGE,
    ADMIN_PERMISSIONS.CLASSES_VIEW,
    ADMIN_PERMISSIONS.CLASSES_MANAGE
  ]
};

export function isValidAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isLimitedAdminRole(role) {
  return LIMITED_ADMIN_ROLES.includes(role);
}

export function permissionsForRole(role, explicitPermissions = []) {
  if (role === "super_admin") return ROLE_PERMISSIONS.super_admin;
  const allowed = new Set(ROLE_PERMISSIONS[role] || []);
  const explicit = Array.isArray(explicitPermissions) ? explicitPermissions : [];
  return explicit.length ? explicit.filter((permission) => allowed.has(permission)) : [...allowed];
}