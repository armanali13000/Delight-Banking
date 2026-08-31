import { requireAdmin } from "../_lib/adminAuth.js";
import { handleError, method, sendJson } from "../_lib/http.js";
import {
  addAdminNote,
  cancelSubscription,
  exportReport,
  extendSubscription,
  getOrderDetail,
  getSubscriptionDetail,
  getTransactionDetail,
  getUserDetail,
  grantSubscription,
  listOrders,
  listSubscriptions,
  listTransactions,
  listUsers,
  reactivateSubscription,
  readBody,
  reconcileTransaction,
  revokeSubscription,
  searchVerifiedUser,
  updateUserProfile,
  updateUserStatus
} from "../_lib/adminOperations.js";

function parts(req) {
  const value = req.query?.path || [];
  return (Array.isArray(value) ? value : [value]).map((item) => decodeURIComponent(String(item || ""))).filter(Boolean);
}

function sendCsv(res, report) {
  res.statusCode = 200;
  res.setHeader("Content-Type", report.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
  res.end(report.body);
}

function allowedMethods(path) {
  if (path[0] === "users") {
    if (path.length === 1 || path[1] === "search") return ["GET"];
    if (path.length === 2) return ["GET", "PATCH"];
    if (path.length === 3 && ["status", "notes"].includes(path[2])) return ["POST"];
  }
  if (path[0] === "subscriptions") {
    if (path.length === 1 || (path.length === 2 && path[1] !== "grant")) return ["GET"];
    if (path.length === 2 && path[1] === "grant") return ["POST"];
    if (path.length === 3 && ["extend", "cancel", "revoke", "reactivate", "notes"].includes(path[2])) return ["POST"];
  }
  if (path[0] === "orders") {
    if (path.length === 1 || path.length === 2) return ["GET"];
  }
  if (path[0] === "transactions") {
    if (path.length === 1 || path.length === 2) return ["GET"];
    if (path.length === 3 && ["reconcile", "notes"].includes(path[2])) return ["POST"];
  }
  if (path[0] === "exports" && path.length === 2) return ["GET"];
  return null;
}
export default async function handler(req, res) {
  const path = parts(req);
  try {
    const allowed = allowedMethods(path);
    if (allowed && !method(req, res, allowed)) return;
    const admin = await requireAdmin(req);

    if (path[0] === "users") {
      if (path.length === 1) {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await listUsers(admin, req.query || {}));
        return;
      }
      if (path[1] === "search") {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await searchVerifiedUser(admin, req.query || {}));
        return;
      }
      if (path.length === 2) {
        if (!method(req, res, ["GET", "PATCH"])) return;
        sendJson(res, 200, req.method === "GET" ? await getUserDetail(admin, path[1]) : await updateUserProfile(admin, path[1], await readBody(req)));
        return;
      }
      if (path.length === 3 && path[2] === "status") {
        if (!method(req, res, ["POST"])) return;
        sendJson(res, 200, await updateUserStatus(admin, path[1], await readBody(req)));
        return;
      }
      if (path.length === 3 && path[2] === "notes") {
        if (!method(req, res, ["POST"])) return;
        sendJson(res, 200, await addAdminNote(admin, "user", path[1], await readBody(req)));
        return;
      }
    }

    if (path[0] === "subscriptions") {
      if (path.length === 1) {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await listSubscriptions(admin, req.query || {}));
        return;
      }
      if (path.length === 2 && path[1] === "grant") {
        if (!method(req, res, ["POST"])) return;
        sendJson(res, 200, await grantSubscription(admin, await readBody(req)));
        return;
      }
      if (path.length === 2) {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await getSubscriptionDetail(admin, path[1]));
        return;
      }
      if (path.length === 3 && ["extend", "cancel", "revoke", "reactivate"].includes(path[2])) {
        if (!method(req, res, ["POST"])) return;
        const body = await readBody(req);
        const actions = { extend: extendSubscription, cancel: cancelSubscription, revoke: revokeSubscription, reactivate: reactivateSubscription };
        sendJson(res, 200, await actions[path[2]](admin, path[1], body));
        return;
      }
      if (path.length === 3 && path[2] === "notes") {
        if (!method(req, res, ["POST"])) return;
        sendJson(res, 200, await addAdminNote(admin, "subscription", path[1], await readBody(req)));
        return;
      }
    }

    if (path[0] === "orders") {
      if (path.length === 1) {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await listOrders(admin, req.query || {}));
        return;
      }
      if (path.length === 2) {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await getOrderDetail(admin, path[1]));
        return;
      }
    }

    if (path[0] === "transactions") {
      if (path.length === 1) {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await listTransactions(admin, req.query || {}));
        return;
      }
      if (path.length === 2) {
        if (!method(req, res, ["GET"])) return;
        sendJson(res, 200, await getTransactionDetail(admin, path[1]));
        return;
      }
      if (path.length === 3 && path[2] === "reconcile") {
        if (!method(req, res, ["POST"])) return;
        sendJson(res, 200, await reconcileTransaction(admin, path[1]));
        return;
      }
      if (path.length === 3 && path[2] === "notes") {
        if (!method(req, res, ["POST"])) return;
        sendJson(res, 200, await addAdminNote(admin, "transaction", path[1], await readBody(req)));
        return;
      }
    }

    if (path[0] === "exports" && path.length === 2) {
      if (!method(req, res, ["GET"])) return;
      sendCsv(res, await exportReport(admin, path[1], req.query || {}));
      return;
    }

    sendJson(res, 404, { error: "Admin operation route was not found.", code: "REQUEST_FAILED", status: 404 });
  } catch (error) {
    handleError(res, error);
  }
}