const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const BotService = require("../services/BotService");
const Helper = require("../utils/helper");
const Validator = require("../utils/validator");
const logger = require("../utils/logger");
const config = require("../config/config");

class BotController {
  constructor() {
    this.userStates = new Map();
  }

  // دریافت یا ایجاد state کاربر
  getUserState(chatId) {
    if (!this.userStates.has(chatId)) {
      this.userStates.set(chatId, { step: null, data: {} });
    }
    return this.userStates.get(chatId);
  }

  // پاک کردن state کاربر
  clearUserState(chatId) {
    this.userStates.delete(chatId);
  }

  // کیبوردهای منو
  mainMenu() {
    return Helper.createReplyKeyboard([
      [{ text: "🛍 محصولات" }, { text: "🛒 سبد خرید" }],
      [{ text: "📦 سفارش‌های من" }, { text: "🔍 پیگیری سفارش" }],
      [{ text: "ℹ️ درباره ما" }, { text: "☎️ پشتیبانی" }],
    ]);
  }

  adminMenu() {
    return Helper.createReplyKeyboard([
      [{ text: "📊 آمار کلی" }],
      [{ text: "📋 مدیریت سفارش‌ها" }, { text: "👥 مدیریت کاربران" }],
      [{ text: "📦 مدیریت محصولات" }, { text: "➕ افزودن محصول" }],
      [{ text: "📦 مدیریت موجودی" }],
      [{ text: "🔙 برگشت به منوی کاربر" }],
    ]);
  }

  // هندل پیام‌ها
  async handleMessage(message) {
    try {
      const chatId = message.from.id;
      const text = message.text;
      const userInfo = Helper.getUserInfo(message);
      
      // ایجاد/دریافت کاربر
      const user = await User.getOrCreate(chatId, userInfo);

      // بررسی بلاک بودن
      if (user.is_blocked) {
        return BotService.sendMessage(
          chatId,
          "❌ شما از استفاده از این ربات محروم شده‌اید."
        );
      }

      // دستورات مدیریتی
      if (String(chatId) === String(config.bot.adminChatId)) {
        if (text === "/admin") {
          return BotService.sendMessage(
            chatId,
            "👑 پنل مدیریت فعال شد",
            this.adminMenu()
          );
        }
        
        if (text === "📊 آمار کلی") {
          return this.showStats(chatId);
        }

        if (text === "📋 مدیریت سفارش‌ها") {
          return this.manageOrders(chatId);
        }

        if (text === "👥 مدیریت کاربران") {
          return this.manageUsers(chatId);
        }

        if (text === "➕ افزودن محصول") {
          return this.startAddProduct(chatId);
        }

        if (text === "📦 مدیریت موجودی") {
          return this.manageStock(chatId);
        }

        if (text === "🔙 برگشت به منوی کاربر") {
          this.clearUserState(chatId);
          return BotService.sendMessage(
            chatId,
            "منوی اصلی:",
            this.mainMenu()
          );
        }
        if (text === "👥 مدیریت کاربران") {
          this.userStates.set(chatId, { step: "admin_users", data: { page: 1 } });
          return this.showUsers(chatId, 1);
        }

        if (text === "📦 مدیریت محصولات") {
          this.userStates.set(chatId, { step: "admin_products", data: { page: 1 } });
          return this.showProducts(chatId, 1);
        }
      }

      // دستورات عمومی
      if (text === "/start") {
        this.clearUserState(chatId);
        const welcomeText = `سلام ${message.from.first_name || "کاربر عزیز"} 👋

به ${config.shop.name} خوش اومدی!

🛍 از منوی زیر برای شروع خرید استفاده کن:`;
        return BotService.sendMessage(chatId, welcomeText, this.mainMenu());
      }

      if (text === "🛍 محصولات") {
        return this.showCategories(chatId);
      }

      if (text === "🛒 سبد خرید") {
        return this.showCart(chatId, user.id);
      }

      if (text === "📦 سفارش‌های من") {
        return this.showUserOrders(chatId, user.id);
      }

      if (text === "🔍 پیگیری سفارش") {
        const state = this.getUserState(chatId);
        state.step = "track_order";
        return BotService.sendMessage(chatId, "لطفاً شماره سفارش یا کد پیگیری رو ارسال کن:");
      }

      if (text === "ℹ️ درباره ما") {
        return this.showAbout(chatId);
      }

      if (text === "☎️ پشتیبانی") {
        return this.showSupport(chatId);
      }

      // مدیریت state‌ها
      const state = this.getUserState(chatId);

      if (state.step === "track_order") {
        return this.trackOrder(chatId, text);
      }

      if (state.step === "checkout_name") {
        if (!Validator.isValidName(text)) {
          return BotService.sendMessage(chatId, "❌ نام وارد شده معتبر نیست. لطفاً دوباره تلاش کنید:");
        }
        state.data.full_name = Validator.sanitizeText(text);
        state.step = "checkout_phone";
        return BotService.sendMessage(chatId, "📱 شماره تماس خودت رو ارسال کن:\n(مثال: 09123456789)");
      }

      if (state.step === "checkout_phone") {
        const phone = Validator.formatPhone(text);
        if (!Validator.isValidPhone(phone)) {
          return BotService.sendMessage(chatId, "❌ شماره تلفن معتبر نیست. لطفاً دوباره وارد کنید:");
        }
        state.data.phone = phone;
        state.step = "checkout_address";
        return BotService.sendMessage(chatId, "📍 آدرس کامل خودت رو ارسال کن:\n(حداقل 10 کاراکتر)");
      }

      if (state.step === "checkout_address") {
        if (!Validator.isValidAddress(text)) {
          return BotService.sendMessage(chatId, "❌ آدرس باید حداقل 10 کاراکتر باشد:");
        }
        state.data.address = Validator.sanitizeText(text);
        state.step = "checkout_postal";
        return BotService.sendMessage(
          chatId,
          "📮 کد پستی 10 رقمی رو ارسال کن:\n(اگر ندارید، عدد 0 را ارسال کنید)"
        );
      }

      if (state.step === "checkout_postal") {
        const postal = text === "0" ? null : text;
        if (postal && !Validator.isValidPostalCode(postal)) {
          return BotService.sendMessage(chatId, "❌ کد پستی باید 10 رقم باشد:");
        }
        state.data.postal_code = postal;
        return this.completeCheckout(chatId, user.id, state.data);
      }

      // مدیریت افزودن محصول (ادمین)
      if (String(chatId) === String(config.bot.adminChatId)) {
        if (state.step === "add_product_category") {
          return this.selectCategoryForProduct(chatId, parseInt(text));
        }
        if (state.step === "add_product_name") {
          state.data.name = Validator.sanitizeText(text);
          state.step = "add_product_price";
          return BotService.sendMessage(chatId, "💰 قیمت محصول را وارد کنید (به تومان):");
        }
        if (state.step === "add_product_price") {
          const price = parseInt(text);
          if (!Validator.isValidPrice(price)) {
            return BotService.sendMessage(chatId, "❌ قیمت معتبر نیست:");
          }
          state.data.price = price;
          state.step = "add_product_stock";
          return BotService.sendMessage(chatId, "📦 موجودی محصول را وارد کنید:");
        }
        if (state.step === "add_product_stock") {
          const stock = parseInt(text);
          if (!Validator.isValidQuantity(stock)) {
            return BotService.sendMessage(chatId, "❌ موجودی معتبر نیست:");
          }
          state.data.stock = stock;
          state.step = "add_product_description";
          return BotService.sendMessage(chatId, "📝 توضیحات محصول را وارد کنید:\n(یا 0 برای رد کردن)");
        }
        if (state.step === "add_product_description") {
          state.data.description = text === "0" ? null : Validator.sanitizeText(text);
          return this.saveProduct(chatId, state.data);
        }
      }

      // پیام پیش‌فرض
      return BotService.sendMessage(
        chatId,
        "متوجه درخواست شما نشدم 🤔\nلطفاً از منو استفاده کنید.",
        this.mainMenu()
      );
    } catch (error) {
      logger.error(`خطا در handleMessage: ${error.message}`);
      return BotService.sendMessage(
        message.chat.id,
        "❌ خطایی رخ داد. لطفاً دوباره تلاش کنید."
      );
    }
  }

  // نمایش دسته‌بندی‌ها
  async showCategories(chatId) {
    try {
      const categories = await Category.getAll();
      
      if (categories.length === 0) {
        return BotService.sendMessage(chatId, "هیچ دسته‌بندی‌ای موجود نیست.");
      }

      const buttons = categories.map((cat) => [
        {
          text: `${cat.icon || "📂"} ${cat.title}`,
          callback_data: `cat_${cat.id}`,
        },
      ]);

      return BotService.sendMessage(
        chatId,
        "📂 یک دسته‌بندی انتخاب کنید:",
        Helper.createInlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`خطا در showCategories: ${error.message}`);
      throw error;
    }
  }

  // نمایش محصولات یک دسته
  async showProducts(chatId, categoryId) {
    try {
      const products = await Product.findByCategory(categoryId);

      if (products.length === 0) {
        return BotService.sendMessage(
          chatId,
          "این دسته‌بندی محصولی ندارد 😅",
          Helper.createInlineKeyboard([[{ text: "🔙 برگشت", callback_data: "back_main" }]])
        );
      }

      for (const product of products) {
        const price = product.discount_price || product.price;
        const discountPercent = Helper.calculateDiscountPercent(product.price, product.discount_price);
        
        let caption = `🛍 *${product.name}*\n\n`;
        
        if (product.description) {
          caption += `📝 ${Helper.truncate(product.description, 150)}\n\n`;
        }

        if (discountPercent > 0) {
          caption += `💰 قیمت: ~${Helper.formatPrice(product.price)}~ ${Helper.formatPrice(price)} ${config.shop.currency}\n`;
          caption += `🔥 ${discountPercent}٪ تخفیف\n\n`;
        } else {
          caption += `💰 قیمت: ${Helper.formatPrice(price)} ${config.shop.currency}\n\n`;
        }

        caption += `📦 موجودی: ${product.stock > 0 ? product.stock : "ناموجود"}`;

        const keyboard = Helper.createInlineKeyboard([
          product.stock > 0
            ? [{ text: "➕ افزودن به سبد", callback_data: `addcart_${product.id}` }]
            : [{ text: "❌ ناموجود", callback_data: "noop" }],
        ]);

        if (product.image_url) {
          await BotService.sendPhoto(chatId, product.image_url, caption, keyboard);
        } else {
          await BotService.sendMessage(chatId, caption, keyboard);
        }

        await Helper.sleep(300); // جلوگیری از flood
      }
    } catch (error) {
      logger.error(`خطا در showProducts: ${error.message}`);
      throw error;
    }
  }

  // نمایش سبد خرید
  async showCart(chatId, userId) {
    try {
      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        return BotService.sendMessage(
          chatId,
          "🛒 سبد خرید شما خالی است!\n\nبرای خرید از منوی محصولات استفاده کنید.",
          this.mainMenu()
        );
      }

      let message = "🛒 *سبد خرید شما:*\n\n";
      
      cartData.items.forEach((item, index) => {
        const price = item.discount_price || item.price;
        const totalPrice = price * item.quantity;
        message += `${index + 1}. ${item.name}\n`;
        message += `   💰 ${Helper.formatPrice(price)} × ${item.quantity} = ${Helper.formatPrice(totalPrice)}\n\n`;
      });

      message += `\n💵 *جمع کل:* ${Helper.formatPrice(cartData.total)} ${config.shop.currency}\n`;
      message += `📦 *تعداد اقلام:* ${cartData.count}\n\n`;

      const buttons = [];

      // دکمه‌های مدیریت هر محصول
      cartData.items.forEach((item) => {
        buttons.push([
          { text: `➖`, callback_data: `cart_dec_${item.product_id}` },
          { text: `${item.name} (${item.quantity})`, callback_data: "noop" },
          { text: `➕`, callback_data: `cart_inc_${item.product_id}` },
          { text: `🗑`, callback_data: `cart_del_${item.product_id}` },
        ]);
      });

      // دکمه‌های عملیات
      buttons.push([{ text: "🗑 پاک کردن سبد", callback_data: "cart_clear" }]);
      buttons.push([{ text: "✅ تکمیل خرید", callback_data: "checkout_start" }]);

      return BotService.sendMessage(
        chatId,
        message,
        Helper.createInlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`خطا در showCart: ${error.message}`);
      throw error;
    }
  }

  // شروع فرآیند تسویه
  async startCheckout(chatId, userId) {
    try {
      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        return BotService.sendMessage(chatId, "سبد خرید شما خالی است!");
      }

      const state = this.getUserState(chatId);
      state.step = "checkout_name";
      state.data = {};

      return BotService.sendMessage(
        chatId,
        "✅ شروع ثبت سفارش\n\n👤 لطفاً نام و نام خانوادگی خود را وارد کنید:"
      );
    } catch (error) {
      logger.error(`خطا در startCheckout: ${error.message}`);
      throw error;
    }
  }

  // تکمیل خرید
  async completeCheckout(chatId, userId, orderData) {
    try {
      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        this.clearUserState(chatId);
        return BotService.sendMessage(chatId, "سبد خرید شما خالی است!");
      }

      // ایجاد سفارش
      const orderId = await Order.create(userId, {
        ...orderData,
        total_price: cartData.total,
        items: cartData.items,
      });

      const order = await Order.findById(orderId);

      // پاک کردن state
      this.clearUserState(chatId);

      // پیام تایید برای کاربر
      let successMessage = `✅ سفارش شما با موفقیت ثبت شد!\n\n`;
      successMessage += `🆔 شماره سفارش: *${order.id}*\n`;
      successMessage += `📍 کد پیگیری: *${order.tracking_code}*\n`;
      successMessage += `💰 مبلغ نهایی: *${Helper.formatPrice(order.final_price)}* ${config.shop.currency}\n\n`;
      successMessage += `📌 وضعیت: ${Helper.translateOrderStatus(order.status)}\n\n`;
      successMessage += `سفارش شما در حال بررسی است و به زودی تایید خواهد شد.`;

      await BotService.sendMessage(chatId, successMessage, this.mainMenu());

      // ارسال اعلان برای ادمین
      await this.notifyAdminNewOrder(order, cartData.items);

      return order;
    } catch (error) {
      logger.error(`خطا در completeCheckout: ${error.message}`);
      this.clearUserState(chatId);
      return BotService.sendMessage(
        chatId,
        `❌ خطا در ثبت سفارش: ${error.message}\n\nلطفاً دوباره تلاش کنید.`,
        this.mainMenu()
      );
    }
  }

  // اعلان سفارش جدید به ادمین
  async notifyAdminNewOrder(order, items) {
    try {
      let message = `🔔 *سفارش جدید ثبت شد!*\n\n`;
      message += `🆔 شماره سفارش: ${order.id}\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n`;
      message += `👤 نام: ${order.full_name}\n`;
      message += `📱 تلفن: ${order.phone}\n`;
      message += `📍 آدرس: ${order.address}\n`;
      if (order.postal_code) {
        message += `📮 کد پستی: ${order.postal_code}\n`;
      }
      message += `\n📦 *اقلام سفارش:*\n`;

      items.forEach((item, index) => {
        message += `${index + 1}. ${item.name} × ${item.quantity}\n`;
      });

      message += `\n💰 جمع: ${Helper.formatPrice(order.total_price)}\n`;
      message += `🎁 تخفیف: ${Helper.formatPrice(order.discount_amount)}\n`;
      message += `📊 مالیات: ${Helper.formatPrice(order.tax_amount)}\n`;
      message += `💵 *مبلغ نهایی: ${Helper.formatPrice(order.final_price)}*\n`;

      const keyboard = Helper.createInlineKeyboard([
        [
          { text: "✅ تایید", callback_data: `order_confirm_${order.id}` },
          { text: "❌ رد", callback_data: `order_cancel_${order.id}` },
        ],
        [{ text: "📦 آماده‌سازی", callback_data: `order_prepare_${order.id}` }],
      ]);

      await BotService.sendMessage(config.bot.adminChatId, message, keyboard);
    } catch (error) {
      logger.error(`خطا در notifyAdminNewOrder: ${error.message}`);
    }
  }

  // پیگیری سفارش
  async trackOrder(chatId, input) {
    try {
      this.clearUserState(chatId);

      const orderId = parseInt(input);
      if (isNaN(orderId)) {
        return BotService.sendMessage(chatId, "❌ شماره سفارش نامعتبر است.");
      }

      const order = await Order.findById(orderId);

      if (!order) {
        return BotService.sendMessage(
          chatId,
          "❌ سفارشی با این شماره پیدا نشد.",
          this.mainMenu()
        );
      }

      const items = await Order.getItems(orderId);

      let message = `📦 *اطلاعات سفارش ${order.id}*\n\n`;
      message += `📍 کد پیگیری: ${order.tracking_code}\n`;
      message += `📌 وضعیت: *${Helper.translateOrderStatus(order.status)}*\n`;
      message += `💳 وضعیت پرداخت: ${Helper.translatePaymentStatus(order.payment_status)}\n`;
      message += `💰 مبلغ: ${Helper.formatPrice(order.final_price)} ${config.shop.currency}\n`;
      message += `📅 تاریخ: ${Helper.toJalali(order.created_at)}\n\n`;

      message += `📦 *اقلام:*\n`;
      items.forEach((item, index) => {
        message += `${index + 1}. ${item.product_name} × ${item.quantity}\n`;
      });

      return BotService.sendMessage(chatId, message, this.mainMenu());
    } catch (error) {
      logger.error(`خطا در trackOrder: ${error.message}`);
      throw error;
    }
  }

  // نمایش سفارش‌های کاربر
  async showUserOrders(chatId, userId) {
    try {
      const orders = await Order.findByUser(userId, 10);

      if (orders.length === 0) {
        return BotService.sendMessage(
          chatId,
          "شما هنوز هیچ سفارشی ثبت نکرده‌اید.",
          this.mainMenu()
        );
      }

      let message = "📦 *سفارش‌های شما:*\n\n";

      orders.forEach((order, index) => {
        message += `${index + 1}. سفارش #${order.id}\n`;
        message += `   📌 ${Helper.translateOrderStatus(order.status)}\n`;
        message += `   💰 ${Helper.formatPrice(order.final_price)} ${config.shop.currency}\n`;
        message += `   📅 ${Helper.toJalali(order.created_at)}\n\n`;
      });

      const buttons = orders.map((order) => [
        { text: `جزئیات سفارش #${order.id}`, callback_data: `order_view_${order.id}` },
      ]);

      return BotService.sendMessage(
        chatId,
        message,
        Helper.createInlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`خطا در showUserOrders: ${error.message}`);
      throw error;
    }
  }

  // درباره ما
  async showAbout(chatId) {
    const message = `ℹ️ *درباره ${config.shop.name}*\n\n${config.shop.name} یک فروشگاه آنلاین است که با بهترین کیفیت و قیمت در خدمت شماست.\n\n✨ ویژگی‌ها:\n• محصولات با کیفیت\n• قیمت مناسب\n• ارسال سریع\n• پشتیبانی 24 ساعته`;
    
    return BotService.sendMessage(chatId, message, this.mainMenu());
  }

  // پشتیبانی
  async showSupport(chatId) {
    const message = `☎️ *پشتیبانی ${config.shop.name}*\n\nبرای ارتباط با پشتیبانی:\n\n📱 تلگرام: @moha_st\n📧 ایمیل: sumohast@gmail.com\n\nساعات پاسخگویی: 9 صبح تا 9 شب`;
    
    return BotService.sendMessage(chatId, message, this.mainMenu());
  }

  // نمایش آمار (ادمین)
  async showStats(chatId) {
    try {
      const userStats = await User.getStats();
      const orderStats = await Order.getStats();
      const productStats = await Product.getStats();

      let message = `📊 *آمار کلی سیستم*\n\n`;
      message += `👥 *کاربران:*\n`;
      message += `   • کل: ${userStats.total}\n`;
      message += `   • امروز: ${userStats.today}\n`;
      message += `   • این هفته: ${userStats.week}\n\n`;
      
      message += `📦 *سفارش‌ها:*\n`;
      message += `   • کل: ${orderStats.total}\n`;
      message += `   • در انتظار: ${orderStats.pending}\n`;
      message += `   • تکمیل شده: ${orderStats.completed}\n`;
      message += `   • لغو شده: ${orderStats.cancelled}\n`;
      message += `   • درآمد کل: ${Helper.formatPrice(orderStats.revenue)} تومان\n\n`;
      
      message += `🛍 *محصولات:*\n`;
      message += `   • کل: ${productStats.total}\n`;
      message += `   • ناموجود: ${productStats.outOfStock}\n`;
      message += `   • کم موجود: ${productStats.lowStock}\n`;

      return BotService.sendMessage(chatId, message, this.adminMenu());
    } catch (error) {
      logger.error(`خطا در showStats: ${error.message}`);
      throw error;
    }
  }

  // مدیریت سفارش‌ها (ادمین)
  async manageOrders(chatId) {
    try {
      const orders = await Order.getAll({}, 20);

      if (orders.length === 0) {
        return BotService.sendMessage(chatId, "هیچ سفارشی ثبت نشده است.");
      }

      let message = "📋 *سفارش‌های اخیر:*\n\n";

      orders.forEach((order, index) => {
        message += `${index + 1}. سفارش #${order.id}\n`;
        message += `   👤 ${order.full_name}\n`;
        message += `   📌 ${Helper.translateOrderStatus(order.status)}\n`;
        message += `   💰 ${Helper.formatPrice(order.final_price)}\n\n`;
      });

      const buttons = orders.slice(0, 10).map((order) => [
        { text: `سفارش #${order.id}`, callback_data: `admin_order_${order.id}` },
      ]);

      return BotService.sendMessage(
        chatId,
        message,
        Helper.createInlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`خطا در manageOrders: ${error.message}`);
      throw error;
    }
  }

  // مدیریت کاربران (ادمین)
  async manageUsers(chatId) {
    try {
      const users = await User.getAll(20);
      const stats = await User.getStats();

      let message = `👥 *مدیریت کاربران*\n\n`;
      message += `کل کاربران: ${stats.total}\n`;
      message += `کاربران بلاک شده: ${stats.blocked}\n\n`;
      message += `آخرین کاربران:\n\n`;

      users.slice(0, 10).forEach((user, index) => {
        message += `${index + 1}. ${user.first_name || "بدون نام"} (${user.chat_id})\n`;
      });

      return BotService.sendMessage(chatId, message, this.adminMenu());
    } catch (error) {
      logger.error(`خطا در manageUsers: ${error.message}`);
      throw error;
    }
  }

  // شروع افزودن محصول
  async startAddProduct(chatId) {
    try {
      const categories = await Category.getAll();
      
      if (categories.length === 0) {
        return BotService.sendMessage(chatId, "ابتدا باید دسته‌بندی ایجاد کنید!");
      }

      const state = this.getUserState(chatId);
      state.step = "add_product_category";
      state.data = {};

      let message = "➕ *افزودن محصول جدید*\n\nدسته‌بندی محصول را انتخاب کنید:\n\n";
      categories.forEach((cat, index) => {
        message += `${index + 1}. ${cat.title}\n`;
      });
      message += "\nشماره دسته‌بندی را ارسال کنید:";

      return BotService.sendMessage(chatId, message);
    } catch (error) {
      logger.error(`خطا در startAddProduct: ${error.message}`);
      throw error;
    }
  }

  async selectCategoryForProduct(chatId, categoryIndex) {
    try {
      const categories = await Category.getAll();
      const selectedCategory = categories[categoryIndex - 1];

      if (!selectedCategory) {
        return BotService.sendMessage(chatId, "❌ دسته‌بندی نامعتبر است!");
      }

      const state = this.getUserState(chatId);
      state.data.category_id = selectedCategory.id;
      state.step = "add_product_name";

      return BotService.sendMessage(chatId, `✅ دسته‌بندی: ${selectedCategory.title}\n\nنام محصول را وارد کنید:`);
    } catch (error) {
      logger.error(`خطا در selectCategoryForProduct: ${error.message}`);
      throw error;
    }
  }

  async saveProduct(chatId, productData) {
    try {
      const productId = await Product.create(productData);
      this.clearUserState(chatId);

      return BotService.sendMessage(
        chatId,
        `✅ محصول با موفقیت اضافه شد!\n\n🆔 شناسه: ${productId}\n📦 نام: ${productData.name}`,
        this.adminMenu()
      );
    } catch (error) {
      logger.error(`خطا در saveProduct: ${error.message}`);
      this.clearUserState(chatId);
      return BotService.sendMessage(chatId, `❌ خطا در افزودن محصول: ${error.message}`);
    }
  }

  // مدیریت موجودی
  async manageStock(chatId) {
    try {
      const lowStockProducts = await Product.getLowStock(10);

      if (lowStockProducts.length === 0) {
        return BotService.sendMessage(chatId, "✅ موجودی همه محصولات کافی است!", this.adminMenu());
      }

      let message = "⚠️ *محصولات کم موجود:*\n\n";
      lowStockProducts.forEach((product, index) => {
        message += `${index + 1}. ${product.name}\n`;
        message += `   📦 موجودی: ${product.stock}\n\n`;
      });

      return BotService.sendMessage(chatId, message, this.adminMenu());
    } catch (error) {
      logger.error(`خطا در manageStock: ${error.message}`);
      throw error;
    }
  }

  // هندل callback query
  async handleCallback(callbackQuery) {
    try {
      const chatId = callbackQuery.from.id;
      const data = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;

      // دریافت کاربر
      const user = await User.findByChatId(chatId);

      if (!user) {
        return BotService.answerCallbackQuery(
          callbackQuery.id,
          "کاربر یافت نشد!",
          true
        );
      }

      // برگشت به منوی اصلی
      if (data === "back_main") {
        await BotService.deleteMessage(chatId, messageId);
        return this.showCategories(chatId);
      }

      // نمایش محصولات دسته
      if (data.startsWith("cat_")) {
        const categoryId = parseInt(data.split("_")[1]);
        await BotService.deleteMessage(chatId, messageId);
        return this.showProducts(chatId, categoryId);
      }

      // افزودن به سبد
      if (data.startsWith("addcart_")) {
        const productId = parseInt(data.split("_")[1]);
        await Cart.add(user.id, productId, 1);
        await BotService.answerCallbackQuery(
          callbackQuery.id,
          "✅ محصول به سبد خرید اضافه شد!",
          false
        );
        return;
      }

      // مدیریت سبد خرید
      if (data.startsWith("cart_")) {
        const parts = data.split("_");
        const action = parts[1];

        if (action === "inc") {
          const productId = parseInt(parts[2]);
          await Cart.add(user.id, productId, 1);
          await BotService.answerCallbackQuery(callbackQuery.id, "✅ افزایش یافت");
          return this.showCart(chatId, user.id);
        }

        if (action === "dec") {
          const productId = parseInt(parts[2]);
          await Cart.decrease(user.id, productId, 1);
          await BotService.answerCallbackQuery(callbackQuery.id, "✅ کاهش یافت");
          return this.showCart(chatId, user.id);
        }

        if (action === "del") {
          const productId = parseInt(parts[2]);
          await Cart.remove(user.id, productId);
          await BotService.answerCallbackQuery(callbackQuery.id, "🗑 حذف شد");
          return this.showCart(chatId, user.id);
        }

        if (action === "clear") {
          await Cart.clear(user.id);
          await BotService.deleteMessage(chatId, messageId);
          await BotService.answerCallbackQuery(callbackQuery.id, "🗑 سبد خرید پاک شد");
          return BotService.sendMessage(chatId, "سبد خرید شما پاک شد.", this.mainMenu());
        }
      }

      // شروع تسویه
      if (data === "checkout_start") {
        await BotService.deleteMessage(chatId, messageId);
        return this.startCheckout(chatId, user.id);
      }

      // مشاهده جزئیات سفارش
      if (data.startsWith("order_view_")) {
        const orderId = parseInt(data.split("_")[2]);
        const order = await Order.findById(orderId);
        const items = await Order.getItems(orderId);

        let message = `📦 *جزئیات سفارش ${order.id}*\n\n`;
        message += `📍 کد پیگیری: ${order.tracking_code}\n`;
        message += `📌 وضعیت: ${Helper.translateOrderStatus(order.status)}\n`;
        message += `💰 مبلغ: ${Helper.formatPrice(order.final_price)} تومان\n\n`;
        message += `📦 اقلام:\n`;
        items.forEach((item, index) => {
          message += `${index + 1}. ${item.product_name} × ${item.quantity}\n`;
        });

        return BotService.sendMessage(chatId, message);
      }

      // مدیریت سفارش توسط ادمین
      if (data.startsWith("order_confirm_")) {
        const orderId = parseInt(data.split("_")[2]);
        await Order.updateStatus(orderId, "confirmed");
        await BotService.answerCallbackQuery(callbackQuery.id, "✅ سفارش تایید شد");
        
        const order = await Order.findById(orderId);
        await BotService.sendMessage(
          order.user_id,
          `✅ سفارش #${orderId} شما تایید شد و در حال آماده‌سازی است.`
        );
        return;
      }

      if (data.startsWith("order_cancel_")) {
        const orderId = parseInt(data.split("_")[2]);
        await Order.cancel(orderId, "لغو توسط ادمین");
        await BotService.answerCallbackQuery(callbackQuery.id, "❌ سفارش لغو شد");
        
        const order = await Order.findById(orderId);
        await BotService.sendMessage(
          order.user_id,
          `❌ متاسفانه سفارش #${orderId} شما لغو شد.`
        );
        return;
      }

      if (data.startsWith("order_prepare_")) {
        const orderId = parseInt(data.split("_")[2]);
        await Order.updateStatus(orderId, "preparing");
        await BotService.answerCallbackQuery(callbackQuery.id, "📦 وضعیت به آماده‌سازی تغییر کرد");
        return;
      }

      if (data.startsWith("admin_order_")) {
        const orderId = parseInt(data.split("_")[2]);
        const order = await Order.findById(orderId);
        const items = await Order.getItems(orderId);

        let message = `📦 *سفارش #${order.id}*\n\n`;
        message += `👤 ${order.full_name}\n`;
        message += `📱 ${order.phone}\n`;
        message += `📍 ${order.address}\n`;
        message += `📌 ${Helper.translateOrderStatus(order.status)}\n`;
        message += `💰 ${Helper.formatPrice(order.final_price)}\n\n`;
        message += `اقلام:\n`;
        items.forEach((item) => {
          message += `• ${item.product_name} × ${item.quantity}\n`;
        });

        const keyboard = Helper.createInlineKeyboard([
          [
            { text: "✅ تایید", callback_data: `order_confirm_${order.id}` },
            { text: "❌ لغو", callback_data: `order_cancel_${order.id}` },
          ],
        ]);

        return BotService.sendMessage(chatId, message, keyboard);
      }

      // noop - بدون عملیات
      if (data === "noop") {
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        return;
      }

    } catch (error) {
      logger.error(`خطا در handleCallback: ${error.message}`);
      BotService.answerCallbackQuery(
        callbackQuery.id,
        "خطایی رخ داد!",
        true
      );
    }
    if (data.startsWith("admin_toggle_block_")) {
      const userId = parseInt(data.split("_")[3]);
      const user = await User.findById(userId);
      if (user.is_blocked) {
        await User.unblock(userId);
        await BotService.answerCallbackQuery(callbackQuery.id, "🟢 کاربر آنبلاک شد");
      } else {
        await User.block(userId);
        await BotService.answerCallbackQuery(callbackQuery.id, "🔴 کاربر بلاک شد");
      }
      // رفرش لیست
      const state = this.getUserState(chatId);
      await this.showUsers(chatId, state.data.page || 1);
      return;
    }

    if (data.startsWith("admin_delete_user_")) {
      const userId = parseInt(data.split("_")[3]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
      await BotService.answerCallbackQuery(callbackQuery.id, "🗑 کاربر حذف شد");
      const state = this.getUserState(chatId);
      await this.showUsers(chatId, state.data.page || 1);
      return;
    }

    if (data.startsWith("admin_delete_product_")) {
      const productId = parseInt(data.split("_")[3]);
      await Product.update(productId, { is_active: false }); // یا DELETE کامل اگر بخوای
      await BotService.answerCallbackQuery(callbackQuery.id, "🗑 محصول غیرفعال شد");
      const state = this.getUserState(chatId);
      await this.showProducts(chatId, state.data.page || 1);
      return;
    }

    if (data.startsWith("admin_users_page_")) {
      const page = parseInt(data.split("_")[3]);
      await this.showUsers(chatId, page);
      await BotService.answerCallbackQuery(callbackQuery.id, "");
      return;
    }

    if (data.startsWith("admin_products_page_")) {
      const page = parseInt(data.split("_")[3]);
      await this.showProducts(chatId, page);
      await BotService.answerCallbackQuery(callbackQuery.id, "");
      return;
    }

    if (data === "admin_back") {
      await BotService.sendMessage(chatId, "منوی ادمین:", this.adminMenu());
      await BotService.answerCallbackQuery(callbackQuery.id, "");
      return;
    }

  }
  async showUsers(chatId, page = 1) {
  try {
    const limit = 10;
    const offset = (page - 1) * limit;
    const users = await User.getAll(limit, offset);
    const total = await User.count();

    if (users.length === 0) {
      return BotService.sendMessage(chatId, "کاربری یافت نشد.");
    }

    let message = `👥 *لیست کاربران* (صفحه ${page})\n\n`;
    const keyboard = [];

    for (const user of users) {
      const status = user.is_blocked ? "🔴 بلاک شده" : "🟢 فعال";
      message += `${user.id}. ${user.first_name || "بدون نام"} (@${user.username || "بدون یوزر"})\n`;
      message += `   chat_id: ${user.chat_id} | ${status}\n\n`;

      keyboard.push([
        { text: `${user.is_blocked ? "🟢 آنبلاک" : "🔴 بلاک"} کاربر ${user.id}`, callback_data: `admin_toggle_block_${user.id}` },
        { text: `🗑 حذف کاربر ${user.id}`, callback_data: `admin_delete_user_${user.id}` },
      ]);
    }

    // صفحه‌بندی
    const nav = [];
    if (page > 1) nav.push({ text: "◀ قبلی", callback_data: `admin_users_page_${page - 1}` });
    if (users.length === limit) nav.push({ text: "بعدی ▶", callback_data: `admin_users_page_${page + 1}` });
    if (nav.length > 0) keyboard.push(nav);

    keyboard.push([{ text: "🔙 بازگشت به منوی ادمین", callback_data: "admin_back" }]);

    await BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(keyboard));
  } catch (error) {
    logger.error(`خطا در showUsers: ${error.message}`);
    await BotService.sendMessage(chatId, "خطایی رخ داد.");
  }
}

async showProducts(chatId, page = 1) {
    try {
      const products = await Product.getAll(null); // همه محصولات
      const paginated = Helper.paginate(products, page, 10);

      if (paginated.data.length === 0) {
        return BotService.sendMessage(chatId, "محصولی یافت نشد.");
      }

      let message = `📦 *لیست محصولات* (صفحه ${paginated.page}/${paginated.totalPages})\n\n`;
      const keyboard = [];

      for (const product of paginated.data) {
        const status = product.is_active ? "🟢 فعال" : "🔴 غیرفعال";
        message += `${product.id}. ${product.name}\n`;
        message += `   قیمت: ${Helper.formatPrice(product.price)} | موجودی: ${product.stock} | ${status}\n\n`;

        keyboard.push([
          { text: `🗑 حذف محصول ${product.id}`, callback_data: `admin_delete_product_${product.id}` },
        ]);
      }

      // صفحه‌بندی
      const nav = [];
      if (page > 1) nav.push({ text: "◀ قبلی", callback_data: `admin_products_page_${page - 1}` });
      if (paginated.page < paginated.totalPages) nav.push({ text: "بعدی ▶", callback_data: `admin_products_page_${page + 1}` });
      if (nav.length > 0) keyboard.push(nav);

      keyboard.push([{ text: "🔙 بازگشت به منوی ادمین", callback_data: "admin_back" }]);

      await BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(keyboard));
    } catch (error) {
      logger.error(`خطا در showProducts: ${error.message}`);
      await BotService.sendMessage(chatId, "خطایی رخ داد.");
    }
  }

}

module.exports = new BotController();
