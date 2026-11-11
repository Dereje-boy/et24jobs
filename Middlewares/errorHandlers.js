// 404 Not Found handler
// Placed after all routes to catch any request that doesn't match a defined route.
function notFoundHandler(req, res, next) {
  res.status(404);

  // Respond with JSON for API/AJAX requests, otherwise render an HTML page.
  if (req.accepts("html")) {
    return res.render("404", {
      title: "Page Not Found",
      pageTitle: "Page Not Found | ET24Jobs",
      pageCss: "/css/pages/404.css",
    });
  }

  return res.json({
    error: "Not Found",
    message: `The requested resource '${req.originalUrl}' was not found.`,
  });
}

// Global error handler
// Express recognizes this as an error handler because it declares 4 arguments.
// Must be registered last, after all routes and other middleware.
function globalErrorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;

  // Log the full error for server-side diagnostics.
  console.error(`[Error] ${statusCode} - ${err.message}`);
  console.error(err.stack);

  // If headers are already sent, delegate to Express' default handler.
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode);

  if (req.accepts("html")) {
    return res.render("500", {
      title: "Server Error",
      pageTitle: "Server Error | ET24Jobs",
      pageCss: "/css/pages/500.css",
      message: err.message,
      // Only expose the stack trace in development.
      stack: process.env.NODE_ENV === "development" ? err.stack : null,
    });
  }

  return res.json({
    error: statusCode === 500 ? "Internal Server Error" : err.message,
  });
}

module.exports.notFoundHandler = notFoundHandler;
module.exports.globalErrorHandler = globalErrorHandler;
