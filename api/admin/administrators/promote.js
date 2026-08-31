import { promoteAdministrator } from "../../_lib/adminManagement.js";
import { handleError, method, readJson, sendJson } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;

  try {
    sendJson(res, 200, await promoteAdministrator(req, await readJson(req)));
  } catch (error) {
    handleError(res, error);
  }
}