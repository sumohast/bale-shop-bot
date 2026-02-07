const db = require("../config/database");
const logger = require("../utils/logger");

class User {
  /**
   * دریافت یا ایجاد کاربر
   */
  static async getOrCreate(chatId, userInfo = {}) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM users WHERE chat_id = ?",
        [chatId]
      );

      if (rows.length > 0) {
        return rows[0];
      }

      // ایجاد کاربر جدید
      await db.query(
        `INSERT INTO users (chat_id, username, first_name, last_name) 
         VALUES (?, ?, ?, ?)`,
        [
          chatId,
          userInfo.username || null,
          userInfo.first_name || null,
          userInfo.last_name || null,
        ]
      );

      const [newRows] = await db.query(
        "SELECT * FROM users WHERE chat_id = ?",
        [chatId]
      );

      logger.info(`کاربر جدید ایجاد شد: ${chatId}`);
      return newRows[0];
    } catch (error) {
      logger.error(`خطا در getOrCreate: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت کاربر با ID
   */
  static async findById(id) {
    try {
      const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findById: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت کاربر با chat_id
   */
  static async findByChatId(chatId) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM users WHERE chat_id = ?",
        [chatId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findByChatId: ${error.message}`);
      throw error;
    }
  }

  /**
   * به‌روزرسانی اطلاعات کاربر
   */
  static async update(userId, data) {
    try {
      const fields = [];
      const values = [];

      if (data.phone !== undefined) {
        fields.push("phone = ?");
        values.push(data.phone);
      }
      if (data.username !== undefined) {
        fields.push("username = ?");
        values.push(data.username);
      }
      if (data.first_name !== undefined) {
        fields.push("first_name = ?");
        values.push(data.first_name);
      }
      if (data.last_name !== undefined) {
        fields.push("last_name = ?");
        values.push(data.last_name);
      }

      if (fields.length === 0) return;

      values.push(userId);
      await db.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
        values
      );

      logger.info(`اطلاعات کاربر ${userId} به‌روزرسانی شد`);
    } catch (error) {
      logger.error(`خطا در update user: ${error.message}`);
      throw error;
    }
  }

  /**
   * بلاک کردن کاربر
   */
  static async block(userId) {
    try {
      await db.query("UPDATE users SET is_blocked = 1 WHERE id = ?", [userId]);
      logger.info(`کاربر ${userId} بلاک شد`);
    } catch (error) {
      logger.error(`خطا در block user: ${error.message}`);
      throw error;
    }
  }

  /**
   * آنبلاک کردن کاربر
   */
  static async unblock(userId) {
    try {
      await db.query("UPDATE users SET is_blocked = 0 WHERE id = ?", [userId]);
      logger.info(`کاربر ${userId} آنبلاک شد`);
    } catch (error) {
      logger.error(`خطا در unblock user: ${error.message}`);
      throw error;
    }
  }

  /**
   * تعیین ادمین
   */
  static async setAdmin(userId, isAdmin = true) {
    try {
      await db.query("UPDATE users SET is_admin = ? WHERE id = ?", [
        isAdmin ? 1 : 0,
        userId,
      ]);
      logger.info(`وضعیت ادمین کاربر ${userId} تغییر کرد`);
    } catch (error) {
      logger.error(`خطا در setAdmin: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت تمام کاربران
   */
  static async getAll(limit = 100, offset = 0) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getAll users: ${error.message}`);
      throw error;
    }
  }

  /**
   * تعداد کل کاربران
   */
  static async count() {
    try {
      const [rows] = await db.query("SELECT COUNT(*) as count FROM users");
      return rows[0].count;
    } catch (error) {
      logger.error(`خطا در count users: ${error.message}`);
      throw error;
    }
  }

  /**
   * آمار کاربران
   */
  static async getStats() {
    try {
      const [total] = await db.query(
        "SELECT COUNT(*) as count FROM users"
      );
      const [today] = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()"
      );
      const [week] = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
      );
      const [blocked] = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE is_blocked = 1"
      );

      return {
        total: total[0].count,
        today: today[0].count,
        week: week[0].count,
        blocked: blocked[0].count,
      };
    } catch (error) {
      logger.error(`خطا در getStats users: ${error.message}`);
      throw error;
    }
  }
}

module.exports = User;
