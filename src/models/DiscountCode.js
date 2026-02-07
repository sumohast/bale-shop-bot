const db = require("../config/database");
const logger = require("../utils/logger");

class DiscountCode {
  /**
   * اعتبارسنجی و دریافت کد تخفیف
   */
  static async validate(code, userId, orderTotal) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM discount_codes 
         WHERE code = ? AND is_active = 1 
         AND (end_date IS NULL OR end_date >= NOW())
         AND start_date <= NOW()`,
        [code.toUpperCase()]
      );

      if (rows.length === 0) {
        return { valid: false, message: "❌ کد تخفیف نامعتبر یا منقضی شده است" };
      }

      const discount = rows[0];

      // بررسی تعداد استفاده
      if (discount.usage_limit && discount.used_count >= discount.usage_limit) {
        return { valid: false, message: "❌ ظرفیت استفاده از این کد تخفیف تمام شده است" };
      }

      // بررسی حداقل خرید
      if (orderTotal < discount.min_purchase) {
        return {
          valid: false,
          message: `❌ حداقل خرید برای این کد ${discount.min_purchase.toLocaleString('fa-IR')} تومان است`,
        };
      }

      // بررسی استفاده قبلی توسط کاربر
      const [usage] = await db.query(
        "SELECT * FROM discount_usage WHERE discount_code_id = ? AND user_id = ?",
        [discount.id, userId]
      );

      if (usage.length > 0) {
        return { valid: false, message: "❌ شما قبلاً از این کد تخفیف استفاده کرده‌اید" };
      }

      // محاسبه مبلغ تخفیف
      let discountAmount = 0;
      if (discount.discount_type === "percentage") {
        discountAmount = Math.round((orderTotal * discount.discount_value) / 100);
        // بررسی حداکثر تخفیف
        if (discount.max_discount && discountAmount > discount.max_discount) {
          discountAmount = discount.max_discount;
        }
      } else {
        // تخفیف ثابت
        discountAmount = discount.discount_value;
      }

      return {
        valid: true,
        discount: discount,
        discountAmount: discountAmount,
        message: `✅ کد تخفیف اعمال شد! ${discountAmount.toLocaleString('fa-IR')} تومان تخفیف`,
      };
    } catch (error) {
      logger.error(`خطا در validate discount: ${error.message}`);
      throw error;
    }
  }

  /**
   * ثبت استفاده از کد تخفیف
   */
  static async recordUsage(discountCodeId, userId, orderId = null) {
    try {
      await db.query(
        "INSERT INTO discount_usage (discount_code_id, user_id, order_id) VALUES (?, ?, ?)",
        [discountCodeId, userId, orderId]
      );

      await db.query(
        "UPDATE discount_codes SET used_count = used_count + 1 WHERE id = ?",
        [discountCodeId]
      );

      logger.info(`کد تخفیف ${discountCodeId} توسط کاربر ${userId} استفاده شد`);
    } catch (error) {
      logger.error(`خطا در recordUsage: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت همه کدهای تخفیف فعال
   */
  static async getActive() {
    try {
      const [rows] = await db.query(
        `SELECT * FROM discount_codes 
         WHERE is_active = 1 
         AND (end_date IS NULL OR end_date >= NOW())
         AND start_date <= NOW()
         ORDER BY created_at DESC`
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getActive: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت کد تخفیف با ID
   */
  static async findById(id) {
    try {
      const [rows] = await db.query("SELECT * FROM discount_codes WHERE id = ?", [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findById: ${error.message}`);
      throw error;
    }
  }

  /**
   * ایجاد کد تخفیف جدید
   */
  static async create(data) {
    try {
      const [result] = await db.query(
        `INSERT INTO discount_codes 
         (code, description, discount_type, discount_value, min_purchase, max_discount, usage_limit, end_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.code.toUpperCase(),
          data.description || null,
          data.discount_type || "percentage",
          data.discount_value,
          data.min_purchase || 0,
          data.max_discount || null,
          data.usage_limit || null,
          data.end_date || null,
        ]
      );

      logger.info(`کد تخفیف جدید ایجاد شد: ${data.code}`);
      return result.insertId;
    } catch (error) {
      logger.error(`خطا در create discount: ${error.message}`);
      throw error;
    }
  }

  /**
   * غیرفعال کردن کد تخفیف
   */
  static async deactivate(id) {
    try {
      await db.query("UPDATE discount_codes SET is_active = 0 WHERE id = ?", [id]);
      logger.info(`کد تخفیف ${id} غیرفعال شد`);
    } catch (error) {
      logger.error(`خطا در deactivate: ${error.message}`);
      throw error;
    }
  }

  /**
   * آمار استفاده از کد تخفیف
   */
  static async getStats(discountCodeId) {
    try {
      const [rows] = await db.query(
        `SELECT 
          COUNT(*) as usage_count,
          SUM(orders.discount_amount) as total_discount
         FROM discount_usage
         LEFT JOIN orders ON discount_usage.order_id = orders.id
         WHERE discount_usage.discount_code_id = ?`,
        [discountCodeId]
      );
      return rows[0];
    } catch (error) {
      logger.error(`خطا در getStats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DiscountCode;