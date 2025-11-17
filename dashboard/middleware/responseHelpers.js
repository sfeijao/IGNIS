/**
 * Standardized error response helpers for dashboard API
 * Ensures consistent error format: { success: false, error: 'message' }
 */

/**
 * Send standardized error response
 * @param {Response} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} error - Error message
 * @param {Object} meta - Optional additional metadata
 */
function sendError(res, status, error, meta = {}) {
  if (res.headersSent) return;
  res.status(status).json({
    success: false,
    error,
    ...meta
  });
}

/**
 * Send standardized success response
 * @param {Response} res - Express response object
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code (default: 200)
 */
function sendSuccess(res, data, status = 200) {
  if (res.headersSent) return;
  res.status(status).json({
    success: true,
    ...data
  });
}

/**
 * Common error responses
 */
const Errors = {
  NOT_AUTHENTICATED: (res) => sendError(res, 401, 'Not authenticated'),
  NOT_FOUND: (res, resource = 'Resource') => sendError(res, 404, `${resource} not found`),
  FORBIDDEN: (res, reason = 'Insufficient permissions') => sendError(res, 403, reason),
  BAD_REQUEST: (res, message = 'Invalid request') => sendError(res, 400, message),
  INTERNAL_ERROR: (res, message = 'Internal server error') => sendError(res, 500, message),
  SERVICE_UNAVAILABLE: (res, service = 'Service') => sendError(res, 503, `${service} unavailable`),

  // Specific cases
  BOT_UNAVAILABLE: (res) => sendError(res, 500, 'Bot not available'),
  GUILD_NOT_FOUND: (res) => sendError(res, 404, 'Guild not found'),
  NOT_GUILD_MEMBER: (res) => sendError(res, 403, 'You are not a member of this server'),
  MISSING_PERMISSION: (res) => sendError(res, 403, 'Missing permission'),
  MONGO_NOT_CONNECTED: (res) => sendError(res, 503, 'Database not connected'),
};

/**
 * Validation helper - check required fields
 * @param {Object} body - Request body
 * @param {string[]} required - Array of required field names
 * @returns {string|null} Error message or null if valid
 */
function validateRequired(body, required) {
  const missing = required.filter(field => !body[field]);
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

/**
 * Async route wrapper to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      console.error('Route error:', err);
      if (!res.headersSent) {
        sendError(res, 500, err.message || 'Internal server error', {
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    });
  };
}

module.exports = {
  sendError,
  sendSuccess,
  Errors,
  validateRequired,
  asyncHandler
};
