// Shape of Apify's Google Maps reviews scraper dataset items (fields we use plus some we ignore).
export const apifyItems = [
  {
    reviewId: "g-001",
    name: "A. Reviewer",
    text: "The dan dan noodles are great but skip the dumplings.",
    stars: 4,
    publishedAtDate: "2026-09-14T18:22:05.000Z",
    reviewUrl: "https://maps.example/r/g-001",
    likesCount: 2,
  },
  {
    reviewId: "g-002",
    name: "B. Reviewer",
    text: "Cumin lamb noodles were spicy and perfect. Get them.",
    stars: 5,
    publishedAtDate: "2026-10-02T12:00:00.000Z",
  },
  { reviewId: "g-003", name: "C. Reviewer", text: null, stars: 3, publishedAtDate: "2026-10-03T12:00:00.000Z" },
  { reviewId: "g-004", name: "D. Reviewer", text: "Pork dumplings were soggy.", stars: 2, publishedAtDate: "2026-10-05T09:30:00.000Z" },
];
