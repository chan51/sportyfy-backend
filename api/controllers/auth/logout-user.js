module.exports = {
  friendlyName: "Logout User",

  description: "Log out user using logged in seesion id.",

  extendedDescription: `This action deletes the \`req.headers.ssid\` key from the session of the requesting user agent.
Actual garbage collection of session data depends on this app's session store, and
potentially also on the [TTL configuration](https://sailsjs.com/docs/reference/configuration/sails-config-session)
you provided for it.

Note that this action does not check to see whether or not the requesting user was
actually logged in.  (If they weren't, then this action is just a no-op.)`,

  exits: {
    success: {
      description:
        "The requesting user agent has been successfully logged out.",
    },

    badCombo: {
      description: `The logged in user session not match with any recorded session in databse.`,
      responseType: "unauthorized",
    },
  },

  fn: async function () {
    const user = this.req.loggedInUser;
    if (!user || !user.id) {
      return this.res.ok(this.req.headers);
    }

    const userId = user.id;
    var sessionRecord = await Logins.find({
      userId,
      isLogin: true,
    })
      .sort([{ createdAt: "DESC" }])
      .limit(1);

    // If there was no matching session, respond thru the "badCombo" exit.
    if (!sessionRecord) {
      throw "badCombo";
    }

    delete this.req.headers.ssid;
    await Users.update({ id: userId }).set({ isLogin: false });
    await Logins.update({ userId, isLogin: true }).set({
      loggedOutAt: new Date(),
      isLogin: false,
    });

    // Then finish up, sending an appropriate response.
    // > Under the covers, this persists the now-logged-out session back
    // > to the underlying session store.
    return this.res.ok({ sessionRecord: sessionRecord[0] });
  },
};
