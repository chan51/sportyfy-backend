/**
 * @description :: The conventional "custom" hook.  Extends this app with custom server-start-time and request-time logic.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

const config = sails.config;

module.exports = function defineCustomHook(sails) {
  return {
    /**
     * Runs when a Sails app loads/lifts.
     */
    initialize: async function () {
      sails.log.info("Initializing project hook... (`api/hooks/`)");
      // ... Any other app-specific setup code that needs to run on lift,
      // even in production, goes here ...
    },

    routes: {
      /**
       * Runs before every matching route.
       *
       * @param {Ref} req
       * @param {Ref} res
       * @param {Function} next
       */
      before: {
        "/*": {
          skipAssets: true,
          fn: async function (req, res, next) {
            var url = require("url");

            const params = _.extend(req.query || {}, req.body || {});
            req.paramBody = params;

            // First, if this is a GET request (and thus potentially a view),
            // attach a couple of guaranteed locals.
            if (req.method === "GET") {
              // The  `_environment` local lets us do a little workaround to make Vue.js
              // run in "production mode" without unnecessarily involving complexities
              // with webpack et al.)
              if (res.locals._environment !== undefined) {
                throw new Error(
                  "Cannot attach Sails environment as the view local `_environment`, because this view local already exists!  (Is it being attached somewhere else?)"
                );
              }
              res.locals._environment = sails.config.environment;

              // The `me` local is set explicitly to `undefined` here just to avoid having to
              // do `typeof me !== 'undefined'` checks in our views/layouts/partials.
              // > Note that, depending on the request, this may or may not be set to the
              // > logged-in user record further below.
              if (res.locals.me !== undefined) {
                throw new Error(
                  "Cannot attach view local `me`, because this view local already exists!  (Is it being attached somewhere else?)"
                );
              }
              res.locals.me = undefined;
            } //ﬁ

            // Next, if we're running in our actual "production" or "staging" Sails
            // environment, check if this is a GET request via some other host,
            // for example a subdomain like `webhooks.` or `click.`.  If so, we'll
            // automatically go ahead and redirect to the corresponding path under
            // our base URL, which is environment-specific.
            // > Note that we DO NOT redirect virtual socket requests and we DO NOT
            // > redirect non-GET requests (because it can confuse some 3rd party
            // > platforms that send webhook requests.)  We also DO NOT redirect
            // > requests in other environments to allow for flexibility during
            // > development (e.g. so you can preview an app running locally on
            // > your laptop using a local IP address or a tool like ngrok, in
            // > case you want to run it on a real, physical mobile/IoT device)
            var configuredBaseHostname;
            try {
              configuredBaseHostname = url.parse(
                sails.config.custom.baseUrl
              ).host;
            } catch (unusedErr) {
              /*…*/
            }
            if (
              (sails.config.environment === "staging" ||
                sails.config.environment === "production") &&
              !req.isSocket &&
              req.method === "GET" &&
              req.hostname !== configuredBaseHostname
            ) {
              sails.log.info(
                "Redirecting GET request from `" +
                  req.hostname +
                  "` to configured expected host (`" +
                  configuredBaseHostname +
                  "`)..."
              );
              return res.redirect(sails.config.custom.baseUrl + req.url);
            } //•

            // No session? Proceed as usual.
            // (e.g. request for a static asset)
            if (!req.session) {
              return next();
            }

            // Not logged in? Proceed as usual.
            if (!req.headers.ssid) {
              return next();
            }

            const patterns = config.ssidPatterns;
            let idx = -1;
            const isValidLogin = patterns.some((pattern, idxx) => {
              if (req.headers.ssid.includes(pattern)) {
                idx = idxx;
                return true;
              }
              return false;
            });

            if (!isValidLogin) {
              sails.log.warn(
                "Somehow, the user record for the logged-in user (`" +
                  req.headers.ssid +
                  "`) has gone missing...."
              );
              delete req.headers.ssid;
              return res.unauthorized();
            }

            // Otherwise, look up the logged-in user.
            var loggedInUser = await Users.findOne({
              id: req.headers.ssid.split(patterns[idx])[1],
            });
            delete loggedInUser.password;

            // If the logged-in user has gone missing, log a warning,
            // wipe the user id from the requesting user agent's session,
            // and then send the "unauthorized" response.
            if (!loggedInUser) {
              sails.log.warn(
                "Somehow, the user record for the logged-in user (`" +
                  req.headers.ssid +
                  "`) has gone missing...."
              );
              delete req.headers.ssid;
              return res.unauthorized();
            }

            // Expose the user record as an extra property on the request object (`req.loggedInUser`).
            // > Note that we make sure `req.loggedInUser` doesn't already exist first.
            if (req.loggedInUser !== undefined) {
              throw new Error(
                "Cannot attach logged-in user as `req.loggedInUser` because this property already exists!  (Is it being attached somewhere else?)"
              );
            }
            req.loggedInUser = loggedInUser;

            req.headers.userType = loggedInUser.userType;
            req.headers.isSuperAdmin = loggedInUser.isSuperAdmin;

            // If our "lastSeenAt" attribute for this user is at least a few seconds old, then set it
            // to the current timestamp.
            //
            // (Note: As an optimization, this is run behind the scenes to avoid adding needless latency.)
            var MS_TO_BUFFER = 60 * 1000;
            var now = Date.now();
            if (loggedInUser.isLogin && loggedInUser.lastSeenAt < now - MS_TO_BUFFER) {
              Users.updateOne({ id: loggedInUser.id })
                .set({ lastSeenAt: now })
                .exec((err) => {
                  if (err) {
                    sails.log.error(
                      "Background task failed: Could not update user (`" +
                        loggedInUser.id +
                        "`) with a new `lastSeenAt` timestamp.  Error details: " +
                        err.stack
                    );
                    return;
                  } //•
                  sails.log.verbose(
                    "Updated the `lastSeenAt` timestamp for user `" +
                      loggedInUser.id +
                      "`."
                  );
                  // Nothing else to do here.
                }); //_∏_  (Meanwhile...)
            } //ﬁ

            // If this is a GET request, then also expose an extra view local (`<%= me %>`).
            // > Note that we make sure a local named `me` doesn't already exist first.
            // > Also note that we strip off any properties that correspond with protected attributes.
            if (req.method === "GET") {
              if (res.locals.me !== undefined) {
                throw new Error(
                  "Cannot attach logged-in user as the view local `me`, because this view local already exists!  (Is it being attached somewhere else?)"
                );
              }

              // Exclude any fields corresponding with attributes that have `protect: true`.
              var sanitizedUser = _.extend({}, loggedInUser);
              sails.helpers.redactUser(sanitizedUser);

              // If there is still a "password" in sanitized user data, then delete it just to be safe.
              // (But also log a warning so this isn't hopelessly confusing.)
              if (sanitizedUser.password) {
                sails.log.warn(
                  "The logged in user record has a `password` property, but it was still there after pruning off all properties that match `protect: true` attributes in the User model.  So, just to be safe, removing the `password` property anyway..."
                );
                delete sanitizedUser.password;
              } //ﬁ

              res.locals.me = sanitizedUser;
            } //ﬁ

            // Prevent the browser from caching logged-in users' pages.
            // (including w/ the Chrome back button)
            // > • https://mixmax.com/blog/chrome-back-button-cache-no-store
            // > • https://madhatted.com/2013/6/16/you-do-not-understand-browser-history
            res.setHeader("Cache-Control", "SSID", "no-cache, no-store");

            return next();
          },
        },
      },
    },
  };
};
