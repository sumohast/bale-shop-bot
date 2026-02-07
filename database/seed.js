const mysql = require("mysql2/promise");
require("dotenv").config();

async function seedDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    console.log("🌱 شروع درج داده‌های نمونه...\n");

    // درج دسته‌بندی‌های نمونه
    await connection.query(`
      INSERT INTO categories (title, description, icon, sort_order) VALUES
      ('لوازم الکترونیکی', 'موبایل، لپتاپ، تبلت و ...', '📱', 1),
      ('پوشاک', 'لباس، کفش، اکسسوری', '👕', 2),
      ('کتاب و لوازم‌التحریر', 'کتاب، دفتر، خودکار', '📚', 3),
      ('خانه و آشپزخانه', 'لوازم خانگی و آشپزخانه', '🏠', 4),
      ('ورزش و سرگرمی', 'لوازم ورزشی و تفریحی', '⚽', 5)
    `);
    console.log("✅ دسته‌بندی‌ها درج شدند");

    // درج محصولات نمونه
    await connection.query(`
      INSERT INTO products (category_id, name, description, price, discount_price, stock, image_url, is_featured) VALUES
      (1, 'گوشی سامسونگ A54', 'گوشی هوشمند سامسونگ با صفحه نمایش 6.4 اینچ', 12500000, 11900000, 15, 'https://via.placeholder.com/400x400.png?text=Samsung+A54', TRUE),
      (1, 'لپتاپ ایسوس VivoBook', 'لپتاپ 15.6 اینچ با پردازنده i5', 25000000, NULL, 8, 'https://via.placeholder.com/400x400.png?text=Asus+VivoBook', TRUE),
      (1, 'تبلت سامسونگ Tab A8', 'تبلت 10.5 اینچی با حافظه 64 گیگ', 7500000, 7200000, 20, 'https://via.placeholder.com/400x400.png?text=Samsung+Tab', FALSE),
      (2, 'تیشرت مردانه', 'تیشرت نخی با کیفیت بالا', 250000, NULL, 50, 'https://via.placeholder.com/400x400.png?text=T-Shirt', FALSE),
      (2, 'کفش اسپرت نایک', 'کفش ورزشی مناسب پیاده‌روی', 1800000, 1650000, 25, 'https://via.placeholder.com/400x400.png?text=Nike+Shoes', TRUE),
      (3, 'کتاب آموزش برنامه‌نویسی', 'آموزش جامع JavaScript', 450000, NULL, 100, 'https://via.placeholder.com/400x400.png?text=JS+Book', FALSE),
      (3, 'دفتر 100 برگ', 'دفتر تک‌خط با جلد سخت', 35000, NULL, 200, 'https://via.placeholder.com/400x400.png?text=Notebook', FALSE),
      (4, 'قابلمه استیل', 'قابلمه 5 لیتری با درب شیشه‌ای', 890000, 799000, 30, 'https://via.placeholder.com/400x400.png?text=Pot', FALSE),
      (4, 'ست قاشق و چنگال', 'ست 24 پارچه استیل', 1250000, NULL, 15, 'https://via.placeholder.com/400x400.png?text=Cutlery', FALSE),
      (5, 'توپ فوتبال', 'توپ فوتبال حرفه‌ای سایز 5', 350000, 320000, 40, 'https://via.placeholder.com/400x400.png?text=Football', FALSE)
    `);
    console.log("✅ محصولات نمونه درج شدند");

    // درج کدهای تخفیف نمونه
    await connection.query(`
      INSERT INTO discount_codes (code, description, discount_type, discount_value, min_purchase, max_discount, usage_limit, start_date, end_date) VALUES
      ('WELCOME10', 'تخفیف 10 درصدی ویژه کاربران جدید', 'percentage', 10, 100000, 100000, 100, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)),
      ('SUMMER50', 'تخفیف 50 هزار تومانی تابستانه', 'fixed', 50000, 200000, NULL, 50, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY)),
      ('VIP20', 'تخفیف 20 درصدی ویژه مشتریان VIP', 'percentage', 20, 500000, 200000, NULL, NOW(), NULL)
    `);
    console.log("✅ کدهای تخفیف نمونه درج شدند");

    await connection.end();
    console.log("\n✅ تمام داده‌های نمونه با موفقیت درج شدند!");
    console.log("🎉 حالا می‌توانید ربات را با دستور npm start اجرا کنید");

  } catch (error) {
    console.error("❌ خطا در درج داده‌ها:", error.message);
    process.exit(1);
  }
}

seedDatabase();
