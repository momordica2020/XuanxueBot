/* ============================================================
 * disk.js — 阶段7 八环生克圆盘 SVG 可视化
 * 8同心环（外→内）：年干 年支 月干 月支 日干 日支 时干 时支
 * 五行底色 + 阴阳区分 + 十神标注 + 关系高亮 + 刑冲合害层 + 神煞徽章
 * 纯 SVG + JS，无外部依赖
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.BAZI_DISK = factory(root.BAZI_DATA);
})(typeof self !== 'undefined' ? self : this, function (D) {

  var PILLAR_NAME = ['年', '月', '日', '时'];
  // 关系着色：生我蓝 / 我生绿 / 克我红 / 我克金 / 比和紫
  var REL_COLOR = { shengMe: '#2f6fbf', meSheng: '#3aa655', keMe: '#d43a2f', meKe: '#c9a227', same: '#8e44ad' };
  var REL_NAME = { shengMe: '生我', meSheng: '我生', keMe: '克我', meKe: '我克', same: '比和' };
  // 刑冲合害线型
  var RC_STYLE = {
    '六合': { color: '#3aa655', dash: 'none', w: 2 },
    '三合局': { color: '#3aa655', dash: 'none', w: 2.5 },
    '三会局': { color: '#2e8b57', dash: 'none', w: 3 },
    '半合': { color: '#7cc98f', dash: '4 3', w: 1.5 },
    '天干合': { color: '#3aa655', dash: 'none', w: 2 },
    '六冲': { color: '#d43a2f', dash: '7 4', w: 2 },
    '天干冲': { color: '#d43a2f', dash: '7 4', w: 2 },
    '三刑': { color: '#e08a1e', dash: '2 3', w: 2 },
    '相刑': { color: '#e08a1e', dash: '2 3', w: 2 },
    '自刑': { color: '#e08a1e', dash: '2 3', w: 1.5 },
    '六害': { color: '#8e44ad', dash: '1.5 3', w: 1.5 }
  };
  var SHA_BADGE = { '天乙贵人': '贵', '禄神': '禄', '羊刃': '刃', '文昌': '文', '驿马': '马', '桃花': '花', '华盖': '盖', '金舆': '舆' };

  /* 元素i（0..7）→ 柱idx、干/支、角度、半径 */
  function geom(i) {
    var r = 322 - i * 32;            // 环半径
    var ang = -90 + i * 45;          // 标注角度（顶部起，顺时针）
    var rad = ang * Math.PI / 180;
    return { r: r, ang: ang, x: Math.cos(rad) * r, y: Math.sin(rad) * r };
  }
  function fmt(n) { return Math.round(n * 10) / 10; }

  /**
   * 渲染 SVG 字符串
   * A: engine.analyze 结果；opts: { selected: 0..7|null, showRC: bool }
   */
  function renderSVG(A, opts) {
    opts = opts || {};
    var selected = (opts.selected === undefined) ? null : opts.selected;
    var showRC = opts.showRC !== false;
    var P = A.pillars, dayGan = A.dayGan;

    // 8元素：外→内 年干 年支 月干 月支 日干 日支 时干 时支
    var els = [];
    for (var i = 0; i < 8; i++) {
      var pi = Math.floor(i / 2), isGan = i % 2 === 0;
      var ch, wx, yy, shen;
      if (isGan) {
        ch = D.GAN[P[pi].g]; wx = D.GAN_WX[P[pi].g]; yy = D.GAN_YY[P[pi].g];
        shen = pi === 2 ? '日主' : A.shiShenOf(P[pi].g).name;
      } else {
        ch = D.ZHI[P[pi].z]; wx = D.ZHI_WX[P[pi].z]; yy = D.ZHI_YY[P[pi].z];
        shen = A.shiShenOf(D.CANG_GAN[P[pi].z][0][0]).name;
      }
      els.push({ i: i, pi: pi, isGan: isGan, ch: ch, wx: wx, yy: yy, shen: shen });
    }

    var s = [];
    s.push('<svg viewBox="-380 -380 760 760" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;font-family:\'Microsoft YaHei\',serif">');
    s.push('<rect x="-380" y="-380" width="760" height="760" fill="#fdfaf4" rx="12"/>');

    /* ---- 刑冲合害层（先画，垫在环下） ---- */
    if (showRC) {
      A.relations.forEach(function (r) {
        var st = RC_STYLE[r.type]; if (!st) return;
        // 涉及元素索引：天干→2*pi，地支→2*pi+1
        var ea = r.level === 'gan' ? r.a * 2 : r.a * 2 + 1;
        var eb = r.level === 'gan' ? r.b * 2 : r.b * 2 + 1;
        var ga = geom(ea), gb = geom(eb);
        var dash = st.dash === 'none' ? '' : ' stroke-dasharray="' + st.dash + '"';
        // 弧线：控制点拉向圆心内侧
        var mx = (ga.x + gb.x) / 2 * 0.35, my = (ga.y + gb.y) / 2 * 0.35;
        s.push('<path class="rc" d="M' + fmt(ga.x) + ' ' + fmt(ga.y) + ' Q' + fmt(mx) + ' ' + fmt(my) + ' ' + fmt(gb.x) + ' ' + fmt(gb.y) +
          '" fill="none" stroke="' + st.color + '" stroke-width="' + st.w + '"' + dash + ' opacity="0.65"/>');
      });
    }

    /* ---- 8环 ---- */
    els.forEach(function (e) {
      var g = geom(e.i);
      var base = e.yy ? D.WX_COLOR[e.wx] : D.WX_COLOR_LIGHT[e.wx];
      var sw = e.yy ? 26 : 20;
      var dim = (selected !== null && selected !== e.i) ? 0.35 : 1;
      s.push('<circle class="ring" data-el="' + e.i + '" cx="0" cy="0" r="' + g.r + '" fill="none" stroke="' + base +
        '" stroke-width="' + sw + '" opacity="' + dim + '" style="cursor:pointer"/>');
      // 阴阳圈线：阳=外缘加粗线，阴=内缘细线
      if (e.yy) s.push('<circle cx="0" cy="0" r="' + (g.r + sw / 2 + 2) + '" fill="none" stroke="' + base + '" stroke-width="2.5" opacity="' + (0.9 * dim) + '"/>');
      else s.push('<circle cx="0" cy="0" r="' + (g.r - sw / 2 - 2) + '" fill="none" stroke="' + base + '" stroke-width="1" opacity="' + (0.8 * dim) + '"/>');
    });

    /* ---- 关系高亮弧（点击后） ---- */
    if (selected !== null) {
      var se = els[selected], sg = geom(selected);
      els.forEach(function (e) {
        if (e.i === selected) return;
        var rel;
        if (e.wx === se.wx) rel = 'same';
        else if (D.WX_SHENG[e.wx] === se.wx) rel = 'shengMe';   // 他生我
        else if (D.WX_SHENG[se.wx] === e.wx) rel = 'meSheng';   // 我生他
        else if (D.WX_KE[e.wx] === se.wx) rel = 'keMe';         // 他克我
        else rel = 'meKe';                                      // 我克他
        var tg = geom(e.i);
        var c = REL_COLOR[rel];
        var mx = (sg.x + tg.x) / 2 * 0.25, my = (sg.y + tg.y) / 2 * 0.25;
        var marker = 'arrow' + rel;
        s.push('<defs><marker id="' + marker + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
          '<path d="M0 0L10 5L0 10z" fill="' + c + '"/></marker></defs>');
        s.push('<path d="M' + fmt(sg.x) + ' ' + fmt(sg.y) + ' Q' + fmt(mx) + ' ' + fmt(my) + ' ' + fmt(tg.x) + ' ' + fmt(tg.y) +
          '" fill="none" stroke="' + c + '" stroke-width="3.5" opacity="0.9" marker-end="url(#' + marker + ')"/>');
        // 关系标签
        var lx = (sg.x + tg.x) / 2 * 0.62, ly = (sg.y + tg.y) / 2 * 0.62;
        s.push('<text x="' + fmt(lx) + '" y="' + fmt(ly) + '" font-size="13" fill="' + c + '" text-anchor="middle" font-weight="bold">' + REL_NAME[rel] + '</text>');
      });
    }

    /* ---- 环上干支字 + 十神 ---- */
    els.forEach(function (e) {
      var g = geom(e.i);
      var dim = (selected !== null && selected !== e.i) ? 0.45 : 1;
      var selStroke = (selected === e.i) ? ' stroke="#222" stroke-width="1.5"' : '';
      s.push('<g class="lbl" data-el="' + e.i + '" opacity="' + dim + '" style="cursor:pointer">');
      s.push('<circle cx="' + fmt(g.x) + '" cy="' + fmt(g.y) + '" r="17" fill="#fff"' + selStroke + '/>');
      s.push('<text x="' + fmt(g.x) + '" y="' + fmt(g.y + 7) + '" font-size="20" text-anchor="middle" font-weight="bold" fill="#222">' + e.ch + '</text>');
      // 外侧小字：柱名+十神
      var rad2 = (g.ang) * Math.PI / 180, rr = g.r + 24;
      var tx = Math.cos(rad2) * rr, ty = Math.sin(rad2) * rr;
      s.push('<text x="' + fmt(tx) + '" y="' + fmt(ty) + '" font-size="10.5" text-anchor="middle" fill="#555">' +
        PILLAR_NAME[e.pi] + (e.isGan ? '干' : '支') + '·' + e.shen + '</text>');
      s.push('</g>');
    });

    /* ---- 神煞徽章 ---- */
    A.shensha.forEach(function (sh) {
      var ei = sh.pillar * 2 + 1; // 落在支环
      var g = geom(ei);
      var rad = (g.ang + 16) * Math.PI / 180;
      var bx = Math.cos(rad) * (g.r + 20), by = Math.sin(rad) * (g.r + 20);
      var badge = SHA_BADGE[sh.name] || '煞';
      s.push('<g><circle cx="' + fmt(bx) + '" cy="' + fmt(by) + '" r="10" fill="#b03a2e" stroke="#fff" stroke-width="1.5"/>' +
        '<text x="' + fmt(bx) + '" y="' + fmt(by + 4) + '" font-size="11" fill="#fff" text-anchor="middle" font-weight="bold">' + badge + '</text>' +
        '<title>' + sh.name + '（' + PILLAR_NAME[sh.pillar] + '柱' + D.ZHI[sh.zhi] + '）</title></g>');
    });

    /* ---- 中心圆：日主 ---- */
    s.push('<circle cx="0" cy="0" r="72" fill="' + D.WX_COLOR[A.cls.dayWX] + '" opacity="0.92"/>');
    s.push('<circle cx="0" cy="0" r="72" fill="none" stroke="#fff" stroke-width="3"/>');
    s.push('<text x="0" y="-14" font-size="34" fill="#fff" text-anchor="middle" font-weight="bold">' + D.GAN[dayGan] + '</text>');
    s.push('<text x="0" y="14" font-size="15" fill="#fff" text-anchor="middle">' + D.WUXING[A.cls.dayWX] + '·' + A.cls.stage + '</text>');
    s.push('<text x="0" y="36" font-size="12" fill="#fff" text-anchor="middle" opacity="0.9">' + A.scores[A.cls.dayWX].toFixed(1) + '分</text>');
    if (A.cls.special) s.push('<text x="0" y="56" font-size="11" fill="#ffe08a" text-anchor="middle">' + A.cls.special + '</text>');

    /* ---- 图例 ---- */
    var lg = [];
    lg.push('<g transform="translate(-365,330)" font-size="11">');
    lg.push('<text x="0" y="0" fill="#333" font-weight="bold">关系色：</text>');
    var items = [['生我', REL_COLOR.shengMe], ['我生', REL_COLOR.meSheng], ['克我', REL_COLOR.keMe], ['我克', REL_COLOR.meKe], ['比和', REL_COLOR.same]];
    items.forEach(function (it, i) {
      lg.push('<rect x="' + (52 + i * 56) + '" y="-9" width="12" height="12" fill="' + it[1] + '" rx="2"/>');
      lg.push('<text x="' + (67 + i * 56) + '" y="1" fill="#333">' + it[0] + '</text>');
    });
    lg.push('</g>');
    s.push(lg.join(''));

    s.push('</svg>');
    return s.join('');
  }

  /* 浏览器挂载：渲染 + 点击交互 */
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

  return { renderSVG: renderSVG, mount: mount, REL_COLOR: REL_COLOR, RC_STYLE: RC_STYLE, SHA_BADGE: SHA_BADGE };
});
