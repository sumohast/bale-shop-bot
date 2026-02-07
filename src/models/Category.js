const db = require("../config/database");
const logger = require("../utils/logger");

class Category {
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

  static async delete(id) {
    try {
      await db.query("UPDATE categories SET is_active = 0 WHERE id = ?", [id]);
      logger.info(`دسته‌بندی ${id} غیرفعال شد`);
    } catch (error) {
      logger.error(`خطا در delete category: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Category;
