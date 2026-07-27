/* ============================================================
 * calendar.js — 阶段1 历法换算
 * 公历(UTC+8) → 四柱干支。节气用 Meeus 低精度太阳视黄经公式。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.BAZI_CALENDAR = factory(root.BAZI_DATA);
})(typeof self !== 'undefined' ? self : this, function (D) {

  var TZ = 8; // 固定东八区

  /* ---------- 儒略日 ---------- */
  // 公历(北京时) → JD（UT）
  function toJD(y, m, d, hh, mm) {
    hh = hh || 0; mm = mm || 0;
    var dayFrac = (hh - TZ + mm / 60) / 24;
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    var JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + dayFrac + B - 1524.5;
    return JD;
  }
  // JD（UT）→ 公历(北京时) {y,m,d,hh,mm}
  function fromJD(jd) {
    jd += 0.5 + TZ / 24;
    var Z = Math.floor(jd), F = jd - Z;
    var A;
    if (Z >= 2299161) { var a = Math.floor((Z - 1867216.25) / 36524.25); A = Z + 1 + a - Math.floor(a / 4); }
    else A = Z;
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25), Dd = Math.floor(365.25 * C), E = Math.floor((B - Dd) / 30.6001);
    var day = B - Dd - Math.floor(30.6001 * E) + F;
    var month = E < 14 ? E - 1 : E - 13;
    var year = month > 2 ? C - 4716 : C - 4715;
    var dInt = Math.floor(day), frac = day - dInt;
    var hh = Math.floor(frac * 24), mm = Math.round((frac * 24 - hh) * 60);
    if (mm >= 60) { mm -= 60; hh += 1; }
    if (hh >= 24) { hh -= 24; dInt += 1; } // 边界
    return { y: year, m: month, d: dInt, hh: hh, mm: mm };
  }

  /* ---------- 太阳视黄经 ---------- */
  function sunLon(jd) {
    var T = (jd - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * Math.PI / 180;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
          + 0.000289 * Math.sin(3 * M);
    var omega = (125.04 - 1934.136 * T) * Math.PI / 180;
    var lam = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
    lam = lam % 360; if (lam < 0) lam += 360;
    return lam;
  }

  /* ---------- 求节气时刻：λ(jd)=target 二分求解 ---------- */
  // nearJD：预估初值（该节气公历中点）
  function findTermJD(targetLon, nearJD) {
    var lo = nearJD - 3, hi = nearJD + 3;
    // 处理跨0°（春分 target=0）
    function diff(jd) { var d = sunLon(jd) - targetLon; while (d > 180) d -= 360; while (d < -180) d += 360; return d; }
    for (var i = 0; i < 50; i++) {
      var mid = (lo + hi) / 2;
      if (diff(mid) < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  // 节气预估日中点（粗略，用于二分初值）：每月节气约在上/下半月
  function approxJD(year, targetLon) {
    // 以2000年春分(3/20)为基准，每节气约15.2184天，回归年365.2422天
    var baseJD = toJD(2000, 3, 20, 0, 0);
    var idx = Math.round(targetLon / 15) % 24; // 春分=0
    // 小寒/大寒/立春/雨水/惊蛰(285~345°)在公历1~3月，须以上一年春分起算
    var k = year - 2000 - (targetLon >= 285 ? 1 : 0);
    return baseJD + k * 365.2422 + idx * 15.2184;
  }

  var termCache = {};
  // 求某年某节气（黄经）时刻 JD；目标年份按"节气所在公历年"：立春/雨水/惊蛰属该公历年
  function termJD(year, targetLon) {
    var key = year + '_' + targetLon;
    if (termCache[key]) return termCache[key];
    var approx = approxJD(year, targetLon);
    var jd = findTermJD(targetLon, approx);
    termCache[key] = jd;
    return jd;
  }

  // 取得覆盖出生时刻所需全部节气表：返回 [{lon, jd}] 按时间升序
  function termTableAround(jd) {
    var y = fromJD(jd).y;
    var lons = [315, 330, 345, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300];
    var list = [];
    // 上年末两个节气（大雪/冬至/小寒可能落在上年12月或当年1月）
    // 小寒(285)大寒(300)在公历1月，属于"上一农历年"但公历同年；此处按公历年求即可
    for (var yi = y - 1; yi <= y + 1; yi++) {
      for (var i = 0; i < lons.length; i++) list.push({ lon: lons[i], jd: termJD(yi, lons[i]) });
    }
    list.sort(function (a, b) { return a.jd - b.jd; });
    return list;
  }

  /* ---------- 四柱推算 ---------- */
  function gz(i) { return D.GAN[i % 10] + D.ZHI[i % 12]; }

  /**
   * 输入公历(北京时) y m d hh mm，返回四柱与节气信息
   * 日界：23:00（晚子时归次日）
   */
  function siZhu(y, m, d, hh, mm) {
    hh = hh || 12; mm = mm || 0;
    var jd = toJD(y, m, d, hh, mm);

    // 年柱：以立春(315°)为界
    var yearGanZhi = function (gy) { var yy = gy - 4; return { g: ((yy % 10) + 10) % 10, z: ((yy % 12) + 12) % 12 }; };
    var lichunThis = termJD(y, 315);
    var gzYear = (jd < lichunThis) ? yearGanZhi(y - 1) : yearGanZhi(y);

    // 月柱：找出生时刻前最近的一个"节"
    var terms = termTableAround(jd);
    var prevJie = null, nextJie = null;
    for (var i = 0; i < terms.length; i++) {
      if (D.JIE_TO_MONTH[terms[i].lon] !== undefined) {
        if (terms[i].jd <= jd) prevJie = terms[i];
        else { nextJie = terms[i]; break; }
      }
    }
    // nextJie 需跳过非"节"项
    if (!nextJie) {
      for (var j = 0; j < terms.length; j++) if (terms[j].jd > jd && D.JIE_TO_MONTH[terms[j].lon] !== undefined) { nextJie = terms[j]; break; }
    }
    var monthZhi = D.JIE_TO_MONTH[prevJie.lon];
    // 五虎遁：寅月干=(年干%5)*2+2，月支距寅的偏移取模12（丑月=+11）
    var monthGan = (((gzYear.g % 5) * 2 + 2 + ((monthZhi - 2 + 12) % 12)) % 10 + 10) % 10;

    // 日柱：23:00 起算次日
    var jdDay = jd + (hh >= 23 ? 1 : 0);
    var JDN = Math.floor(jdDay + 0.5);
    var dayIdx = ((JDN + 49) % 60 + 60) % 60;
    var dayGan = dayIdx % 10, dayZhi = dayIdx % 12;

    // 时柱
    var hourZhi = Math.floor(((hh + 1) % 24) / 2);
    var hourGan = (((dayGan % 5) * 2 + hourZhi) % 10 + 10) % 10;

    // 临界提示：距最近"节"或立春 < 2小时
    var edge = null;
    var chk = prevJie && (jd - prevJie.jd), chk2 = nextJie && (nextJie.jd - jd);
    if (chk !== null && chk < 2 / 24) edge = '出生时距交' + jieName(prevJie.lon) + '仅' + Math.round(chk * 24 * 60) + '分钟，月柱存在临界';
    if (chk2 !== null && chk2 < 2 / 24) edge = '出生时距交' + jieName(nextJie.lon) + '仅' + Math.round(chk2 * 24 * 60) + '分钟，月柱存在临界';
    if (Math.abs(jd - lichunThis) < 2 / 24) edge = '出生时正值立春交节前后，年柱存在临界';

    return {
      year: { g: gzYear.g, z: gzYear.z },
      month: { g: monthGan, z: monthZhi },
      day: { g: dayGan, z: dayZhi },
      hour: { g: hourGan, z: hourZhi },
      jd: jd, prevJie: prevJie, nextJie: nextJie, terms: terms, edge: edge
    };
  }

  function jieName(lon) {
    for (var i = 0; i < D.JIE_QI.length; i++) if (D.JIE_QI[i][1] === lon) return D.JIE_QI[i][0];
    return '';
  }

  return { toJD: toJD, fromJD: fromJD, sunLon: sunLon, termJD: termJD, termTableAround: termTableAround, siZhu: siZhu, gz: gz, jieName: jieName, TZ: TZ };
});
