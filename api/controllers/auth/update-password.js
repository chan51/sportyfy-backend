var bcrypt = require('bcrypt');

module.exports = {
  friendlyName: 'Update User password',
  description: 'Update user password by given data.',
  extendedDescription: `Update user to give access of application.`,

  fn: async function () {
    const requestData = this.req.paramBody;
    const { id, password } = requestData.data;

    if (!id) {
      this.res.badRequest(null, {
        message: 'There is no user with specified id.',
      });
    }
    if (!password) {
      this.res.badRequest(null, {
        message: 'Password is a required field.',
      });
    }

    // Look up by the user id
    var userRecord = await Users.findOne({
      id: id.toLowerCase().trim()
    });

    // If there was no matching user, respond thru the "notFound" exit.
    if (!userRecord) {
      return this.res.notFound(requestData.data, {
        message: `The user you want to update not found.`,
      });
    }

    if (password) {
      const pass = await bcrypt.hash(password, 10);
      requestData.data.password = pass;
    }

    const updatedUser = await Users.update({ id }).set(requestData.data).fetch();
    if (updatedUser.length) {
      this.res.updated(updatedUser[0], {
        message: 'User password updated successfully.',
      });
    } else {
      this.res.badRequest(updatedUser, {
        message: 'There is some error in updating user password.',
      });
    }
  },
};
