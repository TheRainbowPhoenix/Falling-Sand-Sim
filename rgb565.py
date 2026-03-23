colors = {
    "COLOR_AIR": 0x0000,
    "COLOR_SAND": 0xFDA0,
    "COLOR_WATER": 0x03BF,
    "COLOR_STONE": 0x7BEF,
    "COLOR_WALL": 0x4208,
    "COLOR_LAVA": 0xF800,
    "COLOR_PLANT": 0x07E0,
    "COLOR_ICE": 0xAFFF,
    "COLOR_UI_AIR": 0xF81F,
    "COLOR_STEAM": 0xEF7D,
    "COLOR_ACID": 0x8FE0,
    "COLOR_FIRE": 0xFA00,
    "COLOR_HIGHLIGHT": 0xFFFF
}

for name, val in colors.items():
    r = (val >> 11) & 0x1F
    g = (val >> 5) & 0x3F
    b = val & 0x1F
    r = (r * 255) // 31
    g = (g * 255) // 63
    b = (b * 255) // 31
    print(f"{name}: rgb({r}, {g}, {b})")
