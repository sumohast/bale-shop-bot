const BotService = require("./BotService");
const User = require("../models/User");
const Helper = require("../utils/helper");
const logger = require("../utils/logger");
const config = require("../config/config");

class NotificationService {
  /**
   * ارسال اعلان ثبت سفارش به کاربر
   */
  static async orderCreated(order, items) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `✅ *سفارش شما ثبت شد!*\n\n`;
      message += `🆔 شماره سفارش: ${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n\n`;
      
      message += `📦 *اقلام سفارش:*\n`;
      items.forEach((item, index) => {
        message += `${index + 1}. ${item.name} × ${item.quantity}\n`;
      });

      message += `\n💰 مبلغ کل: ${Helper.formatPrice(order.total_price)} تومان\n`;
      if (order.discount_amount > 0) {
        message += `🎁 تخفیف: ${Helper.formatPrice(order.discount_amount)} تومان\n`;
      }
      message += `📊 مالیات: ${Helper.formatPrice(order.tax_amount)} تومان\n`;
      message += `💵 *مبلغ نهایی: ${Helper.formatPrice(order.final_price)} تومان*\n\n`;
      
      message += `📌 وضعیت: در حال بررسی\n`;
      message += `⏰ زمان ثبت: ${Helper.toJalali(order.created_at)}\n\n`;
      message += `سفارش شما در حال بررسی است و به زودی تایید خواهد شد.`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان ثبت سفارش ${order.id} به کاربر ${user.chat_id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در orderCreated notification: ${error.message}`);
    }
  }

  /**
   * اعلان تایید سفارش
   */
  static async orderConfirmed(order) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `✅ *سفارش شما تایید شد!*\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n`;
      message += `💰 مبلغ: ${Helper.formatPrice(order.final_price)} تومان\n\n`;
      message += `سفارش شما تایید شد و در حال آماده‌سازی است.\n`;
      message += `به زودی ارسال خواهد شد.`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان تایید سفارش ${order.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در orderConfirmed notification: ${error.message}`);
    }
  }

  /**
   * اعلان آماده‌سازی سفارش
   */
  static async orderPreparing(order) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `📦 *سفارش شما در حال آماده‌سازی است*\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n\n`;
      message += `سفارش شما در حال بسته‌بندی و آماده‌سازی برای ارسال است.`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان آماده‌سازی سفارش ${order.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در orderPreparing notification: ${error.message}`);
    }
  }

  /**
   * اعلان ارسال سفارش
   */
  static async orderShipped(order, trackingCode = null) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `🚚 *سفارش شما ارسال شد!*\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n`;
      
      if (trackingCode) {
        message += `📮 کد رهگیری پست: ${trackingCode}\n`;
        message += `\nبرای پیگیری مرسوله به سایت پست مراجعه کنید:\n`;
        message += `https://tracking.post.ir\n`;
      }
      
      message += `\nسفارش شما ارسال شد و به زودی تحویل خواهد شد.`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان ارسال سفارش ${order.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در orderShipped notification: ${error.message}`);
    }
  }

  /**
   * اعلان تحویل سفارش
   */
  static async orderDelivered(order) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `🎉 *سفارش شما تحویل داده شد!*\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n`;
      message += `💰 مبلغ: ${Helper.formatPrice(order.final_price)} تومان\n\n`;
      message += `از خرید شما متشکریم! 🙏\n`;
      message += `امیدواریم از محصولات راضی باشید.\n\n`;
      message += `نظر شما برای ما مهم است.`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان تحویل سفارش ${order.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در orderDelivered notification: ${error.message}`);
    }
  }

  /**
   * اعلان لغو سفارش
   */
  static async orderCancelled(order, reason = null) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `❌ *سفارش شما لغو شد*\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n`;
      
      if (reason) {
        message += `\n📝 دلیل لغو: ${reason}\n`;
      }
      
      message += `\nمتاسفانه سفارش شما لغو شد.\n`;
      message += `در صورت کسر وجه، مبلغ ظرف 72 ساعت به حساب شما برمی‌گردد.`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان لغو سفارش ${order.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در orderCancelled notification: ${error.message}`);
    }
  }

  /**
   * اعلان موجودی کم به ادمین
   */
  static async lowStockAlert(product) {
    try {
      let message = `⚠️ *هشدار موجودی کم!*\n\n`;
      message += `📦 محصول: ${product.name}\n`;
      message += `🆔 شناسه: ${product.id}\n`;
      message += `📊 موجودی فعلی: ${product.stock}\n\n`;
      message += `موجودی این محصول رو به حد کمی رسیده است.`;

      await BotService.sendMessage(config.bot.adminChatId, message);
      logger.info(`هشدار موجودی کم برای محصول ${product.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در lowStockAlert: ${error.message}`);
    }
  }

  /**
   * اعلان سفارش جدید به ادمین
   */
  static async newOrderToAdmin(order, items) {
    try {
      let message = `🔔 *سفارش جدید ثبت شد!*\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n`;
      message += `👤 نام: ${order.full_name}\n`;
      message += `📱 تلفن: ${order.phone}\n`;
      message += `📍 آدرس: ${order.address}\n`;
      
      if (order.postal_code) {
        message += `📮 کد پستی: ${order.postal_code}\n`;
      }
      
      message += `\n📦 *اقلام:*\n`;
      items.forEach((item, index) => {
        message += `${index + 1}. ${item.name} × ${item.quantity}\n`;
      });

      message += `\n💰 جمع: ${Helper.formatPrice(order.total_price)} تومان\n`;
      
      if (order.discount_amount > 0) {
        message += `🎁 تخفیف: ${Helper.formatPrice(order.discount_amount)} تومان\n`;
      }
      
      message += `📊 مالیات: ${Helper.formatPrice(order.tax_amount)} تومان\n`;
      message += `💵 *نهایی: ${Helper.formatPrice(order.final_price)} تومان*\n`;
      
      message += `\n⏰ زمان: ${Helper.toJalali(order.created_at)}`;

      const keyboard = Helper.createInlineKeyboard([
        [
          { text: "✅ تایید", callback_data: `order_confirm_${order.id}` },
          { text: "❌ رد", callback_data: `order_cancel_${order.id}` },
        ],
        [{ text: "📦 آماده‌سازی", callback_data: `order_prepare_${order.id}` }],
      ]);

      await BotService.sendMessage(config.bot.adminChatId, message, keyboard);
      logger.info(`اعلان سفارش جدید ${order.id} به ادمین ارسال شد`);
    } catch (error) {
      logger.error(`خطا در newOrderToAdmin: ${error.message}`);
    }
  }

  /**
   * اعلان پرداخت موفق
   */
  static async paymentSuccess(order) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `💳 *پرداخت موفق!*\n\n`;
      message += `✅ پرداخت شما با موفقیت انجام شد.\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      message += `💰 مبلغ: ${Helper.formatPrice(order.final_price)} تومان\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n\n`;
      message += `از خرید شما متشکریم! 🙏`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان پرداخت موفق برای سفارش ${order.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در paymentSuccess: ${error.message}`);
    }
  }

  /**
   * اعلان پرداخت ناموفق
   */
  static async paymentFailed(order, reason = null) {
    try {
      const user = await User.findById(order.user_id);
      if (!user) return;

      let message = `❌ *پرداخت ناموفق!*\n\n`;
      message += `متاسفانه پرداخت شما با مشکل مواجه شد.\n\n`;
      message += `🆔 سفارش: #${order.id}\n`;
      
      if (reason) {
        message += `📝 دلیل: ${reason}\n\n`;
      }
      
      message += `لطفاً مجدداً تلاش کنید یا با پشتیبانی تماس بگیرید.`;

      await BotService.sendMessage(user.chat_id, message);
      logger.info(`اعلان پرداخت ناموفق برای سفارش ${order.id} ارسال شد`);
    } catch (error) {
      logger.error(`خطا در paymentFailed: ${error.message}`);
    }
  }

  /**
   * اعلان کد تخفیف جدید به همه کاربران
   */
  static async newDiscountCode(discountCode) {
    try {
      const users = await User.getAll(1000);
      
      let message = `🎁 *کد تخفیف جدید!*\n\n`;
      message += `کد: ${discountCode.code}\n`;
      
      if (discountCode.description) {
        message += `📝 ${discountCode.description}\n\n`;
      }
      
      if (discountCode.discount_type === 'percentage') {
        message += `💰 ${discountCode.discount_value}٪ تخفیف\n`;
      } else {
        message += `💰 ${Helper.formatPrice(discountCode.discount_value)} تومان تخفیف\n`;
      }
      
      if (discountCode.min_purchase > 0) {
        message += `📊 حداقل خرید: ${Helper.formatPrice(discountCode.min_purchase)} تومان\n`;
      }
      
      if (discountCode.end_date) {
        message += `⏰ تا: ${Helper.toJalali(discountCode.end_date)}\n`;
      }
      
      message += `\nبرای استفاده کد رو در سبد خرید وارد کنید! 🛒`;

      for (const user of users) {
        try {
          await BotService.sendMessage(user.chat_id, message);
          await Helper.sleep(100); // جلوگیری از flood
        } catch (error) {
          logger.warn(`خطا در ارسال به کاربر ${user.chat_id}: ${error.message}`);
        }
      }

      logger.info(`اعلان کد تخفیف ${discountCode.code} به ${users.length} کاربر ارسال شد`);
    } catch (error) {
      logger.error(`خطا در newDiscountCode: ${error.message}`);
    }
  }
}

module.exports = NotificationService;