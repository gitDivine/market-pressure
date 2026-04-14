// Central bank interest rates — update periodically
// Last updated: April 2026
export const CENTRAL_BANK_RATES: Record<string, { rate: number; bank: string }> = {
  USD: { rate: 4.50, bank: "Federal Reserve" },
  EUR: { rate: 2.65, bank: "ECB" },
  GBP: { rate: 4.50, bank: "Bank of England" },
  JPY: { rate: 0.50, bank: "Bank of Japan" },
  AUD: { rate: 4.10, bank: "Reserve Bank of Australia" },
  NZD: { rate: 3.50, bank: "Reserve Bank of New Zealand" },
  CAD: { rate: 2.75, bank: "Bank of Canada" },
  CHF: { rate: 0.25, bank: "Swiss National Bank" },
  CNY: { rate: 3.10, bank: "People's Bank of China" },
  SEK: { rate: 2.25, bank: "Sveriges Riksbank" },
  NOK: { rate: 4.50, bank: "Norges Bank" },
  SGD: { rate: 3.50, bank: "MAS" },
  HKD: { rate: 4.75, bank: "HKMA" },
  ZAR: { rate: 7.50, bank: "SARB" },
  MXN: { rate: 9.00, bank: "Banxico" },
  TRY: { rate: 42.50, bank: "TCMB" },
  BRL: { rate: 14.25, bank: "BCB" },
  INR: { rate: 6.00, bank: "RBI" },
  PLN: { rate: 5.75, bank: "NBP" },
  HUF: { rate: 6.50, bank: "MNB" },
  CZK: { rate: 3.75, bank: "CNB" },
  DKK: { rate: 2.60, bank: "Danmarks Nationalbank" },
};

// Sector mapping for stocks
export const STOCK_SECTORS: Record<string, string> = {
  // Technology
  AAPL: "Technology", MSFT: "Technology", GOOGL: "Technology", GOOG: "Technology",
  AMZN: "Technology", NVDA: "Technology", META: "Technology", TSLA: "Technology",
  NFLX: "Technology", ADBE: "Technology", CRM: "Technology", AMD: "Technology",
  INTC: "Technology", AVGO: "Technology", QCOM: "Technology", ORCL: "Technology",
  IBM: "Technology", NOW: "Technology", SNOW: "Technology", UBER: "Technology",
  SHOP: "Technology", PLTR: "Technology", MU: "Technology", AMAT: "Technology",
  LRCX: "Technology", KLAC: "Technology", MRVL: "Technology", ARM: "Technology",
  PANW: "Technology", CRWD: "Technology", ZS: "Technology", NET: "Technology",
  DDOG: "Technology", TEAM: "Technology", WDAY: "Technology", HUBS: "Technology",
  VEEV: "Technology", TTD: "Technology", RBLX: "Technology", COIN: "Technology",
  HOOD: "Technology", SQ: "Technology", ABNB: "Technology", DASH: "Technology",
  SNAP: "Technology", PINS: "Technology", SPOT: "Technology", ZM: "Technology",
  DOCU: "Technology", TWLO: "Technology", OKTA: "Technology", MDB: "Technology",
  TSM: "Technology",
  // Finance
  JPM: "Financials", V: "Financials", MA: "Financials", BAC: "Financials",
  WFC: "Financials", GS: "Financials", MS: "Financials", C: "Financials",
  AXP: "Financials", BLK: "Financials", SCHW: "Financials", PYPL: "Financials",
  // Healthcare
  UNH: "Healthcare", LLY: "Healthcare", JNJ: "Healthcare", PFE: "Healthcare",
  ABBV: "Healthcare", MRK: "Healthcare", TMO: "Healthcare", ABT: "Healthcare",
  DHR: "Healthcare", ISRG: "Healthcare", AMGN: "Healthcare", GILD: "Healthcare",
  VRTX: "Healthcare", REGN: "Healthcare", BMY: "Healthcare", MDT: "Healthcare",
  SYK: "Healthcare", BSX: "Healthcare", ZTS: "Healthcare", CI: "Healthcare",
  ELV: "Healthcare", HUM: "Healthcare",
  // Consumer
  WMT: "Consumer", HD: "Consumer", PEP: "Consumer", KO: "Consumer",
  MCD: "Consumer", NKE: "Consumer", SBUX: "Consumer", TGT: "Consumer",
  COST: "Consumer", LOW: "Consumer", TJX: "Consumer", LULU: "Consumer",
  CMG: "Consumer", YUM: "Consumer", DPZ: "Consumer", DKNG: "Consumer",
  MGM: "Consumer", WYNN: "Consumer", MAR: "Consumer", HLT: "Consumer",
  BKNG: "Consumer", DIS: "Consumer", CMCSA: "Consumer", CHTR: "Consumer",
  WBD: "Consumer", PARA: "Consumer", LYV: "Consumer", NCLH: "Consumer",
  CCL: "Consumer", RCL: "Consumer",
  // Energy
  XOM: "Energy", CVX: "Energy", COP: "Energy", SLB: "Energy",
  EOG: "Energy", OXY: "Energy", MPC: "Energy", VLO: "Energy",
  PSX: "Energy", HAL: "Energy",
  // Industrials
  CAT: "Industrials", DE: "Industrials", HON: "Industrials", MMM: "Industrials",
  GE: "Industrials", RTX: "Industrials", LMT: "Industrials", NOC: "Industrials",
  BA: "Industrials", GD: "Industrials", UNP: "Industrials", UPS: "Industrials",
  FDX: "Industrials", DAL: "Industrials", UAL: "Industrials", AAL: "Industrials",
  LUV: "Industrials", JBLU: "Industrials",
  // Real Estate
  AMT: "Real Estate", PLD: "Real Estate", CCI: "Real Estate", EQIX: "Real Estate",
  SPG: "Real Estate", O: "Real Estate", WELL: "Real Estate", DLR: "Real Estate",
  // Utilities
  NEE: "Utilities", DUK: "Utilities", SO: "Utilities", AEP: "Utilities",
  D: "Utilities", EXC: "Utilities", XEL: "Utilities", ES: "Utilities",
  // Materials
  LIN: "Materials", APD: "Materials", SHW: "Materials", ECL: "Materials",
  FCX: "Materials", NEM: "Materials", NUE: "Materials", STLD: "Materials",
  // Telecom
  T: "Telecom", VZ: "Telecom", TMUS: "Telecom",
};

// The 8 major currencies for strength calculation
export const MAJOR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"];

// 28 major forex pairs (all combinations of 8 majors)
export const MAJOR_PAIRS = [
  "EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF", "USDJPY",
  "EURGBP", "EURAUD", "EURNZD", "EURCAD", "EURCHF", "EURJPY",
  "GBPAUD", "GBPNZD", "GBPCAD", "GBPCHF", "GBPJPY",
  "AUDNZD", "AUDCAD", "AUDCHF", "AUDJPY",
  "NZDCAD", "NZDCHF", "NZDJPY",
  "CADCHF", "CADJPY",
  "CHFJPY",
];
