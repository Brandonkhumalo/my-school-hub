// HR page-permission helpers.
// For non-HR roles (admin, root HR boss, etc.) both read and write default to true.

export function getHrPageGrant(user, permissionKey) {
  if (!user || user.role !== "hr") return { read: true, write: true };
  if (user.hr_is_root_boss) return { read: true, write: true };
  const perms = user.hr_page_permissions || {};
  const grant = perms[permissionKey] || {};
  return { read: Boolean(grant.read || grant.write), write: Boolean(grant.write) };
}

export function canReadPage(user, permissionKey) {
  return getHrPageGrant(user, permissionKey).read;
}

export function canWritePage(user, permissionKey) {
  return getHrPageGrant(user, permissionKey).write;
}

// Detects a 403/forbidden response from the fetch layer.
export function isForbiddenError(err) {
  if (!err) return false;
  if (err.status === 403) return true;
  if (err.response && err.response.status === 403) return true;
  const msg = String(err.message || "").toLowerCase();
  return msg.includes("forbidden") || msg.includes("permission denied");
}
