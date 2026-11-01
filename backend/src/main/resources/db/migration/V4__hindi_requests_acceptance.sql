-- Hindi names for the catalog, order requests (handwritten list photo / voice note), and the ACCEPTED order step.
-- Order status is a VARCHAR without a CHECK constraint, so ACCEPTED needs no schema change.

ALTER TABLE categories ADD COLUMN name_hi VARCHAR(80) NULL AFTER name;
ALTER TABLE products ADD COLUMN name_hi VARCHAR(160) NULL AFTER name;
-- Snapshot like product_name, so past orders keep the Hindi name they were placed with
ALTER TABLE order_items ADD COLUMN product_name_hi VARCHAR(160) NULL AFTER product_name;

CREATE TABLE order_requests (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    user_id        BIGINT        NOT NULL,
    status         VARCHAR(20)   NOT NULL,
    image_path     VARCHAR(200)  NULL,
    audio_path     VARCHAR(200)  NULL,
    audio_seconds  INT           NULL,
    note           VARCHAR(500)  NULL,
    -- Delivery address snapshot taken when the request is sent
    addr_label     VARCHAR(40)   NOT NULL,
    addr_name      VARCHAR(120)  NULL,
    addr_phone     VARCHAR(16)   NOT NULL,
    addr_line1     VARCHAR(200)  NOT NULL,
    addr_line2     VARCHAR(200)  NULL,
    addr_landmark  VARCHAR(120)  NULL,
    addr_pincode   VARCHAR(6)    NOT NULL,
    addr_lat       DECIMAL(9, 6) NOT NULL,
    addr_lng       DECIMAL(9, 6) NOT NULL,
    distance_km    DECIMAL(6, 2) NOT NULL,
    order_id       BIGINT        NULL,
    reject_reason  VARCHAR(300)  NULL,
    handled_by     BIGINT        NULL,
    handled_at     DATETIME(6)   NULL,
    created_at     DATETIME(6)   NOT NULL,
    updated_at     DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_order_requests_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_order_requests_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
    CONSTRAINT uk_order_requests_order UNIQUE (order_id),
    CONSTRAINT chk_order_requests_media CHECK (image_path IS NOT NULL OR audio_path IS NOT NULL),
    INDEX idx_order_requests_status_created (status, created_at),
    INDEX idx_order_requests_user_created (user_id, created_at)
);

-- The request an order was built from, so the store can look at the list photo while packing
ALTER TABLE orders ADD COLUMN request_id BIGINT NULL AFTER user_id;

-- Hindi names for the demo catalog (only where the English name is still the seeded one)
UPDATE categories SET name_hi = 'फल और सब्ज़ियाँ' WHERE id = 1 AND name = 'Fruits & Vegetables';
UPDATE categories SET name_hi = 'दूध, ब्रेड और अंडे' WHERE id = 2 AND name = 'Dairy, Bread & Eggs';
UPDATE categories SET name_hi = 'आटा, चावल और दाल' WHERE id = 3 AND name = 'Atta, Rice & Dal';
UPDATE categories SET name_hi = 'तेल, घी और मसाले' WHERE id = 4 AND name = 'Oil, Ghee & Masala';
UPDATE categories SET name_hi = 'नमकीन और बिस्कुट' WHERE id = 5 AND name = 'Snacks & Biscuits';
UPDATE categories SET name_hi = 'कोल्ड ड्रिंक और जूस' WHERE id = 6 AND name = 'Cold Drinks & Juices';
UPDATE categories SET name_hi = 'पर्सनल केयर' WHERE id = 7 AND name = 'Personal Care';
UPDATE categories SET name_hi = 'साफ़-सफ़ाई' WHERE id = 8 AND name = 'Cleaning Essentials';

UPDATE products SET name_hi = 'प्याज़' WHERE id = 1 AND name = 'Onion';
UPDATE products SET name_hi = 'आलू' WHERE id = 2 AND name = 'Potato';
UPDATE products SET name_hi = 'टमाटर' WHERE id = 3 AND name = 'Tomato';
UPDATE products SET name_hi = 'केला' WHERE id = 4 AND name = 'Banana Robusta';
UPDATE products SET name_hi = 'हरा धनिया' WHERE id = 5 AND name = 'Coriander Leaves';
UPDATE products SET name_hi = 'टोंड दूध' WHERE id = 6 AND name = 'Toned Milk';
UPDATE products SET name_hi = 'दही' WHERE id = 7 AND name = 'Curd';
UPDATE products SET name_hi = 'पनीर' WHERE id = 8 AND name = 'Paneer';
UPDATE products SET name_hi = 'ब्राउन ब्रेड' WHERE id = 9 AND name = 'Brown Bread';
UPDATE products SET name_hi = 'अंडे' WHERE id = 10 AND name = 'Farm Eggs';
UPDATE products SET name_hi = 'मक्खन' WHERE id = 11 AND name = 'Butter';
UPDATE products SET name_hi = 'गेहूँ का आटा' WHERE id = 12 AND name = 'Whole Wheat Atta';
UPDATE products SET name_hi = 'बासमती चावल' WHERE id = 13 AND name = 'Basmati Rice';
UPDATE products SET name_hi = 'सोना मसूरी चावल' WHERE id = 14 AND name = 'Sona Masoori Rice';
UPDATE products SET name_hi = 'अरहर (तूर) दाल' WHERE id = 15 AND name = 'Toor Dal';
UPDATE products SET name_hi = 'मूंग दाल' WHERE id = 16 AND name = 'Moong Dal';
UPDATE products SET name_hi = 'सूरजमुखी तेल' WHERE id = 17 AND name = 'Sunflower Oil';
UPDATE products SET name_hi = 'शुद्ध देसी घी' WHERE id = 18 AND name = 'Pure Cow Ghee';
UPDATE products SET name_hi = 'हल्दी पाउडर' WHERE id = 19 AND name = 'Turmeric Powder';
UPDATE products SET name_hi = 'लाल मिर्च पाउडर' WHERE id = 20 AND name = 'Red Chilli Powder';
UPDATE products SET name_hi = 'मैरी गोल्ड बिस्कुट' WHERE id = 21 AND name = 'Marie Gold Biscuits';
UPDATE products SET name_hi = 'नमकीन चिप्स' WHERE id = 22 AND name = 'Classic Salted Chips';
UPDATE products SET name_hi = 'आलू भुजिया' WHERE id = 23 AND name = 'Aloo Bhujia';
UPDATE products SET name_hi = 'इंस्टेंट नूडल्स' WHERE id = 24 AND name = 'Instant Noodles';
UPDATE products SET name_hi = 'कोला' WHERE id = 25 AND name = 'Cola Soft Drink';
UPDATE products SET name_hi = 'आम का ड्रिंक' WHERE id = 26 AND name = 'Mango Drink';
UPDATE products SET name_hi = 'पीने का पानी' WHERE id = 27 AND name = 'Packaged Drinking Water';
UPDATE products SET name_hi = 'नहाने का साबुन' WHERE id = 28 AND name = 'Bathing Soap';
UPDATE products SET name_hi = 'टूथपेस्ट' WHERE id = 29 AND name = 'Toothpaste';
UPDATE products SET name_hi = 'शैम्पू' WHERE id = 30 AND name = 'Shampoo';
UPDATE products SET name_hi = 'बर्तन साफ़ करने की टिकिया' WHERE id = 31 AND name = 'Dishwash Bar';
UPDATE products SET name_hi = 'कपड़े धोने का पाउडर' WHERE id = 32 AND name = 'Detergent Powder';
