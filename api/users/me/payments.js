import { method, sendJson } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const header = req.headers.authorization || req.headers.Authorization || "";
    if (!header.match(/^Bearer (.+)$/)) {
      sendJson(res, 401, { error: "Login required." });
      return;
    }
    const [{ requireUser }, { getUserPaymentSummary }] = await Promise.all([
      import("../../_lib/firebaseAdmin.js"),
      import("../../_lib/payments.js")
    ]);
    const user = await requireUser(req);
    const result = await getUserPaymentSummary(user);
    sendJson(res, 200, result);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.safeMessage || (error.statusCode ? error.message : "Server could not complete the request.") });
  }
}
