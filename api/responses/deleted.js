/**
 * deleted.js
 */

module.exports = function deleted(data, options) {

  // Get access to `req` and `res`
  var req = this.req;
  var res = this.res;
  var result = { data, status: true, ...options };

  // Define the status code to send in the response.
  var statusCodeToSet = 202;

  // If no data was provided, use res.sendStatus().
  if (data === undefined) {
    sails.log.info('Ran custom response: res.deleted()');
    return res.sendStatus(statusCodeToSet);
  }
  // Else if the provided data is an Error instance, if it has
  // a toJSON() function, then always run it and use it as the
  // response body to send.  Otherwise, send down its `.stack`,
  // except in production use res.sendStatus().
  else if (_.isError(data)) {
    sails.log.info('Custom response `res.deleted()` called with an Error:', result);

    // If the error doesn't have a custom .toJSON(), use its `stack` instead--
    // otherwise res.json() would turn it into an empty dictionary.
    // (If this is production, don't send a response body at all.)
    if (!_.isFunction(data.toJSON)) {
      if (process.env.NODE_ENV === 'production') {
        return res.sendStatus(statusCodeToSet);
      }
      else {
        return res.status(statusCodeToSet).send(data.stack);
      }
    }
  }
  // Set status code and send response data.
  else {
    return res.status(statusCodeToSet).send(result);
  }

};
