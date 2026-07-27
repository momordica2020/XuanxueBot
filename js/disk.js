/* ============================================================
 * disk.js — 阶段7 八环生克圆盘 SVG 可视化（扇形格子·传统五色·格局凸显版）
 * 8同心环（外→内）：年干 年支 月干 月支 日干 日支 时干 时支
 * - 天干环：10等分（甲乙丙丁戊己庚辛壬癸）
 * - 地支环：12等分（子丑寅卯辰巳午未申酉戌亥）
 * - 中国传统五色：金白金 木青 水黑 火红 土黄；阳亮阴暗
 * - 日主（日干）位于正上方，各环同步旋转
 * - 同柱干支两环几乎无间隔，柱之间留间隙
 * - 三合/三会等格局：对应五行整个扇区填淡色凸显
 * - 地支藏干在该柱天干环对应位置半透明显示
 * - 纯SVG + JS，无外部依赖
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.BAZI_DISK = factory(root.BAZI_DATA);
})(typeof self !== 'undefined' ? self : this, function (D) {

  var PILLAR_NAME = ['年', '月', '日', '时'];

  /* ---------- 关系色（生克弧线用） ---------- */
  var REL_COLOR = { shengMe: '#2196f3', meSheng: '#4caf50', keMe: '#f44336', meKe: '#ffc107', same: '#9c27b0' };
  var REL_NAME = { shengMe: '生我', meSheng: '我生', keMe: '克我', meKe: '我克', same: '比和' };

  /* ---------- 刑冲合害线型 ---------- */
  var RC_STYLE = {
    '六合': { color: '#4caf50', dash: 'none', w: 2 },
    '三合局': { color: '#4caf50', dash: 'none', w: 2.5 },
    '三会局': { color: '#2e7d32', dash: 'none', w: 3 },
    '半合': { color: '#81c784', dash: '4 3', w: 1.5 },
    '天干合': { color: '#4caf50', dash: 'none', w: 2 },
    '六冲': { color: '#f44336', dash: '7 4', w: 2 },
    '天干冲': { color: '#f44336', dash: '7 4', w: 2 },
    '三刑': { color: '#ff9800', dash: '2 3', w: 2 },
    '相刑': { color: '#ff9800', dash: '2 3', w: 2 },
    '自刑': { color: '#ff9800', dash: '2 3', w: 1.5 },
    '六害': { color: '#9c27b0', dash: '1.5 3', w: 1.5 }
  };

  /* ---------- 神煞徽章 ---------- */
  var SHA_BADGE = {
    '天乙贵人': { icon: '👑', priority: 2, color: '#ffd700', halo: true },
    '禄神': { icon: '💰', priority: 2, color: '#ffd700', halo: true },
    '羊刃': { icon: '⚔️', priority: 1, color: '#ff3b3b', halo: true, pulse: true },
    '文昌': { icon: '📝', priority: 3, color: '#64b5f6', halo: false },
    '驿马': { icon: '🐎', priority: 3, color: '#ba68c8', halo: false },
    '桃花': { icon: '🌸', priority: 3, color: '#f06292', halo: false },
    '华盖': { icon: '⛩️', priority: 3, color: '#90a4ae', halo: false },
    '金舆': { icon: '🚗', priority: 3, color: '#ffd700', halo: false }
  };

  /* ---------- 中国传统五行色（阳亮阴暗） ---------- */
  // 金：白  木：青  水：黑  火：赤  土：黄
  // 阳干阳支 = 正色/亮色；阴干阴支 = 暗色/灰调
  var WX_YANG = ['#00acc1', '#e53935', '#fdd835', '#ffffff', '#212121'];   // 木青蓝 火红 土亮黄 金白 水黑
  var WX_YIN  = ['#00838f', '#b71c1c', '#f9a825', '#eceff1', '#424242']; // 木暗青 火暗红 土暗黄 金银白 水深灰
  var WX_LIGHT = ['rgba(0,172,193,0.15)', 'rgba(229,57,53,0.15)', 'rgba(253,216,53,0.2)', 'rgba(255,255,255,0.25)', 'rgba(33,33,33,0.12)'];

  var BGCOLOR = '#f5e6c8';
  var BGCOLOR2 = '#e8d4a8';
  var TICK_COLOR = 'rgba(120,80,20,0.2)';
  var TEXT_COLOR = '#3e2723';
  var TEXT_DIM = '#6d4c41';

  /* ---------- 环几何参数（扇区面积相等：外薄内厚） ----------
   * 8环（外→内）：0年干 1年支 2月干 3月支 4日干 5日支 6时干 7时支
   * 扇区面积 = (θ/360)×π×(R²-r²)，面积相等则 segs×(R²-r²) 为常数
   * 同柱干支间隙小，柱之间间隙大
   */
  var R_OUTER = 330;       // 最外圈半径
  var R_INNER = 68;        // 最内圈半径
  var GAP_INNER = 2;       // 同柱干支间隙（几乎无间隔）
  var GAP_PILLAR = 14;     // 柱之间间隙

  function calcRingGeo() {
    // 先用二分法求 k，使 8 环 + 间隙 刚好填满 R_OUTER 到 R_INNER
    var lo = 500, hi = 5000, bestK = 2000;
    for (var iter = 0; iter < 40; iter++) {
      var mid = (lo + hi) / 2;
      var r = R_OUTER;
      for (var i = 0; i < 8; i++) {
        var segs = (i % 2 === 0) ? 10 : 12;
        var rInSq = r * r - mid * segs;
        if (rInSq <= 0) { r = 0; break; }
        r = Math.sqrt(rInSq);
        // 加间隙（最后一环不加）
        if (i < 7) {
          // 奇数次间隙（环后）：0后同柱间隙小，1后柱间隙大，2后同柱，3后柱，4后同柱，5后柱，6后同柱
          var isPillarGap = (i % 2 === 1); // 地支环后是柱间隙
          r -= isPillarGap ? GAP_PILLAR : GAP_INNER;
        }
      }
      if (r > R_INNER) { lo = mid; } else { hi = mid; }
    }
    bestK = (lo + hi) / 2;

    // 用 bestK 计算实际尺寸
    var geo = [];
    var rr = R_OUTER;
    for (var ii = 0; ii < 8; ii++) {
      var s = (ii % 2 === 0) ? 10 : 12;
      var rrIn = Math.sqrt(rr * rr - bestK * s);
      geo.push({ rOut: rr, rIn: rrIn });
      if (ii < 7) {
        var isPg = (ii % 2 === 1);
        rr = rrIn - (isPg ? GAP_PILLAR : GAP_INNER);
      }
    }
    return geo;
  }
  var RING_GEO = calcRingGeo();
  var CENTER_R = R_INNER - 6;
  var VIEW = 360;

  /* ---------- 工具 ---------- */
  function fmt(n) { return Math.round(n * 10) / 10; }
  function toRad(deg) { return deg * Math.PI / 180; }
  function polar(r, deg) { return { x: Math.cos(toRad(deg)) * r, y: Math.sin(toRad(deg)) * r }; }

  /** 环形扇段路径 */
  function arcSeg(rIn, rOut, a1, a2) {
    var largeArc = Math.abs(a2 - a1) > 180 ? 1 : 0;
    var sweep = a2 > a1 ? 1 : 0;
    var p1 = polar(rOut, a1), p2 = polar(rOut, a2);
    var p3 = polar(rIn, a2), p4 = polar(rIn, a1);
    return [
      'M', fmt(p1.x), fmt(p1.y),
      'A', rOut, rOut, 0, largeArc, sweep, fmt(p2.x), fmt(p2.y),
      'L', fmt(p3.x), fmt(p3.y),
      'A', rIn, rIn, 0, largeArc, 1 - sweep, fmt(p4.x), fmt(p4.y),
      'Z'
    ].join(' ');
  }

  /* ---------- 元素定位 ---------- */
  function ringInfo(i) {
    var pi = Math.floor(i / 2);
    var isGan = i % 2 === 0;
    var segs = isGan ? 10 : 12;
    return { pi: pi, isGan: isGan, segs: segs, segDeg: 360 / segs, rIn: RING_GEO[i].rIn, rOut: RING_GEO[i].rOut };
  }

  // 字符索引 → 中心角（未旋转时，索引0 在 -90°即顶部）
  function baseAngle(charIdx, segDeg) {
    return -90 + charIdx * segDeg;
  }

  // 获取元素（环i，字符charIdx）的中心点（考虑旋转）
  function elemPos(i, charIdx, rotate) {
    var info = ringInfo(i);
    var angle = baseAngle(charIdx, info.segDeg) + rotate;
    return polar((info.rIn + info.rOut) / 2, angle);
  }

  // 获取元素角度（考虑旋转）
  function elemAngle(i, charIdx, rotate) {
    var info = ringInfo(i);
    return baseAngle(charIdx, info.segDeg) + rotate;
  }

  /* ---------- 计算旋转角：使日干位于正上方 ---------- */
  function calcRotate(dayGanIdx) {
    // 日干环（index 4，天干环。日干 charIdx = dayGanIdx
    // 我们希望日干的中心在 -90°（正上方）
    // 未旋转时日干角度 = -90 + dayGanIdx * 36°
    // 旋转后 = -90 + dayGanIdx * 36° + rotate = -90°
    // → rotate = -dayGanIdx * 36°
    return -dayGanIdx * 36;
  }

  /* ---------- 检测哪些五行有三合/三会成局 ---------- */
  function getStrongWuxing(A) {
    var strong = {};
    A.relations.forEach(function (r) {
      if (r.type === '三合局' || r.type === '三会局') {
        strong[r.heWX] = true;
      }
    });
    // 太旺以上也加亮
    for (var w = 0; w < 5; w++) {
      if (A.scores[w] >= 200) strong[w] = true;
    }
    return strong;
  }

  /* ---------- 渲染主函数 ---------- */
  function renderSVG(A, opts) {
    opts = opts || {};
    var selected = (opts.selected === undefined) ? null : opts.selected;
    var showRC = opts.showRC !== false;
    var P = A.pillars, dayGan = A.dayGan;
    var rotate = calcRotate(dayGan);

    // 构造8个元素信息
    var els = [];
    for (var i = 0; i < 8; i++) {
      var info = ringInfo(i);
      var ch, wx, yy, shen, charIdx;
      if (info.isGan) {
        charIdx = P[info.pi].g;
        ch = D.GAN[charIdx];
        wx = D.GAN_WX[charIdx];
        yy = D.GAN_YY[charIdx];
        shen = info.pi === 2 ? '日主' : A.shiShenOf(charIdx).name;
      } else {
        charIdx = P[info.pi].z;
        ch = D.ZHI[charIdx];
        wx = D.ZHI_WX[charIdx];
        yy = D.ZHI_YY[charIdx];
        shen = A.shiShenOf(D.CANG_GAN[charIdx][0][0]).name;
      }
      var angle = elemAngle(i, charIdx, rotate);
      els.push({ i: i, pi: info.pi, isGan: info.isGan, charIdx: charIdx, ch: ch, wx: wx, yy: yy, shen: shen, angle: angle });
    }

    var strongWX = getStrongWuxing(A);

    var s = [];
    s.push('<svg viewBox="-' + VIEW + ' -' + VIEW + ' ' + (VIEW * 2) + ' ' + (VIEW * 2) +
      '" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;font-family:\'Microsoft YaHei\',serif">');
    s.push('<defs>');
    // 背景径向渐变
    s.push('<radialGradient id="bgGrad" cx="50%" cy="50%" r="55%">');
    s.push('<stop offset="0%" stop-color="' + BGCOLOR2 + '"/>');
    s.push('<stop offset="100%" stop-color="' + BGCOLOR + '"/>');
    s.push('</radialGradient>');
    // 羊刃脉动
    s.push('<style>');
    s.push('@keyframes pulse-glow { 0%, 100% { opacity: 0.85; } 50% { opacity: 0.3; } }');
    s.push('.pulse-halo { animation: pulse-glow 1.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }');
    s.push('.seg { cursor: pointer; transition: opacity 0.25s, filter 0.25s; }');
    s.push('.seg:hover { filter: brightness(1.2); }');
    s.push('</style>');
    s.push('</defs>');

    // 背景
    s.push('<rect x="-' + VIEW + '" y="-' + VIEW + '" width="' + (VIEW * 2) + '" height="' + (VIEW * 2) + '" fill="url(#bgGrad)" rx="12"/>');

    /* ---- 环刻度（所有格子淡线） ---- */
    s.push('<g class="ticks" stroke="' + TICK_COLOR + '" stroke-width="0.7" fill="none">');
    for (var i = 0; i < 8; i++) {
      var infoI = ringInfo(i);
      for (var k = 0; k < infoI.segs; k++) {
        var a = baseAngle(k, infoI.segDeg) - infoI.segDeg / 2 + rotate;
        var pOut = polar(infoI.rOut, a);
        var pIn = polar(infoI.rIn, a);
        s.push('<line x1="' + fmt(pOut.x) + '" y1="' + fmt(pOut.y) + '" x2="' + fmt(pIn.x) + '" y2="' + fmt(pIn.y) + '"/>');
      }
      s.push('<circle cx="0" cy="0" r="' + infoI.rOut + '"/>');
      s.push('<circle cx="0" cy="0" r="' + infoI.rIn + '"/>');
    }
    s.push('</g>');

    /* ---- 格局凸显：成局五行的整个扇区填淡色 ---- */
    s.push('<g class="strong-wx">');
    for (var w = 0; w < 5; w++) {
      if (!strongWX[w]) continue;
      // 在每个环上，找出属于该五行的字符索引
      for (var i = 0; i < 8; i++) {
        var inf = ringInfo(i);
        var chars = [];
        if (inf.isGan) {
          // 天干：该五行的两个天干
          chars.push(w * 2);     // 阳干
          chars.push(w * 2 + 1); // 阴干
        } else {
          // 地支：找所有属该五行的
          for (var z = 0; z < 12; z++) {
            if (D.ZHI_WX[z] === w) chars.push(z);
          }
        }
        chars.forEach(function (cIdx) {
          var a = baseAngle(cIdx, inf.segDeg) + rotate;
          var a1 = a - inf.segDeg / 2;
          var a2 = a + inf.segDeg / 2;
          s.push('<path d="' + arcSeg(inf.rIn, inf.rOut, a1, a2) + '" fill="' + WX_LIGHT[w] + '"/>');
        });
      }
    }
    s.push('</g>');

    /* ---- 刑冲合害层 ---- */
    if (showRC) {
      s.push('<g class="rel-layer">');
      A.relations.forEach(function (r) {
        var st = RC_STYLE[r.type]; if (!st) return;
        var ea = r.level === 'gan' ? r.a * 2 : r.a * 2 + 1;
        var eb = r.level === 'gan' ? r.b * 2 : r.b * 2 + 1;
        var pa = elemPos(ea, els[ea].charIdx, rotate);
        var pb = elemPos(eb, els[eb].charIdx, rotate);
        var dash = st.dash === 'none' ? '' : ' stroke-dasharray="' + st.dash + '"';
        s.push('<line x1="' + fmt(pa.x) + '" y1="' + fmt(pa.y) +
          '" x2="' + fmt(pb.x) + '" y2="' + fmt(pb.y) +
          '" stroke="' + st.color + '" stroke-width="' + st.w + '"' + dash + ' opacity="0.75" stroke-linecap="round"/>');
      });
      s.push('</g>');
    }

    /* ---- 藏干标记：地支藏干在该柱天干环对应位置半透明显示 ---- */
    s.push('<g class="cang-gan" opacity="0.45">');
    for (var pi = 0; pi < 4; pi++) {
      var zhiIdx = P[pi].z;
      var ganRingIdx = pi * 2; // 同柱天干环
      var inf = ringInfo(ganRingIdx);
      D.CANG_GAN[zhiIdx].forEach(function (cg) {
        var ganIdx = cg[0];
        var a = baseAngle(ganIdx, inf.segDeg) + rotate;
        var a1 = a - inf.segDeg / 2 + 3;
        var a2 = a + inf.segDeg / 2 - 3;
        // 半透明条带
        var wxg = D.GAN_WX[ganIdx];
        var col = D.GAN_YY[ganIdx] ? WX_YANG[wxg] : WX_YIN[wxg];
        s.push('<path d="' + arcSeg(inf.rIn + 3, inf.rOut - 3, a1, a2) +
          '" fill="' + col + '" opacity="0.5"/>');
      });
    }
    s.push('</g>');

    /* ---- 命中格子填实色 ---- */
    s.push('<g class="segments">');
    els.forEach(function (e) {
      var info = ringInfo(e.i);
      var a1 = e.angle - info.segDeg / 2;
      var a2 = e.angle + info.segDeg / 2;
      var color = e.yy ? WX_YANG[e.wx] : WX_YIN[e.wx];
      var dim = (selected !== null && selected !== e.i) ? 0.35 : 1;
      var selStroke = (selected === e.i)
        ? ' stroke="#5d4037" stroke-width="2.5"'
        : ' stroke="' + BGCOLOR + '" stroke-width="1.2"';
      s.push('<path class="seg" data-el="' + e.i + '" d="' + arcSeg(info.rIn, info.rOut, a1, a2) +
        '" fill="' + color + '" opacity="' + dim + '"' + selStroke + '/>');
    });
    s.push('</g>');

    /* ---- 阴阳标记：阳的内侧加亮边 ---- */
    s.push('<g class="yy-mark">');
    els.forEach(function (e) {
      if (!e.yy) return;
      var info = ringInfo(e.i);
      var dotR = 3.5;
      var pos = polar(info.rIn + dotR + 2, e.angle);
      s.push('<circle cx="' + fmt(pos.x) + '" cy="' + fmt(pos.y) + '" r="' + dotR +
        '" fill="#ffd700" stroke="#b8860b" stroke-width="0.6"/>');
    });
    s.push('</g>');

    /* ---- 干支字 ---- */
    s.push('<g class="labels">');
    els.forEach(function (e) {
      var info = ringInfo(e.i);
      var dim = (selected !== null && selected !== e.i) ? 0.5 : 1;
      var pos = polar((info.rIn + info.rOut) / 2, e.angle);
      var fontSize = info.isGan ? 20 : 18;
      // 文字颜色：字在土黄底色圆上，统一用深色
      var textFill = TEXT_COLOR;
      s.push('<g class="lbl" data-el="' + e.i + '" opacity="' + dim + '" style="cursor:pointer">');
      s.push('<circle cx="' + fmt(pos.x) + '" cy="' + fmt(pos.y) + '" r="17" fill="' + BGCOLOR + '" stroke="' + TEXT_DIM + '" stroke-width="1"/>');
      s.push('<text x="' + fmt(pos.x) + '" y="' + fmt(pos.y + 7) + '" font-size="' + fontSize +
        '" text-anchor="middle" font-weight="bold" fill="' + textFill + '">' + e.ch + '</text>');
      s.push('</g>');
    });
    s.push('</g>');

    /* ---- 神煞徽章 ---- */
    s.push('<g class="shensha">');
    var shaList = A.shensha.slice().sort(function (a, b) {
      var pa = (SHA_BADGE[a.name] || {}).priority || 9;
      var pb = (SHA_BADGE[b.name] || {}).priority || 9;
      return pa - pb;
    });
    shaList.forEach(function (sh, idx) {
      var badge = SHA_BADGE[sh.name]; if (!badge) return;
      var ei = sh.pillar * 2 + 1;
      var info = ringInfo(ei);
      var charIdx = P[sh.pillar].z;
      var ang = elemAngle(ei, charIdx, rotate);
      // 徽章位置：扇形外侧
      var badgeR = info.rOut + 18 + idx * 2;
      var bx = polar(badgeR, ang).x;
      var by = polar(badgeR, ang).y;
      var r = badge.priority <= 1 ? 13 : 11;
      if (badge.halo) {
        s.push('<circle cx="' + fmt(bx) + '" cy="' + fmt(by) + '" r="' + (r + 5) +
          '" fill="' + badge.color + '" opacity="0.3"' + (badge.pulse ? ' class="pulse-halo"' : '') + '/>');
      }
      s.push('<g>');
      s.push('<circle cx="' + fmt(bx) + '" cy="' + fmt(by) + '" r="' + r + '" fill="' + badge.color +
        '" stroke="#5d4037" stroke-width="2"/>');
      s.push('<text x="' + fmt(bx) + '" y="' + fmt(by + r * 0.35) + '" font-size="' + (r * 1.1) +
        '" text-anchor="middle">' + badge.icon + '</text>');
      s.push('<title>' + sh.name + '（' + PILLAR_NAME[sh.pillar] + '柱' + D.ZHI[sh.zhi] + '）</title>');
      s.push('</g>');
    });
    s.push('</g>');

    /* ---- 中心圆：日主 ---- */
    s.push('<g class="center">');
    s.push('<circle cx="0" cy="0" r="' + (CENTER_R + 10) + '" fill="' + WX_YANG[A.cls.dayWX] + '" opacity="0.2"/>');
    s.push('<circle cx="0" cy="0" r="' + CENTER_R + '" fill="' + WX_YANG[A.cls.dayWX] + '" opacity="0.95"/>');
    s.push('<circle cx="0" cy="0" r="' + CENTER_R + '" fill="none" stroke="#5d4037" stroke-width="3"/>');
    var dayTextFill = (A.cls.dayWX === 3 || A.cls.dayWX === 2) ? '#3e2723' : '#fff';
    s.push('<text x="0" y="-18" font-size="34" fill="' + dayTextFill + '" text-anchor="middle" font-weight="bold">' + D.GAN[dayGan] + '</text>');
    s.push('<text x="0" y="6" font-size="15" fill="' + dayTextFill + '" text-anchor="middle" opacity="0.95">' + D.WUXING[A.cls.dayWX] + '·' + A.cls.stage + '</text>');
    s.push('<text x="0" y="26" font-size="12" fill="' + dayTextFill + '" text-anchor="middle" opacity="0.85">' + A.scores[A.cls.dayWX].toFixed(1) + '分</text>');
    if (A.cls.special) s.push('<text x="0" y="46" font-size="11" fill="#5d4037" text-anchor="middle" font-weight="bold">' + A.cls.special + '</text>');
    s.push('</g>');

    /* ---- 关系高亮弧（选中后，最上层，不被中心圆遮挡） ---- */
    if (selected !== null) {
      var se2 = els[selected];
      var sg2 = elemPos(selected, se2.charIdx, rotate);
      s.push('<g class="rel-arrows">');
      els.forEach(function (e) {
        if (e.i === selected) return;
        var rel;
        if (e.wx === se2.wx) rel = 'same';
        else if (D.WX_SHENG[e.wx] === se2.wx) rel = 'shengMe';
        else if (D.WX_SHENG[se2.wx] === e.wx) rel = 'meSheng';
        else if (D.WX_KE[e.wx] === se2.wx) rel = 'keMe';
        else rel = 'meKe';
        var tg2 = elemPos(e.i, e.charIdx, rotate);
        var c2 = REL_COLOR[rel];
        var marker2 = 'arrow' + rel;
        s.push('<defs><marker id="' + marker2 + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
          '<path d="M0 0L10 5L0 10z" fill="' + c2 + '"/></marker></defs>');
        s.push('<line x1="' + fmt(sg2.x) + '" y1="' + fmt(sg2.y) +
          '" x2="' + fmt(tg2.x) + '" y2="' + fmt(tg2.y) +
          '" stroke="' + c2 + '" stroke-width="4" opacity="1" marker-end="url(#' + marker2 + ')" stroke-linecap="round"/>');
        // 关系标签（在线中点偏外）
        var midX = (sg2.x + tg2.x) / 2, midY = (sg2.y + tg2.y) / 2;
        var len = Math.sqrt(midX * midX + midY * midY);
        var push = 18;
        var lx2 = midX + (midX / len) * push;
        var ly2 = midY + (midY / len) * push;
        s.push('<g transform="translate(' + fmt(lx2) + ',' + fmt(ly2) + ')">');
        s.push('<rect x="-20" y="-12" width="40" height="24" rx="6" fill="' + BGCOLOR + '" stroke="' + c2 + '" stroke-width="1.5" opacity="0.95"/>');
        s.push('<text x="0" y="6" font-size="13" fill="' + c2 + '" text-anchor="middle" font-weight="bold">' + REL_NAME[rel] + '</text>');
        s.push('</g>');
      });
      s.push('</g>');
    }

    /* ---- 图例 ---- */
    s.push('<g transform="translate(-' + (VIEW - 10) + ',' + (VIEW - 44) + ')" font-size="11" fill="' + TEXT_DIM + '">');
    s.push('<text x="0" y="0" fill="' + TEXT_COLOR + '" font-weight="bold">关系：</text>');
    var items = [['生我', REL_COLOR.shengMe], ['我生', REL_COLOR.meSheng], ['克我', REL_COLOR.keMe], ['我克', REL_COLOR.meKe], ['比和', REL_COLOR.same]];
    items.forEach(function (it, i) {
      s.push('<rect x="' + (42 + i * 44) + '" y="-9" width="12" height="12" fill="' + it[1] + '" rx="2"/>');
      s.push('<text x="' + (57 + i * 44) + '" y="1">' + it[0] + '</text>');
    });
    s.push('<text x="0" y="22">五行：</text>');
    var wxItems = [['木青', 0], ['火红', 1], ['土黄', 2], ['金白', 3], ['水黑', 4]];
    wxItems.forEach(function (it, i) {
      s.push('<rect x="' + (42 + i * 50) + '" y="13" width="12" height="12" fill="' + WX_YANG[it[1]] + '" stroke="' + TEXT_DIM + '" stroke-width="0.5" rx="2"/>');
      s.push('<text x="' + (57 + i * 50) + '" y="23">' + it[0] + '</text>');
    });
    s.push('<text x="0" y="44">· 金色点=阳干/阳支 · 点击扇形查看生克 · 淡色扇区=成格局五行</text>');
    s.push('</g>');

    s.push('</svg>');
    return s.join('');
  }

  /* ---------- 浏览器挂载 ---------- */
  function mount(container, A) {
    var state = { selected: null, showRC: true };
    function draw() {
      container.innerHTML = renderSVG(A, state);
      var nodes = container.querySelectorAll('[data-el]');
      nodes.forEach(function (n) {
        n.addEventListener('click', function () {
          var i = parseInt(n.getAttribute('data-el'), 10);
          state.selected = (state.selected === i) ? null : i;
          draw();
        });
      });
    }
    draw();
    return { redraw: draw, state: state };
  }

  return { renderSVG: renderSVG, mount: mount, REL_COLOR: REL_COLOR, RC_STYLE: RC_STYLE, SHA_BADGE: SHA_BADGE, RING_GEO: RING_GEO, WX_YANG: WX_YANG, WX_YIN: WX_YIN };
});
