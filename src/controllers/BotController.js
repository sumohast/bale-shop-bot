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

  // ==================== State Management ====================
  getUserState(chatId) {
    if (!this.userStates.has(chatId)) {
      this.userStates.set(chatId, { step: null, data: {} });
    }
    return this.userStates.get(chatId);
  }

  clearUserState(chatId) {
    this.userStates.delete(chatId);
  }

  // ==================== Menus ====================
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
      [{ text: "📂 مدیریت دسته‌بندی‌ها" }, { text: "➕ افزودن دسته‌بندی" }],
      [{ text: "🎁 مدیریت کدهای تخفیف" }, { text: "➕ ایجاد کد تخفیف" }],
      [{ text: "📢 ارسال پیام همگانی" }],
      [{ text: "🔙 برگشت به منوی کاربر" }],
    ]);
  }

  // ==================== Message Handler ====================
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

      const isAdmin = String(chatId) === String(config.bot.adminChatId);

      // ==================== Admin Commands ====================
      if (isAdmin) {
        if (text === "/admin") {
          this.clearUserState(chatId);
          return BotService.sendMessage(chatId, "👑 پنل مدیریت", this.adminMenu());
        }
        
        if (text === "📊 آمار کلی") return this.showStats(chatId);
        if (text === "📋 مدیریت سفارش‌ها") return this.manageOrders(chatId);
        if (text === "👥 مدیریت کاربران") return this.showUsersList(chatId);
        if (text === "📦 مدیریت محصولات") return this.showProductsList(chatId);
        if (text === "➕ افزودن محصول") return this.startAddProduct(chatId);
        if (text === "📂 مدیریت دسته‌بندی‌ها") return this.showCategoriesList(chatId);
        if (text === "➕ افزودن دسته‌بندی") return this.startAddCategory(chatId);
        if (text === "🎁 مدیریت کدهای تخفیف") return this.showDiscountCodes(chatId);
        if (text === "➕ ایجاد کد تخفیف") return this.startCreateDiscount(chatId);
        
        if (text === "📢 ارسال پیام همگانی") {
          const state = this.getUserState(chatId);
          state.step = "broadcast_message";
          return BotService.sendMessage(
            chatId,
            "📢 *ارسال پیام همگانی*\n\nمتن پیام خود را برای ارسال به همه کاربران وارد کنید:"
          );
        }
        
        if (text === "🔙 برگشت به منوی کاربر") {
          this.clearUserState(chatId);
          return BotService.sendMessage(chatId, "منوی اصلی:", this.mainMenu());
        }
      }

      // ==================== General Commands ====================
      if (text === "/start") {
        this.clearUserState(chatId);
        const welcomeMsg = `سلام ${message.from.first_name || "کاربر عزیز"} 👋\n\nبه ${config.shop.name} خوش اومدی!\n\n🛍 از منوی زیر برای شروع خرید استفاده کن:`;
        return BotService.sendMessage(chatId, welcomeMsg, this.mainMenu());
      }

      if (text === "🛍 محصولات") return this.showCategories(chatId);
      if (text === "🛒 سبد خرید") return this.showCart(chatId, user.id);
      if (text === "📦 سفارش‌های من") return this.showUserOrders(chatId, user.id);
      
      if (text === "🔍 پیگیری سفارش") {
        const state = this.getUserState(chatId);
        state.step = "track_order";
        return BotService.sendMessage(
          chatId,
          "📦 لطفاً کد پیگیری سفارش خود را وارد کنید:\n(مثل TR-XXXXXXXXXX-XXXXXX)"
        );
      }

      if (text === "ℹ️ درباره ما") return this.showAbout(chatId);
      if (text === "☎️ پشتیبانی") return this.showSupport(chatId);

      // ==================== State Handlers ====================
      return this.handleStateFlow(chatId, text, user.id, isAdmin);

    } catch (error) {
      logger.error(`خطا در handleMessage: ${error.message}`);
      return BotService.sendMessage(message.from.id, "❌ خطایی رخ داد.");
    }
  }

  // ==================== State Flow Handler ====================
  async handleStateFlow(chatId, text, userId, isAdmin) {
    const state = this.getUserState(chatId);

    // Track Order
    if (state.step === "track_order") {
      return this.trackOrderByCode(chatId, text);
    }

    // Checkout Flow
    if (state.step === "checkout_name") {
      if (!Validator.isValidName(text)) {
        return BotService.sendMessage(chatId, "❌ نام معتبر نیست. دوباره وارد کنید:");
      }
      // حفظ اطلاعات تخفیف
      const discountCode = state.data.discount_code;
      const discountAmount = state.data.discount_amount;
      
      state.data.full_name = Validator.sanitizeText(text);
      state.data.discount_code = discountCode; // بازگرداندن اطلاعات تخفیف
      state.data.discount_amount = discountAmount;
      state.step = "checkout_phone";
      return BotService.sendMessage(chatId, "📱 شماره تماس:\n(مثال: 09123456789)");
    }

    if (state.step === "checkout_phone") {
      const phone = Validator.formatPhone(text);
      if (!Validator.isValidPhone(phone)) {
        return BotService.sendMessage(chatId, "❌ شماره تلفن نامعتبر:");
      }
      // حفظ اطلاعات تخفیف
      const discountCode = state.data.discount_code;
      const discountAmount = state.data.discount_amount;
      
      state.data.phone = phone;
      state.data.discount_code = discountCode;
      state.data.discount_amount = discountAmount;
      state.step = "checkout_address";
      return BotService.sendMessage(chatId, "📍 آدرس کامل:");
    }

    if (state.step === "checkout_address") {
      if (!Validator.isValidAddress(text)) {
        return BotService.sendMessage(chatId, "❌ آدرس باید حداقل 10 کاراکتر باشد:");
      }
      // حفظ اطلاعات تخفیف
      const discountCode = state.data.discount_code;
      const discountAmount = state.data.discount_amount;
      
      state.data.address = Validator.sanitizeText(text);
      state.data.discount_code = discountCode;
      state.data.discount_amount = discountAmount;
      state.step = "checkout_postal";
      return BotService.sendMessage(chatId, "📮 کد پستی 10 رقمی:\n(یا 0 برای رد کردن)");
    }

    if (state.step === "checkout_postal") {
      const postal = text === "0" ? null : text;
      if (postal && !Validator.isValidPostalCode(postal)) {
        return BotService.sendMessage(chatId, "❌ کد پستی باید 10 رقم باشد:");
      }
      state.data.postal_code = postal;
      // اطلاعات تخفیف قبلاً در state.data هست
      return this.completeCheckout(chatId, userId, state.data);
    }

    // Discount Code Entry
    if (state.step === "enter_discount") {
      return this.applyDiscountCode(chatId, userId, text);
    }

    // Admin - Broadcast Message
    if (isAdmin && state.step === "broadcast_message") {
      return this.sendBroadcast(chatId, text);
    }

    // Admin - Create Discount Code Flow
    if (isAdmin) {
      // Add Category Flow
      if (state.step === "add_category_title") {
        state.data.title = Validator.sanitizeText(text);
        state.step = "add_category_icon";
        return BotService.sendMessage(chatId, `نام: ${state.data.title}\n\nآیکون دسته‌بندی:\n(مثل: 📱 یا 0 برای بدون آیکون)`);
      }
      if (state.step === "add_category_icon") {
        state.data.icon = text === "0" ? null : text.trim();
        state.step = "add_category_description";
        return BotService.sendMessage(chatId, "توضیحات دسته‌بندی:\n(یا 0 برای رد کردن)");
      }
      if (state.step === "add_category_description") {
        state.data.description = text === "0" ? null : Validator.sanitizeText(text);
        state.step = "add_category_sort";
        return BotService.sendMessage(chatId, "ترتیب نمایش (عدد):\n(یا 0 برای پیش‌فرض)");
      }
      if (state.step === "add_category_sort") {
        state.data.sort_order = parseInt(text) || 0;
        return this.saveCategory(chatId, state.data);
      }

      // Edit Category Flow
      if (state.step === "edit_category_title") {
        if (text === "/cancel") {
          this.clearUserState(chatId);
          await BotService.sendMessage(chatId, "❌ ویرایش لغو شد.", this.adminMenu());
          return;
        }
        const { categoryId } = state.data;
        await Category.update(categoryId, { title: text });
        state.step = "edit_category_icon";
        return BotService.sendMessage(chatId, `نام جدید ذخیره شد.\n\nآیکون جدید:\n(یا 0 برای بدون تغییر)`);
      }
      if (state.step === "edit_category_icon") {
        const { categoryId } = state.data;
        if (text !== "0") {
          await Category.update(categoryId, { icon: text.trim() });
        }
        state.step = "edit_category_description";
        return BotService.sendMessage(chatId, "توضیحات جدید:\n(یا 0 برای بدون تغییر)");
      }
      if (state.step === "edit_category_description") {
        const { categoryId } = state.data;
        if (text !== "0") {
          await Category.update(categoryId, { description: text });
        }
        this.clearUserState(chatId);
        await BotService.sendMessage(chatId, "✅ دسته‌بندی با موفقیت ویرایش شد!", this.adminMenu());
        return this.showCategoriesList(chatId);
      }

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

    // Admin - Edit Product Flow
    if (isAdmin && state.step === "admin_edit_product") {
      if (text === "/cancel") {
        this.clearUserState(chatId);
        await BotService.sendMessage(chatId, "❌ ویرایش لغو شد.", this.adminMenu());
        return;
      }

      const { productId, product, field } = state.data;
      let updates = { ...product };

      if (field === "name") {
        updates.name = text;
        state.data.field = "description";
        await BotService.sendMessage(chatId, `نام جدید: ${text}\n\nتوضیحات جدید را وارد کنید (یا 0 برای بدون تغییر):`);
      } else if (field === "description") {
        if (text !== "0") updates.description = text;
        state.data.field = "price";
        await BotService.sendMessage(chatId, "توضیحات ذخیره شد.\n\nقیمت جدید را وارد کنید (عدد):");
      } else if (field === "price") {
        if (isNaN(text)) return BotService.sendMessage(chatId, "❌ قیمت باید عدد باشد.");
        updates.price = parseFloat(text);
        state.data.field = "discount_price";
        await BotService.sendMessage(chatId, `قیمت: ${Helper.formatPrice(text)} تومان\n\nقیمت تخفیف را وارد کنید (یا 0 برای بدون تخفیف):`);
      } else if (field === "discount_price") {
        updates.discount_price = parseFloat(text) || null;
        state.data.field = "stock";
        await BotService.sendMessage(chatId, "قیمت تخفیف ذخیره شد.\n\nموجودی جدید را وارد کنید (عدد):");
      } else if (field === "stock") {
        if (isNaN(text)) return BotService.sendMessage(chatId, "❌ موجودی باید عدد باشد.");
        updates.stock = parseInt(text);
        state.data.field = "image_url";
        await BotService.sendMessage(chatId, `موجودی: ${text}\n\nلینک عکس جدید را وارد کنید (یا 0 برای بدون تغییر):`);
      } else if (field === "image_url") {
        if (text !== "0") updates.image_url = text;
        state.data.field = "is_featured";
        await BotService.sendMessage(chatId, "عکس ذخیره شد.\n\nآیا ویژه باشد؟ (بله/خیر):");
      } else if (field === "is_featured") {
        updates.is_featured = text.toLowerCase() === "بله" || text.toLowerCase() === "yes";
        
        // ذخیره نهایی
        await Product.update(productId, updates);
        this.clearUserState(chatId);
        await BotService.sendMessage(chatId, `✅ محصول ${updates.name} با موفقیت به‌روزرسانی شد!`, this.adminMenu());
        await this.showProductsList(chatId);
        return;
      }

      state.data.product = updates;
      return;
    }

    // Admin - Add Product Flow
    if (isAdmin) {
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

    // Default response
    return BotService.sendMessage(
      chatId,
      "متوجه نشدم 🤔\nلطفاً از منو استفاده کنید.",
      this.mainMenu()
    );
  }

  // ==================== Category & Products ====================
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

  // ==================== Cart Management ====================
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

      cartData.items.forEach((item) => {
        buttons.push([
          { text: `➖`, callback_data: `cart_dec_${item.product_id}` },
          { text: `${item.name} (${item.quantity})`, callback_data: "noop" },
          { text: `➕`, callback_data: `cart_inc_${item.product_id}` },
          { text: `🗑`, callback_data: `cart_del_${item.product_id}` },
        ]);
      });

      buttons.push([{ text: "🎁 کد تخفیف دارید؟", callback_data: "apply_discount" }]);
      buttons.push([{ text: "🗑 پاک کردن سبد", callback_data: "cart_clear" }]);
      buttons.push([{ text: "✅ تکمیل خرید", callback_data: "checkout_start" }]);

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در showCart: ${error.message}`);
      throw error;
    }
  }

  // ==================== Checkout Flow ====================
  async startCheckout(chatId, userId) {
    try {
      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        return BotService.sendMessage(chatId, "سبد خرید خالیست!");
      }

      const state = this.getUserState(chatId);
      state.step = "checkout_name";
      // حفظ اطلاعات تخفیف از قبل (اگر وجود داره)
      if (!state.data) {
        state.data = {};
      }
      // discount_code و discount_amount از قبل در state هست و حفظ میشه

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

      const state = this.getUserState(chatId);
      const discountCode = orderData.discount_code || state.data.discount_code;
      const discountAmount = orderData.discount_amount || state.data.discount_amount || 0;

      logger.info(`Checkout - Discount Code: ${discountCode ? discountCode.code : 'none'}, Amount: ${discountAmount}`);

      const orderId = await Order.create(userId, {
        full_name: orderData.full_name,
        phone: orderData.phone,
        address: orderData.address,
        postal_code: orderData.postal_code,
        total_price: cartData.total,
        discount_amount: discountAmount,
        items: cartData.items,
      });

      const order = await Order.findById(orderId);

      if (discountCode && discountCode.id) {
        await DiscountCode.recordUsage(discountCode.id, userId, orderId);
      }

      this.clearUserState(chatId);

      // ارسال رسید به کاربر
      let receipt = `✅ *سفارش شما ثبت شد!*\n\n`;
      receipt += `🆔 شماره سفارش: ${order.id}\n`;
      receipt += `📍 کد پیگیری: ${order.tracking_code}\n`;
      receipt += `📅 تاریخ: ${Helper.toJalali(order.created_at)}\n\n`;
      
      receipt += `📦 *اقلام سفارش:*\n`;
      cartData.items.forEach((item, index) => {
        const price = item.discount_price || item.price;
        receipt += `${index + 1}. ${item.name} × ${item.quantity}\n`;
        receipt += `   ${Helper.formatPrice(price * item.quantity)} تومان\n`;
      });
      
      receipt += `\n💰 جمع کل: ${Helper.formatPrice(order.total_price)} تومان\n`;
      
      if (discountAmount > 0) {
        receipt += `🎁 تخفیف: ${Helper.formatPrice(discountAmount)} تومان\n`;
      }
      
      if (order.tax_amount > 0) {
        receipt += `📊 مالیات: ${Helper.formatPrice(order.tax_amount)} تومان\n`;
      }
      
      receipt += `\n💵 *مبلغ نهایی: ${Helper.formatPrice(order.final_price)} تومان*\n\n`;
      receipt += `📌 وضعیت: ${Helper.translateOrderStatus(order.status)}\n`;
      receipt += `💳 پرداخت: ${Helper.translatePaymentStatus(order.payment_status)}\n\n`;
      receipt += `سفارش شما در حال بررسی است و به زودی تایید خواهد شد.`;

      await BotService.sendMessage(chatId, receipt, this.mainMenu());

      await NotificationService.newOrderToAdmin(order, cartData.items);
      await Cart.clear(userId);

      return order;
    } catch (error) {
      logger.error(`خطا در completeCheckout: ${error.message}`);
      this.clearUserState(chatId);
      return BotService.sendMessage(chatId, `❌ خطا: ${error.message}`, this.mainMenu());
    }
  }

  // ==================== Order Tracking ====================
  async trackOrderByCode(chatId, trackingCode) {
    try {
      this.clearUserState(chatId);

      const order = await Order.findByTrackingCode(trackingCode.trim().toUpperCase());

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

      return BotService.sendMessage(chatId, message, this.mainMenu());
    } catch (error) {
      logger.error(`خطا در trackOrderByCode: ${error.message}`);
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

  // ==================== Discount Code ====================
  async applyDiscountCode(chatId, userId, code) {
    try {
      this.clearUserState(chatId);

      const cartData = await Cart.getTotal(userId);

      if (cartData.items.length === 0) {
        return BotService.sendMessage(chatId, "سبد خرید خالیست!", this.mainMenu());
      }

      const result = await DiscountCode.validate(code, userId, cartData.total);

      if (!result.valid) {
        await BotService.sendMessage(chatId, result.message);
        return this.showCart(chatId, userId);
      }

      const state = this.getUserState(chatId);
      state.data.discount_code = result.discount;
      state.data.discount_amount = result.discountAmount;

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

  // ==================== Info Pages ====================
  async showAbout(chatId) {
    const message = `ℹ️ *درباره ${config.shop.name}*\n\nفروشگاه آنلاین با بهترین کیفیت و قیمت`;
    return BotService.sendMessage(chatId, message, this.mainMenu());
  }

  async showSupport(chatId) {
    const message = `☎️ *پشتیبانی*\n\n📱 @moha_st\n📧 sumohast@gmail.com`;
    return BotService.sendMessage(chatId, message, this.mainMenu());
  }

  // ==================== Admin - Stats ====================
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

  // ==================== Admin - Order Management ====================
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

  // ==================== Admin - User Management ====================
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

  // ==================== Admin - Product Management ====================
  async showProductsList(chatId, page = 1) {
    try {
      const products = await Product.getAllIncludingInactive(); // این همه محصولات رو برمی‌گردونه (فعال و غیرفعال)
      const paginated = Helper.paginate(products, page, 8);

      if (paginated.data.length === 0) {
        return BotService.sendMessage(chatId, "محصولی یافت نشد.", this.adminMenu());
      }

      let message = `📦 *مدیریت محصولات* (صفحه ${paginated.page}/${paginated.totalPages})\n`;
      message += `کل: ${products.length} محصول\n\n`;
      const keyboard = [];

      for (const product of paginated.data) {
        const status = product.is_active ? "🟢" : "🔴";
        const featured = product.is_featured ? "⭐" : "";
        message += `${product.id}. ${status} ${product.name} ${featured}\n`;
        message += `   💰 ${Helper.formatPrice(product.price)} | 📦 ${product.stock}\n\n`;

        keyboard.push([
          { 
            text: `${status} ${Helper.truncate(product.name, 30)}`, 
            callback_data: `product_manage_${product.id}` 
          }
        ]);
      }

      const nav = [];
      if (page > 1) nav.push({ text: "◀ قبلی", callback_data: `admin_products_page_${page - 1}` });
      if (paginated.page < paginated.totalPages) nav.push({ text: "بعدی ▶", callback_data: `admin_products_page_${page + 1}` });
      if (nav.length > 0) keyboard.push(nav);

      keyboard.push([{ text: "🔙 بازگشت", callback_data: "admin_back" }]);

      await BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(keyboard));
    } catch (error) {
      logger.error(`خطا در showProductsList: ${error.message}`);
      await BotService.sendMessage(chatId, "خطایی رخ داد.");
    }
  }

  async showProductManagement(chatId, productId) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        return BotService.sendMessage(chatId, "❌ محصول پیدا نشد!");
      }

      let message = `📦 *مدیریت محصول*\n\n`;
      message += `🆔 شناسه: ${product.id}\n`;
      message += `📛 نام: ${product.name}\n`;
      message += `💰 قیمت: ${Helper.formatPrice(product.price)} تومان\n`;
      if (product.discount_price) {
        message += `🔥 قیمت تخفیف: ${Helper.formatPrice(product.discount_price)} تومان\n`;
      }
      message += `📦 موجودی: ${product.stock}\n`;
      message += `📊 وضعیت: ${product.is_active ? "فعال 🟢" : "غیرفعال 🔴"}\n`;
      message += `⭐ ویژه: ${product.is_featured ? "بله" : "خیر"}\n`;
      if (product.description) {
        message += `\n📝 توضیحات:\n${Helper.truncate(product.description, 200)}\n`;
      }

      const buttons = [
        [
          { text: "✏️ ویرایش", callback_data: `product_edit_${product.id}` },
          { 
            text: product.is_active ? "❌ غیرفعال کردن" : "✅ فعال کردن", 
            callback_data: `product_toggle_${product.id}` 
          },
        ],
        [
          { 
            text: product.is_featured ? "⭐ حذف از ویژه" : "⭐ افزودن به ویژه", 
            callback_data: `product_toggle_featured_${product.id}` 
          }
        ],
        [{ text: "🗑 حذف کامل محصول", callback_data: `product_delete_${product.id}` }],
        [{ text: "🔙 برگشت به لیست", callback_data: "back_products_list" }],
      ];

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در showProductManagement: ${error.message}`);
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

  // ==================== Admin - Category Management ====================
  async showCategoriesList(chatId) {
    try {
      const categories = await Category.getAllIncludingInactive();

      if (categories.length === 0) {
        return BotService.sendMessage(chatId, "هیچ دسته‌بندی‌ای موجود نیست.", this.adminMenu());
      }

      let message = `📂 *مدیریت دسته‌بندی‌ها*\n\nتعداد: ${categories.length}\n\n`;
      const keyboard = [];

      categories.forEach((category, index) => {
        const status = category.is_active ? "🟢" : "🔴";
        message += `${index + 1}. ${status} ${category.icon || "📂"} ${category.title}\n`;
        if (category.description) {
          message += `   ${Helper.truncate(category.description, 50)}\n`;
        }
        message += `\n`;

        keyboard.push([
          { 
            text: `${status} ${category.icon || "📂"} ${category.title}`, 
            callback_data: `category_manage_${category.id}` 
          }
        ]);
      });

      keyboard.push([{ text: "🔙 بازگشت", callback_data: "admin_back" }]);

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(keyboard));
    } catch (error) {
      logger.error(`خطا در showCategoriesList: ${error.message}`);
      throw error;
    }
  }

  async showCategoryManagement(chatId, categoryId) {
    try {
      const category = await Category.findById(categoryId);

      if (!category) {
        return BotService.sendMessage(chatId, "❌ دسته‌بندی پیدا نشد!");
      }

      let message = `📂 *مدیریت دسته‌بندی*\n\n`;
      message += `🆔 شناسه: ${category.id}\n`;
      message += `${category.icon || "📂"} نام: ${category.title}\n`;
      if (category.description) {
        message += `📝 توضیحات: ${category.description}\n`;
      }
      message += `📊 ترتیب نمایش: ${category.sort_order}\n`;
      message += `📊 وضعیت: ${category.is_active ? "فعال 🟢" : "غیرفعال 🔴"}\n`;

      const buttons = [
        [
          { text: "✏️ ویرایش", callback_data: `category_edit_${category.id}` },
          { 
            text: category.is_active ? "❌ غیرفعال کردن" : "✅ فعال کردن", 
            callback_data: `category_toggle_${category.id}` 
          },
        ],
        [{ text: "🗑 حذف دسته‌بندی", callback_data: `category_delete_${category.id}` }],
        [{ text: "🔙 برگشت به لیست", callback_data: "back_categories_list" }],
      ];

      return BotService.sendMessage(chatId, message, Helper.createInlineKeyboard(buttons));
    } catch (error) {
      logger.error(`خطا در showCategoryManagement: ${error.message}`);
      throw error;
    }
  }

  async startAddCategory(chatId) {
    const state = this.getUserState(chatId);
    state.step = "add_category_title";
    state.data = {};
    return BotService.sendMessage(chatId, "➕ *افزودن دسته‌بندی*\n\nنام دسته‌بندی را وارد کنید:");
  }

  async saveCategory(chatId, categoryData) {
    try {
      const categoryId = await Category.create(categoryData);
      this.clearUserState(chatId);

      return BotService.sendMessage(
        chatId,
        `✅ دسته‌بندی اضافه شد!\n\n🆔 ${categoryId}\n📂 ${categoryData.title}`,
        this.adminMenu()
      );
    } catch (error) {
      logger.error(`خطا در saveCategory: ${error.message}`);
      this.clearUserState(chatId);
      return BotService.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // ==================== Admin - Discount Code Management ====================
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

  async startCreateDiscount(chatId) {
    const state = this.getUserState(chatId);
    state.step = "create_discount_code";
    state.data = {};
    return BotService.sendMessage(chatId, "➕ *ایجاد کد تخفیف*\n\nکد تخفیف را وارد کنید:\n(فقط حروف انگلیسی و اعداد)");
  }

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

  // ==================== Admin - Broadcast ====================
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
          await Helper.sleep(100);
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

  // ==================== Callback Handler ====================
  async handleCallback(callbackQuery) {
    try {
      const chatId = callbackQuery.from.id;
      const callbackData = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;

      const user = await User.findByChatId(chatId);

      if (!user) {
        return BotService.answerCallbackQuery(callbackQuery.id, "کاربر یافت نشد!", true);
      }

      // ==================== Navigation ====================
      if (callbackData === "back_main") {
        await BotService.deleteMessage(chatId, messageId);
        return this.showCategories(chatId);
      }

      if (callbackData === "admin_back") {
        await BotService.deleteMessage(chatId, messageId);
        return BotService.sendMessage(chatId, "پنل مدیریت:", this.adminMenu());
      }

      if (callbackData === "noop") {
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        return;
      }

      // ==================== Categories & Products ====================
      if (callbackData.startsWith("cat_")) {
        const categoryId = parseInt(callbackData.split("_")[1]);
        await BotService.deleteMessage(chatId, messageId);
        return this.showProducts(chatId, categoryId);
      }

      // ==================== Cart Actions ====================
      if (callbackData.startsWith("addcart_")) {
        const productId = parseInt(callbackData.split("_")[1]);
        await Cart.add(user.id, productId, 1);
        await BotService.answerCallbackQuery(callbackQuery.id, "✅ اضافه شد!");
        return;
      }

      if (callbackData.startsWith("cart_")) {
        return this.handleCartCallback(callbackQuery, user.id);
      }

      // ==================== Checkout ====================
      if (callbackData === "checkout_start") {
        // IMPORTANT: Don't delete message to preserve state
        // await BotService.deleteMessage(chatId, messageId);
        return this.startCheckout(chatId, user.id);
      }

      // ==================== Discount Code ====================
      if (callbackData === "apply_discount") {
        const state = this.getUserState(chatId);
        state.step = "enter_discount";
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        return BotService.sendMessage(chatId, "🎁 کد تخفیف خود را وارد کنید:");
      }

      if (callbackData === "remove_discount") {
        const state = this.getUserState(chatId);
        state.data.discount_code = null;
        state.data.discount_amount = 0;
        await BotService.answerCallbackQuery(callbackQuery.id, "🗑 کد تخفیف حذف شد");
        await BotService.deleteMessage(chatId, messageId);
        return this.showCart(chatId, user.id);
      }

      if (callbackData === "back_to_cart") {
        const state = this.getUserState(chatId);
        state.data.discount_code = null;
        state.data.discount_amount = 0;
        await BotService.deleteMessage(chatId, messageId);
        return this.showCart(chatId, user.id);
      }

      // ==================== Order Management ====================
      if (callbackData.startsWith("order_")) {
        return this.handleOrderCallback(callbackQuery);
      }

      if (callbackData.startsWith("admin_order_")) {
        return this.showAdminOrderDetails(callbackQuery);
      }

      // ==================== Product Management ====================
      if (callbackData.startsWith("product_manage_")) {
        const productId = parseInt(callbackData.split("_")[2]);
        await BotService.deleteMessage(chatId, messageId);
        return this.showProductManagement(chatId, productId);
      }

      if (callbackData === "back_products_list") {
        await BotService.deleteMessage(chatId, messageId);
        return this.showProductsList(chatId, 1);
      }

      if (callbackData.startsWith("product_edit_")) {
        const productId = parseInt(callbackData.split("_")[2]);
        const product = await Product.findById(productId);
        this.userStates.set(chatId, { 
          step: "admin_edit_product", 
          data: { productId, product, field: "name" } 
        });
        await BotService.deleteMessage(chatId, messageId);
        await BotService.answerCallbackQuery(callbackQuery.id, "✏️ ویرایش محصول شروع شد");
        await BotService.sendMessage(chatId, `✏️ ویرایش محصول: ${product.name}\n\nلطفاً نام جدید را وارد کنید (یا /cancel برای لغو):`);
        return;
      }

      if (callbackData.startsWith("product_toggle_")) {
        const productId = parseInt(callbackData.split("_")[2]);
        const product = await Product.findById(productId);
        const newStatus = !product.is_active;
        await Product.update(productId, { is_active: newStatus });
        
        const statusText = newStatus ? "فعال" : "غیرفعال";
        await BotService.answerCallbackQuery(callbackQuery.id, `✅ محصول ${statusText} شد`);
        await BotService.deleteMessage(chatId, messageId);
        return this.showProductManagement(chatId, productId);
      }

      if (callbackData.startsWith("product_toggle_featured_")) {
        const productId = parseInt(callbackData.split("_")[3]);
        const product = await Product.findById(productId);
        const newFeatured = !product.is_featured;
        await Product.update(productId, { is_featured: newFeatured });
        
        const featuredText = newFeatured ? "به محصولات ویژه اضافه شد" : "از محصولات ویژه حذف شد";
        await BotService.answerCallbackQuery(callbackQuery.id, `✅ ${featuredText}`);
        await BotService.deleteMessage(chatId, messageId);
        return this.showProductManagement(chatId, productId);
      }

      if (callbackData.startsWith("product_delete_")) {
        const productId = parseInt(callbackData.split("_")[2]);
        const product = await Product.findById(productId);

        const keyboard = Helper.createInlineKeyboard([
          [
            { text: "✅ بله، حذف شود", callback_data: `confirm_delete_product_${productId}` },
            { text: "❌ خیر", callback_data: `product_manage_${productId}` },
          ],
        ]);

        await BotService.deleteMessage(chatId, messageId);
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        
        return BotService.sendMessage(
          chatId,
          `⚠️ *هشدار!*\n\nآیا مطمئن هستید که می‌خواهید محصول "${product.name}" را *کاملاً حذف* کنید؟\n\n⚠️ این عملیات غیرقابل بازگشت است!\n\n💡 توصیه: بهتر است محصول را غیرفعال کنید تا داده‌های سفارشات قبلی حفظ شود.`,
          keyboard
        );
      }

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
        
        return this.showProductsList(chatId, 1);
      }

      if (callbackData.startsWith("admin_edit_product_")) {
        const productId = parseInt(callbackData.split("_")[3]);
        const product = await Product.findById(productId);
        this.userStates.set(chatId, { 
          step: "admin_edit_product", 
          data: { productId, product, field: "name" } 
        });
        await BotService.answerCallbackQuery(callbackQuery.id, "✏️ ویرایش محصول شروع شد");
        await BotService.sendMessage(chatId, `✏️ ویرایش محصول: ${product.name}\n\nلطفاً نام جدید را وارد کنید (یا /cancel برای لغو):`);
        return;
      }

      if (callbackData.startsWith("admin_deactivate_product_")) {
        const productId = parseInt(callbackData.split("_")[3]);
        await Product.update(productId, { is_active: false });
        await BotService.answerCallbackQuery(callbackQuery.id, "🔴 محصول غیرفعال شد");
        const state = this.getUserState(chatId);
        await this.showProductsList(chatId, state.data.page || 1);
        return;
      }

      if (callbackData.startsWith("admin_activate_product_")) {
        const productId = parseInt(callbackData.split("_")[3]);
        await Product.update(productId, { is_active: true });
        await BotService.answerCallbackQuery(callbackQuery.id, "🟢 محصول فعال شد");
        const state = this.getUserState(chatId);
        await this.showProductsList(chatId, state.data.page || 1);
        return;
      }

      if (callbackData.startsWith("admin_products_page_")) {
        const page = parseInt(callbackData.split("_")[3]);
        await this.showProductsList(chatId, page);
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        return;
      }

      // ==================== Category Management ====================
      if (callbackData.startsWith("category_manage_")) {
        const categoryId = parseInt(callbackData.split("_")[2]);
        await BotService.deleteMessage(chatId, messageId);
        return this.showCategoryManagement(chatId, categoryId);
      }

      if (callbackData === "back_categories_list") {
        await BotService.deleteMessage(chatId, messageId);
        return this.showCategoriesList(chatId);
      }

      if (callbackData.startsWith("category_edit_")) {
        const categoryId = parseInt(callbackData.split("_")[2]);
        const category = await Category.findById(categoryId);
        this.userStates.set(chatId, { 
          step: "edit_category_title", 
          data: { categoryId } 
        });
        await BotService.deleteMessage(chatId, messageId);
        await BotService.answerCallbackQuery(callbackQuery.id, "✏️ ویرایش دسته‌بندی");
        return BotService.sendMessage(chatId, `✏️ ویرایش: ${category.title}\n\nنام جدید را وارد کنید (یا /cancel):`);
      }

      if (callbackData.startsWith("category_toggle_")) {
        const categoryId = parseInt(callbackData.split("_")[2]);
        const category = await Category.findById(categoryId);
        const newStatus = !category.is_active;
        await Category.update(categoryId, { is_active: newStatus });
        
        const statusText = newStatus ? "فعال" : "غیرفعال";
        await BotService.answerCallbackQuery(callbackQuery.id, `✅ دسته‌بندی ${statusText} شد`);
        await BotService.deleteMessage(chatId, messageId);
        return this.showCategoryManagement(chatId, categoryId);
      }

      if (callbackData.startsWith("category_delete_")) {
        const categoryId = parseInt(callbackData.split("_")[2]);
        const category = await Category.findById(categoryId);

        const keyboard = Helper.createInlineKeyboard([
          [
            { text: "✅ بله، حذف شود", callback_data: `confirm_delete_category_${categoryId}` },
            { text: "❌ خیر", callback_data: `category_manage_${categoryId}` },
          ],
        ]);

        await BotService.deleteMessage(chatId, messageId);
        await BotService.answerCallbackQuery(callbackQuery.id, "");
        
        return BotService.sendMessage(
          chatId,
          `⚠️ *هشدار!*\n\nآیا مطمئن هستید که می‌خواهید دسته‌بندی "${category.title}" را حذف کنید؟\n\n⚠️ تمام محصولات این دسته نیز غیرفعال می‌شوند!`,
          keyboard
        );
      }

      if (callbackData.startsWith("confirm_delete_category_")) {
        const categoryId = parseInt(callbackData.split("_")[3]);
        const category = await Category.findById(categoryId);
        
        await Category.delete(categoryId);
        await BotService.answerCallbackQuery(callbackQuery.id, "🗑 دسته‌بندی حذف شد");
        await BotService.deleteMessage(chatId, messageId);
        
        await BotService.sendMessage(
          chatId,
          `✅ دسته‌بندی "${category.title}" حذف شد.`,
          this.adminMenu()
        );
        
        return this.showCategoriesList(chatId);
      }

      // ==================== Discount Code Management ====================
      if (callbackData.startsWith("delete_discount_")) {
        const discountId = parseInt(callbackData.split("_")[2]);
        await DiscountCode.deactivate(discountId);
        await BotService.answerCallbackQuery(callbackQuery.id, "🗑 کد تخفیف حذف شد");
        await BotService.deleteMessage(chatId, messageId);
        return this.showDiscountCodes(chatId);
      }

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

    } catch (error) {
      logger.error(`خطا در handleCallback: ${error.message}`);
      BotService.answerCallbackQuery(callbackQuery.id, "خطا!", true);
    }
  }

  // ==================== Cart Callback Handler ====================
  async handleCartCallback(callbackQuery, userId) {
    const chatId = callbackQuery.from.id;
    const parts = callbackQuery.data.split("_");
    const action = parts[1];

    if (action === "inc") {
      const productId = parseInt(parts[2]);
      await Cart.add(userId, productId, 1);
      await BotService.answerCallbackQuery(callbackQuery.id, "✅");
      return this.showCart(chatId, userId);
    }

    if (action === "dec") {
      const productId = parseInt(parts[2]);
      await Cart.decrease(userId, productId, 1);
      await BotService.answerCallbackQuery(callbackQuery.id, "✅");
      return this.showCart(chatId, userId);
    }

    if (action === "del") {
      const productId = parseInt(parts[2]);
      await Cart.remove(userId, productId);
      await BotService.answerCallbackQuery(callbackQuery.id, "🗑 حذف شد");
      return this.showCart(chatId, userId);
    }

    if (action === "clear") {
      await Cart.clear(userId);
      await BotService.deleteMessage(chatId, callbackQuery.message.message_id);
      await BotService.answerCallbackQuery(callbackQuery.id, "🗑 پاک شد");
      return BotService.sendMessage(chatId, "سبد خرید پاک شد.", this.mainMenu());
    }
  }

  // ==================== Order Callback Handler ====================
  async handleOrderCallback(callbackQuery) {
    const chatId = callbackQuery.from.id;
    const parts = callbackQuery.data.split("_");
    const action = parts[1];

    if (action === "view") {
      const orderId = parseInt(parts[2]);
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

    if (action === "confirm") {
      const orderId = parseInt(parts[2]);
      await Order.updateStatus(orderId, "confirmed");
      await BotService.answerCallbackQuery(callbackQuery.id, "✅ تایید شد");
      
      const order = await Order.findById(orderId);
      await NotificationService.orderConfirmed(order);
      return;
    }

    if (action === "cancel") {
      const orderId = parseInt(parts[2]);
      await Order.cancel(orderId, "لغو توسط ادمین");
      await BotService.answerCallbackQuery(callbackQuery.id, "❌ لغو شد");
      
      const order = await Order.findById(orderId);
      await NotificationService.orderCancelled(order, "لغو توسط ادمین");
      return;
    }

    if (action === "prepare") {
      const orderId = parseInt(parts[2]);
      await Order.updateStatus(orderId, "preparing");
      await BotService.answerCallbackQuery(callbackQuery.id, "📦 در حال آماده‌سازی");
      
      const order = await Order.findById(orderId);
      await NotificationService.orderPreparing(order);
      return;
    }

    if (action === "ship") {
      const orderId = parseInt(parts[2]);
      await Order.updateStatus(orderId, "shipped");
      await BotService.answerCallbackQuery(callbackQuery.id, "🚚 ارسال شد");
      
      const order = await Order.findById(orderId);
      await NotificationService.orderShipped(order);
      return;
    }

    if (action === "deliver") {
      const orderId = parseInt(parts[2]);
      await Order.updateStatus(orderId, "delivered");
      await BotService.answerCallbackQuery(callbackQuery.id, "✅ تحویل داده شد");
      
      const order = await Order.findById(orderId);
      await NotificationService.orderDelivered(order);
      return;
    }
  }

  // ==================== Admin Order Details ====================
  async showAdminOrderDetails(callbackQuery) {
    const chatId = callbackQuery.from.id;
    const orderId = parseInt(callbackQuery.data.split("_")[2]);
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
}

module.exports = new BotController();