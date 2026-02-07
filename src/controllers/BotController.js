const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const DiscountCode = require("../models/DiscountCode");
const BotService = require("../services/BotService");
const NotificationService = require("../services/NotificationService");
const Helper = require("../utils/helper");
const Validator = require("../utils/validator");
const logger = require("../utils/logger");
const config = require("../config/config");

class BotController {
  constructor() {
    this.userStates = new Map();
  }

  getUserState(chatId) {
    if (!this.userStates.has(chatId)) {
      this.userStates.set(chatId, { step: null, data: {} });
    }
    return this.userStates.get(chatId);
  }

  clearUserState(chatId) {
    this.userStates.delete(chatId);
  }

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
      [{ text: "🎁 مدیریت کدهای تخفیف" }, { text: "➕ ایجاد کد تخفیف" }],
      [{ text: "📢 ارسال پیام همگانی" }],
      [{ text: "🔙 برگشت به منوی کاربر" }],
    ]);
  }

  async handleMessage(message) {
    try {
      const chatId = message.from.id;
      const text = message.text;
      const userInfo = Helper.getUserInfo(message);
      
      const user = await User.getOrCreate(chatId, userInfo);

      if (user.is_blocked) {
        return BotService.sendMessage(
          chatId,
          "❌ شما از استفاده از این ربات محروم شده‌اید."
        );
      }

      // دستورات ادمین
      if (String(chatId) === String(config.bot.adminChatId)) {
        if (text === "/admin") {
          this.clearUserState(chatId);
          return BotService.sendMessage(chatId, "👑 پنل مدیریت", this.adminMenu());
        }
        
        if (text === "📊 آمار کلی") return this.showStats(chatId);
        if (text === "📋 مدیریت سفارش‌ها") return this.manageOrders(chatId);
        if (text === "👥 مدیریت کاربران") return this.showUsersList(chatId);
        if (text === "📦 مدیریت محصولات") return this.showProductsList(chatId);
        if (text === "➕ افزودن محصول") return this.startAddProduct(chatId);
        
        if (text === "🔙 برگشت به منوی کاربر") {
          this.clearUserState(chatId);
          return BotService.sendMessage(chatId, "منوی اصلی:", this.mainMenu());
        }

        // مدیریت کدهای تخفیف
        if (text === "🎁 مدیریت کدهای تخفیف") {
          return this.showDiscountCodes(chatId);
        }

        // ایجاد کد تخفیف
        if (text === "➕ ایجاد کد تخفیف") {
          return this.startCreateDiscount(chatId);
        }

        // ارسال پیام همگانی
        if (text === "📢 ارسال پیام همگانی") {
          const state = this.getUserState(chatId);
          state.step = "broadcast_message";
          return BotService.sendMessage(
            chatId,
            "📢 *ارسال پیام همگانی*\n\nمتن پیام خود را برای ارسال به همه کاربران وارد کنید:"
          );
        }
      }

      // دستورات عمومی
      if (text === "/start") {
        this.clearUserState(chatId);
        return BotService.sendMessage(
          chatId,
          `سلام ${message.from.first_name || "کاربر عزیز"} 👋\n\nبه ${config.shop.name} خوش اومدی!\n\n🛍 از منوی زیر برای شروع خرید استفاده کن:`,
          this.mainMenu()
        );
      }

      if (text === "🛍 محصولات") return this.showCategories(chatId);
      if (text === "🛒 سبد خرید") return this.showCart(chatId, user.id);
      if (text === "📦 سفارش‌های من") return this.showUserOrders(chatId, user.id);
      
      if (text === "🔍 پیگیری سفارش") {
        this.userStates.set(chatId, { step: "track_order" });
        return BotService.sendMessage(
          chatId,
          "📦 لطفاً کد پیگیری سفارش خود را وارد کنید:\n(مثل TR-XXXXXXXXXX-XXXXXX)"
        );
      }

      if (text === "ℹ️ درباره ما") return this.showAbout(chatId);
      if (text === "☎️ پشتیبانی") return this.showSupport(chatId);

      const state = this.getUserState(chatId);
      if (state.step === "track_order") {
        const order = await Order.findByTrackingCode(text.trim().toUpperCase());
        
        if (!order) {
          return BotService.sendMessage(chatId, "❌ کد پیگیری نامعتبر است. لطفاً دوباره امتحان کنید.");
        }

        const items = await Order.getItems(order.id);

        let message = `📦 *سفارش #${order.id}*\n\n`;
        message += `کد پیگیری: ${order.tracking_code}\n`;
        message += `وضعیت: ${Helper.translateOrderStatus(order.status)}\n`;
        message += `پرداخت: ${Helper.translatePaymentStatus(order.payment_status)}\n`;
        message += `مبلغ نهایی: ${Helper.formatPrice(order.final_price)} تومان\n`;
        message += `تاریخ: ${Helper.toJalali(order.created_at)}\n\n`;
        message += `📋 اقلام سفارش:\n`;
        items.forEach((item, index) => {
          message += `${index + 1}. ${item.product_name} × ${item.quantity}\n`;
          const itemPrice = item.discount_price || item.price;
          message += `   قیمت: ${Helper.formatPrice(itemPrice * item.quantity)} تومان\n`;
        });

        if (order.customer_notes) {
          message += `\n📝 یادداشت مشتری: ${order.customer_notes}`;
        }

        this.clearUserState(chatId); // پاک کردن state بعد از نمایش
        return BotService.sendMessage(chatId, message, this.mainMenu());
      }

      if (state.step === "checkout_name") {
        if (!Validator.isValidName(text)) {
          return BotService.sendMessage(chatId, "❌ نام معتبر نیست. دوباره وارد کنید:");
        }
        state.data.full_name = Validator.sanitizeText(text);
        state.step = "checkout_phone";
        return BotService.sendMessage(chatId, "📱 شماره تماس:\n(مثال: 09123456789)");
      }

      if (state.step === "checkout_phone") {
        const phone = Validator.formatPhone(text);
        if (!Validator.isValidPhone(phone)) {
          return BotService.sendMessage(chatId, "❌ شماره تلفن نامعتبر:");
        }
        state.data.phone = phone;
        state.step = "checkout_address";
        return BotService.sendMessage(chatId, "📍 آدرس کامل:");
      }

      if (state.step === "checkout_address") {
        if (!Validator.isValidAddress(text)) {
          return BotService.sendMessage(chatId, "❌ آدرس باید حداقل 10 کاراکتر باشد:");
        }
        state.data.address = Validator.sanitizeText(text);
        state.step = "checkout_postal";
        return BotService.sendMessage(chatId, "📮 کد پستی 10 رقمی:\n(یا 0 برای رد کردن)");
      }

      if (state.step === "checkout_postal") {
        const postal = text === "0" ? null : text;
        if (postal && !Validator.isValidPostalCode(postal)) {
          return BotService.sendMessage(chatId, "❌ کد پستی باید 10 رقم باشد:");
        }
        state.data.postal_code = postal;
        return this.completeCheckout(chatId, user.id, state.data);
      }

      // ورود کد تخفیف
      if (state.step === "enter_discount") {
        return this.applyDiscountCode(chatId, user.id, text);
      }

      // ارسال پیام همگانی (ادمین)
      if (String(chatId) === String(config.bot.adminChatId)) {
        if (state.step === "broadcast_message") {
          return this.sendBroadcast(chatId, text);
        }

        // ایجاد کد تخفیف
        if (state.step === "create_discount_code") {
          state.data.code = Validator.sanitizeText(text).toUpperCase();
          state.step = "create_discount_type";
          return BotService.sendMessage(
            chatId,
            `کد: ${state.data.code}\n\nنوع تخفیف را انتخاب کنید:\n\n1. درصدی (percentage)\n2. ثابت (fixed)\n\nعدد 1 یا 2 را ارسال کنید:`
          );
        }

        if (state.step === "create_discount_type") {
          const type = text === "1" ? "percentage" : text === "2" ? "fixed" : null;
          if (!type) {
            return BotService.sendMessage(chatId, "❌ فقط عدد 1 یا 2:");
          }
          state.data.discount_type = type;
          state.step = "create_discount_value";
          return BotService.sendMessage(
            chatId,
            `نوع: ${type === "percentage" ? "درصدی" : "ثابت"}\n\nمقدار تخفیف:\n${type === "percentage" ? "(عدد بین 1 تا 100)" : "(مبلغ به تومان)"}`
          );
        }

        if (state.step === "create_discount_value") {
          const value = parseFloat(text);
          if (!Validator.isValidPrice(value)) {
            return BotService.sendMessage(chatId, "❌ مقدار نامعتبر:");
          }
          state.data.discount_value = value;
          state.step = "create_discount_min";
          return BotService.sendMessage(chatId, "حداقل خرید (به تومان):\n(یا 0 برای بدون محدودیت)");
        }

        if (state.step === "create_discount_min") {
          const min = parseInt(text);
          state.data.min_purchase = min <= 0 ? 0 : min;
          state.step = "create_discount_limit";
          return BotService.sendMessage(chatId, "تعداد استفاده مجاز:\n(یا 0 برای نامحدود)");
        }

        if (state.step === "create_discount_limit") {
          const limit = parseInt(text);
          state.data.usage_limit = limit <= 0 ? null : limit;
          state.step = "create_discount_desc";
          return BotService.sendMessage(chatId, "توضیحات کد تخفیف:\n(یا 0 برای رد کردن)");
        }

        if (state.step === "create_discount_desc") {
          state.data.description = text === "0" ? null : Validator.sanitizeText(text);
          return this.saveDiscountCode(chatId, state.data);
        }
      }

      // افزودن محصول (ادمین)
      if (String(chatId) === String(config.bot.adminChatId)) {
        if (state.step === "add_product_category") {
          return this.selectCategoryForProduct(chatId, parseInt(text));
        }
        if (state.step === "add_product_name") {
          state.data.name = Validator.sanitizeText(text);
          state.step = "add_product_price";
          return BotService.sendMessage(chatId, "💰 قیمت محصول (به تومان):");
        }
        if (state.step === "add_product_price") {
          const price = parseInt(text);
          if (!Validator.isValidPrice(price)) {
            return BotService.sendMessage(chatId, "❌ قیمت نامعتبر:");
          }
          state.data.price = price;
          state.step = "add_product_stock";
          return BotService.sendMessage(chatId, "📦 موجودی محصول:");
        }
        if (state.step === "add_product_stock") {
          const stock = parseInt(text);
          if (!Validator.isValidQuantity(stock)) {
            return BotService.sendMessage(chatId, "❌ موجودی نامعتبر:");
          }
          state.data.stock = stock;
          state.step = "add_product_description";
          return BotService.sendMessage(chatId, "📝 توضیحات محصول:\n(یا 0 برای رد کردن)");
        }
        if (state.step === "add_product_description") {
          state.data.description = text === "0" ? null : Validator.sanitizeText(text);
          state.step = "add_product_image";
          return BotService.sendMessage(chatId, "🖼 لینک عکس محصول:\n(یا 0 برای بدون عکس)");
        }
        if (state.step === "add_product_image") {
          state.data.image_url = text === "0" ? null : text.trim();
          return this.saveProduct(chatId, state.data);
        }
      }

      return BotService.sendMessage(
        chatId,
        "متوجه نشدم 🤔\nلطفاً از منو استفاده کنید.",
        this.mainMenu()
      );
    } catch (error) {
      logger.error(`خطا در handleMessage: ${error.message}`);
      return BotService.sendMessage(
        message.from.id,
        "❌ خطایی رخ داد."
      );
    }
  }

  async showCategories(chatId) {
    try {
      const categories = await Category.getAll();
      
      if (categories.length === 0) {
        return BotService.sendMessage(chatId, "هیچ دسته‌بندی‌ای موجود نیست.");
      }

      const buttons = categories.map((cat) => [
        { text: `${cat.icon || "📂"} ${cat.title}`, callback_data: `cat_${cat.id}` },
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

  async showProducts(chatId, categoryId) {
    try {
      const products = await Product.findByCategory(categoryId);

      if (products.length === 0) {
        return BotService.sendMessage(
          chatId,
          "این دسته محصولی ندارد 😅",
          Helper.createInlineKeyboard([[{ text: "🔙 برگشت", callback_data: "back_main" }]])
        );
      }

      for (const product of products) {
        const price = product.discount_price || product.price;
        const discountPercent = Helper.calculateDiscountPercent(product.price, product.discount_price);
        
        let caption = `🛍 ${product.name}\n\n`;
        
        if (product.description) {
          caption += `📝 ${Helper.truncate(product.description, 150)}\n\n`;
        }

        if (discountPercent > 0) {
          caption += `💰 قیمت: ${Helper.formatPrice(price)} ${config.shop.currency}\n`;
          caption += `🔥 ${discountPercent}٪ تخفیف!\n\n`;
        } else {
          caption += `💰 قیمت: ${Helper.formatPrice(price)} ${config.shop.currency}\n\n`;
        }

        caption += `📦 موجودی: ${product.stock > 0 ? product.stock : "ناموجود"}`;

        const keyboard = Helper.createInlineKeyboard([
          product.stock > 0
            ? [{ text: "➕ افزودن به سبد", callback_data: `addcart_${product.id}` }]
            : [{ text: "❌ ناموجود", callback_data: "noop" }],
        ]);

        if (product.image_url && product.image_url.startsWith('http')) {
          await BotService.sendPhoto(chatId, product.image_url, caption, keyboard);
        } else {
          await BotService.sendMessage(chatId, caption, keyboard);
        }

        await Helper.sleep(300);
      }
    } catch (error) {
      logger.error(`خطا در showProducts: ${error.message}`);
      throw error;
    }
  }

  async showCart(chatId, userId) {
    try {
      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        return BotService.sendMessage(
          chatId,
          "🛒 سبد خرید خالیست!\n\nبرای خرید از منوی محصولات استفاده کنید.",
          this.mainMenu()
        );
      }

      let message = "🛒 *سبد خرید:*\n\n";
      
      cartData.items.forEach((item, index) => {
        const price = item.discount_price || item.price;
        const totalPrice = price * item.quantity;
        message += `${index + 1}. ${item.name}\n`;
        message += `   💰 ${Helper.formatPrice(price)} × ${item.quantity} = ${Helper.formatPrice(totalPrice)}\n\n`;
      });

      message += `\n💵 *جمع:* ${Helper.formatPrice(cartData.total)} ${config.shop.currency}\n`;

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

      // دکمه کد تخفیف
      buttons.push([{ text: "🎁 کد تخفیف دارید؟", callback_data: "apply_discount" }]);
      buttons.push([{ text: "🗑 پاک کردن سبد", callback_data: "cart_clear" }]);
      buttons.push([{ text: "✅ تکمیل خرید", callback_data: "checkout_start" }]);

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در showCart: ${error.message}`);
      throw error;
    }
  }

  async startCheckout(chatId, userId) {
    try {
      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        return BotService.sendMessage(chatId, "سبد خرید خالیست!");
      }

      const state = this.getUserState(chatId);
      state.step = "checkout_name";
      state.data = {};

      return BotService.sendMessage(chatId, "✅ ثبت سفارش\n\n👤 نام و نام خانوادگی:");
    } catch (error) {
      logger.error(`خطا در startCheckout: ${error.message}`);
      throw error;
    }
  }

  async completeCheckout(chatId, userId, orderData) {
    try {
      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        this.clearUserState(chatId);
        return BotService.sendMessage(chatId, "سبد خرید خالیست!");
      }

      // دریافت اطلاعات تخفیف از state
      const state = this.getUserState(chatId);
      const discountCode = state.data.discount_code;
      const discountAmount = state.data.discount_amount || 0;

      // ایجاد سفارش با تخفیف
      const orderId = await Order.create(userId, {
        ...orderData,
        total_price: cartData.total,
        discount_amount: discountAmount,
        items: cartData.items,
      });

      const order = await Order.findById(orderId);

      // ثبت استفاده از کد تخفیف
      if (discountCode) {
        await DiscountCode.recordUsage(discountCode.id, userId, orderId);
      }

      this.clearUserState(chatId);

      // ارسال اعلان به کاربر
      await NotificationService.orderCreated(order, cartData.items);

      // ارسال اعلان به ادمین
      await NotificationService.newOrderToAdmin(order, cartData.items);

      // پاک کردن سبد خرید
      await Cart.clear(userId);

      return order;
    } catch (error) {
      logger.error(`خطا در completeCheckout: ${error.message}`);
      this.clearUserState(chatId);
      return BotService.sendMessage(chatId, `❌ خطا: ${error.message}`, this.mainMenu());
    }
  }

  async trackOrder(chatId, input) {
    try {
      this.clearUserState(chatId);

      const orderId = parseInt(input);
      if (isNaN(orderId)) {
        return BotService.sendMessage(chatId, "❌ شماره نامعتبر.");
      }

      const order = await Order.findById(orderId);

      if (!order) {
        return BotService.sendMessage(chatId, "❌ سفارش پیدا نشد.", this.mainMenu());
      }

      const items = await Order.getItems(orderId);

      let message = `📦 *سفارش ${order.id}*\n\n`;
      message += `📍 کد: ${order.tracking_code}\n`;
      message += `📌 وضعیت: ${Helper.translateOrderStatus(order.status)}\n`;
      message += `💰 مبلغ: ${Helper.formatPrice(order.final_price)}\n`;
      message += `📅 ${Helper.toJalali(order.created_at)}\n\n`;
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

  async showUserOrders(chatId, userId) {
    try {
      const orders = await Order.findByUser(userId, 10);

      if (orders.length === 0) {
        return BotService.sendMessage(chatId, "هنوز سفارشی ثبت نکردید.", this.mainMenu());
      }

      let message = "📦 *سفارش‌های شما:*\n\n";

      orders.forEach((order, index) => {
        message += `${index + 1}. #${order.id}\n`;
        message += `   📌 ${Helper.translateOrderStatus(order.status)}\n`;
        message += `   💰 ${Helper.formatPrice(order.final_price)}\n`;
        message += `   📅 ${Helper.toJalali(order.created_at)}\n\n`;
      });

      const buttons = orders.map((order) => [
        { text: `جزئیات #${order.id}`, callback_data: `order_view_${order.id}` },
      ]);

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در showUserOrders: ${error.message}`);
      throw error;
    }
  }

  async showAbout(chatId) {
    const message = `ℹ️ *درباره ${config.shop.name}*\n\nفروشگاه آنلاین با بهترین کیفیت و قیمت`;
    return BotService.sendMessage(chatId, message, this.mainMenu());
  }

  async showSupport(chatId) {
    const message = `☎️ *پشتیبانی*\n\n📱 @moha_st\n📧 sumohast@gmail.com`;
    return BotService.sendMessage(chatId, message, this.mainMenu());
  }

  // اعمال کد تخفیف
  async applyDiscountCode(chatId, userId, code) {
    try {
      this.clearUserState(chatId);

      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        return BotService.sendMessage(chatId, "سبد خرید خالیست!", this.mainMenu());
      }

      // اعتبارسنجی کد تخفیف
      const result = await DiscountCode.validate(code, userId, cartData.total);

      if (!result.valid) {
        await BotService.sendMessage(chatId, result.message);
        return this.showCart(chatId, userId);
      }

      // ذخیره کد تخفیف در state کاربر
      const state = this.getUserState(chatId);
      state.data.discount_code = result.discount;
      state.data.discount_amount = result.discountAmount;

      // نمایش سبد با تخفیف
      const afterDiscount = cartData.total - result.discountAmount;
      const tax = Helper.calculateTax(afterDiscount);
      const finalPrice = afterDiscount + tax;

      let message = `✅ ${result.message}\n\n`;
      message += `🛒 *سبد خرید با تخفیف:*\n\n`;

      cartData.items.forEach((item, index) => {
        const price = item.discount_price || item.price;
        message += `${index + 1}. ${item.name} × ${item.quantity}\n`;
      });

      message += `\n💰 جمع: ${Helper.formatPrice(cartData.total)} تومان\n`;
      message += `🎁 تخفیف: ${Helper.formatPrice(result.discountAmount)} تومان\n`;
      message += `📊 مالیات: ${Helper.formatPrice(tax)} تومان\n`;
      message += `💵 *مبلغ نهایی: ${Helper.formatPrice(finalPrice)} تومان*\n`;

      const keyboard = Helper.createInlineKeyboard([
        [{ text: "🗑 حذف کد تخفیف", callback_data: "remove_discount" }],
        [{ text: "✅ تکمیل خرید", callback_data: "checkout_start" }],
        [{ text: "🔙 بازگشت به سبد", callback_data: "back_to_cart" }],
      ]);

      return BotService.sendMessage(chatId, message, keyboard);
    } catch (error) {
      logger.error(`خطا در applyDiscountCode: ${error.message}`);
      return BotService.sendMessage(chatId, "❌ خطا در اعمال کد تخفیف");
    }
  }

  async showStats(chatId) {
    try {
      const userStats = await User.getStats();
      const orderStats = await Order.getStats();
      const productStats = await Product.getStats();

      let message = `📊 *آمار سیستم*\n\n`;
      message += `👥 کاربران: ${userStats.total}\n`;
      message += `📦 سفارشات: ${orderStats.total}\n`;
      message += `💰 درآمد: ${Helper.formatPrice(orderStats.revenue)}\n`;
      message += `🛍 محصولات: ${productStats.total}\n`;

      return BotService.sendMessage(chatId, message, this.adminMenu());
    } catch (error) {
      logger.error(`خطا در showStats: ${error.message}`);
      throw error;
    }
  }

  async manageOrders(chatId) {
    try {
      const orders = await Order.getAll({}, 10);

      if (orders.length === 0) {
        return BotService.sendMessage(chatId, "سفارشی ثبت نشده.");
      }

      let message = "📋 *سفارش‌های اخیر:*\n\n";

      orders.forEach((order, index) => {
        message += `${index + 1}. #${order.id} - ${order.full_name}\n`;
        message += `   ${Helper.translateOrderStatus(order.status)} - ${Helper.formatPrice(order.final_price)}\n\n`;
      });

      const buttons = orders.map((order) => [
        { text: `#${order.id} - ${order.full_name}`, callback_data: `admin_order_${order.id}` },
      ]);

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در manageOrders: ${error.message}`);
      throw error;
    }
  }

  async showUsersList(chatId) {
    try {
      const users = await User.getAll(10);
      const stats = await User.getStats();

      let message = `👥 *کاربران (کل: ${stats.total})*\n\n`;

      users.forEach((user, index) => {
        const status = user.is_blocked ? "🔴" : "🟢";
        message += `${index + 1}. ${status} ${user.first_name || "بدون نام"} (${user.chat_id})\n`;
      });

      return BotService.sendMessage(chatId, message, this.adminMenu());
    } catch (error) {
      logger.error(`خطا در showUsersList: ${error.message}`);
      throw error;
    }
  }

  async showProductsList(chatId) {
    try {
      const products = await Product.getAll();
      const limited = products.slice(0, 10);

      let message = `📦 *محصولات (کل: ${products.length})*\n\n`;

      limited.forEach((product, index) => {
        const status = product.is_active ? "🟢" : "🔴";
        message += `${index + 1}. ${status} ${product.name}\n`;
        message += `   موجودی: ${product.stock} - قیمت: ${Helper.formatPrice(product.price)}\n\n`;
      });

      return BotService.sendMessage(chatId, message, this.adminMenu());
    } catch (error) {
      logger.error(`خطا در showProductsList: ${error.message}`);
      throw error;
    }
  }

  async startAddProduct(chatId) {
    try {
      const categories = await Category.getAll();
      
      if (categories.length === 0) {
        return BotService.sendMessage(chatId, "ابتدا باید دسته‌بندی ایجاد کنید!");
      }

      const state = this.getUserState(chatId);
      state.step = "add_product_category";
      state.data = {};

      let message = "➕ *افزودن محصول*\n\nدسته‌بندی:\n\n";
      categories.forEach((cat, index) => {
        message += `${index + 1}. ${cat.title}\n`;
      });
      message += "\nشماره دسته:";

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
        return BotService.sendMessage(chatId, "❌ دسته نامعتبر!");
      }

      const state = this.getUserState(chatId);
      state.data.category_id = selectedCategory.id;
      state.step = "add_product_name";

      return BotService.sendMessage(chatId, `✅ دسته: ${selectedCategory.title}\n\nنام محصول:`);
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
        `✅ محصول اضافه شد!\n\n🆔 ${productId}\n📦 ${productData.name}`,
        this.adminMenu()
      );
    } catch (error) {
      logger.error(`خطا در saveProduct: ${error.message}`);
      this.clearUserState(chatId);
      return BotService.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // نمایش کدهای تخفیف (ادمین)
  async showDiscountCodes(chatId) {
    try {
      const codes = await DiscountCode.getActive();

      if (codes.length === 0) {
        return BotService.sendMessage(chatId, "هیچ کد تخفیفی موجود نیست.", this.adminMenu());
      }

      let message = `🎁 *کدهای تخفیف فعال:*\n\n`;

      codes.forEach((code, index) => {
        message += `${index + 1}. کد: *${code.code}*\n`;
        if (code.discount_type === "percentage") {
          message += `   💰 ${code.discount_value}٪ تخفیف\n`;
        } else {
          message += `   💰 ${Helper.formatPrice(code.discount_value)} تومان\n`;
        }
        message += `   📊 استفاده: ${code.used_count}`;
        if (code.usage_limit) {
          message += ` / ${code.usage_limit}`;
        }
        message += `\n\n`;
      });

      const buttons = codes.slice(0, 10).map((code) => [
        { text: `🗑 حذف ${code.code}`, callback_data: `delete_discount_${code.id}` },
      ]);

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در showDiscountCodes: ${error.message}`);
      throw error;
    }
  }

  // شروع ایجاد کد تخفیف
  async startCreateDiscount(chatId) {
    const state = this.getUserState(chatId);
    state.step = "create_discount_code";
    state.data = {};
    return BotService.sendMessage(chatId, "➕ *ایجاد کد تخفیف*\n\nکد تخفیف را وارد کنید:\n(فقط حروف انگلیسی و اعداد)");
  }

  // ذخیره کد تخفیف
  async saveDiscountCode(chatId, data) {
    try {
      const id = await DiscountCode.create(data);
      this.clearUserState(chatId);

      let message = `✅ کد تخفیف ایجاد شد!\n\n`;
      message += `🎁 کد: ${data.code}\n`;
      message += `💰 ${data.discount_type === "percentage" ? data.discount_value + "٪" : Helper.formatPrice(data.discount_value) + " تومان"}\n`;
      if (data.min_purchase > 0) {
        message += `📊 حداقل خرید: ${Helper.formatPrice(data.min_purchase)}\n`;
      }

      await BotService.sendMessage(chatId, message, this.adminMenu());

      // اعلان به همه کاربران (اختیاری)
      const keyboard = Helper.createInlineKeyboard([
        [
          { text: "✅ بله", callback_data: `announce_discount_${id}` },
          { text: "❌ خیر", callback_data: "noop" },
        ],
      ]);

      return BotService.sendMessage(
        chatId,
        "آیا می‌خواهید این کد را به همه کاربران اعلام کنید؟",
        keyboard
      );
    } catch (error) {
      logger.error(`خطا در saveDiscountCode: ${error.message}`);
      this.clearUserState(chatId);
      return BotService.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // ارسال پیام همگانی
  async sendBroadcast(chatId, message) {
    try {
      this.clearUserState(chatId);

      const users = await User.getAll(10000);

      await BotService.sendMessage(chatId, `📢 در حال ارسال به ${users.length} کاربر...`);

      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await BotService.sendMessage(user.chat_id, message);
          successCount++;
          await Helper.sleep(100); // جلوگیری از flood
        } catch (error) {
          failCount++;
          logger.warn(`خطا در ارسال به ${user.chat_id}: ${error.message}`);
        }
      }

      return BotService.sendMessage(
        chatId,
        `✅ ارسال کامل شد!\n\n✅ موفق: ${successCount}\n❌ ناموفق: ${failCount}`,
        this.adminMenu()
      );
    } catch (error) {
      logger.error(`خطا در sendBroadcast: ${error.message}`);
      return BotService.sendMessage(chatId, "❌ خطا در ارسال پیام همگانی");
    }
  }

  // نمایش محصولات پیشرفته (با دکمه حذف)
  async showProductsListAdvanced(chatId) {
    try {
      const products = await Product.getAll();
      const limited = products.slice(0, 15);

      let message = `📦 *محصولات (${products.length})*\n\n`;

      limited.forEach((product, index) => {
        const status = product.is_active ? "🟢" : "🔴";
        message += `${index + 1}. ${status} ${product.name}\n`;
        message += `   💰 ${Helper.formatPrice(product.price)} | 📦 ${product.stock}\n`;
      });

      const buttons = limited.map((product) => [
        { 
          text: `${product.is_active ? "❌ غیرفعال" : "✅ فعال"} ${product.name.substring(0, 20)}`, 
          callback_data: product.is_active ? `deactivate_product_${product.id}` : `activate_product_${product.id}` 
        },
        { 
          text: `🗑 حذف کامل`, 
          callback_data: `delete_product_${product.id}` 
        },
      ]);

      buttons.push([{ text: "🔙 بازگشت", callback_data: "admin_back" }]);

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در showProductsListAdvanced: ${error.message}`);
      throw error;
    }
  }

  async handleCallback(callbackQuery) {
    try {
      const chatId = callbackQuery.from.id;
      const callbackData = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;

      const user = await User.findByChatId(chatId);

      if (!user) {
        return BotService.answerCallbackQuery(callbackQuery.id, "کاربر یافت نشد!", true);
      }

      // برگشت به منو
      if (callbackData === "back_main") {
        await BotService.deleteMessage(chatId, messageId);
        return this.showCategories(chatId);
      }

      // نمایش محصولات
      if (callbackData.startsWith("cat_")) {
        const categoryId = parseInt(callbackData.split("_")[1]);
        await BotService.deleteMessage(chatId, messageId);
        return this.showProducts(chatId, categoryId);
      }

      // افزودن به سبد
      if (callbackData.startsWith("addcart_")) {
        const productId = parseInt(callbackData.split("_")[1]);
        await Cart.add(user.id, productId, 1);
        await BotService.answerCallbackQuery(callbackQuery.id, "✅ اضافه شد!");
        return;
      }

      // مدیریت سبد
      if (callbackData.startsWith("cart_")) {
        const parts = callbackData.split("_");
        const action = parts[1];

        if (action === "inc") {
          const productId = parseInt(parts[2]);
          await Cart.add(user.id, productId, 1);
          await BotService.answerCallbackQuery(callbackQuery.id, "✅");
          return this.showCart(chatId, user.id);
        }

        if (action === "dec") {
          const productId = parseInt(parts[2]);
          await Cart.decrease(user.id, productId, 1);
          await BotService.answerCallbackQuery(callbackQuery.id, "✅");
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
          await BotService.answerCallbackQuery(callbackQuery.id, "🗑 پاک شد");
          return BotService.sendMessage(chatId, "سبد خرید پاک شد.", this.mainMenu());
        }
      }

      // شروع تسویه
      if (callbackData === "checkout_start") {
        await BotService.deleteMessage(chatId, messageId);
        return this.startCheckout(chatId, user.id);
      }

      // درخواست کد تخفیف
      if (callbackData === "apply_discount") {
        const state = this.getUserState(chatId);
        state.step = "enter_discount";
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        return BotService.sendMessage(chatId, "🎁 کد تخفیف خود را وارد کنید:");
      }

      // حذف کد تخفیف
      if (callbackData === "remove_discount") {
        const state = this.getUserState(chatId);
        state.data.discount_code = null;
        state.data.discount_amount = 0;
        await BotService.answerCallbackQuery(callbackQuery.id, "🗑 کد تخفیف حذف شد");
        await BotService.deleteMessage(chatId, messageId);
        return this.showCart(chatId, user.id);
      }

      // بازگشت به سبد
      if (callbackData === "back_to_cart") {
        const state = this.getUserState(chatId);
        state.data.discount_code = null;
        state.data.discount_amount = 0;
        await BotService.deleteMessage(chatId, messageId);
        return this.showCart(chatId, user.id);
      }

      // مشاهده سفارش
      if (callbackData.startsWith("order_view_")) {
        const orderId = parseInt(callbackData.split("_")[2]);
        const order = await Order.findById(orderId);
        const items = await Order.getItems(orderId);

        let message = `📦 *سفارش ${order.id}*\n\n`;
        message += `📍 ${order.tracking_code}\n`;
        message += `📌 ${Helper.translateOrderStatus(order.status)}\n`;
        message += `💰 ${Helper.formatPrice(order.final_price)}\n\n`;
        message += `اقلام:\n`;
        items.forEach((item) => {
          message += `• ${item.product_name} × ${item.quantity}\n`;
        });

        return BotService.sendMessage(chatId, message);
      }

      // مدیریت سفارش (ادمین)
      if (callbackData.startsWith("order_confirm_")) {
        const orderId = parseInt(callbackData.split("_")[2]);
        await Order.updateStatus(orderId, "confirmed");
        await BotService.answerCallbackQuery(callbackQuery.id, "✅ تایید شد");
        
        const order = await Order.findById(orderId);
        await NotificationService.orderConfirmed(order);
        return;
      }

      if (callbackData.startsWith("order_cancel_")) {
        const orderId = parseInt(callbackData.split("_")[2]);
        await Order.cancel(orderId, "لغو توسط ادمین");
        await BotService.answerCallbackQuery(callbackQuery.id, "❌ لغو شد");
        
        const order = await Order.findById(orderId);
        await NotificationService.orderCancelled(order, "لغو توسط ادمین");
        return;
      }

      if (callbackData.startsWith("order_prepare_")) {
        const orderId = parseInt(callbackData.split("_")[2]);
        await Order.updateStatus(orderId, "preparing");
        await BotService.answerCallbackQuery(callbackQuery.id, "📦 در حال آماده‌سازی");
        
        const order = await Order.findById(orderId);
        await NotificationService.orderPreparing(order);
        return;
      }

      if (callbackData.startsWith("order_ship_")) {
        const orderId = parseInt(callbackData.split("_")[2]);
        await Order.updateStatus(orderId, "shipped");
        await BotService.answerCallbackQuery(callbackQuery.id, "🚚 ارسال شد");
        
        const order = await Order.findById(orderId);
        await NotificationService.orderShipped(order);
        return;
      }

      if (callbackData.startsWith("order_deliver_")) {
        const orderId = parseInt(callbackData.split("_")[2]);
        await Order.updateStatus(orderId, "delivered");
        await BotService.answerCallbackQuery(callbackQuery.id, "✅ تحویل داده شد");
        
        const order = await Order.findById(orderId);
        await NotificationService.orderDelivered(order);
        return;
      }

      if (callbackData.startsWith("admin_order_")) {
        const orderId = parseInt(callbackData.split("_")[2]);
        const order = await Order.findById(orderId);
        const items = await Order.getItems(orderId);

        let message = `📦 *سفارش #${order.id}*\n\n`;
        message += `👤 ${order.full_name}\n`;
        message += `📱 ${order.phone}\n`;
        message += `📍 ${order.address}\n`;
        if (order.postal_code) message += `📮 ${order.postal_code}\n`;
        message += `📌 وضعیت: ${Helper.translateOrderStatus(order.status)}\n`;
        message += `💰 ${Helper.formatPrice(order.final_price)} تومان\n\n`;
        message += `📦 اقلام:\n`;
        items.forEach((item) => {
          message += `• ${item.product_name} × ${item.quantity}\n`;
        });

        const keyboard = Helper.createInlineKeyboard([
          [
            { text: "✅ تایید", callback_data: `order_confirm_${order.id}` },
            { text: "❌ لغو", callback_data: `order_cancel_${order.id}` },
          ],
          [
            { text: "📦 آماده‌سازی", callback_data: `order_prepare_${order.id}` },
            { text: "🚚 ارسال شد", callback_data: `order_ship_${order.id}` },
          ],
          [
            { text: "✅ تحویل داده شد", callback_data: `order_deliver_${order.id}` },
          ],
        ]);

        return BotService.sendMessage(chatId, message, keyboard);
      }

      // noop
      if (callbackData === "noop") {
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        return;
      }

      // حذف/فعال‌سازی محصول (ادمین)
      if (callbackData.startsWith("deactivate_product_")) {
        const productId = parseInt(callbackData.split("_")[2]);
        await Product.update(productId, { is_active: false });
        await BotService.answerCallbackQuery(callbackQuery.id, "❌ محصول غیرفعال شد");
        await BotService.deleteMessage(chatId, messageId);
        return this.showProductsListAdvanced(chatId);
      }

      if (callbackData.startsWith("activate_product_")) {
        const productId = parseInt(callbackData.split("_")[2]);
        await Product.update(productId, { is_active: true });
        await BotService.answerCallbackQuery(callbackQuery.id, "✅ محصول فعال شد");
        await BotService.deleteMessage(chatId, messageId);
        return this.showProductsListAdvanced(chatId);
      }

      // حذف کامل محصول با تایید
      if (callbackData.startsWith("delete_product_")) {
        const productId = parseInt(callbackData.split("_")[2]);
        const product = await Product.findById(productId);

        const keyboard = Helper.createInlineKeyboard([
          [
            { text: "✅ بله، حذف شود", callback_data: `confirm_delete_product_${productId}` },
            { text: "❌ خیر", callback_data: "cancel_delete" },
          ],
        ]);

        await BotService.answerCallbackQuery(callbackQuery.id, "");
        await BotService.deleteMessage(chatId, messageId);
        
        return BotService.sendMessage(
          chatId,
          `⚠️ *هشدار!*\n\nآیا مطمئن هستید که می‌خواهید محصول "${product.name}" را *کاملاً حذف* کنید؟\n\n⚠️ این عملیات غیرقابل بازگشت است!\n\n💡 توصیه: بهتر است محصول را غیرفعال کنید تا داده‌های سفارشات قبلی حفظ شود.`,
          keyboard
        );
      }

      // تایید حذف محصول
      if (callbackData.startsWith("confirm_delete_product_")) {
        const productId = parseInt(callbackData.split("_")[3]);
        const product = await Product.findById(productId);
        
        await Product.hardDelete(productId);
        await BotService.answerCallbackQuery(callbackQuery.id, "🗑 محصول حذف شد");
        await BotService.deleteMessage(chatId, messageId);
        
        await BotService.sendMessage(
          chatId,
          `✅ محصول "${product.name}" به طور کامل حذف شد.`,
          this.adminMenu()
        );
        
        return this.showProductsListAdvanced(chatId);
      }

      // لغو حذف
      if (callbackData === "cancel_delete") {
        await BotService.answerCallbackQuery(callbackQuery.id, "❌ لغو شد");
        await BotService.deleteMessage(chatId, messageId);
        return this.showProductsListAdvanced(chatId);
      }

      // حذف کد تخفیف (ادمین)
      if (callbackData.startsWith("delete_discount_")) {
        const discountId = parseInt(callbackData.split("_")[2]);
        await DiscountCode.deactivate(discountId);
        await BotService.answerCallbackQuery(callbackQuery.id, "🗑 کد تخفیف حذف شد");
        await BotService.deleteMessage(chatId, messageId);
        return this.showDiscountCodes(chatId);
      }

      // اعلان کد تخفیف جدید
      if (callbackData.startsWith("announce_discount_")) {
        const discountId = parseInt(callbackData.split("_")[2]);
        const discount = await DiscountCode.findById(discountId);
        
        await BotService.answerCallbackQuery(callbackQuery.id, "📢 در حال ارسال...");
        await BotService.deleteMessage(chatId, messageId);
        
        await NotificationService.newDiscountCode(discount);
        
        return BotService.sendMessage(
          chatId,
          "✅ کد تخفیف به همه کاربران اعلام شد!",
          this.adminMenu()
        );
      }

      // بازگشت به پنل ادمین
      if (callbackData === "admin_back") {
        await BotService.deleteMessage(chatId, messageId);
        return BotService.sendMessage(chatId, "پنل مدیریت:", this.adminMenu());
      }

    } catch (error) {
      logger.error(`خطا در handleCallback: ${error.message}`);
      BotService.answerCallbackQuery(callbackQuery.id, "خطا!", true);
    }
  }
}

module.exports = new BotController();