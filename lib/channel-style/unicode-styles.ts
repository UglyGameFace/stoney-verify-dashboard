export type UnicodeReadability = "good" | "medium" | "poor";
export type UnicodeRisk = "low" | "medium" | "high";

export type UnicodeStyleId =
  | "normal"
  | "bold_sans"
  | "italic_sans"
  | "bold_italic_sans"
  | "monospace"
  | "fullwidth"
  | "serif_bold"
  | "serif_italic"
  | "serif_bold_italic"
  | "script"
  | "bold_script"
  | "fraktur"
  | "bold_fraktur"
  | "circled"
  | "parenthesized"
  | "small_caps"
  | "upside_down";

export type UnicodeSafetyLevel =
  | "recommended_readability"
  | "allow_decorative_with_warnings"
  | "allow_unicode_everywhere";

export type UnicodeStyleMeta = {
  id: UnicodeStyleId;
  label: string;
  description: string;
  example: string;
  readability: UnicodeReadability;
  screenReaderRisk: UnicodeRisk;
  searchRisk: UnicodeRisk;
  renderRisk: UnicodeRisk;
  recommendedForCritical: boolean;
  decorative: boolean;
  warning: string;
};

const A = "abcdefghijklmnopqrstuvwxyz";
const Z = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const D = "0123456789";

function rangeMap(from: string, startCodePoint: number): Record<string, string> {
  const out: Record<string, string> = {};
  [...from].forEach((char, index) => {
    out[char] = String.fromCodePoint(startCodePoint + index);
  });
  return out;
}

function explicitMap(entries: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(entries);
}

const MAPS: Record<Exclude<UnicodeStyleId, "normal">, Record<string, string>> = {
  bold_sans: {
    ...rangeMap(Z, 0x1d5d4),
    ...rangeMap(A, 0x1d5ee),
    ...rangeMap(D, 0x1d7ec),
  },
  italic_sans: {
    ...rangeMap(Z, 0x1d608),
    ...rangeMap(A, 0x1d622),
  },
  bold_italic_sans: {
    ...rangeMap(Z, 0x1d63c),
    ...rangeMap(A, 0x1d656),
  },
  monospace: {
    ...rangeMap(Z, 0x1d670),
    ...rangeMap(A, 0x1d68a),
    ...rangeMap(D, 0x1d7f6),
  },
  fullwidth: {
    ...rangeMap(Z, 0xff21),
    ...rangeMap(A, 0xff41),
    ...rangeMap(D, 0xff10),
    "-": "－",
    " ": "　",
  },
  serif_bold: {
    ...rangeMap(Z, 0x1d400),
    ...rangeMap(A, 0x1d41a),
    ...rangeMap(D, 0x1d7ce),
  },
  serif_italic: {
    ...rangeMap(Z, 0x1d434),
    ...rangeMap(A, 0x1d44e),
    h: "ℎ",
  },
  serif_bold_italic: {
    ...rangeMap(Z, 0x1d468),
    ...rangeMap(A, 0x1d482),
  },
  script: {
    ...rangeMap(Z, 0x1d49c),
    ...rangeMap(A, 0x1d4b6),
    B: "ℬ",
    E: "ℰ",
    F: "ℱ",
    H: "ℋ",
    I: "ℐ",
    L: "ℒ",
    M: "ℳ",
    R: "ℛ",
    e: "ℯ",
    g: "ℊ",
    o: "ℴ",
  },
  bold_script: {
    ...rangeMap(Z, 0x1d4d0),
    ...rangeMap(A, 0x1d4ea),
  },
  fraktur: {
    ...rangeMap(Z, 0x1d504),
    ...rangeMap(A, 0x1d51e),
    C: "ℭ",
    H: "ℌ",
    I: "ℑ",
    R: "ℜ",
    Z: "ℨ",
  },
  bold_fraktur: {
    ...rangeMap(Z, 0x1d56c),
    ...rangeMap(A, 0x1d586),
  },
  circled: {
    ...rangeMap(Z, 0x24b6),
    ...rangeMap(A, 0x24d0),
    ...rangeMap(D, 0x24ea),
    "0": "⓪",
    "1": "①",
    "2": "②",
    "3": "③",
    "4": "④",
    "5": "⑤",
    "6": "⑥",
    "7": "⑦",
    "8": "⑧",
    "9": "⑨",
  },
  parenthesized: {
    ...explicitMap([
      ["a", "⒜"], ["b", "⒝"], ["c", "⒞"], ["d", "⒟"], ["e", "⒠"], ["f", "⒡"], ["g", "⒢"], ["h", "⒣"], ["i", "⒤"], ["j", "⒥"], ["k", "⒦"], ["l", "⒧"], ["m", "⒨"], ["n", "⒩"], ["o", "⒪"], ["p", "⒫"], ["q", "⒬"], ["r", "⒭"], ["s", "⒮"], ["t", "⒯"], ["u", "⒰"], ["v", "⒱"], ["w", "⒲"], ["x", "⒳"], ["y", "⒴"], ["z", "⒵"],
      ["1", "⑴"], ["2", "⑵"], ["3", "⑶"], ["4", "⑷"], ["5", "⑸"], ["6", "⑹"], ["7", "⑺"], ["8", "⑻"], ["9", "⑼"],
    ]),
  },
  small_caps: explicitMap([
    ["a", "ᴀ"], ["b", "ʙ"], ["c", "ᴄ"], ["d", "ᴅ"], ["e", "ᴇ"], ["f", "ꜰ"], ["g", "ɢ"], ["h", "ʜ"], ["i", "ɪ"], ["j", "ᴊ"], ["k", "ᴋ"], ["l", "ʟ"], ["m", "ᴍ"], ["n", "ɴ"], ["o", "ᴏ"], ["p", "ᴘ"], ["q", "ǫ"], ["r", "ʀ"], ["s", "ꜱ"], ["t", "ᴛ"], ["u", "ᴜ"], ["v", "ᴠ"], ["w", "ᴡ"], ["x", "x"], ["y", "ʏ"], ["z", "ᴢ"],
  ]),
  upside_down: explicitMap([
    ["a", "ɐ"], ["b", "q"], ["c", "ɔ"], ["d", "p"], ["e", "ǝ"], ["f", "ɟ"], ["g", "ƃ"], ["h", "ɥ"], ["i", "ᴉ"], ["j", "ɾ"], ["k", "ʞ"], ["l", "l"], ["m", "ɯ"], ["n", "u"], ["o", "o"], ["p", "d"], ["q", "b"], ["r", "ɹ"], ["s", "s"], ["t", "ʇ"], ["u", "n"], ["v", "ʌ"], ["w", "ʍ"], ["x", "x"], ["y", "ʎ"], ["z", "z"],
    ["A", "∀"], ["B", "B"], ["C", "Ɔ"], ["D", "D"], ["E", "Ǝ"], ["F", "Ⅎ"], ["G", "פ"], ["H", "H"], ["I", "I"], ["J", "ſ"], ["K", "K"], ["L", "˥"], ["M", "W"], ["N", "N"], ["O", "O"], ["P", "Ԁ"], ["Q", "Q"], ["R", "R"], ["S", "S"], ["T", "⊥"], ["U", "Ո"], ["V", "Λ"], ["W", "M"], ["X", "X"], ["Y", "⅄"], ["Z", "Z"],
    ["1", "Ɩ"], ["2", "ᄅ"], ["3", "Ɛ"], ["4", "ㄣ"], ["5", "ϛ"], ["6", "9"], ["7", "ㄥ"], ["8", "8"], ["9", "6"], ["0", "0"], ["-", "-"], ["_", "‾"],
  ]),
};

export const UNICODE_STYLES: UnicodeStyleMeta[] = [
  {
    id: "normal",
    label: "Normal",
    description: "Plain readable text. Best for important channels and setup defaults.",
    example: "gaming-clips",
    readability: "good",
    screenReaderRisk: "low",
    searchRisk: "low",
    renderRisk: "low",
    recommendedForCritical: true,
    decorative: false,
    warning: "No Unicode styling applied.",
  },
  {
    id: "bold_sans",
    label: "Bold Sans",
    description: "Readable bold Unicode lookalike letters.",
    example: "𝗴𝗮𝗺𝗶𝗻𝗴-𝗰𝗹𝗶𝗽𝘀",
    readability: "good",
    screenReaderRisk: "medium",
    searchRisk: "medium",
    renderRisk: "low",
    recommendedForCritical: true,
    decorative: false,
    warning: "Bold Unicode may not search like normal text and may be read strangely by screen readers.",
  },
  {
    id: "italic_sans",
    label: "Italic Sans",
    description: "Slanted Unicode lookalike letters.",
    example: "𝘨𝘢𝘮𝘪𝘯𝘨-𝘤𝘭𝘪𝘱𝘴",
    readability: "medium",
    screenReaderRisk: "medium",
    searchRisk: "medium",
    renderRisk: "low",
    recommendedForCritical: false,
    decorative: false,
    warning: "Italic Unicode is less readable on some mobile screens and may hurt search/accessibility.",
  },
  {
    id: "bold_italic_sans",
    label: "Bold Italic Sans",
    description: "Bold slanted Unicode lookalike letters.",
    example: "𝙜𝙖𝙢𝙞𝙣𝙜-𝙘𝙡𝙞𝙥𝙨",
    readability: "medium",
    screenReaderRisk: "medium",
    searchRisk: "medium",
    renderRisk: "low",
    recommendedForCritical: false,
    decorative: false,
    warning: "Bold italic Unicode can be harder to read and search than normal channel names.",
  },
  {
    id: "monospace",
    label: "Monospace",
    description: "Code-like Unicode letters.",
    example: "𝚐𝚊𝚖𝚒𝚗𝚐-𝚌𝚕𝚒𝚙𝚜",
    readability: "good",
    screenReaderRisk: "medium",
    searchRisk: "medium",
    renderRisk: "low",
    recommendedForCritical: true,
    decorative: false,
    warning: "Monospace Unicode is usually readable but still may affect search and screen readers.",
  },
  {
    id: "fullwidth",
    label: "Fullwidth",
    description: "Wide Unicode letters with a spaced-out look.",
    example: "ｇａｍｉｎｇ－ｃｌｉｐｓ",
    readability: "medium",
    screenReaderRisk: "medium",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Fullwidth text changes spacing and may render differently across devices.",
  },
  {
    id: "serif_bold",
    label: "Serif Bold",
    description: "Classic bold Unicode letters.",
    example: "𝐠𝐚𝐦𝐢𝐧𝐠-𝐜𝐥𝐢𝐩𝐬",
    readability: "good",
    screenReaderRisk: "medium",
    searchRisk: "medium",
    renderRisk: "low",
    recommendedForCritical: false,
    decorative: true,
    warning: "Serif bold is readable but still not normal text for search or accessibility tools.",
  },
  {
    id: "serif_italic",
    label: "Serif Italic",
    description: "Classic italic Unicode letters.",
    example: "𝑔𝑎𝑚𝑖𝑛𝑔-𝑐𝑙𝑖𝑝𝑠",
    readability: "medium",
    screenReaderRisk: "medium",
    searchRisk: "medium",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Italic Unicode may be harder to read on mobile and may not map cleanly to search.",
  },
  {
    id: "serif_bold_italic",
    label: "Serif Bold Italic",
    description: "Classic bold italic Unicode letters.",
    example: "𝒈𝒂𝒎𝒊𝒏𝒈-𝒄𝒍𝒊𝒑𝒔",
    readability: "medium",
    screenReaderRisk: "medium",
    searchRisk: "medium",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Bold italic Unicode should stay decorative, not critical.",
  },
  {
    id: "script",
    label: "Script",
    description: "Cursive Unicode lookalike letters.",
    example: "𝑔𝒶𝓂𝒾𝓃𝑔-𝒸𝓁𝒾𝓅𝓈",
    readability: "poor",
    screenReaderRisk: "high",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Script Unicode is decorative and can be difficult to read, search, or use with screen readers.",
  },
  {
    id: "bold_script",
    label: "Bold Script",
    description: "Bold cursive Unicode lookalike letters.",
    example: "𝓰𝓪𝓶𝓲𝓷𝓰-𝓬𝓵𝓲𝓹𝓼",
    readability: "poor",
    screenReaderRisk: "high",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Bold script is high-risk decorative Unicode. Avoid it for rules, verify, tickets, support, and logs.",
  },
  {
    id: "fraktur",
    label: "Fraktur / Gothic",
    description: "Gothic Unicode lookalike letters.",
    example: "𝔤𝔞𝔪𝔦𝔫𝔤-𝔠𝔩𝔦𝔭𝔰",
    readability: "poor",
    screenReaderRisk: "high",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Gothic Unicode is hard to read and high-risk for accessibility/search.",
  },
  {
    id: "bold_fraktur",
    label: "Bold Fraktur",
    description: "Heavy gothic Unicode lookalike letters.",
    example: "𝖌𝖆𝖒𝖎𝖓𝖌-𝖈𝖑𝖎𝖕𝖘",
    readability: "poor",
    screenReaderRisk: "high",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Bold gothic Unicode is decorative only. Strong warning for critical channels.",
  },
  {
    id: "circled",
    label: "Circled",
    description: "Circled Unicode characters.",
    example: "ⓖⓐⓜⓘⓝⓖ-ⓒⓛⓘⓟⓢ",
    readability: "poor",
    screenReaderRisk: "high",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Circled characters are decorative and can be annoying to search or read.",
  },
  {
    id: "parenthesized",
    label: "Parenthesized",
    description: "Parenthesized lowercase Unicode characters.",
    example: "⒢⒜⒨⒤⒩⒢-⒞⒧⒤⒫⒮",
    readability: "poor",
    screenReaderRisk: "high",
    searchRisk: "high",
    renderRisk: "high",
    recommendedForCritical: false,
    decorative: true,
    warning: "This style has limited character coverage and may look broken on some devices.",
  },
  {
    id: "small_caps",
    label: "Small Caps",
    description: "Compact small-cap Unicode characters where available.",
    example: "ɢᴀᴍɪɴɢ-ᴄʟɪᴘꜱ",
    readability: "medium",
    screenReaderRisk: "medium",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Small caps has incomplete coverage and can hurt search/readability.",
  },
  {
    id: "upside_down",
    label: "Upside Down",
    description: "Flipped decorative Unicode characters.",
    example: "ƃuᴉɯɐƃ-sdᴉlɔ",
    readability: "poor",
    screenReaderRisk: "high",
    searchRisk: "high",
    renderRisk: "medium",
    recommendedForCritical: false,
    decorative: true,
    warning: "Upside-down text is novelty-only and should not be used for important server navigation.",
  },
];

export const UNICODE_STYLE_BY_ID: Record<UnicodeStyleId, UnicodeStyleMeta> = Object.fromEntries(
  UNICODE_STYLES.map((style) => [style.id, style]),
) as Record<UnicodeStyleId, UnicodeStyleMeta>;

export type UnicodeTransformResult = {
  value: string;
  style: UnicodeStyleMeta;
  unsupportedCharacters: string[];
  changed: boolean;
};

export function transformUnicodeStyle(input: string, styleId: UnicodeStyleId = "normal"): UnicodeTransformResult {
  const style = UNICODE_STYLE_BY_ID[styleId] ?? UNICODE_STYLE_BY_ID.normal;
  const text = String(input ?? "");

  if (style.id === "normal") {
    return { value: text, style, unsupportedCharacters: [], changed: false };
  }

  const map = MAPS[style.id];
  const unsupported = new Set<string>();
  const chars = [...text];
  const transformed = chars.map((char) => {
    if (Object.prototype.hasOwnProperty.call(map, char)) {
      return map[char];
    }
    if (/^[A-Za-z0-9]$/.test(char)) {
      unsupported.add(char);
    }
    return char;
  });

  if (style.id === "upside_down") {
    transformed.reverse();
  }

  const value = transformed.join("");
  return {
    value,
    style,
    unsupportedCharacters: [...unsupported],
    changed: value !== text,
  };
}

export function getUnicodeStyle(styleId: UnicodeStyleId | string | null | undefined): UnicodeStyleMeta {
  const id = String(styleId || "normal") as UnicodeStyleId;
  return UNICODE_STYLE_BY_ID[id] ?? UNICODE_STYLE_BY_ID.normal;
}

export function isUnicodeStyleAllowed(styleId: UnicodeStyleId, safetyLevel: UnicodeSafetyLevel): boolean {
  const style = getUnicodeStyle(styleId);
  if (safetyLevel === "allow_unicode_everywhere") return true;
  if (safetyLevel === "allow_decorative_with_warnings") return true;
  return style.readability === "good" && style.searchRisk !== "high";
}
