/**
 * Users.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 **/

module.exports = {
  datastore: "sportyfy",
  tableName: "users",
  migrate: "safe",
  attributes: {
    name: {
      type: "string",
      required: true,
      maxLength: 200,
      example: "Test User",
    },

    email: {
      type: "string",
      required: true,
      unique: true,
      isEmail: true,
      maxLength: 200,
      example: "test@user.com",
    },

    mobile: {
      type: "string",
      required: true,
      unique: true,
      maxLength: 15,
      example: "1234567890",
    },

    password: {
      type: "string",
      required: true,
      description:
        "Securely hashed representation of the user's login password.",
      protect: true,
      example: "$2b$10$oXtZ/6BfJARVno9U/99lbuFc98iLcaw5bV6qaKFvwVLBBuN/bLCGy",
    },

    isLogin: {
      type: "boolean",
      description: "Whether user is login or not.",
    },

    lastSeenAt: {
      type: "number",
      description:
        "A JS timestamp (epoch ms) representing the moment at which this user most recently interacted with the backend while logged in (or 0 if they have not interacted with the backend at all yet).",
      example: 1502844074211,
    },
  },
};
