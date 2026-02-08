const db = require("../config/database");
const logger = require("../utils/logger");

class Payment {
  /**
   * ایجاد رکورد پرداخت جدید
   */
  static async create(data) {
    try {
      const [result] = await db.query(
        `INSERT INTO payments 
         (order_id, user_id, amount, status, payment_method) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.order_id,
          data.user_id,
          data.amount,
          data.status || "pending",
          data.payment_method || "manual"
        ]
      );

      logger.info(`رکورد پرداخت جدید ایجاد شد: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      logger.error(`خطا در create payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت پرداخت با ID
   */
  static async findById(id) {
    try {
      const [rows] = await db.query("SELECT * FROM payments WHERE id = ?", [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findById payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت پرداخت‌های یک سفارش
   */
  static async findByOrder(orderId) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC",
        [orderId]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در findByOrder: ${error.message}`);
      throw error;
    }
  }

  /**
   * ذخیره فیش واریز
   */
  static async saveReceipt(orderId, fileId, userId) {
    try {
      // پیدا کردن یا ایجاد پرداخت برای این سفارش
      const payments = await this.findByOrder(orderId);
      let payment = payments.find(p => p.status === "pending" || p.status === "failed");

      if (!payment) {
        // اگر پرداختی وجود نداره، یکی بسازیم
        const order = await db.query("SELECT final_price FROM orders WHERE id = ?", [orderId]);
        const paymentId = await this.create({
          order_id: orderId,
          user_id: userId,
          amount: order[0][0].final_price,
          status: "pending_verification",
          payment_method: "manual"
        });
        payment = await this.findById(paymentId);
      }

      await db.query(
        "UPDATE payments SET receipt_image = ?, status = 'pending_verification', submitted_at = NOW() WHERE id = ?",
        [fileId, payment.id]
      );
      
      logger.info(`فیش واریز برای پرداخت ${payment.id} ذخیره شد`);
      return payment.id;
    } catch (error) {
      logger.error(`خطا در saveReceipt: ${error.message}`);
      throw error;
    }
  }

  /**
   * تأیید یا رد فیش واریز توسط ادمین
   */
  static async verifyReceipt(id, adminId, approved, notes = null) {
    try {
      const status = approved ? "verified" : "rejected";
      
      await db.query(
        `UPDATE payments 
         SET status = ?, verified_by = ?, verified_at = NOW(), admin_notes = ?, paid_at = ${approved ? 'NOW()' : 'NULL'}
         WHERE id = ?`,
        [status, adminId, notes, id]
      );

      logger.info(`فیش واریز ${id} توسط ادمین ${adminId} ${approved ? "تأیید" : "رد"} شد`);
    } catch (error) {
      logger.error(`خطا در verifyReceipt: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت پرداخت‌های در انتظار تأیید
   */
  static async getPendingVerifications(limit = 20) {
    try {
      const [rows] = await db.query(
        `SELECT p.*, o.full_name, o.phone, o.tracking_code, u.chat_id, u.first_name
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         JOIN users u ON p.user_id = u.id
         WHERE p.status = 'pending_verification'
         ORDER BY p.submitted_at DESC
         LIMIT ?`,
        [limit]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getPendingVerifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * آمار پرداخت‌ها
   */
  static async getStats() {
    try {
      const [total] = await db.query(
        `SELECT 
          COUNT(*) as count, 
          SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as total_amount
         FROM payments`
      );

      const [pending] = await db.query(
        `SELECT COUNT(*) as count FROM payments WHERE status = 'pending_verification'`
      );

      const [verified] = await db.query(
        `SELECT COUNT(*) as count FROM payments WHERE status = 'verified'`
      );

      const [rejected] = await db.query(
        `SELECT COUNT(*) as count FROM payments WHERE status = 'rejected'`
      );

      return {
        total: total[0].count,
        totalAmount: total[0].total_amount || 0,
        pendingVerification: pending[0].count,
        verified: verified[0].count,
        rejected: rejected[0].count
      };
    } catch (error) {
      logger.error(`خطا در getStats payments: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Payment;