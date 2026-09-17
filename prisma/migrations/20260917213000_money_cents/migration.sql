-- AlterTable products
ALTER TABLE `products` ADD COLUMN `price_cents` INT NOT NULL DEFAULT 0;
UPDATE `products` SET `price_cents` = ROUND(`price` * 100);
ALTER TABLE `products` DROP COLUMN `price`;
ALTER TABLE `products` MODIFY COLUMN `price_cents` INT NOT NULL;

-- AlterTable orders
ALTER TABLE `orders` ADD COLUMN `total_cents` INT NOT NULL DEFAULT 0;
UPDATE `orders` SET `total_cents` = ROUND(`total` * 100);
ALTER TABLE `orders` DROP COLUMN `total`;
ALTER TABLE `orders` MODIFY COLUMN `total_cents` INT NOT NULL;

-- AlterTable order_items
ALTER TABLE `order_items` ADD COLUMN `price_cents` INT NOT NULL DEFAULT 0;
UPDATE `order_items` SET `price_cents` = ROUND(`price` * 100);
ALTER TABLE `order_items` DROP COLUMN `price`;
ALTER TABLE `order_items` MODIFY COLUMN `price_cents` INT NOT NULL;
