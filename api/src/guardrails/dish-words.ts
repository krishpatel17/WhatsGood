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

// Strip accents so "Camarón" matches like "camaron".
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

const dishText = (dish: Pick<MenuDish, "name" | "description">) => plain([dish.name, dish.description].filter(Boolean).join(" "));

const rulesFor = (text: string) => (PLANT_BASED.test(text) ? STATED : [...STATED, ...IMPLIED]);

/**
 * Ingredients the menu's own words state, so a dish the model forgot to tag still gets filtered.
 * This never proves a dish is free of anything: a dish with no match keeps its "ask your server" flag.
 */
export function ingredientsNamed(dish: Pick<MenuDish, "name" | "description">): IngredientTag[] {
  const text = dishText(dish);
  return [...new Set(rulesFor(text).filter(([, words]) => words.test(text)).map(([tag]) => tag))];
}

/**
 * Ingredients a model's reason names, with the word that named them. Only the dish's own words can make
 * it plant-based: a reason saying "a burger beyond compare" doesn't. Naming one in any phrasing counts, so
 * "no pork" is caught too, since that's a safety claim. This can't prove a reason is free of a conflict.
 */
export function ingredientsInReason(reason: string, dish: Pick<MenuDish, "name" | "description">): { tag: IngredientTag; word: string }[] {
  // "Tender" describes texture in prose. "Tenders" is still the dish.
  const text = plain(reason).replace(/\btender\b/gi, " ");
  return rulesFor(dishText(dish)).flatMap(([tag, words]) => {
    const hit = text.match(words);
    return hit ? [{ tag, word: hit[0].toLowerCase() }] : [];
  });
}
