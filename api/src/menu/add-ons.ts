// Add-ons are not dishes you order on their own: "Add chicken to any salad", "Extra topping".
// One rule for both the hand-copied answer keys (US-18) and the importer (A2 v3).
const ADD_ON = /^add\b|^(extra|sub(stitute)?)\b.*\b(topp?ings?|cheese|sauces?|dressings?|proteins?|chicken|meat|shots?|eggs?|avocado|bacon)\b/i;

export const isAddOn = (name: string): boolean => ADD_ON.test(name.trim());
