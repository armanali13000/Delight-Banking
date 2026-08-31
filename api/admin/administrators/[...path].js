import { requireSuperAdmin } from "../../_lib/adminAuth.js";
import {
  getAdministratorDetail,
  promoteAdministrator,
  reactivateAdministrator,
  revokeAdministrator,
  suspendAdministrator,
  updateAdministratorRole
} from "../../_lib/adminManagement.js";
import { handleError, method, readJson, sendJson } from "../../_lib/http.js";

function routeSegments(req) {
  const path = new URL(req.url || "/", "https://local.invalid").pathname;
  const suffix = path.replace(/^\/api\/admin\/administrators\/?/, "");
  return suffix.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
}

function notFound() {
  const error = new Error("Administrator endpoint was not found.");
  error.statusCode = 404;
  throw error;
}

export default async function handler(req, res) {
  try {
    await requireSuperAdmin(req);
    const [first, action] = routeSegments(req);

    if (first === "promote" && !action) {
      if (!method(req, res, ["POST"])) return;
      sendJson(res, 200, await promoteAdministrator(req, await readJson(req)));
      return;
    }

    if (!first) notFound();

    if (!action) {
      if (!method(req, res, ["GET", "PATCH"])) return;
      if (req.method === "GET") sendJson(res, 200, await getAdministratorDetail(req, first));
      else sendJson(res, 200, await updateAdministratorRole(req, first, await readJson(req)));
      return;
    }

    if (!method(req, res, ["POST"])) return;
    if (action === "suspend") sendJson(res, 200, await suspendAdministrator(req, first, await readJson(req)));
    else if (action === "reactivate") sendJson(res, 200, await reactivateAdministrator(req, first, await readJson(req)));
    else if (action === "revoke") sendJson(res, 200, await revokeAdministrator(req, first, await readJson(req)));
    else notFound();
  } catch (error) {
    handleError(res, error);
  }
}