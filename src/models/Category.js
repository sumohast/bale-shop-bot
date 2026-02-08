const db = require("../config/database");
const logger = require("../utils/logger");

class Category {
  /**
   * دریافت تمام دسته‌بندی‌های فعال (برای کاربران)
   */
  static async getAll() {
    try {
      const [rows] = await db.query(
        "SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, id"
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getAll categories: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت تمام دسته‌بندی‌ها (فعال و غیرفعال) - برای ادمین
   */
  static async getAllIncludingInactive() {
    try {
      const [rows] = await db.query(
        "SELECT * FROM categories ORDER BY is_active DESC, sort_order, id"
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getAllIncludingInactive categories: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت دسته‌بندی با ID
   */
  static async findById(id) {
    try {
      const [rows] = await db.query("SELECT * FROM categories WHERE id = ?", [
        id,
      ]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findById category: ${error.message}`);
      throw error;
    }
  }

  /**
   * ایجاد دسته‌بندی جدید
   */
  static async create(data) {
    try {
      const [result] = await db.query(
        "INSERT INTO categories (title, description, icon, sort_order) VALUES (?, ?, ?, ?)",
        [data.title, data.description || null, data.icon || null, data.sort_order || 0]
      );
      logger.info(`دسته‌بندی جدید ایجاد شد: ${data.title}`);
      return result.insertId;
    } catch (error) {
      logger.error(`خطا در create category: ${error.message}`);
      throw error;
    }
  }

  /**
   * به‌روزرسانی دسته‌بندی
   */
  static async update(id, data) {
    try {
      const fields = [];
      const values = [];

      if (data.title !== undefined) {
        fields.push("title = ?");
        values.push(data.title);
      }
      if (data.description !== undefined) {
        fields.push("description = ?");
        values.push(data.description);
      }
      if (data.icon !== undefined) {
        fields.push("icon = ?");
        values.push(data.icon);
      }
      if (data.sort_order !== undefined) {
        fields.push("sort_order = ?");
        values.push(data.sort_order);
      }
      if (data.is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(data.is_active);
      }

      if (fields.length === 0) return;

      values.push(id);
      await db.query(
        `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`,
        values
      );
      logger.info(`دسته‌بندی ${id} به‌روزرسانی شد`);
    } catch (error) {
      logger.error(`خطا در update category: ${error.message}`);
      throw error;
    }
  }

  /**
   * حذف دسته‌بندی (soft delete)
   */
  static async delete(id) {
    try {
      await db.query("UPDATE categories SET is_active = 0 WHERE id = ?", [id]);
      logger.info(`دسته‌بندی ${id} غیرفعال شد`);
    } catch (error) {
      logger.error(`خطا در delete category: ${error.message}`);
      throw error;
    }
  }

  /**
   * حذف کامل دسته‌بندی
   */
  static async hardDelete(id) {
    try {
      await db.query("DELETE FROM categories WHERE id = ?", [id]);
      logger.info(`دسته‌بندی ${id} به طور کامل حذف شد`);
    } catch (error) {
      logger.error(`خطا در hardDelete category: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Category;