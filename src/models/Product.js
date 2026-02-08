const db = require("../config/database");
const logger = require("../utils/logger");

class Product {
  /**
   * دریافت تمام محصولات فعال (برای کاربران)
   */
  static async getAll(categoryId = null) {
    try {
      let query = "SELECT * FROM products WHERE is_active = 1";
      const params = [];

      if (categoryId) {
        query += " AND category_id = ?";
        params.push(categoryId);
      }

      query += " ORDER BY is_featured DESC, created_at DESC";

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      logger.error(`خطا در getAll products: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت تمام محصولات (فعال و غیرفعال) - برای ادمین
   */
  static async getAllIncludingInactive(categoryId = null) {
    try {
      let query = "SELECT * FROM products WHERE 1=1";
      const params = [];

      if (categoryId) {
        query += " AND category_id = ?";
        params.push(categoryId);
      }

      query += " ORDER BY is_active DESC, is_featured DESC, created_at DESC";

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      logger.error(`خطا در getAllIncludingInactive products: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت محصولات بر اساس دسته‌بندی
   */
  static async findByCategory(categoryId) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY is_featured DESC",
        [categoryId]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در findByCategory: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت محصول با ID
   */
  static async findById(id) {
    try {
      const [rows] = await db.query("SELECT * FROM products WHERE id = ?", [
        id,
      ]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`خطا در findById product: ${error.message}`);
      throw error;
    }
  }

  /**
   * ایجاد محصول جدید
   */
  static async create(data) {
    try {
      const [result] = await db.query(
        `INSERT INTO products 
         (category_id, name, description, price, discount_price, stock, image_url, is_featured) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.category_id,
          data.name,
          data.description || null,
          data.price,
          data.discount_price || null,
          data.stock || 0,
          data.image_url || null,
          data.is_featured || false,
        ]
      );

      logger.info(`محصول جدید ایجاد شد: ${data.name}`);
      return result.insertId;
    } catch (error) {
      logger.error(`خطا در create product: ${error.message}`);
      throw error;
    }
  }

  /**
   * به‌روزرسانی محصول
   */
  static async update(id, data) {
    try {
      const fields = [];
      const values = [];

      if (data.name !== undefined) {
        fields.push("name = ?");
        values.push(data.name);
      }
      if (data.description !== undefined) {
        fields.push("description = ?");
        values.push(data.description);
      }
      if (data.price !== undefined) {
        fields.push("price = ?");
        values.push(data.price);
      }
      if (data.discount_price !== undefined) {
        fields.push("discount_price = ?");
        values.push(data.discount_price);
      }
      if (data.stock !== undefined) {
        fields.push("stock = ?");
        values.push(data.stock);
      }
      if (data.image_url !== undefined) {
        fields.push("image_url = ?");
        values.push(data.image_url);
      }
      if (data.is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(data.is_active);
      }
      if (data.is_featured !== undefined) {
        fields.push("is_featured = ?");
        values.push(data.is_featured);
      }

      if (fields.length === 0) return;

      values.push(id);
      await db.query(
        `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
        values
      );

      logger.info(`محصول ${id} به‌روزرسانی شد`);
    } catch (error) {
      logger.error(`خطا در update product: ${error.message}`);
      throw error;
    }
  }

  /**
   * حذف محصول (soft delete)
   */
  static async delete(id) {
    try {
      await db.query("UPDATE products SET is_active = 0 WHERE id = ?", [id]);
      logger.info(`محصول ${id} غیرفعال شد`);
    } catch (error) {
      logger.error(`خطا در delete product: ${error.message}`);
      throw error;
    }
  }

  /**
   * حذف دائمی محصول
   */
  static async hardDelete(id) {
    try {
      await db.query("DELETE FROM products WHERE id = ?", [id]);
      logger.info(`محصول ${id} به طور کامل حذف شد`);
    } catch (error) {
      logger.error(`خطا در hardDelete product: ${error.message}`);
      throw error;
    }
  }

  /**
   * کاهش موجودی
   */
  static async decreaseStock(id, quantity) {
    try {
      await db.query("UPDATE products SET stock = stock - ? WHERE id = ?", [
        quantity,
        id,
      ]);
      logger.info(`موجودی محصول ${id} کاهش یافت: ${quantity}`);
    } catch (error) {
      logger.error(`خطا در decreaseStock: ${error.message}`);
      throw error;
    }
  }

  /**
   * افزایش موجودی
   */
  static async increaseStock(id, quantity) {
    try {
      await db.query("UPDATE products SET stock = stock + ? WHERE id = ?", [
        quantity,
        id,
      ]);
      logger.info(`موجودی محصول ${id} افزایش یافت: ${quantity}`);
    } catch (error) {
      logger.error(`خطا در increaseStock: ${error.message}`);
      throw error;
    }
  }

  /**
   * افزایش تعداد فروش
   */
  static async increaseSoldCount(id, quantity) {
    try {
      await db.query(
        "UPDATE products SET sold_count = sold_count + ? WHERE id = ?",
        [quantity, id]
      );
    } catch (error) {
      logger.error(`خطا در increaseSoldCount: ${error.message}`);
      throw error;
    }
  }

  /**
   * افزایش تعداد بازدید
   */
  static async increaseViewCount(id) {
    try {
      await db.query(
        "UPDATE products SET view_count = view_count + 1 WHERE id = ?",
        [id]
      );
    } catch (error) {
      logger.error(`خطا در increaseViewCount: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت محصولات ویژه
   */
  static async getFeatured(limit = 10) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM products WHERE is_featured = 1 AND is_active = 1 ORDER BY created_at DESC LIMIT ?",
        [limit]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getFeatured: ${error.message}`);
      throw error;
    }
  }

  /**
   * جستجوی محصولات
   */
  static async search(keyword) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM products WHERE (name LIKE ? OR description LIKE ?) AND is_active = 1",
        [`%${keyword}%`, `%${keyword}%`]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در search products: ${error.message}`);
      throw error;
    }
  }

  /**
   * محصولات کم موجود
   */
  static async getLowStock(threshold = 10) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM products WHERE stock <= ? AND is_active = 1 ORDER BY stock ASC",
        [threshold]
      );
      return rows;
    } catch (error) {
      logger.error(`خطا در getLowStock: ${error.message}`);
      throw error;
    }
  }

  /**
   * آمار محصولات
   */
  static async getStats() {
    try {
      const [total] = await db.query(
        "SELECT COUNT(*) as count FROM products WHERE is_active = 1"
      );
      const [outOfStock] = await db.query(
        "SELECT COUNT(*) as count FROM products WHERE stock = 0 AND is_active = 1"
      );
      const [lowStock] = await db.query(
        "SELECT COUNT(*) as count FROM products WHERE stock > 0 AND stock <= 10 AND is_active = 1"
      );

      return {
        total: total[0].count,
        outOfStock: outOfStock[0].count,
        lowStock: lowStock[0].count,
      };
    } catch (error) {
      logger.error(`خطا در getStats products: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Product;