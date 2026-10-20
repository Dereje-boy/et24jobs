// Auth guard for the admin panel. Any route mounted after this middleware
// requires a logged-in admin (req.session.adminId set by
// adminAuthController.login).
//
// Page requests are redirected to the login form; requests that look like
// APIs (Accept: application/json or X-Requested-With) get a 401 JSON body
// instead, so future API endpoints can reuse the same guard.

const requireAdmin = (req, res, next) => {
  // return next();
  if (req.session && req.session.adminId) {
    return next();
  }

  const wantsJson =
    (req.headers.accept || "").includes("application/json") ||
    req.headers["x-requested-with"] === "XMLHttpRequest";

  if (wantsJson) {
    return res
      .status(401)
      .json({ error: "Authentication required. Please log in as an admin." });
  }

  // Remember where the admin was heading so login can send them back.
  req.session.returnTo = req.originalUrl;
  return res.redirect("/admin/login");
};

module.exports = { requireAdmin };
