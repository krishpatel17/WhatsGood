// Original top-down food illustrations. They set the mood and are never presented as photos of a dish.
export type ArtKind =
  | "pizza"
  | "burger"
  | "taco"
  | "soup"
  | "noodles"
  | "kabob"
  | "salad"
  | "sandwich"
  | "meatballs"
  | "dessert"
  | "drink"
  | "dumplings"
  | "rice"
  | "steak"
  | "fish"
  | "plate";

const DISH_RULES: [ArtKind, RegExp][] = [
  ["fish", /\b(fish|salmon|trout|tuna|cod|shrimp|pescado|crab|camarones)\b/i],
  ["drink", /\b(beer(?! cheese)|ipa|ale|lager|whiskey|wine|lemonade|tea|coffee|soda)\b/i],
  ["dessert", /\b(cheesecake|cake|brownies?|cookies?|sundae|ice cream|pie|flan|churros?|sopapillas?|baklava|firni)\b/i],
  ["soup", /\b(soups?|stew|chowder|chili|(?<!green )beans|aush|korma|bisque|pozole)\b/i],
  ["salad", /\b(salads?|caprese|slaw)\b/i],
  ["pizza", /\b(pizzas?|calzones?|margherita|stromboli)\b/i],
  ["burger", /\w*burgers?\b/i],
  ["taco", /\b(tacos?|taquitos?|burritos?|quesadillas?|enchiladas?|fajitas?|tostadas?|chimichangas?)\b/i],
  ["sandwich", /\b(sandwich(es)?|panini|wraps?|melt|sub|hoagie|reuben|blt|club)\b/i],
  ["kabob", /\b(kabobs?|kebabs?|skewers?|doner)\b/i],
  ["noodles", /\b(noodles?|pasta|spaghetti|linguine|penne|ramen|fettuccine|mac|lasagna|gnocchi)\b/i],
  ["dumplings", /\b(dumplings?|mantu|aushak|momos?|gyoza|potstickers?|empanadas?)\b/i],
  ["meatballs", /\bmeatballs?\b/i],
  ["steak", /\b(steaks?|ribeye|filet|chops?|ribs?|brisket|carne asada)\b/i],
  ["rice", /\b(rice|pilaf|palau|bowl)\b/i],
];

const RESTAURANT_RULES: [ArtKind, RegExp][] = [
  ["pizza", /\bpizz/i],
  ["taco", /\b(mexican|taqueria|cantina)\b/i],
  ["kabob", /\b(kabobs?|kebabs?)\b/i],
  ["soup", /\bsoups?\b/i],
  ["noodles", /\bnoodles?\b/i],
  ["burger", /\w*burgers?\b/i],
  ["fish", /\b(sushi|seafood|oyster)\b/i],
  ["drink", /\b(tap\w*|whiskey|brew\w*|pub|bar)\b/i],
];

const firstMatch = (rules: [ArtKind, RegExp][], text: string): ArtKind =>
  rules.find(([, re]) => re.test(text))?.[0] ?? "plate";

export const dishArt = (name: string) => firstMatch(DISH_RULES, name);
export const restaurantArt = (name: string) => firstMatch(RESTAURANT_RULES, name);

/** A stable colour for a name, so a restaurant keeps its colour between visits. */
export function tileClass(name: string) {
  let hash = 7;
  for (const c of name) hash = (hash * 131 + c.charCodeAt(0)) % 9973;
  return `tile tile-${(hash >> 2) % 5}`;
}

const INK = "#191919";
const CROCK = "#FFFDF8";

function Plate({ r = 54 }: { r?: number }) {
  return (
    <>
      <circle cx="60" cy="63" r={r} fill={INK} opacity=".16" />
      <circle cx="60" cy="60" r={r} fill={CROCK} />
      <circle cx="60" cy="60" r={r - 8} fill="none" stroke="#EADFC8" strokeWidth="1.5" />
    </>
  );
}

function Bowl({ rim, fill }: { rim: string; fill: string }) {
  return (
    <>
      <circle cx="60" cy="63" r="52" fill={INK} opacity=".16" />
      <circle cx="60" cy="60" r="52" fill={rim} />
      <circle cx="60" cy="60" r="42" fill={fill} />
    </>
  );
}

const ART: Record<Exclude<ArtKind, "plate">, React.ReactNode> = {
  pizza: (
    <>
      <Plate />
      <circle cx="60" cy="60" r="43" fill="#DE9A45" />
      <circle cx="60" cy="60" r="37" fill="#D1401E" />
      <circle cx="60" cy="60" r="34" fill="#F8CA5C" />
      <path d="M60 17v86M17 60h86M30 30l60 60M90 30l-60 60" stroke="#DE9A45" strokeWidth="1.5" />
      {[[46, 42], [74, 44], [84, 66], [62, 72], [40, 76], [35, 56], [60, 52]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="6" fill="#B92D14" />
      ))}
      <ellipse cx="53" cy="62" rx="5" ry="2.5" fill="#2F7D4F" transform="rotate(-30 53 62)" />
      <ellipse cx="72" cy="56" rx="5" ry="2.5" fill="#2F7D4F" transform="rotate(40 72 56)" />
      <ellipse cx="74" cy="78" rx="5" ry="2.5" fill="#2F7D4F" transform="rotate(10 74 78)" />
    </>
  ),
  burger: (
    <>
      <Plate />
      <circle cx="58" cy="58" r="35" fill="#6FA83A" />
      <circle cx="61" cy="62" r="33" fill="#7A3B1E" />
      <circle cx="58" cy="58" r="30" fill="#D98F3D" />
      <path d="M38 48a26 26 0 0 1 24-16" fill="none" stroke="#F1BA6C" strokeWidth="5" strokeLinecap="round" />
      {[[52, 46, 20], [68, 44, -30], [76, 58, 60], [44, 62, -40], [60, 60, 10], [52, 74, 70], [70, 72, -10]].map(([x, y, a]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="3.2" ry="1.8" fill="#FFF3D6" transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </>
  ),
  taco: (
    <>
      <Plate />
      <g transform="rotate(-24 60 60)">
        <path d="M24 56a30 30 0 0 1 60 0z" fill="#EDBB63" />
        <path d="M30 56c3-5 7-3 10-6s6 2 9-1 7 2 10-1 6 3 9 0 7 3 10 8z" fill="#7A3B1E" />
        <circle cx="42" cy="52" r="3" fill="#D1401E" />
        <circle cx="62" cy="50" r="3" fill="#6FA83A" />
      </g>
      <g transform="rotate(-24 60 60) translate(10 34)">
        <path d="M24 56a30 30 0 0 1 60 0z" fill="#F4CB7D" />
        <path d="M30 56c3-5 7-3 10-6s6 2 9-1 7 2 10-1 6 3 9 0 7 3 10 8z" fill="#D1401E" />
        <circle cx="48" cy="51" r="3" fill="#FFF3D6" />
        <circle cx="68" cy="52" r="3" fill="#6FA83A" />
      </g>
    </>
  ),
  soup: (
    <>
      <Bowl rim="#1F5F45" fill="#E8642C" />
      <path d="M38 62c6-16 30-20 40-6 6 10-6 22-18 18-10-3-8-16 2-14" fill="none" stroke="#FFF3D6" strokeWidth="4" strokeLinecap="round" />
      {[[42, 44], [80, 76], [50, 84]].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x - 4} y={y - 4} width="8" height="8" rx="1.5" fill="#E9B65F" transform={`rotate(18 ${x} ${y})`} />
      ))}
      <circle cx="84" cy="46" r="2.5" fill="#2F7D4F" />
      <circle cx="36" cy="72" r="2.5" fill="#2F7D4F" />
      <circle cx="66" cy="40" r="2" fill="#2F7D4F" />
    </>
  ),
  noodles: (
    <>
      <Bowl rim={INK} fill="#F0B84A" />
      <g fill="none" stroke="#FFE7A8" strokeWidth="4" strokeLinecap="round">
        <path d="M30 56c10-10 16 8 26 0s16 8 34-2" />
        <path d="M28 68c12-10 18 8 30 0s18 6 34-2" />
        <path d="M36 80c10-8 16 6 26 0s14 4 24-4" />
        <path d="M38 42c8-6 14 6 22 0s12 4 22-2" />
      </g>
      <circle cx="78" cy="42" r="11" fill="#FFFDF8" />
      <circle cx="78" cy="42" r="5" fill="#F39A1F" />
      <circle cx="46" cy="50" r="2.5" fill="#2F7D4F" />
      <circle cx="58" cy="74" r="2.5" fill="#2F7D4F" />
      <circle cx="74" cy="66" r="2.5" fill="#2F7D4F" />
    </>
  ),
  kabob: (
    <>
      <Plate />
      {[-1, 1].map((side) => (
        <g key={side} transform={`rotate(-38 60 60) translate(0 ${side * 14})`}>
          <path d="M14 60h92" stroke="#8A5A2B" strokeWidth="3" strokeLinecap="round" />
          <rect x="26" y="50" width="14" height="20" rx="4" fill="#8C3B1F" />
          <rect x="42" y="51" width="9" height="18" rx="3" fill="#D1401E" />
          <rect x="53" y="50" width="14" height="20" rx="4" fill="#7A3B1E" />
          <rect x="69" y="51" width="9" height="18" rx="3" fill="#6FA83A" />
          <rect x="80" y="50" width="12" height="20" rx="4" fill="#8C3B1F" />
        </g>
      ))}
    </>
  ),
  salad: (
    <>
      <Bowl rim="#F2E6CF" fill="#3F8A3C" />
      {[[42, 44, 15], [70, 40, 14], [84, 62, 13], [64, 66, 16], [40, 70, 14], [58, 86, 11]].map(([x, y, r]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#7DB84A" />
      ))}
      {[[50, 54, 10], [76, 54, 9], [48, 80, 9]].map(([x, y, r]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#A5D160" />
      ))}
      <circle cx="62" cy="48" r="7" fill="#D1401E" />
      <circle cx="78" cy="74" r="7" fill="#D1401E" />
      <circle cx="38" cy="58" r="6" fill="#D1401E" />
      <rect x="56" y="70" width="10" height="10" rx="2" fill="#FFFDF8" transform="rotate(20 61 75)" />
      <rect x="70" y="60" width="8" height="8" rx="2" fill="#FFFDF8" transform="rotate(-15 74 64)" />
    </>
  ),
  sandwich: (
    <>
      <Plate />
      <g transform="translate(-4 -6)">
        <path d="M28 76 72 32l6 50z" fill="#6FA83A" />
        <path d="M26 72 70 30l4 48z" fill="#D1401E" />
        <path d="M24 68 68 26l2 46z" fill="#E6B56C" />
      </g>
      <g transform="translate(12 14)">
        <path d="M28 76 72 32l6 50z" fill="#6FA83A" />
        <path d="M26 72 70 30l4 48z" fill="#F8CA5C" />
        <path d="M24 68 68 26l2 46z" fill="#F0C583" />
      </g>
    </>
  ),
  meatballs: (
    <>
      <Plate />
      <path d="M26 58c2-20 24-32 42-26s30 22 24 42-30 28-46 20-22-20-20-36z" fill="#C73A1A" />
      {[[46, 48, 12], [72, 46, 12], [82, 68, 11], [60, 70, 13], [38, 72, 11]].map(([x, y, r]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r={r} fill="#6F351C" />
          <circle cx={x - 3} cy={y - 4} r={r / 3} fill="#9A5A32" />
        </g>
      ))}
      <ellipse cx="60" cy="50" rx="6" ry="3" fill="#2F7D4F" transform="rotate(-20 60 50)" />
    </>
  ),
  dessert: (
    <>
      <Plate />
      <path d="M36 80 58 30l34 40z" fill="#4A2412" />
      <path d="M36 80 58 30l34 40-28 4z" fill="#F7E3C5" transform="translate(0 -4)" />
      <path d="M36 76 58 26l6 2-20 46z" fill="#5A2D1A" />
      <circle cx="62" cy="52" r="7" fill="#C2183A" />
      <ellipse cx="66" cy="44" rx="5" ry="2.5" fill="#2F7D4F" transform="rotate(30 66 44)" />
      <path d="M32 92c10-4 16 3 26-1s14 2 24-3" fill="none" stroke="#C2183A" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  drink: (
    <>
      <ellipse cx="60" cy="108" rx="34" ry="5" fill={INK} opacity=".16" />
      <path d="M78 46h10a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H78" fill="none" stroke="#FFFDF8" strokeWidth="7" />
      <rect x="32" y="30" width="50" height="76" rx="7" fill="#E08A1E" />
      <rect x="32" y="30" width="50" height="76" rx="7" fill="none" stroke="#FFFDF8" strokeWidth="3" />
      <path d="M42 54v40M56 54v40M70 54v40" stroke="#F4B34E" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 34c-3-12 11-20 19-13 5-9 21-9 25 0 9-4 19 6 14 15-1 8-13 10-16 4-5 6-13 6-17 0-6 7-22 4-25-6z" fill="#FFFDF8" />
    </>
  ),
  dumplings: (
    <>
      <Plate />
      {[0, 72, 144, 216, 288].map((a) => (
        <g key={a} transform={`rotate(${a} 60 60)`}>
          <path d="M42 32c2-14 34-14 36 0-8 8-28 8-36 0z" fill="#F3E2BE" />
          <path d="M47 25v5M54 22v6M61 21v7M68 23v6M74 26v4" stroke="#D9BE8A" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ))}
      <circle cx="60" cy="60" r="13" fill={INK} />
      <circle cx="60" cy="60" r="9" fill="#7A3B1E" />
    </>
  ),
  rice: (
    <>
      <Bowl rim="#4A2240" fill="#FBF4E4" />
      {[[42, 46, 20], [52, 38, -30], [66, 42, 50], [78, 50, 10], [84, 66, -40], [70, 58, -10], [52, 58, 30], [40, 66, -20], [48, 78, 60], [62, 74, 0], [76, 80, 35], [60, 88, -50], [34, 56, 80]].map(([x, y, a]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="3.5" ry="1.6" fill="#E3D4AE" transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <path d="M66 62c6-8 18-6 20 2s-8 16-16 12-8-8-4-14z" fill="#8C3B1F" />
      <circle cx="46" cy="50" r="3" fill="#D1401E" />
      <circle cx="56" cy="46" r="2.5" fill="#2F7D4F" />
    </>
  ),
  steak: (
    <>
      <Plate />
      <path d="M28 54c2-18 28-28 48-20s24 30 12 42-36 14-48 6-14-16-12-28z" fill="#FFF3D6" />
      <path d="M33 56c2-14 24-24 41-17s20 26 10 36-31 12-41 5-11-13-10-24z" fill="#7A3B1E" />
      <path d="M44 42 72 74M56 36l26 30M36 54l26 28" stroke="#4A2412" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="86" cy="36" rx="6" ry="3" fill="#2F7D4F" transform="rotate(-40 86 36)" />
    </>
  ),
  fish: (
    <>
      <Plate />
      <path d="M26 64c10-20 42-26 66-14-6 22-40 34-66 14z" fill="#F08A5D" />
      <path d="M38 62c10-6 28-10 44-8M42 68c10-4 22-6 32-6" fill="none" stroke="#FFD9C4" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M72 82a11 11 0 0 1 22 0z" fill="#F8D648" transform="rotate(-20 83 82)" />
      <path d="M72 82a11 11 0 0 1 22 0z" fill="none" stroke="#FFFDF8" strokeWidth="2" transform="rotate(-20 83 82)" />
      <ellipse cx="38" cy="42" rx="6" ry="3" fill="#2F7D4F" transform="rotate(-30 38 42)" />
    </>
  ),
};

/** Decorative: hidden from assistive tech. Without a known dish, shows a place setting, with an initial if given. */
export function FoodArt({ kind, initial }: { kind: ArtKind; initial?: string }) {
  return (
    <svg className="food-art" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {kind === "plate" ? (
        <>
          <path d="M12 26v14c0 5 3 7 5 8v44M8 26v12M17 26v12" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M106 26c-5 6-6 16-5 24h5v42" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <Plate r={38} />
          {initial ? (
            <text x="60" y="71" textAnchor="middle" className="art-initial">{initial}</text>
          ) : (
            <>
              <ellipse cx="54" cy="58" rx="9" ry="4.5" fill="#2F7D4F" transform="rotate(-30 54 58)" />
              <ellipse cx="66" cy="62" rx="9" ry="4.5" fill="#6FA83A" transform="rotate(25 66 62)" />
              <circle cx="60" cy="72" r="4" fill="#D1401E" />
            </>
          )}
        </>
      ) : (
        ART[kind]
      )}
    </svg>
  );
}
