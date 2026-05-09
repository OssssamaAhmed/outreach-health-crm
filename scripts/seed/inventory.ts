/**
 * Synthetic inventory generator.
 *
 * Picks ~30 items from the curated inventory list with randomized
 * quantities and cost-centre assignments. Output matches the
 * inventoryData shape in server/seed.ts.
 */
import { faker } from "@faker-js/faker";
import { COST_CENTRES, INVENTORY_ITEMS } from "./_data/names";

export type InventoryRow = {
  name: string;
  category: string;
  costCentre: string;
  quantity: number;
  unit: string;
};

export function generateInventoryItems(seed = 43): InventoryRow[] {
  faker.seed(seed);
  return INVENTORY_ITEMS.map((item) => ({
    name: item.name,
    category: item.category,
    costCentre: faker.helpers.arrayElement(COST_CENTRES),
    quantity: faker.number.int({ min: 1, max: 20 }),
    unit: item.unit,
  }));
}
