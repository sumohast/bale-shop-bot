require("dotenv").config();
const BotController = require("./controllers/BotController");
const BotService = require("./services/BotService");
const logger = require("./utils/logger");
const Helper = require("./utils/helper");

class BaleShopBot {
  constructor() {
    this.offset = 0;
    this.isRunning = false;
  }

  async start() {
    try {
      logger.info("🤖 ربات در حال راه‌اندازی...");

      // تست اتصال ربات
      const botInfo = await BotService.getMe();
      logger.info(`✅ ربات راه‌اندازی شد: @${botInfo.username}`);
      logger.info(`📛 نام: ${botInfo.first_name}`);

      this.isRunning = true;
      await this.poll();
    } catch (error) {
      logger.error(`❌ خطا در راه‌اندازی ربات: ${error.message}`);
      process.exit(1);
    }
  }

  async poll() {
    while (this.isRunning) {
      try {
        const updates = await BotService.getUpdates(this.offset, 30);

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.processUpdate(update);
        }
      } catch (error) {
        logger.error(`خطا در دریافت آپدیت‌ها: ${error.message}`);
        await Helper.sleep(3000);
      }
    }
  }

  async processUpdate(update) {
    try {
      if (update.message) {
        await BotController.handleMessage(update.message);
      } else if (update.callback_query) {
        await BotController.handleCallback(update.callback_query);
      }
    } catch (error) {
      logger.error(`خطا در پردازش آپدیت: ${error.message}`);
    }
  }

  stop() {
    this.isRunning = false;
    logger.info("ربات متوقف شد");
  }
}

// مدیریت سیگنال‌ها برای بستن برنامه
const bot = new BaleShopBot();

process.on("SIGINT", () => {
  logger.info("دریافت سیگنال SIGINT...");
  bot.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("دریافت سیگنال SIGTERM...");
  bot.stop();
  process.exit(0);
});

// مدیریت خطاهای نگرفته‌شده
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// شروع ربات
bot.start();
