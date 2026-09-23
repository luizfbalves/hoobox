-- Unicidade usada nos lookups por nome
CREATE UNIQUE INDEX `customers_name_key` ON `customers`(`name`);
CREATE UNIQUE INDEX `products_name_key` ON `products`(`name`);

-- Estoque inicial fixo
ALTER TABLE `products` ALTER COLUMN `stock` SET DEFAULT 5;

-- Correlation ID e índice da listagem paginada
ALTER TABLE `orders` ADD COLUMN `correlation_id` VARCHAR(36) NULL;
CREATE INDEX `orders_createdAt_id_idx` ON `orders`(`createdAt`, `id`);

-- Defesa no banco (fora do schema Prisma; MySQL 8.0.16+ aplica CHECK)
ALTER TABLE `products` ADD CONSTRAINT `products_stock_non_negative` CHECK (`stock` >= 0);
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_quantity_positive` CHECK (`quantity` > 0);

-- Transactional outbox
CREATE TABLE `outbox_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `aggregate_id` INTEGER NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `published_at` DATETIME(3) NULL,

    INDEX `outbox_events_published_at_id_idx`(`published_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Usuários de teste para JWT
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
