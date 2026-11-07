"""Univers et paramètres de la section Commodities.

Chaque contrat : clé, nom, groupe, racine Yahoo, suffixe de bourse, mois
cotés (codes CME), unité, code CFTC (rapport COT désagrégé), décimales.
Les tickers de contrats Yahoo ont la forme  CLF27.NYM, GCZ26.CMX, ZCH27.CBT.
"""
from __future__ import annotations

ALL = "FGHJKMNQUVXZ"
MONTH_CODE = dict(zip(range(1, 13), ALL))

# key, name, group, root, exch, months, unit, cftc, dec, curve months ahead
UNIVERSE = [
    ("wti", "WTI crude", "Energy", "CL", "NYM", ALL, "$/bbl", "067651", 2, 24),
    ("brent", "Brent crude", "Energy", "BZ", "NYM", ALL, "$/bbl", "06765T", 2, 24),
    ("natgas", "Natural gas", "Energy", "NG", "NYM", ALL, "$/MMBtu", "023651", 3, 24),
    ("gasoline", "RBOB gasoline", "Energy", "RB", "NYM", ALL, "$/gal", "111659", 4, 18),
    ("heatingoil", "Heating oil (ULSD)", "Energy", "HO", "NYM", ALL, "$/gal", "022651", 4, 18),
    ("gold", "Gold", "Metals", "GC", "CMX", "GJMQVZ", "$/oz", "088691", 1, 24),
    ("silver", "Silver", "Metals", "SI", "CMX", "HKNUZ", "$/oz", "084691", 3, 24),
    ("copper", "Copper", "Metals", "HG", "CMX", ALL, "$/lb", "085692", 4, 18),
    ("platinum", "Platinum", "Metals", "PL", "NYM", "FJNV", "$/oz", "076651", 1, 18),
    ("palladium", "Palladium", "Metals", "PA", "NYM", "HMUZ", "$/oz", "075651", 1, 18),
    ("aluminium", "Aluminium", "Metals", "ALI", None, "", "$/t", None, 0, 0),
    ("ironore", "Iron ore (62% Fe)", "Metals", "TIO", None, "", "$/t", None, 2, 0),
    ("corn", "Corn", "Grains", "ZC", "CBT", "HKNUZ", "¢/bu", "002602", 2, 24),
    ("wheat", "Wheat (Chicago)", "Grains", "ZW", "CBT", "HKNUZ", "¢/bu", "001602", 2, 24),
    ("soybeans", "Soybeans", "Grains", "ZS", "CBT", "FHKNQUX", "¢/bu", "005602", 2, 24),
    ("soymeal", "Soybean meal", "Grains", "ZM", "CBT", "FHKNQUVZ", "$/st", "026603", 1, 18),
    ("soyoil", "Soybean oil", "Grains", "ZL", "CBT", "FHKNQUVZ", "¢/lb", "007601", 2, 18),
    ("coffee", "Coffee (arabica)", "Softs", "KC", "NYB", "HKNUZ", "¢/lb", "083731", 2, 18),
    ("cocoa", "Cocoa", "Softs", "CC", "NYB", "HKNUZ", "$/t", "073732", 0, 18),
    ("sugar", "Sugar No. 11", "Softs", "SB", "NYB", "HKNV", "¢/lb", "080732", 2, 18),
    ("cotton", "Cotton", "Softs", "CT", "NYB", "HKNVZ", "¢/lb", "033661", 2, 18),
    ("cattle", "Live cattle", "Livestock", "LE", "CME", "GJMQVZ", "¢/lb", "057642", 3, 14),
    ("hogs", "Lean hogs", "Livestock", "HE", "CME", "GJKMNQVZ", "¢/lb", "054642", 3, 14),
]
GROUPS = ["Energy", "Metals", "Grains", "Softs", "Livestock"]


def front_ticker(root: str) -> str:
    return f"{root}=F"


# Industrial and relative-value spreads, computed from continuous front contracts.
# key, name, unit, formula (dict of ticker: weight applied to price after unit factor), what it says
SPREADS = [
    ("crack321", "3-2-1 crack spread", "$/bbl", "Refining margin: two barrels of gasoline and one of diesel made from three of crude, per barrel."),
    ("crack_gas", "Gasoline crack", "$/bbl", "RBOB gasoline less WTI, per barrel."),
    ("crack_dist", "Diesel crack", "$/bbl", "Heating oil (ULSD) less WTI, per barrel."),
    ("crush", "Soybean crush", "$/bu", "Board crush: value of the meal and oil from a bushel of soybeans less the bushel's price."),
    ("brent_wti", "Brent less WTI", "$/bbl", "Seaborne crude against US inland crude: export pull and shipping risk."),
    ("gold_silver", "Gold / silver ratio", "x", "Ounces of silver for one ounce of gold. Rises in risk-off phases."),
    ("copper_gold", "Copper / gold ratio", "x1000", "Industrial demand against haven demand; tracks long-term yields and growth."),
    ("soy_corn", "Soybean / corn ratio", "x", "New-crop planting economics: above about 2.4 favours soybeans, below 2.2 corn."),
]

# IMF PortWatch chokepoints (name fragments to match)
CHOKEPOINTS = [
    ("hormuz", "Strait of Hormuz", "About a fifth of world oil and LNG trade"),
    ("bab", "Bab el-Mandeb", "Red Sea entry: Europe–Asia shortcut via Suez"),
    ("suez", "Suez Canal", "Europe–Asia container, crude and product route"),
    ("panama", "Panama Canal", "US Gulf grain, LPG and LNG to Asia"),
    ("malacca", "Malacca Strait", "Main route for Gulf crude into East Asia"),
    ("good hope", "Cape of Good Hope", "Detour when the Red Sea is avoided"),
    ("bosporus", "Bosporus", "Black Sea grain and Russian/Kazakh crude"),
    ("gibraltar", "Gibraltar Strait", "Mediterranean–Atlantic gateway"),
]

FREIGHT = [("BDRY", "Dry bulk freight (BDRY)", "Breakwave ETF holding Capesize, Panamax and Supramax freight futures: a proxy for the Baltic Dry Index."),
           ("BWET", "Tanker freight (BWET)", "Breakwave ETF holding TD3C (VLCC Middle East–China) and TD20 freight futures."),
           ("FRO", "Frontline (VLCC owner)", "Crude tanker owner; trades with VLCC day rates."),
           ("ZIM", "ZIM (container line)", "Container shipping; sensitive to Red Sea and Panama disruption.")]

CHINA = [("CNY=X", "Dollar / yuan", "USD/CNY"), ("FXI", "China large caps (FXI)", "iShares China Large-Cap ETF"),
         ("TIO=F", "Iron ore 62% Fe", "SGX/CME TSI iron ore, CFR China"), ("HG=F", "Copper", "COMEX copper"),
         ("ALI=F", "Aluminium", "COMEX aluminium")]
CHINA_FRED = [("XTIMVA01CNM667S", "China imports, value"), ("XTEXVA01CNM667S", "China exports, value")]

NEWS_TICKERS = ["CL=F", "BZ=F", "NG=F", "GC=F", "HG=F", "ZW=F", "ZC=F", "ZS=F", "KC=F", "CC=F", "SI=F"]
NEWS_TAGS = [
    ("Sanctions", ["sanction", "embargo", "price cap", "blacklist", "export ban", "export curb"]),
    ("Supply", ["strike", "outage", "shutdown", "force majeure", "mine", "refinery", "pipeline", "output cut", "production cut", "drought", "frost", "flood"]),
    ("Routes", ["hormuz", "red sea", "suez", "panama", "black sea", "tanker", "shipping", "strait", "houthi", "port"]),
    ("OPEC+", ["opec"]),
    ("Trade", ["tariff", "trade war", "quota", "duties"]),
    ("Geopolitics", ["iran", "russia", "ukraine", "israel", "venezuela", "war", "attack", "missile", "ceasefire"]),
]

import re as _re

# A headline is kept only if its title names a commodity market or a physical-supply theme
NEWS_RELEVANT = _re.compile(r"\b(oil|crude|brent|wti|opec\+?|gasoline|diesel|fuel|refin\w*|lng|natural gas|gas prices?|gas futures|"
                            r"gold|silver|copper|platinum|palladium|alumin\w*|iron ore|nickel|zinc|lithium|metals?|mining|miners?|mines?|"
                            r"wheat|corn|soy\w*|grains?|crops?|harvest|wasde|usda|coffee|cocoa|sugar|cotton|cattle|hogs?|livestock|fertili\w*|"
                            r"commodit\w*|futures|tanker|shipping|freight|hormuz|red sea|suez|panama canal|black sea|pipeline|sanction\w*|embargo|"
                            r"energy|barrels?|bullion|precious metals?)\b")

# Weather: (key, name, lat, lon, role, markets)
WEATHER = [
    ("nyc", "New York", 40.71, -74.01, "gas", "US natural gas, power"),
    ("chi", "Chicago", 41.88, -87.63, "gas", "US natural gas, power"),
    ("atl", "Atlanta", 33.75, -84.39, "gas", "US natural gas, power"),
    ("dal", "Dallas", 32.78, -96.80, "gas", "ERCOT power, gas burn"),
    ("lon", "London", 51.51, -0.13, "gas", "NBP and TTF gas"),
    ("ber", "Berlin", 52.52, 13.40, "gas", "TTF gas, German power"),
    ("tyo", "Tokyo", 35.68, 139.69, "gas", "Asian LNG (JKM)"),
    ("dsm", "Des Moines, Iowa", 41.59, -93.62, "crop", "Corn, soybeans"),
    ("chm", "Champaign, Illinois", 40.12, -88.24, "crop", "Corn, soybeans"),
    ("ict", "Wichita, Kansas", 37.69, -97.34, "crop", "Hard red winter wheat"),
    ("sor", "Sorriso, Mato Grosso", -12.55, -55.71, "crop", "Brazil soybeans, safrinha corn"),
    ("ros", "Rosario, Argentina", -32.95, -60.65, "crop", "Argentina soybeans, corn, wheat"),
    ("kra", "Krasnodar, Russia", 45.04, 38.98, "crop", "Black Sea wheat"),
    ("var", "Varginha, Minas Gerais", -21.55, -45.43, "crop", "Arabica coffee"),
    ("bmt", "Buon Ma Thuot, Vietnam", 12.67, 108.04, "crop", "Robusta coffee"),
    ("dal2", "Daloa, Ivory Coast", 6.88, -6.45, "crop", "Cocoa"),
    ("rib", "Ribeirão Preto, São Paulo", -21.18, -47.81, "crop", "Sugar cane"),
]

# Release calendar
WASDE = ["2026-01-12", "2026-02-10", "2026-03-10", "2026-04-09", "2026-05-12", "2026-06-11", "2026-07-10", "2026-08-12",
         "2026-09-11", "2026-10-09", "2026-11-10", "2026-12-10", "2027-01-12", "2027-02-10", "2027-03-10", "2027-04-09",
         "2027-05-12", "2027-06-11", "2027-07-09", "2027-08-12", "2027-09-10", "2027-10-08", "2027-11-10", "2027-12-10"]
