var bcrypt = require("bcrypt");

module.exports = {
  friendlyName: "Login User",

  description: "Log in using the provided email and password combination.",

  inputs: {
    loginName: {
      description: 'The email to try in this attempt, e.g. "irl@example.com".',
      type: "string",
      required: true,
    },

    password: {
      description:
        'The unencrypted password to try in this attempt, e.g. "passwordlol".',
      type: "string",
      required: true,
    },

    sid: {
      description: 'The twillio otp service id, e.g. "VAE5w434tgersgewrtwert".',
      type: "string",
      required: false,
    },
  },

  fn: async function ({ loginName, password, sid }) {
    // Look up by the email address.
    // (note that we lowercase it to ensure the lookup is always case-insensitive,
    // regardless of which database we're using)
    var userRecord = await Users.findOne({
      or: [
        { email: loginName.toLowerCase().trim() },
        { mobile: loginName.toLowerCase().trim() },
      ],
    });
    // If there was no matching user, respond thru the "badCombo" exit.
    if (
      !userRecord ||
      userRecord.status === 0 ||
      userRecord.status === 2 ||
      userRecord.isDeleted
    ) {
      return this.res.forbidden({
        message:
          "Please check credentials, user either deleted or login id is wrong.",
      });
    }

    let otpResult = { status: false };
    if (sid) {
      otpResult = await ActionService.checkOtp({
        phoneNumber: loginName,
        otp: password,
        sid,
      });
    } else {
      const isPasswordMatch = await bcrypt.compareSync(
        password,
        userRecord.password
      );
      // If password didn't matched, respond thru the "badCombo" exit.
      if (!isPasswordMatch) {
        return this.res.forbidden({
          message: `Password doesn't match with the original password.`,
        });
      }
      otpResult.status = true;
    }

    if (otpResult.status) {
      const userLogin = await ActionService.userLogin(userRecord);
      if (userLogin) {
        const { data, ssid, maxAge } = userLogin;
        this.req.headers.ssid = ssid;
        this.req.session.cookie.maxAge = maxAge;
        Mailer.sendWelcomeMail(data);

        this.res.ok({ data: data });
      } else {
        this.res.badRequest({ data: userLogin });
      }
    } else {
      this.res.badRequest(otpResult);
    }
  },
};
