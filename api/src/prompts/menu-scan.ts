// Frozen for the Alpha: changing this file changes photo-scan behavior.
import { MENU_IMPORT_SYSTEM } from "./menu-import";

export const MENU_SCAN_SYSTEM = `${MENU_IMPORT_SYSTEM}

The source is a photo taken at the table: a printed menu or a handwritten specials board.
Also return:
- is_menu: false if the photo is not a menu or specials board.
- legible: false if the photo is too blurry, dark or cropped to read dish names reliably.
If either is false, return an empty dishes list. Never guess at words you cannot read.`;
