const axios = require("axios");
const config = require("../config/config");
const logger = require("../utils/logger");

class BotService {
  constructor() {
    this.baseUrl = config.bot.baseUrl;
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  async sendMessage(chatId, text, keyboard = null) {
    try {
      const data = {
        chat_id: chatId,
        text: text.substring(0, 4096), // محدودیت طول پیام
      };

      if (keyboard) {
        data.reply_markup = keyboard;
      }

      const response = await this.axios.post("/sendMessage", data);
      return response.data;
    } catch (error) {
      logger.error(`خطا در sendMessage: ${error.message}`);
      throw error;
    }
  }

  async sendPhoto(chatId, photoUrl, caption = "", keyboard = null) {
    try {
      const data = {
        chat_id: chatId,
        photo: photoUrl,
        caption: caption.substring(0, 1024),
      };

      if (keyboard) {
        data.reply_markup = keyboard;
      }

      const response = await this.axios.post("/sendPhoto", data);
      return response.data;
    } catch (error) {
      logger.error(`خطا در sendPhoto: ${error.message}`);
      // fallback به ارسال متن ساده
      return this.sendMessage(chatId, caption, keyboard);
    }
  }

  async editMessageText(chatId, messageId, text, keyboard = null) {
    try {
      const data = {
        chat_id: chatId,
        message_id: messageId,
        text: text.substring(0, 4096),
      };

      if (keyboard) {
        data.reply_markup = keyboard;
      }

      const response = await this.axios.post("/editMessageText", data);
      return response.data;
    } catch (error) {
      logger.error(`خطا در editMessageText: ${error.message}`);
      throw error;
    }
  }

  async deleteMessage(chatId, messageId) {
    try {
      const response = await this.axios.post("/deleteMessage", {
        chat_id: chatId,
        message_id: messageId,
      });
      return response.data;
    } catch (error) {
      logger.error(`خطا در deleteMessage: ${error.message}`);
      throw error;
    }
  }

  async answerCallbackQuery(callbackQueryId, text = "", showAlert = false) {
    try {
      const response = await this.axios.post("/answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text: text.substring(0, 200),
        show_alert: showAlert,
      });
      return response.data;
    } catch (error) {
      logger.error(`خطا در answerCallbackQuery: ${error.message}`);
      throw error;
    }
  }

  async getUpdates(offset = 0, timeout = 30) {
    try {
      const response = await this.axios.get("/getUpdates", {
        params: { offset, timeout },
        validateStatus: () => true,
      });

      if (!response.data.ok) {
        logger.warn("getUpdates returned not ok");
        return [];
      }

      return response.data.result || [];
    } catch (error) {
      logger.error(`خطا در getUpdates: ${error.message}`);
      return [];
    }
  }

  async getMe() {
    try {
      const response = await this.axios.get("/getMe");
      return response.data.result;
    } catch (error) {
      logger.error(`خطا در getMe: ${error.message}`);
      throw error;
    }
  }

  async sendDocument(chatId, documentUrl, caption = "") {
    try {
      const response = await this.axios.post("/sendDocument", {
        chat_id: chatId,
        document: documentUrl,
        caption: caption.substring(0, 1024),
      });
      return response.data;
    } catch (error) {
      logger.error(`خطا در sendDocument: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new BotService();
