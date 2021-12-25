module.exports = {
  friendlyName: "Check OTP",
  description: "Check OTP using twillio to a phone number.",

  fn: async function () {
    const otpResult = await ActionService.checkOtp(this.req.paramBody);

    if (otpResult.status) {
      const userLogin = await ActionService.userLogin(otpResult.data);
      if (userLogin) {
        const { data, ssid, maxAge } = userLogin;
        this.req.headers.ssid = ssid;
        this.req.session.cookie.maxAge = maxAge;

        this.res.ok({ data: data });
      } else {
        this.res.badRequest({ data: userLogin });
      }
    } else {
      this.res.badRequest(otpResult);
    }
  },
};
