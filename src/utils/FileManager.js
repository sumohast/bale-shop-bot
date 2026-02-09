const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * مدیریت فایل‌ها برای بله
 * به جای دانلود فایل، file_id رو ذخیره می‌کنیم
 */
class BaleFileManager {
  /**
   * ذخیره file_id عکس محصول
   */
  static async saveProductImage(fileId, productId) {
    try {
      // فقط file_id رو برمی‌گردونیم
      logger.info(`file_id عکس محصول ${productId} ذخیره شد: ${fileId}`);
      return fileId;
    } catch (error) {
      logger.error(`خطا در saveProductImage: ${error.message}`);
      throw error;
    }
  }

  /**
   * ذخیره file_id فیش واریزی
   */
  static async saveReceiptImage(fileId, orderId) {
    try {
      logger.info(`file_id فیش سفارش ${orderId} ذخیره شد: ${fileId}`);
      return fileId;
    } catch (error) {
      logger.error(`خطا در saveReceiptImage: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت file_id عکس محصول
   * (فقط برمی‌گردونه - چون دیگه مسیر فایل نیست)
   */
  static getProductImagePath(fileId) {
    return fileId; // همون file_id رو برمی‌گردونیم
  }

  /**
   * دریافت file_id فیش
   */
  static getReceiptImagePath(fileId) {
    return fileId;
  }

  /**
   * حذف عکس محصول
   * (در بله نمی‌تونیم فایل رو از سرور بله پاک کنیم، فقط از دیتابیس پاک میشه)
   */
  static deleteProductImage(fileId) {
    try {
      if (!fileId) return;
      logger.info(`عکس محصول از دیتابیس حذف شد: ${fileId}`);
      // در بله نمی‌تونیم فایل رو پاک کنیم، فقط رکوردش رو پاک می‌کنیم
    } catch (error) {
      logger.error(`خطا در deleteProductImage: ${error.message}`);
    }
  }

  /**
   * حذف فیش
   */
  static deleteReceiptImage(fileId) {
    try {
      if (!fileId) return;
      logger.info(`فیش از دیتابیس حذف شد: ${fileId}`);
    } catch (error) {
      logger.error(`خطا در deleteReceiptImage: ${error.message}`);
    }
  }

  /**
   * بررسی وجود file_id
   */
  static fileExists(fileId) {
    // اگه file_id داریم، یعنی فایل وجود داره
    return fileId && fileId.length > 0;
  }

  /**
   * آمار فایل‌ها
   */
  static async getStats() {
    try {
      const [products] = await db.query(
        "SELECT COUNT(*) as count FROM products WHERE image_url IS NOT NULL"
      );

      const [receipts] = await db.query(
        "SELECT COUNT(*) as count FROM payments WHERE receipt_image IS NOT NULL"
      );

      return {
        products: products[0].count,
        receipts: receipts[0].count,
        total: products[0].count + receipts[0].count
      };
    } catch (error) {
      logger.error(`خطا در getStats: ${error.message}`);
      return { products: 0, receipts: 0, total: 0 };
    }
  }
}

module.exports = BaleFileManager;