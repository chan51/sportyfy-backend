var bcrypt = require("bcrypt");

module.exports = {
  friendlyName: "Signup User",

  description: "Sign up using the provided details.",

  inputs: {
    name: {
      description: 'User name, e.g. "Aron".',
      type: "string",
      required: true,
    },
    mobile: {
      description: 'User phone number, e.g. "4516944644".',
      type: "string",
      required: true,
    },
    email: {
      description: 'User email, e.g. "aron@test.com".',
      type: "string",
      required: true,
    },
    password: {
      description: 'User unencrypted password, e.g. "passwordlol".',
      type: "string",
      required: true,
    },
    sid: {
      description: 'Twillio otp service id, e.g. "VAsrgasrfargergerw".',
      type: "string",
      required: true,
    },
  },

  fn: async function (signupData) {
    const { name, mobile, email, password, sid } = signupData;
    // Look up by the email address and mobile number.
    const userRecord = await Users.findOne({
      or: [
        { email: email.toLowerCase().trim() },
        { mobile: mobile.toLowerCase().trim() },
      ],
    });

    // If there was matching user, respond thru the "badCombo" exit.
    if (userRecord) {
      let existKey = "details";
      if (
        userRecord.mobile.toLowerCase().trim() === mobile.toLowerCase().trim()
      ) {
        existKey = "mobile";
      } else if (
        userRecord.email.toLowerCase().trim() === email.toLowerCase().trim()
      ) {
        existKey = "email";
      }

      return this.res.forbidden({
        message: `User already exist, try with different ${existKey}.`,
      });
    }

    if (password && !sid) {
      const pass = await bcrypt.hash(password, 10);
      signupData.password = pass;
    } else if (sid) {
      const pass = await bcrypt.hash("12345", 10);
      signupData.password = pass;
    }

    const otpResult = await ActionService.checkOtp({
      phoneNumber: mobile,
      otp: +password,
      sid,
    }, false);

    if (otpResult.status) {
      const newUser = await Users.create(signupData).fetch();

      const userLogin = await ActionService.userLogin(newUser);
      if (userLogin) {
        const { data, ssid, maxAge } = userLogin;
        this.req.headers.ssid = ssid;
        this.req.session.cookie.maxAge = maxAge;
        Mailer.sendWelcomeMail(data);

        this.res.created(data, {
          message: "user created successfully!",
        });
      } else {
        this.res.badRequest({ data: userLogin });
      }
    } else {
      this.res.badRequest(otpResult);
    }
  },
};
