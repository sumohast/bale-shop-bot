const moment = require("moment-jalaali");

/**
 * تابع‌های کمکی
 */

class Helper {
  /**
   * فرمت کردن قیمت به صورت خوانا
   */
  static formatPrice(price) {
    if (!price) return "0";
    return new Intl.NumberFormat("fa-IR").format(price);
  }

  /**
   * تبدیل تاریخ میلادی به شمسی
   */
  static toJalali(date) {
    return moment(date).format("jYYYY/jMM/jDD HH:mm");
  }

  /**
   * محاسبه درصد تخفیف
   */
  static calculateDiscountPercent(originalPrice, discountPrice) {
    if (!discountPrice || discountPrice >= originalPrice) return 0;
    return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
  }

  /**
   * محاسبه مالیات
   */
  static calculateTax(amount, taxPercent = 9) {
    return Math.round((amount * taxPercent) / 100);
  }

  /**
   * محاسبه قیمت نهایی با تخفیف و مالیات
   */
  static calculateFinalPrice(subtotal, discount = 0, taxPercent = 9) {
    const afterDiscount = subtotal - discount;
    const tax = this.calculateTax(afterDiscount, taxPercent);
    return afterDiscount + tax;
  }

  /**
   * ایجاد کد پیگیری تصادفی
   */
  static generateTrackingCode() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `TR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * اسلیپ (تاخیر)
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * صفحه‌بندی آرایه
   */
  static paginate(array, page = 1, perPage = 10) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
      data: array.slice(start, end),
      total: array.length,
      page,
      perPage,
      totalPages: Math.ceil(array.length / perPage),
    };
  }

  /**
   * کوتاه کردن متن
   */
  static truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  /**
   * ترجمه وضعیت سفارش
   */
  static translateOrderStatus(status) {
    const statusMap = {
      pending: "در انتظار تایید",
      confirmed: "تایید شده",
      preparing: "در حال آماده‌سازی",
      shipped: "ارسال شده",
      delivered: "تحویل داده شده",
      cancelled: "لغو شده",
    };
    return statusMap[status] || status;
  }

  /**
   * ترجمه وضعیت پرداخت
   */
  static translatePaymentStatus(status) {
    const statusMap = {
      unpaid: "پرداخت نشده",
      paid: "پرداخت شده",
      refunded: "بازگشت داده شده",
    };
    return statusMap[status] || status;
  }

  /**
   * ایجاد دکمه‌های inline keyboard
   */
  static createInlineKeyboard(buttons) {
    return { inline_keyboard: buttons };
  }

  /**
   * ایجاد دکمه‌های reply keyboard
   */
  static createReplyKeyboard(buttons, resize = true, oneTime = false) {
    return {
      keyboard: buttons,
      resize_keyboard: resize,
      one_time_keyboard: oneTime,
    };
  }

  /**
   * حذف کیبورد
   */
  static removeKeyboard() {
    return { remove_keyboard: true };
  }

  /**
   * استخراج chat_id از message یا callback
   */
  static getChatId(update) {
    if (update.message) return update.message.from.id;
    if (update.callback_query) return update.callback_query.from.id;
    return null;
  }

  /**
   * استخراج user info از message
   */
  static getUserInfo(message) {
    if (!message || !message.from) return null;
    return {
      chat_id: message.from.id,
      username: message.from.username || null,
      first_name: message.from.first_name || null,
      last_name: message.from.last_name || null,
    };
  }
}

module.exports = Helper;
