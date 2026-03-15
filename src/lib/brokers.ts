export type SupportedBrokerName = 'ibkr' | 'schwab' | 'tdameritrade' | 'webull';

export interface BrokerDetails {
  brokerName: SupportedBrokerName;
  accountLabel: string;
}

const BROKER_DETAILS_BY_FORMAT: Record<string, BrokerDetails> = {
  'ibkr-flex-query': {
    brokerName: 'ibkr',
    accountLabel: 'IBKR Account',
  },
  'ibkr-activity-statement': {
    brokerName: 'ibkr',
    accountLabel: 'IBKR Account',
  },
  schwab: {
    brokerName: 'schwab',
    accountLabel: 'Schwab Account',
  },
  tdameritrade: {
    brokerName: 'tdameritrade',
    accountLabel: 'TD Ameritrade Account',
  },
  webull: {
    brokerName: 'webull',
    accountLabel: 'Webull Account',
  },
};

export function getBrokerDetailsFromFormat(brokerFormat: string): BrokerDetails | null {
  return BROKER_DETAILS_BY_FORMAT[brokerFormat] ?? null;
}
