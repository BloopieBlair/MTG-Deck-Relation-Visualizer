

import type { KeywordStyle, CardGameData, ManaSymbol } from './types';
import { v4 as uuidv4 } from 'uuid';

export const PLACEHOLDER_CARD_IMAGE_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680" fill="%23111827"><rect width="488" height="680" rx="20" fill="%23111827" stroke="%23374151" stroke-width="6"/><text x="50%25" y="46%25" dominant-baseline="middle" text-anchor="middle" fill="%2306B6D4" font-family="sans-serif" font-size="24" font-weight="bold">MTG CARD ART</text><text x="50%25" y="54%25" dominant-baseline="middle" text-anchor="middle" fill="%239CA3AF" font-family="sans-serif" font-size="16">Image Not Available</text></svg>`;


export const MOCK_CARD_DATABASE: Record<string, CardGameData> = {
  // Basic Lands
  "Plains": { keywords: ["land"], text: "T: Add {W}.", imageUrl: "https://cards.scryfall.io/normal/front/1/2/12cff32a-a365-43ee-a196-8ce32b3bb9fd.jpg?1743205092", manaCostString: "", producesMana: ["W"] },
  "Island": { keywords: ["land"], text: "T: Add {U}.", imageUrl: "https://cards.scryfall.io/normal/front/1/f/1ff6acc9-581c-468f-894d-41f725da7f33.jpg", manaCostString: "", producesMana: ["U"] },
  "Swamp": { keywords: ["land"], text: "T: Add {B}.", imageUrl: "https://cards.scryfall.io/normal/front/f/0/f0bfdb9e-318f-4acd-9fbd-41b98a8875d6.jpg", manaCostString: "", producesMana: ["B"] },
  "Mountain": { keywords: ["land"], text: "T: Add {R}.", imageUrl: "https://cards.scryfall.io/normal/front/b/f/bfa10a88-12e0-4b79-80bb-6f4620277e20.jpg", manaCostString: "", producesMana: ["R"] },
  "Forest": { keywords: ["land"], text: "T: Add {G}.", imageUrl: "https://cards.scryfall.io/normal/front/8/1/8100bceb-ffba-487a-bb45-4fe2a156a8dc.jpg", manaCostString: "", producesMana: ["G"] },

  // Artifacts
  "Sol Ring": { keywords: ["mana ramp", "artifact"], text: "{T}: Add {C}{C}.", imageUrl: "https://cards.scryfall.io/normal/front/2/d/2d47121d-8b90-4286-b91b-d340d9c17a00.jpg?1706241087", manaCostString: "{1}", producesMana: ["C", "C"] },
  "Sensei's Divining Top": { keywords: ["card selection", "artifact"], text: "{1}: Look at the top three cards of your library, then put them back in any order.\n{T}: Draw a card, then put Sensei's Divining Top on top of its owner's library.", imageUrl: "https://cards.scryfall.io/normal/front/e/5/e5142b2a-e580-4737-a4aa-2590f6610ceb.jpg?1673149430", manaCostString: "{1}" },
  "Skullclamp": { keywords: ["card draw", "equipment", "sacrifice"], text: "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}", imageUrl: "https://cards.scryfall.io/normal/front/a/3/a36fd6d8-66a2-49ea-b1b5-469169b39941.jpg?1699452260", manaCostString: "{1}" },
  
  // Creatures with common keywords
  "Serra Angel": { keywords: ["flying", "vigilance", "angel", "creature"], text: "Flying, Vigilance", imageUrl: "https://cards.scryfall.io/normal/front/0/8/081c07f8-d1a3-4b9a-ac65-65a047360138.jpg?1690542610", manaCostString: "{3}{W}{W}" },
  "Shivan Dragon": { keywords: ["flying", "firebreathing", "dragon", "creature"], text: "Flying\n{R}: Shivan Dragon gets +1/+0 until end of turn.", imageUrl: "https://cards.scryfall.io/normal/front/9/7/97389260-5954-478a-8294-95c16c341a03.jpg?1687906553", manaCostString: "{4}{R}{R}" },
  "Llanowar Elves": { keywords: ["mana dork", "elf", "creature"], text: "{T}: Add {G}.", imageUrl: "https://cards.scryfall.io/normal/front/7/3/73542493-cd0b-4bb7-a5b8-8f889c76e4d6.jpg?1605281272", manaCostString: "{G}", producesMana: ["G"] },
  "Birds of Paradise": { keywords: ["mana dork", "flying", "bird", "creature"], text: "Flying\n{T}: Add one mana of any color.", imageUrl: "https://cards.scryfall.io/normal/front/3/d/3d69a3e0-6a2e-475a-964e-0aff910d6776.jpg?1702429545", manaCostString: "{G}", producesMana: ["W", "U", "B", "R", "G"] },
  "Giant Spider": { keywords: ["reach", "spider", "creature"], text: "Reach", imageUrl: "https://cards.scryfall.io/normal/front/8/0/80996b0d-cd44-445e-96de-677e00182551.jpg?1562828861", manaCostString: "{3}{G}" },
  "Grizzly Bears": { keywords: ["vanilla", "bear", "creature"], text: "A simple 2/2 creature.", imageUrl: "https://cards.scryfall.io/normal/front/4/0/409f9b88-f03e-40b6-9883-68c14c37c0de.jpg?1562546736", manaCostString: "{1}{G}" },
  "Vampire Nighthawk": { keywords: ["flying", "deathtouch", "lifelink", "vampire", "creature"], text: "Flying, deathtouch, lifelink.", imageUrl: "https://cards.scryfall.io/normal/front/3/0/301ff69c-2590-450c-9e16-6d21bb807a33.jpg?1641602963", manaCostString: "{1}{B}{B}" },
  "Eternal Witness": { keywords: ["recursion", "human", "shaman", "creature"], text: "When Eternal Witness enters the battlefield, you may return target card from your graveyard to your hand.", imageUrl: "https://cards.scryfall.io/normal/front/3/9/39704000-65d3-4d39-8495-a9b617376bbc.jpg?1689998488", manaCostString: "{1}{G}{G}" },
  "Snapcaster Mage": { keywords: ["flash", "spell recursion", "human", "wizard", "creature"], text: "Flash\nWhen Snapcaster Mage enters the battlefield, target instant or sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost.", imageUrl: "https://cards.scryfall.io/normal/front/7/e/7e41765e-43fe-461d-baeb-ee30d13d2d93.jpg?1547516526", manaCostString: "{1}{U}" },
  "Tarmogoyf": { keywords: ["grows", "lhurgoyf", "creature"], text: "Tarmogoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.", imageUrl: "https://cards.scryfall.io/normal/front/6/9/69daba76-96e8-4bcc-ab79-2f00189ad8fb.jpg?1619398799", manaCostString: "{1}{G}" },
  "Dark Confidant": { keywords: ["card draw", "risk/reward", "human", "wizard", "creature"], text: "At the beginning of your upkeep, reveal the top card of your library and put that card into your hand. You lose life equal to its mana value.", imageUrl: "https://cards.scryfall.io/normal/front/b/0/b0d8a832-ada0-4b06-a8da-5fa8f865fed8.jpg?1675644660", manaCostString: "{B}{B}" },
  "Stoneforge Mystic": { keywords: ["tutor", "equipment", "kor", "artificer", "creature"], text: "When Stoneforge Mystic enters the battlefield, you may search your library for an Equipment card, reveal it, put it into your hand, then shuffle.\n{1}{W}, {T}: You may put an Equipment card from your hand onto the battlefield.", imageUrl: "https://cards.scryfall.io/normal/front/1/d/1d34c43d-04f2-4ec0-a766-89b3d9060810.jpg?1599710314", manaCostString: "{1}{W}" },
  "Ragavan, Nimble Pilferer": { keywords: ["treasure", "dash", "monkey", "pirate", "creature", "legendary"], text: "Whenever Ragavan, Nimble Pilferer deals combat damage to a player, create a Treasure token and exile the top card of that player's library. Until end of turn, you may cast that card.\nDash {1}{R}", imageUrl: "https://cards.scryfall.io/normal/front/a/9/a9738cda-adb1-4789-a035-e9713687ac04.jpg?1675957094", manaCostString: "{R}" },

  // Spells
  "Lightning Bolt": { keywords: ["burn", "removal", "instant"], text: "Lightning Bolt deals 3 damage to any target.", imageUrl: "https://cards.scryfall.io/normal/front/7/7/7771fa98-12a3-4203-9440-014d6aca590d.jpg?1706240836", manaCostString: "{R}" },
  "Counterspell": { keywords: ["control", "counter", "instant", "removal"], text: "Counter target spell.", imageUrl: "https://cards.scryfall.io/normal/front/8/4/8493131c-0a7b-4be6-a8a2-0b425f4f693e.jpg?1689996248", manaCostString: "{U}{U}" },
  "Brainstorm": { keywords: ["card draw", "card selection", "instant"], text: "Draw three cards, then put two cards from your hand on top of your library in any order.", imageUrl: "https://cards.scryfall.io/normal/front/4/8/48070245-a370-4416-8ebd-0ecff6041610.jpg?1706240670", manaCostString: "{U}" },
  "Swords to Plowshares": { keywords: ["removal", "exile", "instant"], text: "Exile target creature. Its controller gains life equal to its power.", imageUrl: "https://cards.scryfall.io/normal/front/7/c/7cdee412-27cf-4cb7-a1ca-64207c70c1ca.jpg?1706240651", manaCostString: "{W}" },
  "Thoughtseize": { keywords: ["hand disruption", "discard", "sorcery"], text: "Target player reveals their hand. You choose a nonland card from it. That player discards that card. You lose 2 life.", imageUrl: "https://cards.scryfall.io/normal/front/b/2/b28ef13d-3196-4a39-86c2-7777b9f465f6.jpg?1706240802", manaCostString: "{B}" },
};

export const DEFAULT_KEYWORD_STYLES: KeywordStyle[] = [
  // Common Card Types (enabled by default for immediate visualization)
  { id: uuidv4(), name: "land", color: "#A0AEC0", enabled: true, glowEnabled: false },         // Tailwind Gray 500
  { id: uuidv4(), name: "creature", color: "#63B3ED", enabled: true, glowEnabled: false },     // Tailwind Blue 400
  { id: uuidv4(), name: "artifact", color: "#D69E2E", enabled: true, glowEnabled: false },     // Tailwind Yellow 600
  { id: uuidv4(), name: "enchantment", color: "#F6E05E", enabled: true, glowEnabled: false },  // Tailwind Yellow 300
  { id: uuidv4(), name: "instant", color: "#ED64A6", enabled: true, glowEnabled: false },       // Tailwind Pink 500
  { id: uuidv4(), name: "sorcery", color: "#F59E0B", enabled: true, glowEnabled: false },       // Tailwind Amber 500
  { id: uuidv4(), name: "planeswalker", color: "#4FD1C5", enabled: true, glowEnabled: false },  // Tailwind Teal 400
  { id: uuidv4(), name: "legendary", color: "#FBBF24", enabled: true, glowEnabled: false },     // Tailwind Amber 400 (Gold-ish)


  // Specific Gameplay Keywords - Revised colors
  { id: uuidv4(), name: "flying", color: "#4299E1", enabled: true, glowEnabled: false },        // Tailwind Blue 500
  { id: uuidv4(), name: "mana ramp", color: "#48BB78", enabled: true, glowEnabled: false },    // Tailwind Green 500
  { id: uuidv4(), name: "card draw", color: "#3B82F6", enabled: true, glowEnabled: false },     // Tailwind Blue 600
  { id: uuidv4(), name: "removal", color: "#F56565", enabled: true, glowEnabled: false },      // Tailwind Red 500
  { id: uuidv4(), name: "tutor", color: "#A78BFA", enabled: true, glowEnabled: false },        // Tailwind Purple 400
  { id: uuidv4(), name: "recursion", color: "#38B2AC", enabled: true, glowEnabled: false },    // Tailwind Teal 500
  { id: uuidv4(), name: "treasure", color: "#ECC94B", enabled: true, glowEnabled: false },     // Tailwind Yellow 500
  { id: uuidv4(), name: "counter", color: "#60A5FA", enabled: true, glowEnabled: false }, // Tailwind Blue 400 - For counterspells, often tied to removal


  // Other keywords (can be enabled by user)
  { id: uuidv4(), name: "lifelink", color: "#E2E8F0", enabled: false, glowEnabled: false },     // Tailwind Gray 200
  { id: uuidv4(), name: "deathtouch", color: "#805AD5", enabled: false, glowEnabled: false },   // Tailwind Purple 600
  { id: uuidv4(), name: "trample", color: "#38A169", enabled: false, glowEnabled: false },      // Tailwind Green 600
  { id: uuidv4(), name: "haste", color: "#ED8936", enabled: false, glowEnabled: false },       // Tailwind Orange 500
  { id: uuidv4(), name: "vigilance", color: "#CBD5E0", enabled: false, glowEnabled: false },   // Tailwind Gray 400
  { id: uuidv4(), name: "first strike", color: "#E53E3E", enabled: false, glowEnabled: false },// Tailwind Red 600
  { id: uuidv4(), name: "indestructible", color: "#718096", enabled: false, glowEnabled: false },// Tailwind Gray 600
];

// Default colors for pinned searches. Yellow (Gold), Green, Blue. These can be customized by the user.
export const PINNED_SEARCH_COLORS: readonly string[] = ["#FFD700", "#34D399", "#60A5FA"]; 
// Color for the current, unpinned active search highlight.
export const ACTIVE_SEARCH_HIGHLIGHT_COLOR = "#FFFFFF"; // White
// Color for the highlight when an active search yields a single result.
export const SINGLE_SEARCH_RESULT_HIGHLIGHT_COLOR = "#FFFFFF"; // White (remains white, but distinguished by repulsion)

// Link Glow
export const LINK_GLOW_FILTER_ID = "svgPathGlow";

// Sample Hand Hover Highlighting
export const HOVERED_HAND_NODE_HIGHLIGHT_COLOR = "#FFFFFF"; // White
export const HOVERED_HAND_NODE_HIGHLIGHT_STROKE_WIDTH = 2.2; 

export const HAND_LINK_HIGHLIGHT_COLOR = "#FFFFFF"; // White
export const HAND_LINK_HIGHLIGHT_STROKE_WIDTH = 1.8;
export const HAND_LINK_HIGHLIGHT_OPACITY = 0.95;

export const HAND_TO_HAND_LINK_HIGHLIGHT_COLOR = "#FFD700"; // Yellow
export const HAND_TO_HAND_LINK_HIGHLIGHT_STROKE_WIDTH = 2.2;
export const HAND_TO_HAND_LINK_HIGHLIGHT_OPACITY = 1;

// Deck List Selection Highlighting
export const DECKLIST_HIGHLIGHT_COLOR = "#FFFFFF"; // White
export const DECKLIST_HIGHLIGHT_STROKE_WIDTH = 2.5;
export const DECKLIST_LINK_HIGHLIGHT_COLOR = "#FFFFFF"; // White
export const DECKLIST_LINK_HIGHLIGHT_STROKE_WIDTH = 2.2;
export const DECKLIST_LINK_HIGHLIGHT_OPACITY = 1;


// Placeholder for sample hand images (152x212)
export const HAND_PLACEHOLDER_IMAGE_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="152" height="212" viewBox="0 0 152 212" fill="%23111827"><rect width="152" height="212" rx="10" fill="%23111827" stroke="%23374151" stroke-width="4"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239CA3AF" font-family="sans-serif" font-size="14" font-weight="bold">No Image</text></svg>`;

export const SAMPLE_DECK_ANIM_PAKAL = `Commander
1 Anim Pakal, Thousandth Moon (LCI) 223

Deck
1 Warden of the Inner Sky (LCI) 43
14 Plains (LTR) 263
13 Mountain (LTR) 269
1 Lunarch Veteran (MID) 27
1 Altar of the Brood (KTK) 216
1 Soul Warden (M10) 34
1 Anointer Priest (AKR) 3
1 Blind Obedience (WOT) 1
1 Land Tax (WOT) 9
1 Mana Tithe (STA) 8
1 Panharmonicon (KLR) 258
1 Terramorphic Expanse (ONE) 261
1 Homestead Courage (MID) 24
1 Light of Hope (IKO) 20
1 Ajani's Pridemate (WAR) 4
1 Feat of Resistance (M21) 19
1 Hallowed Priest (ANB) 9
1 Dawn of a New Age (LTR) 5
1 Abzan Falconer (J21) 2
1 Rosie Cotton of South Lane (LTR) 27
1 Light of Promise (M21) 25
1 Aurelia, the Law Above (MKM) 188
1 Mondrak, Glory Dominus (ONE) 23
1 Serra Redeemer (DMU) 282
1 Angelic Gift (M20) 5
1 Bloodlust Inciter (AKR) 140
1 Diamond Pick-Axe (LCI) 143
1 Rabbit Battery (NEO) 157
1 Cleric Class (AFR) 6
1 Ragavan, Nimble Pilferer (MUL) 86
1 Shock (ANB) 84
1 Strike It Rich (MH2) 143
1 Petrify (LCI) 30
1 Benalish Knight-Counselor (Y23) 1
1 Recommission (BRO) 22
1 Smothering Tithe (WOT) 13
1 Sticky Fingers (SNC) 124
1 Demand Answers (MKM) 122
1 Veil of Assimilation (ONE) 37
1 Quarrel's End (LTR) 141
1 Elesh Norn, Mother of Machines (ONE) 10
1 Aurelia, the Warleader (FDN) 651
1 Kumano Faces Kakkazan (NEO) 152
1 Hopeful Initiate (VOW) 20
1 Luminarch Aspirant (ZNR) 24
1 Anointed Procession (AKR) 2
1 Captivating Cave (LCI) 268
1 Mandible Justiciar (ONE) 21
1 Agatha's Soul Cauldron (WOE) 242
1 Mox Amber (BRR) 35
1 Reinforced Ronin (NEO) 158
1 Impact Tremors (WOT) 44
1 Boundary Lands Ranger (WOE) 123
1 Ajani's Welcome (M19) 6
1 Brave the Elements (M14) 10
1 Impassioned Orator (ANB) 10
1 Kor Celebrant (ZNR) 22
1 Reckless Fireweaver (KLR) 141
1 Intangible Virtue (WOT) 6
1 Harmonious Archon (ELD) 17
1 Sundown Pass (VOW) 266
1 Battlefield Forge (BRO) 257
1 Command Tower (ANB) 118
1 Karn's Bastion (WAR) 248
1 Swallow Whole (IKO) 35
1 Great Hall of the Citadel (LTR) 254
1 Ornithopter (BRR) 37
1 Case of the Gateway Express (MKM) 8
1 Not on My Watch (MKM) 28
1 Crusader of Odric (FDN) 569
1 Connecting the Dots (MKM) 118
1 Expedited Inheritance (MKM) 123
1 Warleader's Call (MKM) 242
1 Hinterland Sanctifier (FDN) 730`;

export const SAMPLE_DECK_SLIVERS = `Commander
1 Sliver Overlord (SPG) 0

Deck
4 Plains (ECL) 269
4 Island (ECL) 270
4 Swamp (ECL) 271
4 Mountain (ECL) 272
5 Forest (ECL) 273
1 Enduring Sliver (MH1) 6
1 Diffusion Sliver (J21) 33
1 Dregscape Sliver (MH1) 88
1 Leeching Sliver (J21) 57
1 Striking Sliver (J21) 88
1 Bladeback Sliver (MH1) 119
1 Belligerent Sliver (J21) 67
1 Manaweft Sliver (J21) 102
1 Predatory Sliver (J21) 104
1 Cleaving Sliver (MH1) 121
1 Tempered Sliver (MH1) 183
1 Blur Sliver (J21) 69
1 First Sliver's Chosen (MH1) 9
1 Steelform Sliver (J21) 25
1 Sentinel Sliver (J21) 23
1 Lancer Sliver (MH1) 18
1 Hollowhead Sliver (MH1) 132
1 Scuttling Sliver (MH1) 68
1 Lavabelly Sliver (MH1) 207
1 Bonescythe Sliver (J21) 9
1 Spiteful Sliver (MH1) 148
1 Sliver Hivelord (M15) 211
1 Cloudshredder Sliver (MH1) 195
1 Hive Stirrings (J21) 15
1 Crib Swap (ECL) 11
1 Changeling Outcast (MH1) 82
1 Esper Sentinel (MH2) 12
1 Ponder (OMB) 13
1 Land Tax (WOT) 9
1 Gamble (TLE) 312
1 Brave the Wilds (WOE) 165
1 Sylvan Tutor (SPG) 59
1 Worldly Tutor (TLE) 314
1 Traveler's Amulet (SIS) 73
1 Rakdos Signet (RVR) 265
1 Arcane Signet (ANB) 117
1 Dimir Signet (RVR) 256
1 Assassin's Trophy (MKM) 187
1 Mana Tithe (STA) 8
1 Swallow Whole (IKO) 35
1 Miscast (M21) 57
1 Dark Ritual (STA) 26
1 Command Tower (ANB) 118`;