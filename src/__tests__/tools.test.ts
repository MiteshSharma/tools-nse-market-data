import { describe, expect, it } from 'vitest';
import { createNseMarketDataTools } from '../tools';

describe('createNseMarketDataTools()', () => {
  it('returns 8 tools', () => {
    const tools = createNseMarketDataTools();
    expect(tools).toHaveLength(8);
  });

  it('all tools have required fields', () => {
    const tools = createNseMarketDataTools();
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.toolset).toBe('market');
      expect(tool.schema).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('tool names match expected list', () => {
    const tools = createNseMarketDataTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('nse_market_clean');
    expect(names).toContain('nse_market_backfill');
    expect(names).toContain('nse_market_update');
    expect(names).toContain('nse_watchlist_add');
    expect(names).toContain('nse_watchlist_remove');
    expect(names).toContain('nse_watchlist_show');
    expect(names).toContain('nse_market_history');
    expect(names).toContain('nse_market_screen');
  });
});
