import { describe, expect, it } from 'vitest';
import { getBrokerDetailsFromFormat } from '@/lib/brokers';

describe('getBrokerDetailsFromFormat', () => {
  it('maps IBKR parser formats to the shared broker account', () => {
    expect(getBrokerDetailsFromFormat('ibkr-flex-query')).toEqual({
      brokerName: 'ibkr',
      accountLabel: 'IBKR Account',
    });
    expect(getBrokerDetailsFromFormat('ibkr-activity-statement')).toEqual({
      brokerName: 'ibkr',
      accountLabel: 'IBKR Account',
    });
  });

  it('maps supported non-IBKR brokers to their stored account names', () => {
    expect(getBrokerDetailsFromFormat('schwab')).toEqual({
      brokerName: 'schwab',
      accountLabel: 'Schwab Account',
    });
    expect(getBrokerDetailsFromFormat('tdameritrade')).toEqual({
      brokerName: 'tdameritrade',
      accountLabel: 'TD Ameritrade Account',
    });
    expect(getBrokerDetailsFromFormat('webull')).toEqual({
      brokerName: 'webull',
      accountLabel: 'Webull Account',
    });
  });

  it('returns null for unsupported broker formats', () => {
    expect(getBrokerDetailsFromFormat('unknown')).toBeNull();
  });
});
