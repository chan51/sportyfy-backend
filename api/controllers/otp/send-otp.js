const config = sails.config;

module.exports = {
  friendlyName: "Send OTP",
  description: "Send OTP using twillio to a phone number.",

  inputs: {
    phoneNumber: {
      description: "The phone number to try in this attempt.",
      type: "string",
      required: true,
    },
  },

  fn: async function ({ phoneNumber }) {
    const accountSid = config.TWILLIO_ACCOUNT_SID;
    const authToken = config.TWILLIO_AUTH_TOKEN;
    const client = require("twilio")(accountSid, authToken);

    const message = await client.verify
      .services(config.TWILLIO_SERVICE)
      .verifications.create({ to: `+91${phoneNumber.trim()}`, channel: "sms" });

    if (message.status === "expired") {
      return this.res.badRequest(message.status);
    }
    return this.res.ok({ status: message.status, sid: message.sid });
  },
};
