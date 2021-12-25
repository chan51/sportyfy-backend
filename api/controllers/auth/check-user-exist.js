module.exports = {
  friendlyName: 'Check if user exist',

  inputs: {
    loginName: {
      description: 'The phone number or email to try in this attempt.',
      type: 'string',
      required: true,
    },
    userType: {
      description: 'user type.',
      type: 'string',
      required: false,
    },
  },

  fn: async function ({ loginName, userType }) {
    const userRecord = await Users.findOne({
      or: [{ email: loginName.toLowerCase().trim() }, { mobile: '+' + loginName.toLowerCase().trim() }],
      userType: userType || 'user',
    });

    return userRecord;
  },
};
