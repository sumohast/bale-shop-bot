require("dotenv").config();

module.exports = {
  bot: {
    token: process.env.BOT_TOKEN,
    adminChatId: process.env.ADMIN_CHAT_ID,
    baseUrl: `https://tapi.bale.ai/bot${process.env.BOT_TOKEN}`,
  },
  
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  
  app: {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || 3000,
    logLevel: process.env.LOG_LEVEL || "info",
  },
  
  shop: {
    name: process.env.SHOP_NAME || "فروشگاه من",
    currency: process.env.SHOP_CURRENCY || "تومان",
    defaultDiscount: parseInt(process.env.DEFAULT_DISCOUNT) || 0,
    taxPercentage: parseInt(process.env.TAX_PERCENTAGE) || 9,
  },
  
  payment: {
    zarinpalMerchant: process.env.ZARINPAL_MERCHANT,
    callbackUrl: process.env.PAYMENT_CALLBACK_URL,
  },
};
