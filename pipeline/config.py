"""Univers, tickers et séries utilisés par le pipeline.

Tout ce qui définit *quoi* récupérer est ici : modifier une liste suffit
pour ajouter un indice, une devise, une société ou une série FRED.
"""

SITE_NAME = "Opsilon Markets"

# --------------------------------------------------------------------------
# Dashboards
# --------------------------------------------------------------------------
SECTORS = [  # S&P 500 sector SPDR ETFs
    ("Technology", "XLK"), ("Financials", "XLF"), ("Health care", "XLV"),
    ("Cons. discretionary", "XLY"), ("Cons. staples", "XLP"), ("Energy", "XLE"),
    ("Industrials", "XLI"), ("Materials", "XLB"), ("Real estate", "XLRE"),
    ("Utilities", "XLU"), ("Communications", "XLC"),
]

VOL_CURVE = [("9D", "^VIX9D", 9), ("1M", "^VIX", 30), ("3M", "^VIX3M", 93), ("6M", "^VIX6M", 184)]

GLOBAL_INDICES = [
    ("S&P 500", "^GSPC"), ("Euro Stoxx 50", "^STOXX50E"), ("DAX 40", "^GDAXI"),
    ("FTSE 100", "^FTSE"), ("Nikkei 225", "^N225"), ("Hang Seng", "^HSI"),
    ("Bovespa", "^BVSP"), ("S&P/TSX", "^GSPTSE"),
]

# (name, yahoo ticker, invert) -> invert=True when Yahoo quotes "X per USD";
# performance is always shown as the *currency* against the dollar.
FX_MAJORS_DASH = [
    ("Euro", "EURUSD=X", False), ("Japanese yen", "JPY=X", True), ("Pound", "GBPUSD=X", False),
    ("Swiss franc", "CHF=X", True), ("Canadian dollar", "CAD=X", True), ("Australian dollar", "AUDUSD=X", False),
]

COMMODITIES = [
    ("WTI crude", "CL=F"), ("Gold", "GC=F"), ("Brent crude", "BZ=F"), ("Natural gas", "NG=F"),
    ("Silver", "SI=F"), ("Copper", "HG=F"), ("Platinum", "PL=F"), ("Corn", "ZC=F"), ("Wheat", "ZW=F"),
]

CREDIT_SPREADS = [  # ICE BofA option-adjusted spreads, FRED, in %
    ("High yield", "BAMLH0A0HYM2"), ("Investment grade", "BAMLC0A0CM"),
    ("BBB corporate", "BAMLC0A4CBBB"), ("BB high yield", "BAMLH0A1HYBB"),
    ("CCC and lower", "BAMLH0A3HYC"), ("Euro high yield", "BAMLHE00EHYIOAS"),
    ("Emerging markets corporate", "BAMLEMCBPIOAS"),
]

CROSS_ASSET = [("S&P 500", "S&P", "^GSPC"), ("Long Treasuries", "TLT", "TLT"),
               ("Dollar index", "USD", "DX-Y.NYB"), ("WTI crude", "WTI", "CL=F"), ("Gold", "Gold", "GC=F")]

WATCHLIST = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "JPM", "V", "LLY", "XOM",
             "UNH", "MA", "COST", "HD", "PG", "JNJ", "NFLX", "AMD", "CRM", "BAC", "WMT", "ORCL", "KO", "PLTR"]

# --------------------------------------------------------------------------
# FX page
# --------------------------------------------------------------------------
# key, name, yahoo, quote label, decimals, group, ccy, inverted (Yahoo = X per USD)
FX_PAIRS = [
    ("dxy", "Dollar index", "DX-Y.NYB", "index", 2, "dollar", None, False),
    ("eurusd", "EUR/USD", "EURUSD=X", "USD per EUR", 4, "major", "EUR", False),
    ("usdjpy", "USD/JPY", "JPY=X", "JPY per USD", 2, "major", "JPY", True),
    ("gbpusd", "GBP/USD", "GBPUSD=X", "USD per GBP", 4, "major", "GBP", False),
    ("usdchf", "USD/CHF", "CHF=X", "CHF per USD", 4, "major", "CHF", True),
    ("usdcad", "USD/CAD", "CAD=X", "CAD per USD", 4, "major", "CAD", True),
    ("audusd", "AUD/USD", "AUDUSD=X", "USD per AUD", 4, "major", "AUD", False),
    ("nzdusd", "NZD/USD", "NZDUSD=X", "USD per NZD", 4, "major", "NZD", False),
    ("usdcny", "USD/CNY", "CNY=X", "CNY per USD", 4, "em", "CNY", True),
    ("usdmxn", "USD/MXN", "MXN=X", "MXN per USD", 4, "em", "MXN", True),
    ("usdbrl", "USD/BRL", "BRL=X", "BRL per USD", 4, "em", "BRL", True),
    ("usdinr", "USD/INR", "INR=X", "INR per USD", 2, "em", "INR", True),
    ("usdkrw", "USD/KRW", "KRW=X", "KRW per USD", 1, "em", "KRW", True),
    ("usdzar", "USD/ZAR", "ZAR=X", "ZAR per USD", 4, "em", "ZAR", True),
    ("usdtry", "USD/TRY", "TRY=X", "TRY per USD", 4, "em", "TRY", True),
]
# 3-month interbank rates (OECD via FRED), for rate differentials
SHORT_RATES = {
    "USD": "IR3TIB01USM156N", "EUR": "IR3TIB01EZM156N", "JPY": "IR3TIB01JPM156N",
    "GBP": "IR3TIB01GBM156N", "CHF": "IR3TIB01CHM156N", "CAD": "IR3TIB01CAM156N",
    "AUD": "IR3TIB01AUM156N", "NZD": "IR3TIB01NZM156N", "CNY": "IR3TIB01CNM156N",
    "MXN": "IR3TIB01MXM156N", "INR": "IR3TIB01INM156N", "KRW": "IR3TIB01KRM156N",
    "ZAR": "IR3TIB01ZAM156N",
}

# --------------------------------------------------------------------------
# World markets: iso3, iso2, name, index name, index ticker, fx ticker, fx inverted
# --------------------------------------------------------------------------
WORLD = [
    ("USA", "US", "United States", "S&P 500", "^GSPC", None, False),
    ("CAN", "CA", "Canada", "S&P/TSX Composite", "^GSPTSE", "CAD=X", True),
    ("MEX", "MX", "Mexico", "S&P/BMV IPC", "^MXX", "MXN=X", True),
    ("BRA", "BR", "Brazil", "Bovespa", "^BVSP", "BRL=X", True),
    ("ARG", "AR", "Argentina", "Merval", "^MERV", "ARS=X", True),
    ("GBR", "GB", "United Kingdom", "FTSE 100", "^FTSE", "GBPUSD=X", False),
    ("DEU", "DE", "Germany", "DAX 40", "^GDAXI", "EURUSD=X", False),
    ("FRA", "FR", "France", "CAC 40", "^FCHI", "EURUSD=X", False),
    ("ITA", "IT", "Italy", "FTSE MIB", "FTSEMIB.MI", "EURUSD=X", False),
    ("ESP", "ES", "Spain", "IBEX 35", "^IBEX", "EURUSD=X", False),
    ("NLD", "NL", "Netherlands", "AEX", "^AEX", "EURUSD=X", False),
    ("CHE", "CH", "Switzerland", "SMI", "^SSMI", "CHF=X", True),
    ("SWE", "SE", "Sweden", "OMX Stockholm 30", "^OMX", "SEK=X", True),
    ("TUR", "TR", "Turkey", "BIST 100", "XU100.IS", "TRY=X", True),
    ("ISR", "IL", "Israel", "TA-125", "^TA125.TA", "ILS=X", True),
    ("ZAF", "ZA", "South Africa", "JSE Top 40", "^J200.JO", "ZAR=X", True),
    ("IND", "IN", "India", "Nifty 50", "^NSEI", "INR=X", True),
    ("CHN", "CN", "China", "Shanghai Composite", "000001.SS", "CNY=X", True),
    ("HKG", "HK", "Hong Kong", "Hang Seng", "^HSI", "HKD=X", True),
    ("JPN", "JP", "Japan", "Nikkei 225", "^N225", "JPY=X", True),
    ("KOR", "KR", "South Korea", "KOSPI", "^KS11", "KRW=X", True),
    ("TWN", "TW", "Taiwan", "TAIEX", "^TWII", "TWD=X", True),
    ("IDN", "ID", "Indonesia", "Jakarta Composite", "^JKSE", "IDR=X", True),
    ("SGP", "SG", "Singapore", "Straits Times", "^STI", "SGD=X", True),
    ("AUS", "AU", "Australia", "S&P/ASX 200", "^AXJO", "AUDUSD=X", False),
]

# --------------------------------------------------------------------------
# Daily close note
# --------------------------------------------------------------------------
NOTE_ASSETS = {
    "equities": [("S&P 500", "^GSPC"), ("Nasdaq 100", "^NDX"), ("Dow Jones", "^DJI"), ("Russell 2000", "^RUT")],
    "rates": [("US 3M", "^IRX"), ("US 5Y", "^FVX"), ("US 10Y", "^TNX"), ("US 30Y", "^TYX")],
    "credit": [("High yield (HYG)", "HYG"), ("High yield (JNK)", "JNK"), ("Investment grade (LQD)", "LQD"), ("Long Treasuries (TLT)", "TLT")],
    "fx": [("Dollar index", "DX-Y.NYB"), ("EUR/USD", "EURUSD=X"), ("USD/JPY", "JPY=X"), ("GBP/USD", "GBPUSD=X"), ("AUD/USD", "AUDUSD=X")],
    "commodities": [("WTI crude", "CL=F"), ("Brent crude", "BZ=F"), ("Gold", "GC=F"), ("Silver", "SI=F"), ("Copper", "HG=F"), ("Natural gas", "NG=F")],
    "volatility": [("VIX", "^VIX"), ("VIX 9-day", "^VIX9D"), ("VIX 3-month", "^VIX3M"), ("VVIX", "^VVIX"), ("MOVE", "^MOVE")],
    "digital": [("Bitcoin", "BTC-USD"), ("Ether", "ETH-USD"), ("Solana", "SOL-USD")],
    "international": [("Euro Stoxx 50", "^STOXX50E"), ("DAX 40", "^GDAXI"), ("FTSE 100", "^FTSE"), ("CAC 40", "^FCHI"),
                      ("Nikkei 225", "^N225"), ("Hang Seng", "^HSI"), ("Nifty 50", "^NSEI")],
}

# --------------------------------------------------------------------------
# Market history / simulators
# --------------------------------------------------------------------------
HISTORY_INDICES = {"spx": "^GSPC", "spxtr": "^SP500TR", "ndq": "^IXIC", "sx5e": "^STOXX50E", "nky": "^N225"}

# --------------------------------------------------------------------------
# Recession watch (FRED)
# --------------------------------------------------------------------------
RECESSION = {"curve": "T10Y3M", "sahm": "SAHMREALTIME", "claims": "ICSA", "hy": "BAMLH0A0HYM2", "nfci": "NFCI", "rec": "USREC"}

# --------------------------------------------------------------------------
# Central banks: last known path (seed). The Fed and ECB are refreshed from
# FRED each run; edit the BoE / BoJ paths and the meeting dates here.
# --------------------------------------------------------------------------
CENTRAL_BANKS = [
    {"key": "fed", "name": "Fed", "full": "Federal Reserve, target range", "label": "Fed, top of the target range",
     "fred_upper": "DFEDTARU", "fred_lower": "DFEDTARL",
     "steps": [["2019-01-01", 2.5], ["2019-08-01", 2.25], ["2019-09-19", 2], ["2019-10-31", 1.75], ["2020-03-04", 1.25], ["2020-03-16", 0.25], ["2022-03-17", 0.5], ["2022-05-05", 1], ["2022-06-16", 1.75], ["2022-07-28", 2.5], ["2022-09-22", 3.25], ["2022-11-03", 4], ["2022-12-15", 4.5], ["2023-02-02", 4.75], ["2023-03-23", 5], ["2023-05-04", 5.25], ["2023-07-27", 5.5], ["2024-09-19", 5], ["2024-11-08", 4.75], ["2024-12-19", 4.5], ["2025-09-18", 4.25], ["2025-10-30", 4], ["2025-12-11", 3.75], ["2026-09-17", 4]],
     "meetings": ["2026-12-09", "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-16", "2027-07-28", "2027-09-22", "2027-11-03", "2027-12-15"]},
    {"key": "ecb", "name": "ECB", "full": "European Central Bank, deposit facility rate", "label": "ECB, deposit facility rate",
     "fred": "ECBDFR",
     "steps": [["2019-01-01", -0.4], ["2019-09-18", -0.5], ["2022-07-27", 0], ["2022-09-14", 0.75], ["2022-11-02", 1.5], ["2022-12-21", 2], ["2023-02-08", 2.5], ["2023-03-22", 3], ["2023-05-10", 3.25], ["2023-06-21", 3.5], ["2023-08-02", 3.75], ["2023-09-20", 4], ["2024-06-12", 3.75], ["2024-09-18", 3.5], ["2024-10-23", 3.25], ["2024-12-18", 3], ["2025-02-05", 2.75], ["2025-03-12", 2.5], ["2025-04-23", 2.25], ["2025-06-11", 2], ["2026-06-17", 2.25], ["2026-09-16", 2.5]],
     "meetings": ["2026-12-17", "2027-02-04", "2027-03-18", "2027-04-29", "2027-06-10", "2027-07-22", "2027-09-09", "2027-10-28", "2027-12-16"]},
    {"key": "boe", "name": "BoE", "full": "Bank of England, Bank Rate", "label": "BoE, Bank Rate",
     "steps": [["2019-01-01", 0.75], ["2020-03-11", 0.25], ["2020-03-19", 0.1], ["2021-12-16", 0.25], ["2022-02-03", 0.5], ["2022-03-17", 0.75], ["2022-05-05", 1], ["2022-06-16", 1.25], ["2022-08-04", 1.75], ["2022-09-22", 2.25], ["2022-11-03", 3], ["2022-12-15", 3.5], ["2023-02-02", 4], ["2023-03-23", 4.25], ["2023-05-11", 4.5], ["2023-06-22", 5], ["2023-08-03", 5.25], ["2024-08-01", 5], ["2024-11-07", 4.75], ["2025-02-06", 4.5], ["2025-05-08", 4.25], ["2025-08-07", 4], ["2025-12-18", 3.75], ["2026-11-05", 4]],
     "meetings": ["2026-12-17", "2027-02-04", "2027-03-18", "2027-05-06", "2027-06-17", "2027-08-05", "2027-09-16", "2027-11-04", "2027-12-16"]},
    {"key": "boj", "name": "BoJ", "full": "Bank of Japan, policy rate", "label": "BoJ, policy rate",
     "steps": [["2019-01-01", -0.1], ["2024-03-21", 0.05], ["2024-08-01", 0.25], ["2025-01-27", 0.5], ["2025-12-22", 0.75], ["2026-06-17", 1], ["2026-09-24", 1.25]],
     "meetings": ["2026-12-18", "2027-01-22", "2027-03-18", "2027-04-30", "2027-06-17", "2027-07-30", "2027-09-21", "2027-10-29", "2027-12-17"]},
]

# --------------------------------------------------------------------------
# Inflation & labour (FRED)
# --------------------------------------------------------------------------
MACRO = {"cpi": "CPIAUCSL", "core": "CPILFESL", "pce": "PCEPI", "corepce": "PCEPILFE", "payems": "PAYEMS", "unrate": "UNRATE"}

# Macro releases for the calendar (FRED release ids; needs FRED_API_KEY, optional)
MACRO_RELEASES = [
    (10, "Consumer price index", "High"), (50, "Jobs report (nonfarm payrolls)", "High"),
    (53, "GDP, advance estimate", "High"), (54, "Personal income and PCE prices", "High"),
    (9, "Retail sales", "Medium"), (46, "Producer price index", "Medium"),
    (180, "Initial jobless claims", "Medium"), (192, "JOLTS job openings", "Medium"),
    (13, "Industrial production", "Medium"), (91, "University of Michigan sentiment", "Low"),
]

# --------------------------------------------------------------------------
# Companies: the 600 names (200 US, 200 Europe, 200 Asia), as URL slugs.
# Converted to Yahoo symbols by symbol_from_slug().
# --------------------------------------------------------------------------
COMPANY_SLUGS = """000001-sz 0001-hk 000333-sz 000651-sz 000660-ks 000858-sz 0016-hk 0019-hk 002142-sz 002371-sz 002415-sz 002475-sz 002594-sz 002714-sz 003816-sz 005380-ks 005930-ks 009150-ks 0267-hk 028260-ks 032830-ks 0388-hk 055550-ks 0669-hk 068270-ks 0700-hk 0945-hk 0992-hk 105560-ks 1299-hk 1303-tw 1810-hk 207940-ks 2259-hk 2303-tw 2308-tw 2317-tw 2328-hk 2330-tw 2382-tw 2383-tw 2388-hk 2408-tw 2412-tw 2454-tw 285a-t 2881-tw 2882-tw 2887-tw 2891-tw 2914-t 300059-sz 300308-sz 300502-sz 300750-sz 300760-sz 3037-tw 3382-t 3690-hk 3711-tw 373220-ks 402340-ks 4063-t 4502-t 4519-t 4568-t 4578-t 4661-t 5108-t 5803-t 600000-ss 600025-ss 600028-ss 600030-ss 600036-ss 600150-ss 600276-ss 600309-ss 600519-ss 600690-ss 600887-ss 600900-ss 600919-ss 600938-ss 600941-ss 601088-ss 601138-ss 601166-ss 601211-ss 601225-ss 601288-ss 601318-ss 601319-ss 601328-ss 601398-ss 601601-ss 601628-ss 601658-ss 601728-ss 601816-ss 601857-ss 601869-ss 601899-ss 601919-ss 601939-ss 601985-ss 601988-ss 601995-ss 601998-ss 603259-ss 603288-ss 603993-ss 6098-t 6178-t 6288-hk 6301-t 6367-t 6501-t 6503-t 6701-t 6702-t 6752-t 6758-t 6857-t 6861-t 688012-ss 688041-ss 688235-ss 688256-ss 688347-ss 688802-ss 688825-ss 688836-ss 688981-ss 6902-t 6954-t 6981-t 7011-t 7182-t 7203-t 7267-t 7741-t 7974-t 8001-t 8002-t 8015-t 8031-t 8035-t 8053-t 8058-t 8306-t 8308-t 8316-t 8411-t 8591-t 8630-t 8725-t 8750-t 8766-t 8802-t 9432-t 9433-t 9434-t 9618-hk 9633-hk 9984-t 9988-hk 9999-hk a5g-ir aal-l aapl abbn-sw abbv abi-br abn-as abnb abt aca-pa acn acs-mc ad-as adanient-ns adaniports-ns adanipower-ns adbe adi adp ads-de adyen-as aena-mc aep afl ai-pa air-pa ajg alc-sw all alv-de am-pa amat amd amgn ams-mc amt amzn anet anto-l aon apd aph apo app argx-br asm-as asml-as assa-b-st atco-a-st av-l avgo axisbank-ns axp azn-l ba-l ba bac bajaj-auto-ns bajajfinsv-ns bajfinance-ns barc-l bas-de bats-l bayn-de bbva-mc bel-ns bhartiartl-ns bkng blk bmps-mi bmw-de bmy bn-pa bnp-pa bny bp-l bpe-mi brk-b bsx bx c cabk-mc cah cap-pa cat cb cbk-de cdns ceg cfr-sw ci cl cmcsa cme cmi cof cop cor cost cpg-l crh crm crwd cs-pa csco csx ctas cvna cvs cvx danske-co dash db1-de dbk-de ddog de dell dg-pa dge-l dhl-de dhr dim-pa dis dlr dnb-ol dsfir-as dsv-co dsy-pa dte-de dtg-de duk ebs-vi ecl el-pa ele-mc elv emr emsn-sw enel-mi engi-pa eni-mi enr-de eoan-de eog epi-a-st eqix eqnr-ol eqt-st eric-b-st eternal-ns etn exo-as expn-l fast fcx fdx fer-mc fortum-he fre-de fres-l ftnt g-mi gald-sw gd ge gev gild givn-sw gle-pa glen-l glw gm gmab-co googl gs gsk-l gww hal-ns hban-sw hca hcltech-ns hd hdfcbank-ns hei-de heia-as heio-as hen3-de hexa-b-st hindunilvr-ns hln-l hlt hm-b-st hnr1-de ho-pa holn-sw hon hood hot-de hsba-l hwm iag-l ibe-mc ibkr ibm ice icicibank-ns ifx-de ihg-l iii-l imb-l infy-ns inga-as intc intu inve-b-st isp-mi isrg itc-ns itw itx-mc jci jnj jpl-ns jpm jswsteel-ns kbc-br ker-pa kkr klac kmb kmi knebv-he knin-sw ko kog-ol kotakbank-ns ldo-mi lin lisp-sw live lloy-l lly lmt lonn-sw low lr-pa lrcx lseg-l lt-ns m&m-ns ma maersk-b-co mar maruti-ns mbg-de mc-pa mcd mck mco mdlz mdt met meta ml-pa mmm mnst mo mpc mrk-de mrk mrna mrsh mrvl ms msft msi mt-as mu muv2-de nda-fi-he nee nem nesn-sw neste-he nflx ng-l noc nokia-he novn-sw novo-b-co now nsc nse-bo nsis-b-co ntgy-mc ntpc-ns nvda nwg-l nxpi nxt-l omv-vi ongc-ns or-pa ora-pa orcl orly orsted-co p911-de panw pep pfe pg pgr ph phia-as pkn-wa pko-wa pld pltr pm pnc pru-l prx-as pry-mi psa pst-mi psx pub-pa pwr qcom race-mi rcl regn rel-l reliance-ns rep-mc rhm-de rio-l rkt-l rms-pa rop-sw rost rr-l rsg rtx rwe-de rya-ir saab-b-st saf-pa sampo-he san-mc san-pa sand-st sap-de sbin-ns sbux schp-sw schw scmn-sw sdz-sw seb-a-st sgo-pa sgsn-sw shb-a-st shel-l shl-de shw sie-de sika-sw slb slhn-sw sndk snps so spg spgi sren-sw srg-mi sse-l stan-l stmmi-mi stx su-pa sunpharma-ns swed-a-st syk t tcs-ns tdg ten-mi tgt titan-ns tjx tlx-de tmo tmus trv tsco-l tsla tt tte-pa txn uber ubsg-sw ucb-br ucg-mi ultracemco-ns ulvr-l umg-as unh unp ups uri usb v ver-vi vie-pa vlo vod-l volv-b-st vow3-de vrt vrtx vws-co vz wdc well wfc wm wmb wmt xom""".split()

EXCH_SUFFIX = {
    "sz": "SZ", "ss": "SS", "hk": "HK", "ks": "KS", "t": "T", "tw": "TW", "ns": "NS", "bo": "BO",
    "l": "L", "pa": "PA", "de": "DE", "as": "AS", "mc": "MC", "mi": "MI", "sw": "SW", "st": "ST",
    "co": "CO", "he": "HE", "ol": "OL", "br": "BR", "ir": "IR", "vi": "VI", "wa": "WA",
}
ASIA = {"SZ", "SS", "HK", "KS", "T", "TW", "NS", "BO"}

# Regional benchmark for each exchange suffix
BENCH_BY_SUFFIX = {
    None: ("S&P 500", "^GSPC"), "SZ": ("CSI 300", "000300.SS"), "SS": ("CSI 300", "000300.SS"),
    "HK": ("Hang Seng", "^HSI"), "KS": ("KOSPI", "^KS11"), "T": ("Nikkei 225", "^N225"),
    "TW": ("TAIEX", "^TWII"), "NS": ("Nifty 50", "^NSEI"), "BO": ("Nifty 50", "^NSEI"),
}
EUROPE_BENCH = ("STOXX Europe 600", "^STOXX")


def symbol_from_slug(slug: str):
    """'0700-hk' -> ('0700.HK', 'Asia', 'HK'); 'brk-b' -> ('BRK-B', 'US', None)."""
    parts = slug.split("-")
    if len(parts) > 1 and parts[-1] in EXCH_SUFFIX:
        suf = EXCH_SUFFIX[parts[-1]]
        base = "-".join(parts[:-1]).upper()
        region = "Asia" if suf in ASIA else "Europe"
        return f"{base}.{suf}", region, suf
    return slug.upper(), "US", None


def bench_for(suffix):
    if suffix in BENCH_BY_SUFFIX:
        return BENCH_BY_SUFFIX[suffix]
    return EUROPE_BENCH


SECTOR_MAP = {
    "Technology": "Technology", "Financial Services": "Financials", "Industrials": "Industrials",
    "Healthcare": "Health care", "Consumer Cyclical": "Consumer discretionary",
    "Consumer Defensive": "Consumer staples", "Basic Materials": "Materials", "Energy": "Energy",
    "Communication Services": "Communication", "Utilities": "Utilities", "Real Estate": "Real estate",
}

# Market history episodes: slug, title (start year; each runs to the next start)
EPISODES = [
    ("1928-great-crash", "The Great Crash"), ("1929-great-depression", "The Great Depression"),
    ("1932-new-deal-recovery", "New Deal recovery"), ("1937-recession-of-1937", "Recession of 1937"),
    ("1939-war-in-europe-and-pearl-harbor", "War in Europe and Pearl Harbor"), ("1942-wartime-rally", "Wartime rally"),
    ("1946-post-war-slump", "Post-war slump"), ("1949-korean-war-years", "Korean War years"),
    ("1953-fifties-boom", "Fifties boom"), ("1957-sputnik-and-the-1957-recession", "Sputnik and the 1957 recession"),
    ("1959-kennedy-years-begin", "Kennedy years begin"), ("1962-1962-crash-and-the-cuban-missile-crisis", "1962 crash and the Cuban missile crisis"),
    ("1963-go-go-years", "Go-go years"), ("1966-credit-crunch-and-vietnam", "Credit crunch and Vietnam"),
    ("1968-1969-to-1970-bear-market", "1969 to 1970 bear market"), ("1970-nixon-shock-and-the-nifty-fifty", "Nixon shock and the Nifty Fifty"),
    ("1973-oil-shock-bear-market", "Oil shock bear market"), ("1975-recovery-of-1975", "Recovery of 1975"),
    ("1977-stagflation", "Stagflation"), ("1980-volcker-squeeze", "Volcker squeeze"),
    ("1982-start-of-the-great-bull-market", "Start of the great bull market"), ("1987-black-monday", "Black Monday"),
    ("1989-savings-and-loan-crisis-and-the-gulf-war", "Savings and loan crisis and the Gulf War"), ("1992-1994-bond-rout", "1994 bond rout"),
    ("1995-mid-nineties-bull-market", "Mid-nineties bull market"), ("1998-ltcm-and-the-dot-com-mania", "LTCM and the dot-com mania"),
    ("2000-dot-com-bust", "Dot-com bust"), ("2003-mid-2000s-expansion", "Mid-2000s expansion"),
    ("2007-global-financial-crisis", "Global financial crisis"), ("2009-euro-crisis-years", "Euro crisis years"),
    ("2013-taper-tantrum", "Taper tantrum"), ("2016-brexit-and-the-reflation-trade", "Brexit and the reflation trade"),
    ("2018-volmageddon-and-the-fed-pivot", "Volmageddon and the Fed pivot"), ("2020-covid-crash-and-recovery", "Covid crash and recovery"),
    ("2022-inflation-and-the-fastest-rate-rises-in-decades", "Inflation and the fastest rate rises in decades"),
    ("2024-ai-boom-and-the-tariff-shock", "AI boom and the tariff shock"),
]
