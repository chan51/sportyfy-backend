/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes tell Sails what to do each time it receives a request.
 *
 * For more information on configuring custom routes, check out:
 * https://sailsjs.com/anatomy/config/routes-js
 */

module.exports.routes = {
  "POST /signup-user": { action: "auth/signup-user" },
  "POST /login-user": { action: "auth/login-user" },
  "GET /logout-user": { action: "auth/logout-user" },

  "GET /send-otp": { action: "otp/send-otp" },
  "POST /check-otp": { action: "otp/check-otp" },

  // 'GET /update-password': { action: 'auth/update-password' },
  // 'GET /check-user-exist': { action: 'auth/check-user-exist' },
};
