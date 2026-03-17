# Test CSV Expected Values

## test_schwab_2weeks.csv (Schwab format)

- Broker detection: `schwab`
- Total trades: 14
- Net P&L: $690.30
- Wins: 9, Losses: 5
- Commission: $0.65 per side ($1.30 per round-trip)
- Includes 1 short trade (AMZN)
- Dividend row should be skipped (not a trade)

## test_tdameritrade_2weeks.csv (TD Ameritrade format)

- Broker detection: `tdameritrade`
- Total trades: 14
- Net P&L: $708.50
- Wins: 9, Losses: 5
- Commission: $0.00 (commission-free)
- Includes 1 short trade (AMZN)
- `***END OF FILE***` footer should stop parsing

## test_webull_2weeks.csv (Webull format)

- Broker detection: `webull`
- Total trades: 14
- Net P&L: $707.94
- Wins: 9, Losses: 5
- Commission: $0.02 per fill ($0.04 per round-trip)
- Includes 1 short trade (AMZN)
- 1 cancelled order (TSLA) should be skipped

## All fixtures share the same trades

Same 14 symbols/prices across all brokers. P&L differences are due to different commission structures:
- AAPL: 2 trades (both winners)
- MSFT: 2 trades (1 loss, 1 win)
- NVDA: 2 trades (1 win, 1 loss)
- AMZN: 2 trades (1 long win, 1 short win)
- GOOG: 2 trades (both losses)
- META: 1 trade (winner)
- TSLA: 1 trade (loss)
- AMD: 2 trades (both winners)
