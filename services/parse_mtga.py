import os
import json
import re
import sqlite3
import glob
import sys
import urllib.parse


def resolve_db_path(custom_path=None):
    if custom_path:
        custom_path = os.path.expanduser(custom_path.strip())
        if '\0' in custom_path:
            return None
        if os.path.isfile(custom_path) and custom_path.lower().endswith(('.mtga', '.sqlite')):
            return custom_path
        if os.path.isdir(custom_path):
            patterns = [
                os.path.join(custom_path, "MTGA_Data", "Downloads", "Raw", "Raw_CardDatabase_*.mtga"),
                os.path.join(custom_path, "Downloads", "Raw", "Raw_CardDatabase_*.mtga"),
                os.path.join(custom_path, "Raw_CardDatabase_*.mtga"),
                os.path.join(custom_path, "*.mtga")
            ]
            for p in patterns:
                matches = glob.glob(p)
                if matches:
                    return matches[0]
        return None

    env_path = os.environ.get("MTGA_DB_PATH") or os.environ.get("MTGA_DIR")
    if env_path:
        resolved = resolve_db_path(env_path)
        if resolved:
            return resolved

    # Search standard Windows default installation paths
    default_search_patterns = [
        "C:/Program Files/Wizards of the Coast/MTG Arena/MTGA_Data/Downloads/Raw/Raw_CardDatabase_*.mtga",
        "C:/Program Files (x86)/Wizards of the Coast/MTG Arena/MTGA_Data/Downloads/Raw/Raw_CardDatabase_*.mtga",
        os.path.expanduser("~/AppData/Local/Programs/Wizards of the Coast/MTG Arena/MTGA_Data/Downloads/Raw/Raw_CardDatabase_*.mtga"),
    ]
    for pattern in default_search_patterns:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]

    return None

def resolve_log_path(custom_path=None):
    if custom_path:
        custom_path = os.path.expanduser(custom_path.strip())
        if '\0' in custom_path:
            return None
        base_name = os.path.basename(custom_path).lower()
        if base_name in ('player.log', 'player-prev.log', 'player.log.txt', 'player-prev.log.txt') and os.path.isfile(custom_path):
            return custom_path
        return None

    env_path = os.environ.get("MTGA_LOG_PATH")
    if env_path and os.path.isfile(env_path):
        base_name = os.path.basename(env_path).lower()
        if base_name in ('player.log', 'player-prev.log', 'player.log.txt', 'player-prev.log.txt'):
            return env_path

    default_log_paths = [
        os.path.expanduser("~/AppData/LocalLow/Wizards Of The Coast/MTGA/Player.log"),
    ]
    for p in default_log_paths:
        if os.path.exists(p):
            return p

    return None


def parse_mtga_cards(log_path=None, db_path=None):
    try:
        db_file = resolve_db_path(db_path)
        log_file = resolve_log_path(log_path)

        if not db_file:
            return {"cards": [], "count": 0, "status": "unconfigured", "error": "MTG Arena database path not found. Please configure your MTG Arena folder in settings."}

        if not log_file:
            return {"cards": [], "count": 0, "status": "unconfigured", "error": "MTG Arena Player.log not found. Ensure MTG Arena is installed and detailed logs are enabled."}

        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        # Extract all grpId / cardId occurrences and quantities
        card_counts = {}
        matches = re.findall(r'"cardId":\s*(\d+),\s*"quantity":\s*(\d+)', content)
        for grp_id_str, qty_str in matches:
            grp_id = int(grp_id_str)
            qty = int(qty_str)
            card_counts[grp_id] = max(card_counts.get(grp_id, 0), qty)

        # Also extract card IDs from grpId arrays or objects
        grp_matches = re.findall(r'"grpId":\s*(\d+)', content)
        for grp_id_str in grp_matches:
            grp_id = int(grp_id_str)
            if grp_id not in card_counts:
                card_counts[grp_id] = 1

        if not card_counts:
            return {"cards": [], "count": 0, "status": "No card IDs found in Player.log"}

        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        # Query Cards table joined with Localizations_enUS
        query = """
        SELECT 
            c.GrpId, 
            l_title.Loc AS Title, 
            l_type.Loc AS TypeText,
            c.ExpansionCode, 
            c.Rarity, 
            c.Power, 
            c.Toughness, 
            c.Colors, 
            c.ColorIdentity, 
            c.Types, 
            c.OldSchoolManaText,
            c.CollectorNumber
        FROM Cards c
        LEFT JOIN Localizations_enUS l_title ON c.TitleId = l_title.LocId AND l_title.Formatted = 1
        LEFT JOIN Localizations_enUS l_type ON c.TypeTextId = l_type.LocId AND l_type.Formatted = 0
        WHERE c.GrpId IN ({})
        """.format(",".join("?" * len(card_counts)))

        # Process in chunks of 900 due to SQLite param limit
        grp_ids = list(card_counts.keys())
        chunk_size = 900
        cards_list = []
        seen_titles = set()

        # Map MTGA color codes to standard WUBRG
        # 1: White, 2: Blue, 3: Black, 4: Red, 5: Green
        color_map = {'1': 'W', '2': 'U', '3': 'B', '4': 'R', '5': 'G'}
        # Types: 5 = Land, 2 = Creature, 4 = Instant, 10 = Sorcery, 3 = Enchantment, 1 = Artifact, 8 = Planeswalker, 13 = Battle
        type_map = {
            '5': 'Land',
            '2': 'Creature',
            '4': 'Instant',
            '10': 'Sorcery',
            '3': 'Enchantment',
            '1': 'Artifact',
            '8': 'Planeswalker',
            '13': 'Battle'
        }

        for i in range(0, len(grp_ids), chunk_size):
            chunk = grp_ids[i:i + chunk_size]
            q = """
            SELECT 
                c.GrpId, 
                l_title.Loc AS Title, 
                l_type.Loc AS TypeText,
                c.ExpansionCode, 
                c.Rarity, 
                c.Power, 
                c.Toughness, 
                c.Colors, 
                c.ColorIdentity, 
                c.Types, 
                c.OldSchoolManaText,
                c.CollectorNumber,
                c.AbilityIds
            FROM Cards c
            LEFT JOIN Localizations_enUS l_title ON c.TitleId = l_title.LocId AND l_title.Formatted = 1
            LEFT JOIN Localizations_enUS l_type ON c.TypeTextId = l_type.LocId AND l_type.Formatted = 0
            WHERE c.GrpId IN ({})
            """.format(",".join("?" * len(chunk)))
            
            cursor.execute(q, chunk)
            rows = cursor.fetchall()

            # Collect all LocIds referenced in AbilityIds across this chunk
            loc_ids_to_fetch = set()
            for r in rows:
                ability_ids_str = r[12] or ''
                for loc_id_str in re.findall(r':(\d+)', ability_ids_str):
                    loc_ids_to_fetch.add(int(loc_id_str))

            # Batch fetch localization text for ability LocIds
            loc_text_map = {}
            if loc_ids_to_fetch:
                loc_list = list(loc_ids_to_fetch)
                for j in range(0, len(loc_list), 900):
                    sub_chunk = loc_list[j:j+900]
                    q_loc = "SELECT LocId, Loc FROM Localizations_enUS WHERE LocId IN ({})".format(",".join("?" * len(sub_chunk)))
                    cursor.execute(q_loc, sub_chunk)
                    for loc_id, text in cursor.fetchall():
                        if text:
                            cleaned = re.sub(r'<[^>]+>', '', text).strip()
                            if cleaned:
                                loc_text_map[loc_id] = cleaned

            for r in rows:
                grp_id, title, type_text, set_code, rarity, power, toughness, colors_raw, color_id_raw, types_raw, mana_cost_raw, collector_num, ability_ids_str = r
                if not title:
                    continue

                # Clean HTML/XML tags from title and typeText (e.g. <nobr>God-Pharaoh</nobr>)
                title = re.sub(r'<[^>]+>', '', title).strip()
                if type_text:
                    type_text = re.sub(r'<[^>]+>', '', type_text).strip()

                # Assemble oracle card text from ability localizations
                card_texts = []
                if ability_ids_str:
                    for loc_id_str in re.findall(r':(\d+)', ability_ids_str):
                        t = loc_text_map.get(int(loc_id_str))
                        if t and t not in card_texts:
                            card_texts.append(t)
                card_text = " \n ".join(card_texts)

                # Parse colors & color identity
                colors_split = [c.strip() for c in (colors_raw or '').split(',') if c.strip()]
                mapped_colors = [color_map[c] for c in colors_split if c in color_map]
                
                color_id_split = [c.strip() for c in (color_id_raw or '').split(',') if c.strip()]
                mapped_color_identity = [color_map[c] for c in color_id_split if c in color_map]
                if not mapped_color_identity and mapped_colors:
                    mapped_color_identity = mapped_colors

                # Determine main color group
                if '5' in (types_raw or '').split(','):
                    color_group = 'Land'
                elif len(mapped_colors) == 0:
                    color_group = 'Colorless'
                elif len(mapped_colors) == 1:
                    color_group = mapped_colors[0]
                else:
                    color_group = 'Multicolor'

                # Parse primary type
                types_split = [t.strip() for t in (types_raw or '').split(',') if t.strip()]
                primary_type = 'Other'
                for t in types_split:
                    if t in type_map:
                        primary_type = type_map[t]
                        break
                
                # Type sorting rank (Lands first)
                type_rank_map = {
                    'Land': 1,
                    'Creature': 2,
                    'Instant': 3,
                    'Sorcery': 4,
                    'Enchantment': 5,
                    'Artifact': 6,
                    'Planeswalker': 7,
                    'Battle': 8,
                    'Other': 9
                }
                type_rank = type_rank_map.get(primary_type, 9)

                # Calculate Mana Value / CMC
                # mana_cost_raw e.g. "o2oW" or "oG"
                cmc = 0
                if mana_cost_raw:
                    digits = re.findall(r'o(\d+)', mana_cost_raw)
                    for d in digits:
                        cmc += int(d)
                    symbols = re.findall(r'o([WUBRGC])', mana_cost_raw)
                    cmc += len(symbols)

                card_obj = {
                    "grpId": grp_id,
                    "title": title,
                    "typeText": type_text or primary_type,
                    "cardText": card_text,
                    "text": card_text,
                    "primaryType": primary_type,
                    "typeRank": type_rank,
                    "setCode": set_code or "",
                    "rarity": rarity,
                    "power": power or "",
                    "toughness": toughness or "",
                    "colors": mapped_colors,
                    "colorIdentity": mapped_color_identity,
                    "colorGroup": color_group,
                    "manaCost": mana_cost_raw or "",
                    "cmc": cmc,
                    "collectorNumber": collector_num or "",
                    "quantity": card_counts.get(grp_id, 1),
                    "imageUrl": f"https://api.scryfall.com/cards/named?exact={urllib.parse.quote(title)}&format=image"
                }
                cards_list.append(card_obj)

        conn.close()
        return {"cards": cards_list, "count": len(cards_list), "status": "success"}
    except Exception as e:
        return {"cards": [], "count": 0, "status": "error", "error": "Failed to parse MTG Arena collection data"}

if __name__ == "__main__":
    db_arg = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].strip() else None
    log_arg = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].strip() else None
    result = parse_mtga_cards(log_path=log_arg, db_path=db_arg)
    print(json.dumps(result))
