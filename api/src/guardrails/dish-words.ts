import type { IngredientTag } from "../menu/schema";
import type { MenuDish } from "../recommend/types";

// Words that state an ingredient outright. A match only ever removes a dish, so these err on the cautious side.
const STATED: [IngredientTag, RegExp][] = [
  ["pork", /\b(pork|bacon|ham|sausages?|chorizo|carnitas|pastor|prosciutto|pepperoni|salami|pancetta|blt)\b/i],
  ["beef", /\b(beef|\w*steaks?|brisket|rib-?eye|sirloin|ny strip|filet mignon|carne|barbacoa|reuben|res)\b/i],
  ["lamb", /\b(lamb|mutton|gosht|goshti)\b/i],
  ["poultry", /\b(chicken|turkey|duck|pollo|murgh)\b/i],
  ["meat", /\b(meat\w*|veal|ribs?|chops?|venison|carnivore|milanesa|franks?)\b/i],
  ["fish", /\b(\w*fish|salmon|trout|tuna|cod|anchov\w+|sardines?|pescado|halibut|tilapia)\b/i],
  ["shellfish", /\b(shrimp|prawns?|crab|lobster|oysters?|clams?|mussels?|scallops?|calamari|camaron(es)?|mariscos|seafood)\b/i],
  ["peanut", /\bpeanuts?\b/i],
  ["tree_nut", /\b(walnuts?|almonds?|pecans?|cashews?|pistachios?|hazelnuts?|macadamias?|tree nuts?|nuts)\b/i],
  ["dairy", /\b(cheese\w*|cheddar|queso|mozzarella|parm\w*|brie|ricotta|feta|milk\w*|cream\w*|(?<!peanut |almond )butter|buttermilk|yogurt|ghee)\b/i],
  ["egg", /\b(eggs?|omelets?|omelettes?|huevos?|frittata)\b/i],
  ["gluten", /\b(\w*bread\w*|pasta|noodles?|spaghetti|linguine|penne|pizzas?|calzones?|sandwich(es)?|wraps?|biscuits?|pitas?|waffles?|pancakes?|cakes?|cookies?|brownies?|dumplings?|buns?|croutons?|wheat)\b/i],
  ["soy", /\b(soy|tofu|edamame|tempeh)\b/i],
  ["sesame", /\b(sesame|tahini)\b/i],
];

// Dishes that usually contain meat but also come in plant-based versions.
const IMPLIED: [IngredientTag, RegExp][] = [
  ["beef", /\b\w*burgers?\b/i],
  ["meat", /\b(kabobs?|kebabs?|koft[ae]|doners?|gyros?|meatballs?|dogs?)\b/i],
  ["poultry", /\b(wings?|tenders?|nuggets?)\b/i],
];

const PLANT_BASED = /\b(veggie|veg|vegetarian|vegan|plant[- ]based|beyond|impossible|no[-–\s]bull)\b/i;

/**
 * Ingredients the menu's own words state, so a dish the model forgot to tag still gets filtered.
 * This never proves a dish is free of anything: a dish with no match keeps its "ask your server" flag.
 */
export function ingredientsNamed(dish: Pick<MenuDish, "name" | "description">): IngredientTag[] {
  // Strip accents so "Camarón" matches like "camaron".
  const text = [dish.name, dish.description].filter(Boolean).join(" ").normalize("NFD").replace(/\p{M}/gu, "");
  const rules = PLANT_BASED.test(text) ? STATED : [...STATED, ...IMPLIED];
  return [...new Set(rules.filter(([, words]) => words.test(text)).map(([tag]) => tag))];
}
