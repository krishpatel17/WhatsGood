// Exploratory A2 score, added after the v4 run (not pre-registered): the MVP ranks food dishes,
// so this view leaves drinks, sauces and toppings out of both the answer key and the import.
// Only generic menu words are used, so restaurant-specific section names don't count.

const NOT_FOOD_SECTION =
  /\b(wines?|whites|reds|sparkling|beers?|drafts?|drinks?|beverages?|cocktails?|spirits?|liquors?|bar|happy hour|juices?|sodas?|soft drinks?|coffees?|teas?|toppings?|sauces?|dressings?|condiments?|add[- ]?ons?|extras?)\b/i;
// "é" is not a word character, so rosé needs its own boundaries.
const ROSE = /(^|[^a-z])ros[ée]s?($|[^a-z])/i;
const NOT_FOOD_NAME = /\b(wines?|beers?|juices?|sodas?|beverages?|sauces?|dressings?|toppings?)\b/i;

export function isFoodDish(d: { name: string; section: string }): boolean {
  return !(NOT_FOOD_SECTION.test(d.section) || ROSE.test(d.section) || NOT_FOOD_NAME.test(d.name));
}
