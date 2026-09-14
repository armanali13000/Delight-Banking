function validEpochMs(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value?.toMillis === "function") {
    const milliseconds = value.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (typeof value?.toDate === "function") return validEpochMs(value.toDate());
  if (typeof value === "object" && Number.isFinite(value.seconds ?? value._seconds)) {
    const seconds = Number(value.seconds ?? value._seconds);
    const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    return seconds * 1000 + Math.floor(nanoseconds / 1e6);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
  }
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function registrationTimestamp(authUser = {}, student = {}) {
  const candidates = [authUser.metadata?.creationTime, student.createdAt, student.registeredAt, student.accountCreatedAt, student.registrationDate];
  for (const candidate of candidates) {
    const milliseconds = validEpochMs(candidate);
    if (milliseconds !== null) return milliseconds;
  }
  return null;
}

export async function listAllAuthUsers(auth) {
  const users = [];
  const seen = new Set();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users || []) {
      if (!user?.uid || seen.has(user.uid)) continue;
      seen.add(user.uid);
      users.push(user);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

export function registrationSort(users, direction = "registered_desc") {
  const ascending = direction === "registered_asc" || direction === "oldest";
  return [...users].sort((left, right) => {
    const leftTime = Number.isFinite(left.registeredAtMs) ? left.registeredAtMs : null;
    const rightTime = Number.isFinite(right.registeredAtMs) ? right.registeredAtMs : null;
    if (leftTime === null && rightTime !== null) return 1;
    if (leftTime !== null && rightTime === null) return -1;
    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return ascending ? leftTime - rightTime : rightTime - leftTime;
    return String(left.uid).localeCompare(String(right.uid));
  });
}

export function paginateRegisteredUsers(users, query = {}) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const page = Math.max(Number(query.page || 1), 1);
  const total = users.length;
  const start = (page - 1) * pageSize;
  return { page, pageSize, total, hasMore: start + pageSize < total, items: users.slice(start, start + pageSize) };
}
export function prepareRegisteredUsers(users, query = {}, predicate = () => true) {
  return paginateRegisteredUsers(registrationSort(users.filter(predicate), query.sort || "registered_desc"), query);
}
