// Implemented per Section 10 of tools-nse-market-data.md
// Yahoo Finance HTTP fetching — rate limited, User-Agent required

import type { OhlcvRow } from './store';

export async function fetchOhlcv(
  _symbol: string,
  _fromUnixSec: number,
  _toUnixSec: number,
): Promise<OhlcvRow[]> {
  throw new Error('Not implemented');
}

export async function fetchQuote(_symbol: string): Promise<{ price: number; volume: number }> {
  throw new Error('Not implemented');
}

export async function searchSymbol(
  _query: string,
): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
  throw new Error('Not implemented');
}
