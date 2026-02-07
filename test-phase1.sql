-- ==========================================
-- تست فاز 1: کد تخفیف + اعلان‌ها
-- ==========================================

-- 1. افزودن کدهای تخفیف نمونه
-- ==========================================

-- کد تخفیف 10 درصدی برای کاربران جدید
INSERT INTO discount_codes (
    code,
    description,
    discount_type,
    discount_value,
    min_purchase,
    max_discount,
    usage_limit,
    end_date
) VALUES (
    'WELCOME10',
    'تخفیف 10٪ ویژه کاربران جدید',
    'percentage',
    10,
    100000,
    50000,
    100,
    DATE_ADD(NOW(), INTERVAL 30 DAY)
);

-- کد تخفیف 50 هزار تومانی
INSERT INTO discount_codes (
    code,
    description,
    discount_type,
    discount_value,
    min_purchase,
    usage_limit,
    end_date
) VALUES (
    'DISCOUNT50K',
    'تخفیف 50 هزار تومانی',
    'fixed',
    50000,
    200000,
    50,
    DATE_ADD(NOW(), INTERVAL 60 DAY)
);

-- کد تخفیف 30 درصدی تابستانه
INSERT INTO discount_codes (
    code,
    description,
    discount_type,
    discount_value,
    min_purchase,
    max_discount,
    usage_limit,
    end_date
) VALUES (
    'SUMMER30',
    'تخفیف 30٪ تابستانه',
    'percentage',
    30,
    300000,
    150000,
    200,
    DATE_ADD(NOW(), INTERVAL 90 DAY)
);

-- کد تخفیف VIP 20 درصدی
INSERT INTO discount_codes (
    code,
    description,
    discount_type,
    discount_value,
    min_purchase,
    max_discount
) VALUES (
    'VIP20',
    'تخفیف 20٪ ویژه مشتریان VIP',
    'percentage',
    20,
    500000,
    200000
);

-- کد تخفیف برای تست (50٪ بدون محدودیت)
INSERT INTO discount_codes (
    code,
    description,
    discount_type,
    discount_value
) VALUES (
    'TEST50',
    'کد تست - 50٪ تخفیف',
    'percentage',
    50
);

-- ==========================================
-- 2. تست کدهای تخفیف
-- ==========================================

-- مشاهده تمام کدهای فعال
SELECT 
    code,
    description,
    discount_type,
    discount_value,
    min_purchase,
    max_discount,
    used_count,
    usage_limit,
    end_date
FROM discount_codes
WHERE is_active = 1
ORDER BY created_at DESC;

-- ==========================================
-- 3. چک کردن استفاده از کد تخفیف
-- ==========================================

-- مشاهده کاربرانی که از کد استفاده کردن
SELECT 
    dc.code,
    u.first_name,
    u.chat_id,
    o.id as order_id,
    o.discount_amount,
    du.used_at
FROM discount_usage du
JOIN discount_codes dc ON du.discount_code_id = dc.id
JOIN users u ON du.user_id = u.id
LEFT JOIN orders o ON du.order_id = o.id
ORDER BY du.used_at DESC;

-- ==========================================
-- 4. آمار کدهای تخفیف
-- ==========================================

SELECT 
    dc.code,
    dc.description,
    dc.used_count,
    dc.usage_limit,
    COUNT(du.id) as actual_usage,
    SUM(o.discount_amount) as total_discount_given
FROM discount_codes dc
LEFT JOIN discount_usage du ON dc.id = du.discount_code_id
LEFT JOIN orders o ON du.order_id = o.id
GROUP BY dc.id
ORDER BY dc.created_at DESC;

-- ==========================================
-- 5. غیرفعال کردن کد تخفیف
-- ==========================================

-- غیرفعال کردن کد TEST50
-- UPDATE discount_codes SET is_active = 0 WHERE code = 'TEST50';

-- ==========================================
-- 6. تست اعلان‌ها
-- ==========================================

-- لیست سفارشات برای تست تغییر وضعیت
SELECT 
    id,
    full_name,
    status,
    final_price,
    created_at
FROM orders
ORDER BY created_at DESC
LIMIT 10;

-- تغییر وضعیت سفارش برای تست اعلان
-- (بعد از اجرای هر دستور، کاربر باید اعلان بگیره)

-- تایید سفارش
-- UPDATE orders SET status = 'confirmed' WHERE id = 1;

-- آماده‌سازی
-- UPDATE orders SET status = 'preparing' WHERE id = 1;

-- ارسال شده
-- UPDATE orders SET status = 'shipped' WHERE id = 1;

-- تحویل داده شده
-- UPDATE orders SET status = 'delivered' WHERE id = 1;

-- ==========================================
-- 7. بررسی لاگ‌ها
-- ==========================================

-- مشاهده آخرین لاگ‌ها
SELECT * FROM logs ORDER BY created_at DESC LIMIT 20;

-- ==========================================
-- 8. حذف داده‌های تست (اختیاری)
-- ==========================================

-- حذف کدهای تخفیف تست
-- DELETE FROM discount_codes WHERE code IN ('TEST50', 'WELCOME10', 'DISCOUNT50K', 'SUMMER30', 'VIP20');

-- حذف استفاده‌های تست
-- DELETE FROM discount_usage WHERE discount_code_id NOT IN (SELECT id FROM discount_codes);

-- ==========================================
-- 9. کوئری‌های کمکی
-- ==========================================

-- کدهای تخفیف منقضی شده
SELECT * FROM discount_codes 
WHERE end_date IS NOT NULL AND end_date < NOW();

-- کدهای تخفیف که ظرفیت تمام شده
SELECT * FROM discount_codes 
WHERE usage_limit IS NOT NULL AND used_count >= usage_limit;

-- محبوب‌ترین کدهای تخفیف
SELECT 
    code,
    used_count,
    SUM(o.discount_amount) as total_saved
FROM discount_codes dc
LEFT JOIN discount_usage du ON dc.id = du.discount_code_id
LEFT JOIN orders o ON du.order_id = o.id
GROUP BY dc.id
ORDER BY used_count DESC;

-- ==========================================
-- 10. تست در ربات
-- ==========================================

/*
مراحل تست در ربات:

1. تست کد تخفیف:
   - محصول اضافه کن
   - برو به سبد خرید
   - کلیک روی "🎁 کد تخفیف دارید؟"
   - وارد کن: WELCOME10
   - باید تخفیف اعمال بشه

2. تست با حداقل خرید:
   - سبد رو خالی کن
   - محصولی زیر 100,000 اضافه کن
   - کد WELCOME10 رو امتحان کن
   - باید پیام خطا بده

3. تست استفاده مکرر:
   - یک سفارش با کد WELCOME10 ثبت کن
   - دوباره همون کد رو امتحان کن
   - باید بگه "قبلاً استفاده کردید"

4. تست اعلان‌ها:
   - یک سفارش ثبت کن
   - از پنل ادمین تایید کن
   - کاربر باید اعلان تایید بگیره
*/