"use strict";
// ActionService.js

var fs = require("fs-extra");
var async = require("async");
var moment = require("moment");

const config = sails.config;

module.exports = {
  userLogin: async function (userRecord, ssid) {
    try {
      // Modify the active session instance.
      // (This will be persisted when the response is sent.)
      const date = new Date();
      const loginData = await Logins.create({
        userId: userRecord.id,
        isLogin: true,
        loggedInAt: date,
      }).fetch();
      const patterns = config.ssidPatterns;

      var ssid =
        loginData.id + patterns[Math.floor(Math.random() * 4)] + userRecord.id;
      var maxAge = sails.config.custom.rememberMeCookieMaxAge;

      await Users.update({ id: userRecord.id }).set({
        lastSeenAt: Date.now(),
        isLogin: true,
      });

      var sanitizedUser = { ...userRecord, ssid };
      sails.helpers.redactUser(sanitizedUser);
      return { data: sanitizedUser, ssid, maxAge };
    } catch (err) {
      return null;
    }
  },

  checkOtp: async function (paramBody, shouldCheckUserRecord = true) {
    let response = { status: false };
    let verification_check = {};
    const { phoneNumber, sid, otp } = paramBody;
    const accountSid = config.TWILLIO_ACCOUNT_SID;
    const authToken = config.TWILLIO_AUTH_TOKEN;
    const client = require("twilio")(accountSid, authToken);

    let verification_status_value = "";
    const verification_status = await client.verify
      .services(config.TWILLIO_SERVICE)
      .verifications(sid)
      .fetch();
    verification_status_value = verification_status.status;

    if (verification_status_value === "pending") {
      verification_check = await client.verify
        .services(config.TWILLIO_SERVICE)
        .verificationChecks.create({ to: `+91${phoneNumber}`, code: otp });

      if (verification_check.status === "expired") {
        return this.res.expired(verification_check.status);
      }
      //else if (verification_check.status === 'pending') {
      //return this.res.badRequest(verification_check.status);
      //}
    } else if (verification_status_value === "canceled") {
      return this.res.expired(verification_check.status);
    }

    try {
      !verification_check.status && (verification_check.status = false);

      /* verification_check.status = 'approved';
      let verification_status_value = ''; */

      if (verification_check.status === "approved") {
        var userRecord = await Users.findOne({
          or: [{ mobile: phoneNumber.toString().toLowerCase().trim() }],
        });

        if (userRecord && userRecord.id && shouldCheckUserRecord) {
          return { status: true, data: userRecord };
        } else if (shouldCheckUserRecord === false) {
          return { ...response, status: true };
        } else {
          return { ...response, message: "User not found!" };
        }
      } else {
        return {
          ...response,
          message: "OTP is incorrect, use same otp sent to your mobile number",
        };
      }
    } catch (err) {
      return {
        ...response,
        err,
        message: "OTP is incorrect, use same otp sent to your mobile number",
      };
    }
  },

  uploadUserProfile: async function (data) {
    const profile = data.profile.substring(
      data.profile.indexOf("base64,") + 7,
      data.profile.length
    );
    const imagesPath = require("path").resolve(sails.config.appPath, "assets");
    const filePath = `/c-images/${data.id}/profile/profile.jpg`;

    try {
      const dirCreated = await fs.mkdirpSync(
        imagesPath + `/c-images/${data.id}/profile`
      );
      if (dirCreated) {
        try {
          const bytesWritten = await fs.writeFileSync(
            imagesPath + filePath,
            profile,
            "base64"
          );
          return filePath;
        } catch (err) {
          return "/nofile.png";
        }
      }
    } catch (err) {
      return "/nofile.png";
    }
  },

  getUsersLength: async function (searchTerm) {
    return await Users.find(searchTerm);
  },

  getFAQsLength: async function () {
    return await FAQs.find();
  },

  uploadEventCover: async function (data) {
    const coverPhoto = data.coverPhoto.substring(
      data.coverPhoto.indexOf("base64,") + 7,
      data.coverPhoto.length
    );
    const imagesPath = require("path").resolve(sails.config.appPath, "assets");
    const filePath = `/c-images/events/${data.id}.jpg`;

    try {
      const bytesWritten = await fs.writeFileSync(
        imagesPath + filePath,
        coverPhoto,
        "base64"
      );
      return filePath;
    } catch (err) {
      return "/nofile.png";
    }
  },

  getEventsLength: async function (searchTerm) {
    return await Events.find(searchTerm);
  },

  getLastChatMessage: async function (chatLinks, callback) {
    for (let cl = 0; cl < chatLinks.length; cl++) {
      let lastMessage = null;
      let chatID = chatLinks[cl].id;
      let lastMediaMessage = null,
        lastMediaMessageTime = null;
      let lastStringMessage = null,
        lastStringMessageTime = null;

      lastMediaMessage = await ChatMediaFiles.findOne({
        select: ["chatId", "type", "createdAt", "updatedAt"],
        chatId: chatID,
      })
        .sort({ createdAt: "DESC" })
        .limit(1);
      lastStringMessage = await Chatting.findOne({
        select: ["chatId", "message", "createdAt", "updatedAt"],
        chatId: chatID,
      })
        .sort({ createdAt: "DESC" })
        .limit(1);

      if (lastMediaMessage)
        lastMediaMessageTime = moment(lastMediaMessage.createdAt);
      if (lastStringMessage)
        lastStringMessageTime = moment(lastStringMessage.createdAt);

      if (!lastMediaMessageTime) lastMessage = lastStringMessage;
      else if (!lastStringMessageTime) lastMessage = lastMediaMessage;
      else if (lastMediaMessageTime.isSameOrAfter(lastStringMessageTime))
        lastMessage = lastMediaMessage;
      else if (lastStringMessageTime.isSameOrAfter(lastMediaMessageTime))
        lastMessage = lastStringMessage;

      // chatLinks[cl].lastMessage = lastMessage;
      chatLinks.map((chatLink) => {
        if (chatLink.id === chatID) chatLink.lastMessage = lastMessage;
      });
      if (cl === chatLinks.length - 1) callback(chatLinks);
    }
  },

  postChatting: function (params, callback) {
    Chatting.create(params.data).exec((err, data) => {
      if (err || !data) {
        callback();
      } else {
        callback(data);
      }
    });
  },

  getChatLinks: async function (params) {
    let searchTerm = { type: "link" },
      response = {},
      whereClause = {};
    try {
      params.hasOwnProperty("userId") && (searchTerm.userId = params.userId);
      params.hasOwnProperty("chatId") &&
        (delete searchTerm.userId, (whereClause.chatId = params.chatId));
      if (
        params.hasOwnProperty("startDate") &&
        params.hasOwnProperty("endDate")
      ) {
        whereClause = Object.assign(whereClause, {
          updatedAt: { ">=": params.startDate, "<=": params.endDate },
        });
      }

      const allLinks = await Chatting.find(searchTerm)
        .sort([{ createdAt: "DESC" }])
        .where(whereClause);
      if (!allLinks || !allLinks.length) {
        response.message = "No chat links found.";
        return response;
      } else {
        let links = {};
        let keys = [];
        allLinks.map((link) => {
          let key = moment(link.createdAt).format("MMMM");
          keys.indexOf(key) < 0 && keys.push(key);
          links[key] ? links[key].push(link) : (links[key] = [link]);
        });
        response.status = true;
        response.links = links;
        response.keys = keys;
        response.allLinks = allLinks;
        return response;
      }
    } catch (e) {
      response.err = e;
      response.status = 400;
      response.message = "something wrong happened.";
      return response;
    }
  },

  getFeeds: async function (
    { skip, limit, id, fileType, userId },
    newData = []
  ) {
    const criteria = {
      showFeed: { "!=": [false] },
    };
    if (id) {
      criteria.id = id;
    }
    if (fileType) {
      criteria.fileType = fileType;
    }
    if (userId) {
      criteria.userId = userId;
    }

    const total = newData.length ? 1 : await Feeds.count(criteria);
    const feedsData = newData.length
      ? newData
      : await Feeds.find(criteria)
          .populate("viewCount")
          .sort([{ createdAt: "DESC" }])
          .skip(skip || 0)
          .limit(limit || 5000);
    const feedLikes = newData.length
      ? []
      : await FeedLikes.find({ feedId: feedsData.map((feed) => feed.id) }).sort(
          [{ createdAt: "DESC" }]
        );
    const feedUsers = await Users.find({
      id: feedsData.map((feed) => feed.userId),
    }).select(["profile", "cloudinaryURL"]);

    const feeds = feedsData.map((feed) => {
      let viewCount = feed.viewCount
        ? [
            ...new Map(
              feed.viewCount.map((item) => [item["userId"], item])
            ).values(),
          ]
        : [];
      feed.viewCount =
        viewCount && viewCount.length
          ? [
              ...new Map(
                viewCount.map((item) => [
                  item["viewDate"],
                  {
                    id: item.id,
                    userId: item.userId,
                    feedId: item.feedId,
                    viewDate: item.viewDate,
                    totalView: item.totalView,
                  },
                ])
              ).values(),
            ]
          : [];
      feed.totalViews = feed.viewCount.reduce(
        (total, views) => total + views.totalView,
        0
      );

      const feedLikesData = (feedId) => {
        const likesData = feedLikes
          ? feedLikes.find((feedLike) => feedLike.feedId === feedId)
          : null;
        return likesData ? likesData.likes : [];
      };
      feed.feedLikes = feedLikesData(feed.id);

      const feedUserProfile = (userId) => {
        const userRecord = feedUsers
          ? feedUsers.find((feedUser) => feedUser.id === userId)
          : null;
        return userRecord
          ? userRecord.cloudinaryURL || userRecord.profile
          : null;
      };
      feed.userProfile = feedUserProfile(feed.userId);

      return feed;
    });
    return { feeds, feedLikes, total };
  },

  getChatFiles: async function (params) {
    let sortKey = params.sortKey || "updatedAt",
      searchTerm = {},
      response = {};
    try {
      params.hasOwnProperty("type") && (searchTerm.type = params.type);
      params.hasOwnProperty("userId") && (searchTerm.userId = params.userId);

      params.hasOwnProperty("chatId") &&
        ((searchTerm.chatId = params.chatId),
        (searchTerm.chatId = params.chatId));

      if (
        params.hasOwnProperty("startDate") &&
        params.hasOwnProperty("endDate")
      ) {
        searchTerm = Object.assign(searchTerm, {
          updatedAt: { ">=": params.startDate, "<=": params.endDate },
        });
      }
      if (params.hasOwnProperty("isReported")) {
        searchTerm = Object.assign(searchTerm, {
          showFeed: params.isReported
            ? !params.isReported
            : { "!=": params.isReported },
        });
      }

      const allMedia = await ChatMediaFiles.find(searchTerm)
        .populate("userId")
        .sort([{ [sortKey]: "DESC" }])
        .skip(params.skip || 0)
        .limit(params.limit || 1000);
      const { feeds: allFeeds } = await this.getFeeds({
        userId: params.userId,
      });
      const allFiles = [...allMedia, ...allFeeds]
        .filter((file) => {
          const fileUserId = file.userId.id || file.userId;
          if (params.isReported && file.showFeed === params.isReported)
            return false;
          else if (params.userId)
            return file.userId && fileUserId === params.userId;
          return true;
        })
        .sort((file1, file2) => {
          if (file1[sortKey] > file2[sortKey]) return -1;
          if (file1[sortKey] < file2[sortKey]) return 1;
          return 0;
        });

      if (!allFiles || !allFiles.length) {
        response.status = true;
        response.message = "No media found.";
        return response;
      } else {
        let keys = [];
        let files = {};
        allFiles.map((file) => {
          let key = moment(file.updatedAt).format("Do MMMM YYYY");
          keys.indexOf(key) < 0 && keys.push(key);
          files[key] ? files[key].push(file) : (files[key] = [file]);
        });
        response.keys = keys;
        response.status = true;
        response.files = files;
        response.allFiles = allFiles;
        return response;
      }
    } catch (e) {
      response.e = e;
      response.status = false;
      response.message = "something wrong happened.";
      return response;
    }
  },

  jsCoreDateCreator: function (dateString) {
    let dateParam = dateString.split(/[\s-:]/);
    dateParam[1] = (parseInt(dateParam[1], 10) - 1).toString();
    return new Date(...dateParam).toString();
  },
};
