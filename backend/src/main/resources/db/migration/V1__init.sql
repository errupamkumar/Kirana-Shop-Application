-- Kirana Shop Automation System: initial schema.
-- Timestamps are UTC (DATETIME(6)); money is DECIMAL(10,2) INR.

CREATE TABLE admin_users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(190) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    role          VARCHAR(20)  NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    CONSTRAINT uk_admin_users_email UNIQUE (email),
    CONSTRAINT chk_admin_users_role CHECK (role IN ('ADMIN', 'STAFF'))
);

CREATE TABLE users (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone      VARCHAR(16)  NOT NULL,
    name       VARCHAR(120) NULL,
    created_at DATETIME(6)  NOT NULL,
    updated_at DATETIME(6)  NOT NULL,
    CONSTRAINT uk_users_phone UNIQUE (phone)
);

CREATE TABLE otp_requests (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone      VARCHAR(16) NOT NULL,
    otp_hash   VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    attempts   INT         NOT NULL DEFAULT 0,
    consumed   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    INDEX idx_otp_phone_created (phone, created_at)
);

CREATE TABLE refresh_tokens (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_hash   VARCHAR(64) NOT NULL,
    subject_type VARCHAR(10) NOT NULL,
    subject_id   BIGINT      NOT NULL,
    expires_at   DATETIME(6) NOT NULL,
    revoked      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   DATETIME(6) NOT NULL,
    CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash),
    INDEX idx_refresh_subject (subject_type, subject_id)
);

CREATE TABLE user_addresses (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT        NOT NULL,
    label      VARCHAR(40)   NOT NULL,
    line1      VARCHAR(200)  NOT NULL,
    line2      VARCHAR(200)  NULL,
    landmark   VARCHAR(120)  NULL,
    pincode    VARCHAR(6)    NOT NULL,
    lat        DECIMAL(9, 6) NOT NULL,
    lng        DECIMAL(9, 6) NOT NULL,
    is_default BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at DATETIME(6)   NOT NULL,
    updated_at DATETIME(6)   NOT NULL,
    CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_user_addresses_user (user_id)
);

CREATE TABLE store_settings (
    id                     TINYINT        NOT NULL PRIMARY KEY,
    store_name             VARCHAR(120)   NOT NULL,
    store_phone            VARCHAR(20)    NOT NULL,
    store_address          VARCHAR(300)   NOT NULL,
    gstin                  VARCHAR(15)    NULL,
    store_lat              DECIMAL(9, 6)  NOT NULL,
    store_lng              DECIMAL(9, 6)  NOT NULL,
    max_delivery_radius_km DECIMAL(5, 2)  NOT NULL,
    min_order_amount       DECIMAL(10, 2) NOT NULL,
    delivery_charge        DECIMAL(10, 2) NOT NULL,
    free_delivery_above    DECIMAL(10, 2) NULL,
    cod_enabled            BOOLEAN        NOT NULL,
    online_payment_enabled BOOLEAN        NOT NULL,
    gateway_key_id         VARCHAR(100)   NULL,
    gateway_secret_enc     VARBINARY(512) NULL,
    is_store_open          BOOLEAN        NOT NULL,
    store_closed_message   VARCHAR(300)   NULL,
    low_stock_threshold    INT            NOT NULL,
    updated_at             DATETIME(6)    NOT NULL,
    updated_by             VARCHAR(190)   NULL,
    CONSTRAINT chk_store_settings_singleton CHECK (id = 1),
    CONSTRAINT chk_store_settings_radius CHECK (max_delivery_radius_km BETWEEN 0.5 AND 20)
);

CREATE TABLE categories (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(80)  NOT NULL,
    slug       VARCHAR(90)  NOT NULL,
    image_url  VARCHAR(500) NULL,
    sort_order INT          NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at DATETIME(6)  NOT NULL,
    updated_at DATETIME(6)  NOT NULL,
    CONSTRAINT uk_categories_slug UNIQUE (slug)
);

CREATE TABLE products (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT       NOT NULL,
    name        VARCHAR(160) NOT NULL,
    description TEXT         NULL,
    brand       VARCHAR(80)  NULL,
    image_url   VARCHAR(500) NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
    INDEX idx_products_name (name),
    INDEX idx_products_category_active (category_id, is_active)
);

CREATE TABLE product_variants (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id    BIGINT         NOT NULL,
    label         VARCHAR(40)    NOT NULL,
    sku           VARCHAR(60)    NOT NULL,
    mrp           DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    stock_qty     INT            NOT NULL DEFAULT 0,
    is_active     BOOLEAN        NOT NULL DEFAULT TRUE,
    sort_order    INT            NOT NULL DEFAULT 0,
    created_at    DATETIME(6)    NOT NULL,
    updated_at    DATETIME(6)    NOT NULL,
    CONSTRAINT uk_product_variants_sku UNIQUE (sku),
    CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT chk_variant_price CHECK (selling_price <= mrp AND selling_price >= 0),
    CONSTRAINT chk_variant_stock CHECK (stock_qty >= 0),
    INDEX idx_product_variants_product (product_id)
);

-- Daily counter for human readable order numbers (KS-yyyyMMdd-0001)
CREATE TABLE order_sequences (
    seq_date   DATE NOT NULL PRIMARY KEY,
    last_seq   INT  NOT NULL
);

CREATE TABLE orders (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number             VARCHAR(30)    NOT NULL,
    user_id                  BIGINT         NOT NULL,
    status                   VARCHAR(20)    NOT NULL,
    payment_method           VARCHAR(10)    NOT NULL,
    payment_status           VARCHAR(20)    NOT NULL,
    item_subtotal            DECIMAL(10, 2) NOT NULL,
    delivery_fee             DECIMAL(10, 2) NOT NULL,
    total                    DECIMAL(10, 2) NOT NULL,
    min_order_amount_applied DECIMAL(10, 2) NOT NULL,
    addr_label               VARCHAR(40)    NULL,
    addr_name                VARCHAR(120)   NULL,
    addr_phone               VARCHAR(16)    NOT NULL,
    addr_line1               VARCHAR(200)   NOT NULL,
    addr_line2               VARCHAR(200)   NULL,
    addr_landmark            VARCHAR(120)   NULL,
    addr_pincode             VARCHAR(6)     NOT NULL,
    addr_lat                 DECIMAL(9, 6)  NOT NULL,
    addr_lng                 DECIMAL(9, 6)  NOT NULL,
    distance_km              DECIMAL(6, 2)  NOT NULL,
    customer_note            VARCHAR(300)   NULL,
    cancel_reason            VARCHAR(300)   NULL,
    placed_at                DATETIME(6)    NOT NULL,
    delivered_at             DATETIME(6)    NULL,
    created_at               DATETIME(6)    NOT NULL,
    updated_at               DATETIME(6)    NOT NULL,
    CONSTRAINT uk_orders_number UNIQUE (order_number),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id),
    INDEX idx_orders_status_placed (status, placed_at),
    INDEX idx_orders_user_placed (user_id, placed_at),
    INDEX idx_orders_delivered (delivered_at)
);

CREATE TABLE order_items (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id      BIGINT         NOT NULL,
    -- Nullable: order lines are snapshots and survive variant deletion
    variant_id    BIGINT         NULL,
    product_name  VARCHAR(160)   NOT NULL,
    variant_label VARCHAR(40)    NOT NULL,
    image_url     VARCHAR(500)   NULL,
    mrp           DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    qty           INT            NOT NULL,
    line_total    DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE SET NULL,
    CONSTRAINT chk_order_items_qty CHECK (qty > 0),
    INDEX idx_order_items_order (order_id)
);

CREATE TABLE order_status_history (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT       NOT NULL,
    from_status     VARCHAR(20)  NULL,
    to_status       VARCHAR(20)  NOT NULL,
    changed_by_type VARCHAR(10)  NOT NULL,
    changed_by_id   BIGINT       NULL,
    note            VARCHAR(300) NULL,
    created_at      DATETIME(6)  NOT NULL,
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    INDEX idx_order_status_history_order (order_id, created_at)
);

CREATE TABLE payments (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id           BIGINT         NOT NULL,
    method             VARCHAR(10)    NOT NULL,
    gateway            VARCHAR(20)    NULL,
    gateway_order_id   VARCHAR(100)   NULL,
    gateway_payment_id VARCHAR(100)   NULL,
    amount             DECIMAL(10, 2) NOT NULL,
    status             VARCHAR(20)    NOT NULL,
    raw_response       JSON           NULL,
    created_at         DATETIME(6)    NOT NULL,
    updated_at         DATETIME(6)    NOT NULL,
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT uk_payments_gateway_order UNIQUE (gateway_order_id),
    INDEX idx_payments_order (order_id)
);

CREATE TABLE idempotency_keys (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT       NOT NULL,
    idem_key   VARCHAR(100) NOT NULL,
    order_id   BIGINT       NULL,
    created_at DATETIME(6)  NOT NULL,
    CONSTRAINT uk_idempotency_user_key UNIQUE (user_id, idem_key),
    CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
