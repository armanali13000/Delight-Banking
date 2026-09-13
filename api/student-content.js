import {
  getStudentContentDashboard,
  getStudentResource,
  getStudentTarget,
  joinClass,
  listStudentClasses,
  listStudentResources,
  listStudentTargets,
  recordResourceView,
  requestFileAccess,
  updateTargetProgress
} from "../server/_lib/content.js";
import { listEffectivePlans } from "../server/_lib/planManagement.js";
import { handleError, method, readJson, sendJson } from "../server/_lib/http.js";
import { submitContactEnquiry } from "../server/_lib/support.js";
import { getPreferences, listUserNotifications, markNotifications, savePreferences } from "../server/_lib/notifications.js";
import { requireUser } from "../server/_lib/firebaseAdmin.js";
import { createTelegramConnectionLink, disconnectTelegram, handleTelegramWebhook, telegramConnectionStatus } from "../server/_lib/telegram.js";

const RESOURCES = new Set(["dashboard", "resources", "targets", "classes", "plans", "notifications", "notification_preferences", "telegram_webhook"]);
const ACTIONS = new Set(["request_file_access", "record_resource_view", "record_download", "update_target_progress", "join_class", "submit_contact", "mark_notification", "mark_all_notifications", "save_notification_preferences", "connect_telegram", "disconnect_telegram"]);

function cleanText(value, max = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function queryResource(req) {
  const resource = cleanText(req.query?.resource || "dashboard", 80);
  if (!RESOURCES.has(resource)) badRequest("Invalid student content resource.");
  return resource;
}

function queryId(req, name = "id") {
  return cleanText(req.query?.[name] || req.query?.id, 240);
}

async function handleGet(req, res, resource) {
  if (resource === "notifications") return sendJson(res, 200, await listUserNotifications(req, req.query || {}));
  if (resource === "notification_preferences") return sendJson(res, 200, await getPreferences(req));
  if (resource === "plans") return sendJson(res, 200, { plans: await listEffectivePlans({ publicOnly: true }) });
  if (resource === "dashboard") return sendJson(res, 200, await getStudentContentDashboard(req));
  if (resource === "resources") {
    const id = queryId(req, "resourceId");
    return sendJson(res, 200, id ? await getStudentResource(req, id) : await listStudentResources(req, req.query || {}));
  }
  if (resource === "targets") {
    const id = queryId(req, "targetId");
    return sendJson(res, 200, id ? await getStudentTarget(req, id) : await listStudentTargets(req, req.query || {}));
  }
  if (resource === "classes") return sendJson(res, 200, await listStudentClasses(req, req.query || {}));
  badRequest("Invalid student content resource.");
}

async function handlePost(req, res) {
  const body = await readJson(req);
  const action = cleanText(body.action, 80);
  if (!ACTIONS.has(action)) badRequest("Invalid student content action.");
  if (action === "mark_notification") return sendJson(res, 200, await markNotifications(req, body));
  if (action === "mark_all_notifications") return sendJson(res, 200, await markNotifications(req, { all: true }));
  if (action === "save_notification_preferences") return sendJson(res, 200, await savePreferences(req, body));
  if (action === "connect_telegram") { const user = await requireUser(req); return sendJson(res, 200, { connection: await telegramConnectionStatus(user.uid), link: await createTelegramConnectionLink(user) }); }
  if (action === "disconnect_telegram") { const user = await requireUser(req); return sendJson(res, 200, await disconnectTelegram(user)); }
  if (action === "submit_contact") return sendJson(res, 201, await submitContactEnquiry(req, body));
  if (action === "request_file_access") return sendJson(res, 200, await requestFileAccess(req, body));
  if (action === "record_download") return sendJson(res, 200, await requestFileAccess(req, { ...body, download: true }));
  if (action === "record_resource_view") return sendJson(res, 200, await recordResourceView(req, body));
  if (action === "update_target_progress") return sendJson(res, 200, await updateTargetProgress(req, body));
  if (action === "join_class") return sendJson(res, 200, await joinClass(req, body));
  badRequest("Invalid student content action.");
}

export default async function handler(req, res) {
  try {
    const resource = queryResource(req);
    if (resource === "telegram_webhook") return sendJson(res, 200, await handleTelegramWebhook(req));
    if (req.method === "GET") return await handleGet(req, res, resource);
    if (req.method === "POST") return await handlePost(req, res);
    if (!method(req, res, ["GET", "POST"])) return;
  } catch (error) {
    handleError(res, error);
  }
}

