// NSE Bhavcopy — bulk daily data download
// Requires NSE session cookie — not yet implemented
// URL pattern: https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip

export interface BhavcopyCsvRow {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

// TODO: implement NSE session cookie fetching
export async function fetchBhavcopy(_date: string): Promise<BhavcopyCsvRow[]> {
  throw new Error('NSE Bhavcopy not yet implemented — use Yahoo Finance fetcher instead');
}
