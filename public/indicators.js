/**
 * 股票技术指标计算模块
 * 包含10个核心指标的完整计算逻辑
 */

// ==================== 辅助函数 ====================

function EMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  // Start with SMA
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  result.push(sum / period);
  // EMA calculation
  for (let i = period; i < data.length; i++) {
    result.push((data[i] - result[result.length - 1]) * k + result[result.length - 1]);
  }
  return result;
}

function SMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

function STDDEV(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const squaredDiffs = slice.map(v => Math.pow(v - mean, 2));
      result.push(Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period));
    }
  }
  return result;
}

function HIGHEST(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      result.push(Math.max(...data.slice(i - period + 1, i + 1)));
    }
  }
  return result;
}

function LOWEST(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      result.push(Math.min(...data.slice(i - period + 1, i + 1)));
    }
  }
  return result;
}

// ==================== 1. MACD 指标 ====================
function calcMACD(data) {
  const closes = data.map(d => d.close);
  if (closes.length < 35) return { bullish: false, value: '--', detail: '数据不足' };

  const ema12 = EMA(closes, 12);
  const ema26 = EMA(closes, 26);

  // Align arrays: EMA12 starts at index 11, EMA26 at index 25
  // We need to slice ema12 from its index 14 onward (matching ema26's length)
  const ema12Aligned = ema12.slice(ema12.length - ema26.length);

  const macdLine = [];
  for (let i = 0; i < ema12Aligned.length; i++) {
    macdLine.push(ema12Aligned[i] - ema26[i]);
  }

  const signal = EMA(macdLine, 9);
  // Align: EMA(9) returns (N-8) items, trim macdLine to match
  const macdTrimmed = macdLine.slice(macdLine.length - signal.length);
  const histogram = [];
  for (let i = 0; i < signal.length; i++) {
    histogram.push((macdTrimmed[i] - signal[i]) * 2);
  }

  const latest = histogram[histogram.length - 1];
  const prev = histogram[histogram.length - 2];
  const dif = macdTrimmed[macdTrimmed.length - 1];
  const dea = signal[signal.length - 1];

  const bullish = latest > 0 && dif > dea;

  return {
    bullish,
    value: latest.toFixed(4),
    detail: `DIF:${dif.toFixed(3)} DEA:${dea.toFixed(3)} 柱:${latest.toFixed(4)}`,
    signal: latest > 0 ? (dif > dea ? '多头增强' : '多头减弱') : '空头'
  };
}

// ==================== 2. RSI 指标 ====================
function calcRSI(data, period = 14) {
  const closes = data.map(d => d.close);
  if (closes.length < period + 1) return { bullish: false, value: '--', detail: '数据不足' };

  // Calculate RSI using smoothed method
  let gains = 0, losses = 0;

  // First average gain/loss
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Use the rest of data to smooth (if available)
  // For simplicity, use the period-based calculation
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  // Also get previous RSI for trend
  let prevAvgGain = 0, prevAvgLoss = 0;
  for (let i = closes.length - period - 1; i < closes.length - 1; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) prevAvgGain += diff;
    else prevAvgLoss += Math.abs(diff);
  }
  prevAvgGain /= period;
  prevAvgLoss /= period;
  const prevRs = prevAvgLoss === 0 ? 100 : prevAvgGain / prevAvgLoss;
  const prevRsi = prevAvgLoss === 0 ? 100 : 100 - 100 / (1 + prevRs);

  const bullish = rsi > 55;
  const rising = rsi > prevRsi;

  return {
    bullish,
    value: rsi.toFixed(2),
    detail: `RSI(${period}): ${rsi.toFixed(2)} ${rsi > 80 ? '(超买)' : rsi < 20 ? '(超卖)' : ''}`,
    signal: rsi > 50 ? (rising ? '多头强势' : '多头减弱') : '空头'
  };
}

// ==================== 3. KDJ 指标 ====================
function calcKDJ(data, n = 9, m1 = 3, m2 = 3) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  if (closes.length < n) return { bullish: false, value: '--', detail: '数据不足' };

  const rsvArr = [];
  const kArr = [], dArr = [], jArr = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < n - 1) {
      rsvArr.push(null);
      kArr.push(null);
      dArr.push(null);
      jArr.push(null);
      continue;
    }

    const hh = Math.max(...highs.slice(i - n + 1, i + 1));
    const ll = Math.min(...lows.slice(i - n + 1, i + 1));
    const rsv = hh === ll ? 50 : (closes[i] - ll) / (hh - ll) * 100;
    rsvArr.push(rsv);

    if (i === n - 1) {
      kArr.push(50);
      dArr.push(50);
    } else {
      kArr.push(2 / m1 * kArr[kArr.length - 1] + (1 - 2 / m1) * rsv);
      dArr.push(2 / m2 * dArr[dArr.length - 1] + (1 - 2 / m2) * kArr[kArr.length - 1]);
    }
    jArr.push(3 * kArr[kArr.length - 1] - 2 * dArr[dArr.length - 1]);
  }

  const latestK = kArr[kArr.length - 1];
  const latestD = dArr[dArr.length - 1];
  const latestJ = jArr[jArr.length - 1];
  const prevK = kArr[kArr.length - 2] || 50;
  const prevJ = jArr[jArr.length - 2] || 50;

  // Bullish: J > 10 and K > D
  const bullish = latestJ > 10 && latestK > latestD;

  return {
    bullish,
    value: latestJ ? latestJ.toFixed(2) : '--',
    detail: `K:${latestK?.toFixed(2)} D:${latestD?.toFixed(2)} J:${latestJ?.toFixed(2)}`,
    signal: latestJ > 0 ? (latestJ > prevJ ? 'J值向上' : 'J值回落') : '空头'
  };
}

// ==================== 4. MA 均线排列 ====================
function calcMA(data) {
  const closes = data.map(d => d.close);
  if (closes.length < 60) return { bullish: false, value: '--', detail: '数据不足(需60日)' };

  const ma5 = SMA(closes, 5);
  const ma10 = SMA(closes, 10);
  const ma20 = SMA(closes, 20);
  const ma60 = SMA(closes, 60);

  const lastMA5 = ma5[ma5.length - 1];
  const lastMA10 = ma10[ma10.length - 1];
  const lastMA20 = ma20[ma20.length - 1];
  const lastMA60 = ma60[ma60.length - 1];
  const lastClose = closes[closes.length - 1];

  // Bullish: price > MA5 > MA10 > MA20 (多头排列)
  // Also check MA60 for overall trend
  const priceAbove = lastClose > lastMA5;
  const maBullish = lastMA5 > lastMA10 && lastMA10 > lastMA20;
  const longTrend = lastClose > lastMA60;

  const bullish = priceAbove && maBullish && longTrend;

  let detail = `MA5:${lastMA5.toFixed(2)} MA10:${lastMA10.toFixed(2)} MA20:${lastMA20.toFixed(2)}`;
  if (closes.length >= 60) {
    detail += ` MA60:${lastMA60.toFixed(2)}`;
  }

  let signal = '';
  if (maBullish && priceAbove) signal = '多头排列';
  else if (!maBullish && !priceAbove) signal = '空头排列';
  else if (priceAbove) signal = '价在线上';
  else signal = '价在线下';

  return { bullish, value: lastMA5.toFixed(2), detail, signal };
}

// ==================== 5. BOLL 布林带 ====================
function calcBOLL(data, period = 20, multiplier = 2) {
  const closes = data.map(d => d.close);
  if (closes.length < period) return { bullish: false, value: '--', detail: '数据不足' };

  const ma = SMA(closes, period);
  const std = STDDEV(closes, period);

  const lastMA = ma[ma.length - 1];
  const lastStd = std[std.length - 1];
  const upper = lastMA + multiplier * lastStd;
  const lower = lastMA - multiplier * lastStd;
  const lastClose = closes[closes.length - 1];

  // Bullish: price > middle band
  const bullish = lastClose > lastMA;

  // Calculate bandwidth
  const bandwidth = ((upper - lower) / lastMA * 100).toFixed(2);

  // Position in band
  const position = lastMA === 0 ? 0 : ((lastClose - lower) / (upper - lower) * 100).toFixed(1);

  return {
    bullish,
    value: `中轨:${lastMA.toFixed(2)}`,
    detail: `上轨:${upper.toFixed(2)} 中轨:${lastMA.toFixed(2)} 下轨:${lower.toFixed(2)} 带宽:${bandwidth}%`,
    signal: lastClose > lastMA ? '中轨之上' : '中轨之下'
  };
}

// ==================== 6. VOL 成交量 ====================
function calcVOL(data) {
  const volumes = data.map(d => d.volume);
  const closes = data.map(d => d.close);

  if (volumes.length < 6) return { bullish: false, value: '--', detail: '数据不足' };

  const volMA5 = SMA(volumes, 5);

  const lastVol = volumes[volumes.length - 1];
  const lastVolMA5 = volMA5[volMA5.length - 1];
  const prevClose = closes[closes.length - 2];
  const lastClose = closes[closes.length - 1];

  // Bullish: volume > 1.2 * MA5 and price rising
  const volIncreasing = lastVol > lastVolMA5 * 1.2;
  const priceUp = lastClose > prevClose;

  const bullish = volIncreasing && priceUp;

  const volRatio = lastVolMA5 > 0 ? (lastVol / lastVolMA5).toFixed(2) : '--';

  return {
    bullish,
    value: (lastVol / 10000).toFixed(0) + '万手',
    detail: `量比:${volRatio} MA5均量:${(lastVolMA5 / 10000).toFixed(0)}万手`,
    signal: volIncreasing ? (priceUp ? '放量上涨' : '放量下跌') : '缩量'
  };
}

// ==================== 7. 主力成本 ====================
function calcMainForceCost(data, period = 20) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);

  if (closes.length < period) return { bullish: false, value: '--', detail: '数据不足' };

  // VWAP (Volume Weighted Average Price) as main force cost proxy
  let totalVol = 0, totalVolPrice = 0;
  const start = Math.max(0, closes.length - period);

  for (let i = start; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    totalVol += volumes[i];
    totalVolPrice += typicalPrice * volumes[i];
  }

  const costPrice = totalVol > 0 ? totalVolPrice / totalVol : 0;
  const lastClose = closes[closes.length - 1];

  // Bullish: current price above main force cost
  const bullish = lastClose > costPrice;

  const pctDiff = costPrice > 0 ? ((lastClose - costPrice) / costPrice * 100).toFixed(2) : '--';

  return {
    bullish,
    value: costPrice.toFixed(2),
    detail: `成本价:${costPrice.toFixed(2)} 现价:${lastClose.toFixed(2)} 偏离:${pctDiff}%`,
    signal: bullish ? '高于成本' : '低于成本'
  };
}

// ==================== 8. OBV 能量潮 ====================
function calcOBV(data) {
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);

  if (closes.length < 2) return { bullish: false, value: '--', detail: '数据不足' };

  // Calculate OBV
  const obvArr = [volumes[0]]; // OBV starts with first volume
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obvArr.push(obvArr[i - 1] + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      obvArr.push(obvArr[i - 1] - volumes[i]);
    } else {
      obvArr.push(obvArr[i - 1]);
    }
  }

  const obvMA5 = SMA(obvArr, 5);
  const lastOBV = obvArr[obvArr.length - 1];
  const lastOBVMA5 = obvMA5[obvMA5.length - 1];
  const prevOBV = obvArr[obvArr.length - 2];

  // Bullish: OBV trending up (OBV > MA of OBV and increasing)
  const obvAboveMA = lastOBV > (lastOBVMA5 || 0);
  const obvRising = lastOBV > prevOBV;

  const bullish = obvRising;

  return {
    bullish,
    value: lastOBV > 100000000 ? (lastOBV / 100000000).toFixed(2) + '亿' : (lastOBV / 10000).toFixed(2) + '万',
    detail: obvRising ? 'OBV趋势向上' : 'OBV趋势向下',
    signal: obvRising ? (obvAboveMA ? '量能充沛' : '量能恢复') : '量能萎缩'
  };
}

// ==================== CCI 商品通道指标 ====================
function calcCCI(data, period = 14) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  if (closes.length < period) return { bullish: false, value: '--', detail: '数据不足' };

  const tpArr = []; // Typical Price
  for (let i = 0; i < closes.length; i++) {
    tpArr.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  const cciArr = [];
  for (let i = period - 1; i < tpArr.length; i++) {
    const slice = tpArr.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const mad = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    const cci = mad === 0 ? 0 : (tpArr[i] - mean) / (0.015 * mad);
    cciArr.push(cci);
  }

  const latest = cciArr[cciArr.length - 1] || 0;
  // Bullish: CCI > +80 (偏强), Bearish: CCI < -100 (弱势)
  const bullish = latest > 80;

  let signal = '';
  if (latest > 200) signal = '超买';
  else if (latest > 100) signal = '偏强';
  else if (latest > -100) signal = '震荡';
  else if (latest > -200) signal = '偏弱';
  else signal = '超卖';

  return { bullish, value: latest.toFixed(1), detail: `CCI(${period}): ${latest.toFixed(1)} ${signal}`, signal };
}

// ==================== PSY 心理线 ====================
function calcPSY(data, period = 12) {
  const closes = data.map(d => d.close);
  if (closes.length < period) return { bullish: false, value: '--', detail: '数据不足' };

  let upDays = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) upDays++;
  }
  const psy = (upDays / period) * 100;

  // Bullish: PSY > 55 (多数交易日上涨)
  const bullish = psy > 55;

  let signal = '';
  if (psy > 75) signal = '过度乐观';
  else if (psy > 55) signal = '偏多';
  else if (psy > 45) signal = '均衡';
  else if (psy > 25) signal = '偏空';
  else signal = '过度悲观';

  return { bullish, value: psy.toFixed(1), detail: `PSY(${period}): ${psy.toFixed(1)} ${signal}`, signal };
}
function calcWR(data, period = 14) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  if (closes.length < period) return { bullish: false, value: '--', detail: '数据不足' };

  const h14 = HIGHEST(highs, period);
  const l14 = LOWEST(lows, period);

  const lastWR = h14[h14.length - 1] !== null && h14[h14.length - 1] !== l14[l14.length - 1]
    ? ((h14[h14.length - 1] - closes[closes.length - 1]) / (h14[h14.length - 1] - l14[l14.length - 1])) * -100
    : -50;

  // Bullish: WR > -80 (not oversold), ideally WR > -50
  const bullish = lastWR > -80;

  let signal = '';
  if (lastWR > -20) signal = '超买区';
  else if (lastWR > -50) signal = '强势区';
  else if (lastWR > -80) signal = '弱势区';
  else signal = '超卖区';

  return {
    bullish,
    value: lastWR.toFixed(2),
    detail: `WR(${period}): ${lastWR.toFixed(2)} ${signal}`,
    signal
  };
}

// ==================== 10. DMI 趋向指标 ====================
function calcDMI(data, period = 14) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);

  if (closes.length < period + 1) return { bullish: false, value: '--', detail: '数据不足' };

  // Calculate +DM, -DM, TR
  const trArr = [], pdiArr = [], mdiArr = [];
  let atrSum = 0, pdiSum = 0, mdiSum = 0;

  for (let i = 1; i < closes.length; i++) {
    const h = highs[i], l = lows[i], ph = highs[i - 1], pl = lows[i - 1], pc = closes[i - 1];

    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const upMove = h - ph;
    const downMove = pl - l;

    const pDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const mDM = downMove > upMove && downMove > 0 ? downMove : 0;

    if (i < period) {
      trArr.push(tr);
      if (i === period - 1) {
        atrSum = trArr.reduce((a, b) => a + b, 0);
        pdiSum += pDM;
        mdiSum += mDM;
      }
    } else {
      // Smoothed
      atrSum = (atrSum - atrSum / period + tr);
      pdiSum = (pdiSum - pdiSum / period + pDM);
      mdiSum = (mdiSum - mdiSum / period + mDM);
    }

    if (i >= period) {
      const atr = atrSum / period;
      trArr.push(tr);

      const pDI = atr > 0 ? (pdiSum / period / atr * 100) : 0;
      const mDI = atr > 0 ? (mdiSum / period / atr * 100) : 0;

      pdiArr.push(pDI);
      mdiArr.push(mDI);
    }
  }

  const lastPDI = pdiArr[pdiArr.length - 1] || 0;
  const lastMDI = mdiArr[mdiArr.length - 1] || 0;

  // Bullish: +DI > -DI
  const bullish = lastPDI > lastMDI;

  return {
    bullish,
    value: `+DI:${lastPDI.toFixed(2)}`,
    detail: `+DI:${lastPDI.toFixed(2)} -DI:${lastMDI.toFixed(2)}`,
    signal: lastPDI > lastMDI ? '多头主导' : '空头主导'
  };
}

// ==================== 主计算函数 ====================
function calculateAllIndicators(data) {
  return {
    ma: calcMA(data),         // ① 均线系统 - 趋势之王
    macd: calcMACD(data),     // ② MACD - 趋势确认
    boll: calcBOLL(data),     // ③ 布林带 - 趋势+支撑压力
    dmi: calcDMI(data),       // ④ DMI/ADX - 趋势强度
    rsi: calcRSI(data),       // ⑤ RSI - 相对强弱 (阈值55)
    kdj: calcKDJ(data),       // ⑥ KDJ - 短线买卖点 (J>20)
    vol: calcVOL(data),       // ⑦ 成交量 - 量价配合 (量比1.2)
    cci: calcCCI(data),       // ⑧ CCI - 商品通道指标
    psy: calcPSY(data),       // ⑨ PSY - 心理线
    obv: calcOBV(data),       // ⑩ OBV - 能量潮
    trend: calcTrendAnalysis(data)
  };
}

// ==================== 趋势分析（短期/中期/长期） ====================
function calcTrendAnalysis(data) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  const len = closes.length;

  if (len < 5) return null;

  // Helper: calculate slope of a line (linear regression)
  function slope(arr, periods) {
    const slice = arr.slice(-periods);
    const n = slice.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += slice[i];
      sumXY += i * slice[i];
      sumX2 += i * i;
    }
    const slopeVal = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slopeVal;
  }

  // Short-term signals (近5日)
  const ma5Arr = SMA(closes, 5);
  const ma10Arr = SMA(closes, 10);
  const ma20Arr = SMA(closes, 20);
  const ma60Arr = len >= 60 ? SMA(closes, 60) : [];

  const lastMA5 = ma5Arr[ma5Arr.length - 1];
  const lastMA10 = ma10Arr.length > 0 ? ma10Arr[ma10Arr.length - 1] : closes[closes.length - 1];
  const lastMA20 = ma20Arr.length > 0 ? ma20Arr[ma20Arr.length - 1] : closes[closes.length - 1];
  const lastMA60 = ma60Arr.length > 0 ? ma60Arr[ma60Arr.length - 1] : null;
  const lastClose = closes[len - 1];

  // 短期趋势 (近5-10天)
  const shortMA5_slope = slope(ma5Arr.slice(-10), 5);
  const shortPriceSlope = slope(closes.slice(-10), 5);
  const shortVolSlope = slope(volumes.slice(-10), 5);
  const shortHigh = Math.max(...closes.slice(-5));
  const shortLow = Math.min(...closes.slice(-5));
  const shortRange = shortHigh > shortLow ? ((lastClose - shortLow) / (shortHigh - shortLow)) : 0.5;

  // RSI(6) for short term
  let shortRSI = 50;
  if (len >= 7) {
    let gains = 0, losses = 0;
    for (let i = len - 6; i < len; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    const rs = losses === 0 ? 999 : (gains / 6) / (losses / 6);
    shortRSI = 100 - 100 / (1 + rs);
  }

  // 中期趋势 (近20-60天)
  const midPriceSlope = slope(closes.slice(-30), 20);
  const midVolSlope = slope(volumes.slice(-30), 20);
  const midAboveMA20 = lastClose > lastMA20;

  // 长期趋势 (60天以上)
  const longPriceSlope = lastMA60 ? slope(closes, 30) : null;
  const longAboveMA60 = lastMA60 ? lastClose > lastMA60 : null;
  const maMultiLineBullish = lastMA5 > lastMA10 && lastMA10 > lastMA20 && (lastMA60 ? lastMA20 > lastMA60 : false);

  // ===== 评分 =====
  // Short-term score (0-100)
  let shortScore = 50;
  if (shortMA5_slope > 0) shortScore += 15;
  else shortScore -= 15;
  if (shortPriceSlope > 0) shortScore += 10;
  else shortScore -= 10;
  if (shortRSI > 50) shortScore += 10;
  else shortScore -= 10;
  if (shortVolSlope > 0) shortScore += 8;
  else shortScore -= 8;
  if (shortRange > 0.6) shortScore += 7; // near high
  else if (shortRange < 0.3) shortScore -= 7;

  // Medium-term score (0-100)
  let midScore = 50;
  if (midPriceSlope > 0) midScore += 15;
  else midScore -= 15;
  if (midAboveMA20) midScore += 15;
  else midScore -= 15;
  if (midVolSlope > 0) midScore += 10;
  else midScore -= 10;
  if (shortRSI > 50) midScore += 10;
  else midScore -= 10;

  // Long-term score (0-100)
  let longScore = 50;
  if (longPriceSlope !== null) {
    if (longPriceSlope > 0) longScore += 15;
    else longScore -= 15;
  }
  if (longAboveMA60 === true) longScore += 15;
  else if (longAboveMA60 === false) longScore -= 15;
  if (maMultiLineBullish) longScore += 15;
  else longScore -= 10;
  if (lastMA60 && lastMA20 > lastMA60) longScore += 5;
  else if (lastMA60) longScore -= 5;

  // Clamp scores
  shortScore = Math.max(0, Math.min(100, shortScore));
  midScore = Math.max(0, Math.min(100, midScore));
  longScore = Math.max(0, Math.min(100, longScore));

  function getLevel(score) {
    if (score >= 70) return { label: '强势', icon: '🟢', cls: 'up' };
    if (score >= 55) return { label: '偏强', icon: '🟡', cls: 'neutral' };
    if (score >= 45) return { label: '震荡', icon: '⚪', cls: 'neutral' };
    if (score >= 30) return { label: '偏弱', icon: '🟠', cls: 'down' };
    return { label: '弱势', icon: '🔴', cls: 'down' };
  }

  return {
    short: {
      score: shortScore,
      ...getLevel(shortScore),
      detail: `RSI6:${shortRSI.toFixed(1)} MA5方向:${shortMA5_slope > 0 ? '↑' : '↓'} 量能:${shortVolSlope > 0 ? '↑' : '↓'}`
    },
    mid: {
      score: midScore,
      ...getLevel(midScore),
      detail: `价在MA20${midAboveMA20 ? '上↑' : '下↓'} 趋势:${midPriceSlope > 0 ? '↑' : '↓'} 量能:${midVolSlope > 0 ? '↑' : '↓'}`
    },
    long: {
      score: longScore,
      ...getLevel(longScore),
      detail: lastMA60 ?
        `MA60趋势:${longPriceSlope > 0 ? '↑' : '↓'} 排列:${maMultiLineBullish ? '多头' : '空头'} ` :
        '数据不足(需60日)'
    },
    maData: {
      ma5: lastMA5?.toFixed(2),
      ma10: lastMA10?.toFixed(2),
      ma20: lastMA20?.toFixed(2),
      ma60: lastMA60?.toFixed(2)
    }
  };
}

// ==================== 加权综合信号判断 ====================
// 不同指标权重不同: 趋势>量能>摆动指标
function makeDecision(indicators) {
  // Weights based on historical predictive power
  const weights = {
    ma: 3.0,    // 均线系统: 最重要
    macd: 2.0,  // MACD: 趋势确认
    vol: 2.0,   // 成交量: 量价配合
    dmi: 2.0,   // DMI/ADX: 趋势强度
    boll: 1.5,  // 布林带: 趋势+波动
    rsi: 1.0,   // RSI: 相对强弱
    kdj: 1.0,   // KDJ: 短线
    cci: 1.0,   // CCI: 超买超卖
    psy: 1.0,   // PSY: 心理线
    obv: 1.0    // OBV: 量能趋势
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let bullWeight = 0, bearWeight = 0;

  for (const [key, w] of Object.entries(weights)) {
    const ind = indicators[key];
    if (!ind) continue;
    if (ind.bullish === true) bullWeight += w;
    else if (ind.bullish === false) bearWeight += w;
  }

  const bullRatio = bullWeight / totalWeight * 100;
  const bearRatio = bearWeight / totalWeight * 100;

  // Trend override: if price is below MA60, reduce bullish weight
  // (MA indicators already account for this, so this is implicit)

  let decision, label, action, reason;

  if (bullRatio >= 70) {
    decision = 'STRONG_BUY';
    label = '🔥 偏多信号强烈';
    action = '偏多';
    reason = `加权${bullRatio.toFixed(0)}%偏多，核心趋势指标一致看多`;
  } else if (bullRatio >= 55) {
    decision = 'BUY';
    label = '📈 偏多信号';
    action = '偏多';
    reason = `加权${bullRatio.toFixed(0)}%偏多，趋势指标占优`;
  } else if (bullRatio >= 45) {
    decision = 'CAUTION_BUY';
    label = '⬆️ 指标偏多';
    action = '关注';
    reason = `加权${bullRatio.toFixed(0)}%偏多，轻微博弈优势`;
  } else if (bearRatio >= 70) {
    decision = 'STRONG_SELL';
    label = '🚨 偏空信号强烈';
    action = '偏空';
    reason = `加权${bearRatio.toFixed(0)}%偏空，核心趋势指标一致看空`;
  } else if (bearRatio >= 55) {
    decision = 'SELL';
    label = '📉 偏空信号';
    action = '偏空';
    reason = `加权${bearRatio.toFixed(0)}%偏空，趋势指标占优`;
  } else if (bearRatio >= 45) {
    decision = 'CAUTION_SELL';
    label = '⬇️ 指标偏空';
    action = '关注';
    reason = `加权${bearRatio.toFixed(0)}%偏空，轻微博弈优势`;
  } else {
    decision = 'WAIT';
    label = '⏳ 观望';
    action = '观望';
    reason = `多空均衡(偏多${bullRatio.toFixed(0)}%/偏空${bearRatio.toFixed(0)}%)`;
  }

  return {
    decision,
    label,
    action,
    buyCount: bullWeight,
    sellCount: bearWeight,
    totalCount: totalWeight,
    buyRatio: bullRatio / 100,
    reason,
    details: Object.entries(indicators).filter(([k]) => weights[k]).map(([k, v]) => ({ name: k, weight: weights[k], ...v }))
  };
}

// Export for browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateAllIndicators, makeDecision };
}
