# BEHAVIORAL PATTERN DETECTION SPECIFICATION
## MVP: 4 Patterns

---

## General Principles

1. **All detection is relative to the trader's OWN baseline** — not absolute thresholds.
2. **Conservative thresholds** — better to miss a real pattern than flag a false one.
3. **Confidence levels are explicit** — every detection is labeled HIGH or MEDIUM.
4. **Dollar impact is always calculated** — patterns without dollar impact are just trivia.
5. **Recalibration** — baselines update as more data accumulates.

---

## Baseline Computation

Before detecting patterns, compute the trader's personal baselines from ALL their historical trades:

```
Baseline Metrics:
- avg_trades_per_day (mean + stddev)
- avg_position_size (mean + stddev)
- avg_time_between_trades (mean + stddev) — minutes between consecutive trades
- avg_hold_time_winning (mean) — hold time on winning trades
- avg_hold_time_losing (mean) — hold time on losing trades
- avg_pnl_per_trade (mean)
- win_rate (overall)
```

**Minimum data requirements:**
- < 15 trades: No pattern detection. Show basic P&L only.
- 15–30 trades: "Early observations" label. Detect only HIGH confidence patterns.
- 30–100 trades: "Emerging patterns" label. Detect all 4 patterns.
- 100+ trades: "Established patterns" label. Full confidence in detection.

**Rolling window:** Baselines computed on trailing 90 days (or all data if < 90 days).

---

## PATTERN 1: OVERTRADING

### Definition
Trade frequency significantly above the trader's own normal pace, suggesting impulsive trading rather than planned execution.

### Detection Algorithm

```
FOR each trading day:
  trade_count = number of trades that day
  threshold = avg_trades_per_day + (2 * stddev_trades_per_day)

  IF trade_count > threshold:
    flag as OVERTRADING
    excess_trades = trade_count - avg_trades_per_day (rounded)

    // Also check for same-ticker churn
    FOR each ticker traded that day:
      ticker_trades = trades of this ticker today
      IF ticker_trades > 3 AND time_span < 60 minutes:
        flag as SAME_TICKER_CHURN (sub-pattern)
```

### Confidence
**HIGH** — purely data-driven, no interpretation needed.

### Dollar Impact Calculation
```
Sort day's trades chronologically.
excess_trades = trade_count - round(avg_trades_per_day)
Mark the last N trades as "excess" (where N = excess_trades).
dollar_impact = sum of P&L of excess trades.
```

### Display
```
Headline: "Overtrading detected: 14 trades on March 5 (your average is 6)"
Impact: "The 8 extra trades cost you $420"
Recommendation: "Consider setting a daily trade limit. Your best days average 5-7 trades."
Confidence: HIGH
```

---

## PATTERN 2: SIZE ESCALATION AFTER LOSSES (Tilt)

### Definition
Increasing position size following consecutive losses, suggesting emotional escalation ("make it back" behavior).

### Detection Algorithm

```
FOR each trading session:
  trades = chronologically sorted trades

  FOR i = 2 to len(trades):
    // Check for consecutive losses preceding this trade
    prev_losses = count consecutive losing trades ending at trades[i-1]

    IF prev_losses >= 2:
      current_size = trades[i].position_value
      avg_size = trader baseline avg_position_size

      IF current_size > avg_size * 1.5:  // 50% above average
        flag as SIZE_ESCALATION
        excess_size = current_size - avg_size
```

### Confidence
**HIGH** — factual: losses happened, size increased. The *reason* is inferred but the behavior is factual.

### Dollar Impact Calculation
```
// What would the P&L have been at normal size?
normal_pnl = trades[i].pnl_percent * avg_size
actual_pnl = trades[i].net_pnl
dollar_impact = actual_pnl - normal_pnl  // negative if loss was amplified
```

### Display
```
Headline: "Size escalation after 3 consecutive losses"
Detail: "After losing $180, $95, and $210, you increased position size to $12,400 (your average is $7,500)"
Impact: "The oversized position amplified your loss by $340"
Recommendation: "After 2+ consecutive losses, consider reducing size to 50% of normal or taking a break."
Confidence: HIGH
```

---

## PATTERN 3: RAPID RE-ENTRY AFTER LOSS (Possible Revenge)

### Definition
Taking a new trade within an abnormally short time after a losing trade, potentially driven by emotional reaction rather than planned setup.

### Detection Algorithm

```
FOR each trading session:
  trades = chronologically sorted trades

  FOR i = 1 to len(trades):
    IF trades[i-1].net_pnl < 0:  // previous trade was a loss
      time_gap = trades[i].entry_time - trades[i-1].exit_time  // in minutes
      normal_gap = trader baseline avg_time_between_trades

      IF time_gap < normal_gap * 0.4:  // less than 40% of normal gap
        flag as RAPID_REENTRY

        // Additional severity signals:
        severity = 'moderate'
        IF trades[i].position_value >= trades[i-1].position_value:
          severity = 'severe'  // same or larger size = stronger signal
        IF trades[i].symbol == trades[i-1].symbol:
          severity = 'severe'  // same ticker = stronger signal
```

### Confidence
**MEDIUM** — timing is factual, but "revenge" is an interpretation. The trader may have had a valid planned entry that happened to follow a loss.

### Dollar Impact Calculation
```
dollar_impact = trades[i].net_pnl  // P&L of the rapid re-entry trade
// Also compute: win rate of rapid re-entries vs. trader's overall win rate
```

### Display
```
Headline: "Possible revenge trade: re-entered 4 minutes after a $200 loss"
Detail: "Your average time between trades is 22 minutes. This gap was 4 minutes. Position size was $8,500 (above your $7,000 average)."
Impact: "This trade lost $310. Your win rate on rapid re-entries is 28% vs. your overall 48%."
Recommendation: "Consider a mandatory 15-minute break after any loss over $150."
Confidence: MEDIUM (timing is factual; intent is inferred)
```

---

## PATTERN 4: PREMATURE PROFIT TAKING

### Definition
Closing a winning trade significantly earlier than the trader's own average hold time for winners, leaving substantial profit on the table.

### Detection Algorithm

```
FOR each winning trade (net_pnl > 0):
  hold_time = trade.hold_time_minutes
  avg_winning_hold = trader baseline avg_hold_time_winning

  IF hold_time < avg_winning_hold * 0.4:  // held less than 40% of average
    // Check if price continued favorably after exit
    // (Requires end-of-day price or next available price)
    exit_price = trade.exit_price
    eod_price = get_end_of_day_price(trade.symbol, trade.session_date)

    IF trade.direction == 'long':
      continued_move = eod_price - exit_price
    ELSE:
      continued_move = exit_price - eod_price

    IF continued_move > 0:  // price kept going in favorable direction
      unrealized_profit = continued_move * trade.quantity
      IF unrealized_profit > trade.net_pnl * 0.5:  // left >50% on the table
        flag as PREMATURE_EXIT
        left_on_table = unrealized_profit
```

### Confidence
**MEDIUM** — the early exit is factual. Whether it was "premature" depends on what happened after (which we can measure) and whether the trader had a valid exit reason (which we can't know for certain).

### Dollar Impact Calculation
```
dollar_impact = left_on_table  // unrealized profit after exit
// Aggregate: total profit left on table across all premature exits
```

### Display
```
Headline: "Early exit on NVDA: took $120 profit, left ~$480 on the table"
Detail: "You held for 8 minutes (your average winning hold: 34 minutes). NVDA continued $4.80 in your direction by end of day."
Impact: "Across 11 premature exits this month, you left approximately $2,300 on the table."
Recommendation: "For your next winning trade, try holding to at least 50% of your average winning hold time before making an exit decision."
Confidence: MEDIUM (exit timing is factual; "premature" is based on subsequent price action)
```

---

## AGGREGATE METRICS

### "Cost of Behavior" (per period)
```
total_behavior_cost = sum of dollar_impact across all detected patterns in period

Display:
"Your behavioral patterns cost you $X this [week/month].
Without these patterns, your P&L would be +$Y instead of -$Z."
```

### "Equity Curve Without Patterns" (simulation)
```
For the equity curve simulation:
1. Take actual equity curve
2. Remove all trades flagged as part of a behavioral pattern
3. Recalculate cumulative P&L
4. Display both curves overlaid

Note: This is simplified — removing trades retroactively doesn't perfectly
simulate reality. Label as "estimated" not "guaranteed."
```

### Pattern Trend Over Time
```
For each pattern type, track:
- Instances per week/month
- Total dollar cost per week/month
- Trend direction: increasing / decreasing / stable
```

---

## EDGE CASES & SAFEGUARDS

1. **Small sample size:** If < 5 instances of a pattern, label as "preliminary observation" and don't include in "Cost of Behavior" aggregate.

2. **Overlapping patterns:** A single trade can be flagged by multiple patterns (e.g., rapid re-entry + size escalation). Count dollar impact ONCE (use the largest), not double.

3. **All-winning days:** If trader had a profitable day but with behavioral flags, still show the flags. Good outcomes don't validate bad process.

4. **User dismisses flag:** Store dismissal. If >50% of a pattern type is dismissed, reduce confidence or investigate threshold calibration.

5. **Options trades in file (MVP):** Skip with message: "We found options trades in your file. Options analysis is coming in a future update. For now, we've analyzed your stock trades."

6. **No patterns detected:** This is fine. Show: "No behavioral patterns detected in this session. Here's your performance summary." Don't force insights that don't exist.

7. **End-of-day price unavailable:** For premature exit detection, if we can't get EOD price, skip this pattern for that trade. Don't guess.