-- When a CFU stock option is deleted, clear recipe_lines.default_cfu_option_id that pointed at it
-- instead of blocking the delete (foreign key violation).
ALTER TABLE recipe_lines
  DROP CONSTRAINT IF EXISTS recipe_lines_default_cfu_option_id_fkey;

ALTER TABLE recipe_lines
  ADD CONSTRAINT recipe_lines_default_cfu_option_id_fkey
    FOREIGN KEY (default_cfu_option_id)
    REFERENCES ingredient_cfu_options(id)
    ON DELETE SET NULL;
