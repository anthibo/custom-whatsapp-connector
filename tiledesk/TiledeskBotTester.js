const axios = require("axios").default;
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
var winston = require('../winston');

const { TiledeskClient } = require('@tiledesk/tiledesk-client');
const { TiledeskWhatsappTranslator } = require('./TiledeskWhatsappTranslator');
const { TiledeskChannel } = require('./TiledeskChannel');

class TiledeskBotTester {

  constructor(config) {
    if (!config) {
      throw new Error('config is mandatory');
    }

    if (!config.project_id) {
      throw new Error('config.project_id is mandatory');
    }

    if (!config.redis_client) {
      throw new Error('config.redis_client is mandatory');
    }

    if (!config.db) {
      throw new Error('config.db is mandatory');
    }

    if (!config.tdChannel) {
      throw new Error('config.tdChannel is mandatory');
    }

    if (!config.tlr) {
      throw new Error('config.tlr is mandatory');
    }

    this.log = false;
    if (config.log) {
      this.log = config.log;
    }

    this.settings = config.settings;
    this.project_id = config.project_id;
    this.redis_client = config.redis_client;
    this.db = config.db;
    this.tdChannel = config.tdChannel;
    this.tlr = config.tlr;

  }

  async startBotConversation(body, code) {

    return new Promise(async (resolve, reject) => {
      winston.verbose("(wab) [TiledeskBotTester] starting bot conversation");

      let whatsappChannelMessage = body.entry[0].changes[0].value.messages[0];
      let whatsappContact = body.entry[0].changes[0].value.contacts[0];

      let key = "bottest:" + code.substring(3);

      let test_info;

      this.redis_client.get(key, async (err, value) => {
        if (err) {
          winston.error("An error occured on redis. Exit..");
          return reject(err);
        } else {

          if (!value) {
            winston.verbose("No test info found on redis. Exit..");
            reject("No test info found on redis");
            return;

          } else {
            test_info = JSON.parse(value)
            let message_info = {
              channel: "whatsapp",
              whatsapp: {
                phone_number_id: body.entry[0].changes[0].value.metadata.phone_number_id,
                from: whatsappChannelMessage.from,
                firstname: whatsappContact.profile.name,
                lastname: " "
              }
            }

            let CONTENT_KEY = "whatsapp-" + this.project_id;
            let settings = await this.db.get(CONTENT_KEY);

            if (!settings) {
              winston.verbose("No settings found. Exit..");
              return reject("No settings found. Exit..")
            }

            whatsappChannelMessage.text.body = "/start";
            let tiledeskJsonMessage = await this.tlr.toTiledesk(whatsappChannelMessage, whatsappContact.profile.name);

            if (test_info) {
              const response = await this.tdChannel.sendAndAddBot(tiledeskJsonMessage, message_info, test_info.bot_id)
              return resolve(response)
            } else {
              winston.verbose("(wab) No bot selected for test. Exit..")
              return reject("Test skipped")
            }

          }
        }
      })
    })
  }

  async startBotConversationCMP(body, bot_id) {
    console.log("startBotConversationCMP body: ", JSON.stringify(body), "bot: ", bot_id)
    return new Promise(async (resolve, reject) => {
      winston.verbose("(wab) [TiledeskBotTester] starting bot conversation");

      let whatsappChannelMessage = body.message; // {from: <number>, text: "/start", type: text}
      let whatsappContact = body.contact; // {name}
      let phone_number_id = body.receiverAddress
      let message_info = {
        channel: "whatsapp",
        whatsapp: {
          phone_number_id,
          from: whatsappChannelMessage.from,
          firstname: whatsappContact.name,
          lastname: " "
        }
      }

      let CONTENT_KEY = "whatsapp-" + this.project_id;
      let settings = await this.db.get(CONTENT_KEY);

      if (!settings) {
        winston.verbose("No settings found. Exit..");
        return reject("No settings found. Exit..")
      }

      whatsappChannelMessage.text.body = "/start";
      let tiledeskJsonMessage = await this.tlr.toTiledesk(whatsappChannelMessage, whatsappContact.name);

      if (bot_id) {
        const response = await this.tdChannel.sendAndAddBot(tiledeskJsonMessage, message_info, bot_id)
        return resolve(response)
      } else {
        winston.verbose("(wab) No bot selected for test. Exit..")
        return reject("Test skipped")
      }
    })
  }

}

module.exports = { TiledeskBotTester }

