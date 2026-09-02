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

const RESOURCES = new Set(["dashboard", "resources", "targets", "classes", "plans"]);
const ACTIONS = new Set(["request_file_access", "record_resource_view", "record_download", "update_target_progress", "join_class"]);

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
    if (req.method === "GET") return await handleGet(req, res, resource);
    if (req.method === "POST") return await handlePost(req, res);
    if (!method(req, res, ["GET", "POST"])) return;
  } catch (error) {
    handleError(res, error);
  }
}

