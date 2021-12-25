/**
 * set-log
 *
 * A simple policy that allows any request from an authenticated user.
 *
 * For more about how to use policies, see:
 *   https://sailsjs.com/config/policies
 *   https://sailsjs.com/docs/concepts/policies
 *   https://sailsjs.com/docs/concepts/policies/access-control-and-permissions
 */

module.exports = async function (req, res, proceed) {
  const requestData = req.paramBody;
  const requestOptions = req.options;
  const loggedInUser = req.loggedInUser;

  try {
    const data = {
      requestData,
      requestOptions: {
        action: requestOptions.action,
        detectedVerb: requestOptions.detectedVerb,
      },
      loggedInUser,
    };
    await Logs.create(data);
  } catch {}

  return proceed();
};
