// Model-shaped menu for test/fixtures/menu-easy.html.
import type { Menu } from "../../src/menu/schema";

export const easyMenu: Menu = {
  dishes: [
    {
      name: "Dan Dan Noodles",
      section: "Noodles",
      price: 14,
      description: "Wheat noodles, chili oil, ground pork, peanuts.",
      tags: [
        { tag: "gluten", source: "stated" },
        { tag: "pork", source: "stated" },
        { tag: "peanut", source: "stated" },
        { tag: "spicy", source: "inferred" },
      ],
    },
    {
      name: "Cumin Lamb Noodles (Spicy)",
      section: "Noodles",
      price: 16.5,
      description: "Hand-pulled noodles, cumin lamb, scallion.",
      tags: [
        { tag: "gluten", source: "stated" },
        { tag: "lamb", source: "stated" },
        { tag: "spicy", source: "stated" },
      ],
    },
    { name: "Garlic Bok Choy Noodles", section: "Noodles", price: 12, description: "Vegetarian.", tags: [{ tag: "gluten", source: "inferred" }] },
    { name: "Pork Dumplings", section: "Dumplings", price: 9, description: "Six pieces, black vinegar.", tags: [{ tag: "pork", source: "stated" }] },
    { name: "Vegetable Dumplings", section: "Dumplings", price: 8, description: "Cabbage, mushroom, tofu.", tags: [{ tag: "soy", source: "stated" }] },
  ],
};
