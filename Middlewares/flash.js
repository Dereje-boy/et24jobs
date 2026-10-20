// One-time messages that survive a redirect ("flash messages").
//
// Usage in any controller, right before res.redirect(...):
//   req.flash("success", "Saved.");
// The NEXT request (the page the redirect leads to) then has
// res.locals.flash = { type, text } for the view to render, and the
// message is removed from the session - it can never show twice.
//
// Implemented on top of the existing express-session store instead of
// adding the connect-flash dependency: every admin action produces
// exactly one outcome, so a single { type, text } slot is enough.
//
// Reading never creates a session row: with saveUninitialized:false the
// session only persists once something is stored, so anonymous visitors
// (no writes, no cookies) add nothing to the sessions table.

const flash = (req, res, next) => {
  // --- Write API ----------------------------------------------------------
  req.flash = (type, text) => {
    if (req.session) {
      req.session.flash = { type: String(type), text: String(text) };
    }
  };

  // --- Read-and-clear -----------------------------------------------------
  // Whatever a PREVIOUS request stored becomes visible to the views of
  // THIS request, exactly once.
  res.locals.flash = (req.session && req.session.flash) || null;
  if (req.session) {
    delete req.session.flash;
  }

  next();
};

module.exports = flash;
