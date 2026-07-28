/* ============================================================
 * engine.js — 阶段2~5 核心命理引擎
 * 十神/神煞/胎元/大运/刑冲合害/打分法旺衰/命格定性/取用神
 * 量化规则见《实施文档细则.md》
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.BAZI_ENGINE = factory(root.BAZI_DATA);
})(typeof self !== 'undefined' ? self : this, function (D) {

  /* ============ 工具 ============ */
  function gzStr(g, z) { return D.GAN[g] + D.ZHI[z]; }
  function gzIndex(g, z) { for (var i = 0; i < 60; i++) if (i % 10 === g && i % 12 === z) return i; return -1; }

  /* ============ 十神 ============ */
  // 以日干为太极，target 为其他天干
  function shiShen(dayGan, targetGan) {
    var dw = D.GAN_WX[dayGan], tw = D.GAN_WX[targetGan];
    var rel; // 0同我 1我生 2我克 3克我 4生我
    if (tw === dw) rel = 0;
    else if (D.WX_SHENG[dw] === tw) rel = 1;
    else if (D.WX_KE[dw] === tw) rel = 2;
    else if (D.WX_KE[tw] === dw) rel = 3;
    else rel = 4;
    var sameYY = D.GAN_YY[dayGan] === D.GAN_YY[targetGan] ? 0 : 1;
    return { rel: rel, name: D.SHEN_NAME[rel][sameYY] };
  }

  /* ============ 神煞 ============ */
  function shenSha(pillars) {
    var dayGan = pillars[2].g, out = [];
    var branches = pillars.map(function (p) { return p.z; });
    function addByGan(key) {
      var rule = D.SHEN_SHA[key], hit = rule.map[dayGan];
      var hits = Array.isArray(hit) ? hit : [hit];
      branches.forEach(function (z, i) {
        if (hits.indexOf(z) >= 0) out.push({ name: rule.name, pillar: i, zhi: z });
      });
    }
    function addByZhi(key) {
      var rule = D.SHEN_SHA[key];
      // 以年支、日支所在三合局查
      var bases = [branches[0], branches[2]];
      var targets = [];
      bases.forEach(function (b) {
        for (var i = 0; i < rule.group.length; i++) {
          var grp = rule.group[i];
          if (grp.slice(0, 3).indexOf(b) >= 0) { targets.push(grp[3]); break; }
        }
      });
      branches.forEach(function (z, i) {
        if (targets.indexOf(z) >= 0) out.push({ name: rule.name, pillar: i, zhi: z });
      });
    }
    ['tianyi', 'lu', 'yangren', 'wenchang', 'jinyu'].forEach(addByGan);
    ['yima', 'taohua', 'huagai'].forEach(addByZhi);
    return out;
  }

  /* ============ 胎元 ============ */
  function taiYuan(monthPillar) {
    return { g: (monthPillar.g + 1) % 10, z: (monthPillar.z + 1) % 12 };
  }

  /* ============ 大运 ============ */
  /**
   * chart: siZhu 返回；gender: 'male'|'female'
   * 阳男阴女顺，阴男阳女逆；起运数=至节前/后天数÷3
   */
  function daYun(chart, gender) {
    var yearYY = D.GAN_YY[chart.year.g]; // 1阳 0阴
    var forward = (yearYY === 1 && gender === 'male') || (yearYY === 0 && gender === 'female');
    var days = forward ? (chart.nextJie.jd - chart.jd) : (chart.jd - chart.prevJie.jd);
    var years = days / 3;
    var startYear = chart.jd + years * 365.2422;
    var mIdx = gzIndex(chart.month.g, chart.month.z);
    var list = [];
    for (var k = 1; k <= 8; k++) {
      var idx = ((forward ? mIdx + k : mIdx - k) % 60 + 60) % 60;
      var ageStart = years + (k - 1) * 10;
      list.push({
        g: idx % 10, z: idx % 12,
        ageStart: ageStart, ageEnd: ageStart + 10,
        jdStart: chart.jd + ageStart * 365.2422,
        jdEnd: chart.jd + (ageStart + 10) * 365.2422
      });
    }
    return { forward: forward, days: days, years: years, startJD: startYear, list: list };
  }

  /* ============ 刑冲合害检测 ============ */
  function detectRelations(pillars) {
    var rels = [];
    var gs = pillars.map(function (p) { return p.g; });
    var zs = pillars.map(function (p) { return p.z; });
    function key(a, b) { return a < b ? a + ',' + b : b + ',' + a; }
    // 天干五合 / 冲（仅紧贴）
    for (var i = 0; i < 3; i++) {
      var k1 = key(gs[i], gs[i + 1]);
      if (D.GAN_HE[k1] !== undefined) rels.push({ type: '天干合', a: i, b: i + 1, level: 'gan', detail: gzStr(gs[i], zs[i]) + '与' + gzStr(gs[i + 1], zs[i + 1]) + ' 合化' + D.WUXING[D.GAN_HE[k1]] + '（绊/化候定）', heWX: D.GAN_HE[k1] });
    }
    for (i = 0; i < 3; i++) for (var j = i + 1; j <= 3; j++) {
      D.GAN_CHONG.forEach(function (pr) {
        if ((gs[i] === pr[0] && gs[j] === pr[1]) || (gs[i] === pr[1] && gs[j] === pr[0]))
          rels.push({ type: '天干冲', a: i, b: j, level: 'gan', detail: D.GAN[gs[i]] + D.GAN[gs[j]] + '相冲' });
      });
    }
    // 地支六合/六冲/六害（仅紧贴计合害，冲可隔位仍标但弱化——此处统一检测相邻与全部对）
    for (i = 0; i < 3; i++) {
      var k2 = key(zs[i], zs[i + 1]);
      if (D.ZHI_LIUHE[k2] !== undefined) rels.push({ type: '六合', a: i, b: i + 1, level: 'zhi', detail: D.ZHI[zs[i]] + D.ZHI[zs[i + 1]] + '合化' + D.WUXING[D.ZHI_LIUHE[k2]] });
    }
    for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) {
      D.ZHI_CHONG.forEach(function (pr) {
        if ((zs[i] === pr[0] && zs[j] === pr[1]) || (zs[i] === pr[1] && zs[j] === pr[0]))
          rels.push({ type: '六冲', a: i, b: j, level: 'zhi', detail: D.ZHI[zs[i]] + D.ZHI[zs[j]] + '相冲' });
      });
      D.HAI.forEach(function (pr) {
        if ((zs[i] === pr[0] && zs[j] === pr[1]) || (zs[i] === pr[1] && zs[j] === pr[0]))
          rels.push({ type: '六害', a: i, b: j, level: 'zhi', detail: D.ZHI[zs[i]] + D.ZHI[zs[j]] + '相害' });
      });
    }
    // 三刑
    D.XING_GROUP.forEach(function (grp) {
      var pos = grp.map(function (z) { return zs.indexOf(z); });
      var hit = pos.filter(function (p) { return p >= 0; });
      if (hit.length >= 2) rels.push({ type: '三刑', a: Math.min.apply(null, hit), b: Math.max.apply(null, hit), level: 'zhi', detail: grp.map(function (z) { return D.ZHI[z]; }).join('') + '相刑（' + (hit.length === 3 ? '三字全' : '二字') + '）' });
    });
    D.XING_PAIR.forEach(function (pr) {
      var p1 = zs.indexOf(pr[0]), p2 = zs.indexOf(pr[1]);
      if (p1 >= 0 && p2 >= 0) rels.push({ type: '相刑', a: Math.min(p1, p2), b: Math.max(p1, p2), level: 'zhi', detail: D.ZHI[pr[0]] + D.ZHI[pr[1]] + '相刑' });
    });
    zs.forEach(function (z, i) {
      if (D.ZI_XING.indexOf(z) >= 0 && zs.indexOf(z, i + 1) > i)
        rels.push({ type: '自刑', a: i, b: zs.indexOf(z, i + 1), level: 'zhi', detail: D.ZHI[z] + D.ZHI[z] + '自刑' });
    });
    // 三合 / 半合 / 三会
    D.SANHE.forEach(function (sh) {
      var pos = sh[0].map(function (z) { return zs.indexOf(z); });
      var hit = pos.filter(function (p) { return p >= 0; });
      if (hit.length === 3) rels.push({ type: '三合局', a: Math.min.apply(null, hit), b: Math.max.apply(null, hit), level: 'zhi', detail: sh[0].map(function (z) { return D.ZHI[z]; }).join('') + '三合' + D.WUXING[sh[1]] + '局', heWX: sh[1], zhong: sh[2], branches: sh[0] });
      else if (hit.length === 2 && pos[1] >= 0) rels.push({ type: '半合', a: Math.min.apply(null, hit), b: Math.max.apply(null, hit), level: 'zhi', detail: '半合' + D.WUXING[sh[1]] + '局', heWX: sh[1] });
    });
    D.SANHUI.forEach(function (sh) {
      var pos = sh[0].map(function (z) { return zs.indexOf(z); });
      if (pos.every(function (p) { return p >= 0; }))
        rels.push({ type: '三会局', a: Math.min.apply(null, pos), b: Math.max.apply(null, pos), level: 'zhi', detail: sh[0].map(function (z) { return D.ZHI[z]; }).join('') + '三会' + D.WUXING[sh[1]] + '方', heWX: sh[1], branches: sh[0] });
    });
    return rels;
  }

  /* ============ 阶段4 打分法 ============ */
  // 单柱通用损益（合化改计后用）
  function genericPillarAdj(ganWX, zhiBenQiWX) {
    if (ganWX === zhiBenQiWX) return [0.5, 0.5];           // 比和
    if (D.WX_KE[ganWX] === zhiBenQiWX) return [-0.3, -0.5]; // 盖头
    if (D.WX_KE[zhiBenQiWX] === ganWX) return [-0.5, -0.3]; // 截脚
    if (D.WX_SHENG[ganWX] === zhiBenQiWX) return [-0.3, 0.3]; // 干生支
    return [0.2, -0.2];                                      // 支生干
  }
  // 依赖藏干根的特例柱（根被合化走时退化为通用损益）
  var SPECIAL_ROOT_PILLARS = ['甲辰', '辛巳', '壬辰', '壬戌', '癸丑', '丁未', '丙戌', '乙未'];

  function pillarAdjOf(p, transformed) {
    var name = gzStr(p.g, p.z);
    var ganWX = D.GAN_WX[p.g];
    var benQiWX = transformed !== undefined ? transformed : D.ZHI_WX[p.z];
    if (transformed !== undefined) {
      if (SPECIAL_ROOT_PILLARS.indexOf(name) >= 0 || !D.PILLAR_ADJ[name])
        return genericPillarAdj(ganWX, benQiWX);
      // 非特例柱若原损益关系已因化神改变，也按通用重算
      var orig = D.PILLAR_ADJ[name];
      var origBen = D.ZHI_WX[p.z];
      if (origBen !== benQiWX) return genericPillarAdj(ganWX, benQiWX);
      return orig;
    }
    return D.PILLAR_ADJ[name] || genericPillarAdj(ganWX, benQiWX);
  }

  /**
   * 打分主函数（严格按第五章例一~四逐步验证的约定）
   * pillars: [{g,z}×4]；relations: detectRelations 结果
   * 约定：
   *  (a) 日主自身 = 36×(1+单柱损益)，不做异柱调整（例一②、例二③、例三③、例四③）
   *  (b) 其余天干 = 36×(1+单柱损益+异柱相生"减力")，被生方不加力（例四①月干甲取54反证），
   *      年干隔柱 ×0.5（例一①、例二②）
   *  (c) 天干坐被合化走之支，根气荡然，单柱损益取0（第六章例"根荡然无存"）
   *  (d) 通根 = 藏干分 × 距离系数（本坐1.0/邻0.8/遥0.4，相连或通气→1.0）
   *      日支本气得月令本气生扶 +0.3（例二④）
   */
  function scoreChart(pillars, relations) {
    var i, j;
    var gs = pillars.map(function (p) { return p.g; });
    var zs = pillars.map(function (p) { return p.z; });

    /* ---- (0) 合化判定：三合/三会全 且（中神临月令 或 化神透干）→ 化神改计 ---- */
    var transformed = [undefined, undefined, undefined, undefined]; // 各支化神五行
    var huaInfo = [];
    function tryTransform(sh, kindName) {
      var pos = sh[0].map(function (z) { return zs.indexOf(z); });
      if (!pos.every(function (p) { return p >= 0; })) return;
      var heWX = sh[1];
      var zhongOnMonth = (kindName === '三合') ? (zs[1] === sh[2]) : (sh[0].indexOf(zs[1]) >= 0);
      var touGan = gs.some(function (g) { return D.GAN_WX[g] === heWX; });
      if (zhongOnMonth || touGan) {
        pos.forEach(function (p) { transformed[p] = heWX; });
        huaInfo.push(kindName + '化' + D.WUXING[heWX] + '成功');
      }
    }
    D.SANHUI.forEach(function (sh) { tryTransform(sh, '三会'); });
    D.SANHE.forEach(function (sh) { tryTransform(sh, '三合'); });

    /* ---- (1) 天干合绊（紧贴五合）：各-0.2（合而不化，减力） ---- */
    var banHe = [false, false, false, false];
    relations.forEach(function (r) {
      if (r.type === '天干合' && Math.abs(r.a - r.b) === 1) { banHe[r.a] = true; banHe[r.b] = true; }
    });

    /* ---- (2) 各天干得分 ---- */
    // 异柱相生"减力"表：genDrain[i] = 天干i生他干被泄的系数和（日主不扣）
    var genDrain = [0, 0, 0, 0];
    for (i = 0; i < 3; i++) {
      if (banHe[i] || banHe[i + 1]) continue;
      var wa = D.GAN_WX[gs[i]], wb = D.GAN_WX[gs[i + 1]];
      var src = -1;
      if (D.WX_SHENG[wa] === wb) src = i;          // i生i+1 → i被泄
      else if (D.WX_SHENG[wb] === wa) src = i + 1; // i+1生i → i+1被泄
      if (src >= 0 && src !== 2) {
        var sameYY = D.GAN_YY[gs[i]] === D.GAN_YY[gs[i + 1]];
        genDrain[src] += sameYY ? 0.2 : 0.3;
      }
    }
    var ganScore = [0, 0, 0, 0];
    for (i = 0; i < 4; i++) {
      var adj;
      if (transformed[i] !== undefined) adj = 0;            // (c) 坐化神支，根失虚浮
      else adj = pillarAdjOf(pillars[i], undefined)[0];     // 单柱干损益
      if (i !== 2) {
        adj -= genDrain[i];                                  // (b) 生他干减力
        if (banHe[i]) adj -= 0.2;                            // 合绊减力
      }
      ganScore[i] = D.GAN_BASE * (1 + adj);
    }

    /* ---- (3) 通根系数与月令加成 ---- */
    function branchHas(i, w) {
      if (transformed[i] !== undefined) return transformed[i] === w;
      return D.CANG_GAN[zs[i]].some(function (cg) { return D.GAN_WX[cg[0]] === w; });
    }
    function branchCangOf(i, w) {
      if (transformed[i] !== undefined) return transformed[i] === w ? 100 : 0; // 化神支全部100分归化神
      var s = 0;
      D.CANG_GAN[zs[i]].forEach(function (cg) { if (D.GAN_WX[cg[0]] === w) s += cg[1]; });
      return s;
    }
    var monthBenQi = transformed[1] !== undefined ? transformed[1] : D.ZHI_WX[zs[1]];
    // 日支本气得月令生扶 +0.3
    function monthBoost(i, w) {
      if (i !== 2) return 1;
      var benQi = transformed[2] !== undefined ? transformed[2] : D.ZHI_WX[zs[2]];
      if (w !== benQi) return 1;
      if (D.WX_SHENG[monthBenQi] === benQi || monthBenQi === benQi) return 1.3;
      return 1;
    }
    function rootFactor(i, w) {
      if (i === 2) return 1.0; // 本坐支
      if (i === 0) return 0.4; // 遥支（年支）
      // 邻支（月/时）：相连或通气 → 1.0，否则 0.8
      if (branchHas(2, w) && branchHas(i, w)) return 1.0; // 与日支通根相连
      if (D.GAN_WX[gs[i]] === w) return 1.0;               // 本柱天干通气（紧贴日干）
      return 0.8;
    }

    /* ---- (4) 汇总五行分 ---- */
    var scores = [0, 0, 0, 0, 0]; // 木火土金水
    var detail = [];
    for (var w = 0; w < 5; w++) {
      var ganPart = 0, zhiPart = 0;
      for (i = 0; i < 4; i++) {
        if (D.GAN_WX[gs[i]] === w) {
          var f = (i === 0) ? 0.5 : 1.0; // 年干隔柱 ×0.5
          ganPart += ganScore[i] * f;
        }
      }
      for (j = 0; j < 4; j++) {
        var cangScore = branchCangOf(j, w);
        if (cangScore > 0) zhiPart += cangScore * rootFactor(j, w) * monthBoost(j, w);
      }
      scores[w] = Math.round((ganPart + zhiPart) * 10) / 10;
      detail.push({ wx: w, gan: Math.round(ganPart * 10) / 10, zhi: Math.round(zhiPart * 10) / 10 });
    }
    return { scores: scores, detail: detail, transformed: transformed, huaInfo: huaInfo, banHe: banHe, ganScore: ganScore };
  }

  /* ============ 阶段5 七档定性 + 特殊格局 ============ */
  function stageOf(score) {
    if (score < 25) return '弱极';
    if (score < 45) return '太弱';
    if (score < 109) return '偏弱';
    if (score < 272) return '偏旺';
    if (score < 435) return '太旺';
    return '旺极';
  }
  function nearNeutral(score) { return score >= 89 && score <= 129; }

  var ZHUAN_WANG = ['曲直格', '炎上格', '稼穑格', '从革格', '润下格']; // 木火土金水

  function classify(pillars, scores) {
    var dayWX = D.GAN_WX[pillars[2].g];
    var yinWX = D.WX_SHENG.indexOf(dayWX); // 生我者（印）
    var dayScore = scores[dayWX];
    var stage = stageOf(dayScore);
    var geju = '普通格局', special = null;

    // 印比同旺 → 太旺（例四规则）
    var biScore = dayScore, yinScore = scores[yinWX];
    if (stage === '偏旺' && biScore > 200 && (biScore + yinScore) > 272 && biScore / (biScore + yinScore) > 0.5) {
      stage = '太旺'; special = '印比同旺';
    }
    // 旺极 → 专旺格
    if (stage === '旺极') { geju = ZHUAN_WANG[dayWX] + '（日主一气专旺）'; special = '专旺'; }
    // 弱极 → 从格
    var cong = null;
    if (stage === '弱极') {
      var maxWX = 0;
      for (var w = 1; w < 5; w++) if (scores[w] > scores[maxWX]) maxWX = w;
      var relName = ['比劫', '食伤', '财星', '官杀', '印星'][shiShen(pillars[2].g, maxWX * 2).rel]; // 用阳干查十神类
      cong = relName;
      geju = '从格（从' + relName + '）'; special = '从格';
    }
    return {
      dayWX: dayWX, dayScore: dayScore, stage: stage,
      nearNeutral: nearNeutral(dayScore), geju: geju, special: special, cong: cong,
      stages: scores.map(stageOf)
    };
  }

  /* ============ 阶段5b 取用神决策树 ============ */
  function quYongShen(pillars, scores, cls) {
    var dayWX = cls.dayWX;
    var shengMe = D.WX_SHENG.indexOf(dayWX);  // 印
    var meSheng = D.WX_SHENG[dayWX];          // 食伤
    var meKe = D.WX_KE[dayWX];                // 财
    var keMe = D.WX_KE.indexOf(dayWX);        // 官杀
    var yong = [], ji = [], note = '';
    var st = cls.stage;
    function wxStage(w) { return stageOf(scores[w]); }

    if (st === '偏旺') {
      // 印也旺 → 财为用（克印耗身）；官旺 → 食伤；一般 → 财>食伤>官
      if (scores[shengMe] >= 109) { yong = [meKe, meSheng]; ji = [dayWX, shengMe, keMe]; note = '日主与印星同旺为病，取财星克印耗身为第一用神，食伤次之。'; }
      else if (scores[keMe] >= 109) { yong = [meSheng, meKe]; ji = [dayWX, shengMe, keMe]; note = '日主偏旺而官星亦旺，不可取官（防身官相战），取食伤泄秀，财星次之。'; }
      else { yong = [meKe, meSheng, keMe]; ji = [dayWX, shengMe]; note = '日主偏旺，取克泄耗为用，财为先、食伤次之、官杀再次。'; }
    } else if (st === '偏弱' || (st === '偏旺' && cls.nearNeutral)) {
      if (scores[keMe] >= 109) { yong = [shengMe, dayWX]; ji = [keMe, meKe]; note = '日主偏弱而官杀旺，取印星化官生身为用。'; }
      else if (scores[shengMe] >= 109) { yong = [dayWX]; ji = [shengMe, meKe]; note = '印旺为病，取比劫泄印帮身为用。'; }
      else { yong = [shengMe, dayWX]; ji = [keMe, meKe]; note = '日主偏弱，取生扶为用，印为先、比劫次之。'; }
      if (cls.nearNeutral && st === '偏旺') { yong = [shengMe, dayWX, meKe]; note = '日主接近中和，用神随大运流转而定，需看岁运加减力。'; }
    } else if (st === '太旺') {
      if (cls.special === '印比同旺') { yong = [dayWX]; ji = [shengMe, meKe, keMe]; note = '印比同旺而太旺，印为最大之病，取比劫泄印为用，最忌克（犯怒）。'; }
      else { yong = [meSheng]; ji = [dayWX, shengMe, keMe, meKe]; note = '比劫独旺而太旺，只宜取食伤化泄，忌生扶，最忌官杀犯怒。'; }
    } else if (st === '旺极') {
      yong = [shengMe, dayWX, meSheng]; ji = [keMe, meKe]; note = '日主一气专旺，其气可顺不可逆，取印比食伤为用，最忌财官。';
    } else if (st === '太弱') {
      // 食伤旺→财；财旺→官杀；官杀旺→官杀；印旺→比劫
      if (wxStage(meSheng) === '太旺' || wxStage(meSheng) === '旺极') { yong = [meKe]; note = '日主太弱而食伤强旺，取财星化泄食伤为用（假从）。'; }
      else if (wxStage(meKe) === '太旺' || wxStage(meKe) === '旺极') { yong = [keMe]; note = '日主太弱而财星强旺，取官杀泄财为用（假从）。'; }
      else if (wxStage(keMe) === '太旺' || wxStage(keMe) === '旺极') { yong = [keMe]; note = '日主太弱而官杀强旺，取官杀为用，不取印（防日主不服）。'; }
      else if (wxStage(shengMe) === '太旺' || wxStage(shengMe) === '旺极') { yong = [dayWX]; note = '日主太弱而印星太旺，取比劫泄印为用。'; }
      else { yong = [meKe, keMe]; note = '日主太弱，只宜克泄，帮扶反易招灾（假从格，格局随大运转换）。'; }
      ji = [shengMe, dayWX];
    } else { // 弱极（从格）
      var maxWX = 0;
      for (var w = 1; w < 5; w++) if (scores[w] > scores[maxWX]) maxWX = w;
      yong = [maxWX];
      if (maxWX === shengMe) { ji = [meKe]; note = '日主弱极而印星独旺，从印之势，取印为用，忌财星克印。'; }
      else { ji = [shengMe, dayWX]; note = '日主弱极无根，从其旺势（' + cls.geju + '），取所从之五行为用，忌印比帮身逆局。'; }
    }
    // 调候提示
    var monthZhiWX = D.ZHI_WX[pillars[1].z];
    var tiaohou = '';
    if ([11, 0, 1].indexOf(pillars[1].z) >= 0) tiaohou = '冬月生人，命局偏寒，宜火调候（若与五行平衡冲突，以平衡为先）。';
    if ([5, 6, 7].indexOf(pillars[1].z) >= 0) tiaohou = '夏月生人，命局偏燥，宜水调候（若与五行平衡冲突，以平衡为先）。';
    return { yong: yong, ji: ji, note: note, tiaohou: tiaohou };
  }

  /* ============ 汇总分析 ============ */
  function analyze(chart, gender) {
    var pillars = [chart.year, chart.month, chart.day, chart.hour];
    var dayGan = chart.day.g;
    var rels = detectRelations(pillars);
    var scored = scoreChart(pillars, rels);
    var cls = classify(pillars, scored.scores);
    var ys = quYongShen(pillars, scored.scores, cls);
    var ty = taiYuan(chart.month);
    var dy = daYun(chart, gender);
    var ss = shenSha(pillars);
    return {
      pillars: pillars, dayGan: dayGan, relations: rels,
      scores: scored.scores, scoreDetail: scored.detail, huaInfo: scored.huaInfo,
      transformed: scored.transformed, cls: cls, yongshen: ys,
      taiyuan: ty, dayun: dy, shensha: ss,
      shiShenOf: function (g) { return shiShen(dayGan, g); }
    };
  }

  /* ============ 家境推断 ============ */
  // 年柱=祖上宫，月柱=父母宫；财星=家境，印星=祖荫
  function familyWealth(A) {
    var P = A.pillars, dg = A.dayGan, ys = A.yongshen, sc = A.scores;
    var yearGanShen = shiShen(dg, P[0].g);
    var monthGanShen = shiShen(dg, P[1].g);
    // 财星五行 = 我克
    var caiWX = D.WX_KE[dg]; // 日主所克五行
    var yinWX = (D.WX_SHENG[dg] + 0) % 5; // 生我五行
    // 改：生我 = WX_SHENG的逆，即谁生我
    var shengMeWX = -1;
    for (var w = 0; w < 5; w++) { if (D.WX_SHENG[w] === dg % 5 || D.WX_SHENG[w] === D.GAN_WX[dg]) { shengMeWX = w; break; } }
    // 更简单：日主五行X，生X的是 (X+3)%5 不对。用表反查
    var dw = D.GAN_WX[dg];
    shengMeWX = [4,0,1,2,3][dw]; // 谁生我：水生木→木的印=水(4)；木生火→火的印=木(0)…
    var caiScore = sc[caiWX];
    var yinScore = sc[shengMeWX];
    var yearIsYong = ys.yong.indexOf(D.GAN_WX[P[0].g]) >= 0;
    var monthIsYong = ys.yong.indexOf(D.GAN_WX[P[1].g]) >= 0;
    var caiIsYong = ys.yong.indexOf(caiWX) >= 0;
    var yinIsYong = ys.yong.indexOf(shengMeWX) >= 0;
    // 年月是否被冲克
    var yearChong = false;
    A.relations.forEach(function (r) {
      if (r.type === '六冲' || r.type === '天干冲') {
        if ((r.a === 0 && r.b === 1) || (r.a === 1 && r.b === 0)) yearChong = true;
      }
    });
    // 综合判定
    var level, desc;
    if (caiIsYong && caiScore > 120 && (yearIsYong || monthIsYong)) {
      level = '富裕'; desc = '命局财星旺而为喜用，年月柱得力，祖业殷实，家境优渥，出身富足之门。';
    } else if (caiIsYong && caiScore > 90) {
      level = '小康偏上'; desc = '财星为喜且有一定力量，家境中等偏上，父母勤恳持家，衣食无忧。';
    } else if (yinIsYong && yinScore > 120) {
      level = '书香门第'; desc = '印星旺而为喜用，祖上多读书之人，家境虽未必大富却重教育，有文化底蕴。';
    } else if (yearIsYong && monthIsYong && !yearChong) {
      level = '小康'; desc = '年月柱皆为喜用，父母有能力，家境平稳，虽非大富亦无冻馁之虞。';
    } else if (yearChong) {
      level = '起伏不定'; desc = '年月柱相冲，家境变动较大，或早年搬迁、父母奔波，家道有起落。';
    } else if (ys.ji.indexOf(caiWX) >= 0 && caiScore > 150) {
      level = '财多压身'; desc = '财星过旺为忌，家境或表面富裕但内部压力大，或因财生事，长辈劳碌。';
    } else {
      level = '普通'; desc = '家境平凡，父母为普通人家，需靠自身努力白手起家。';
    }
    return { level: level, desc: desc, caiScore: caiScore, yinScore: yinScore,
             caiIsYong: caiIsYong, yinIsYong: yinIsYong };
  }

  /* ============ 流年编年史 ============ */
  // 从1岁（虚岁）推到maxAge岁，逐年分析
  function liuNian(A, chart, maxAge, gender) {
    var P = A.pillars, dg = A.dayGan, ys = A.yongshen, dy = A.dayun;
    var yearG = chart.year.g, yearZ = chart.year.z;
    var caiWX = D.WX_KE[D.GAN_WX[dg]];         // 财星五行
    var guanWX = D.WX_KE[dg];                   // 官杀五行（克我者→D.WX_KE[tw]===dw → tw = ?）
    // 克我的五行：WX_KE[x]=dw → x
    var keMeWX = -1;
    for (var w2 = 0; w2 < 5; w2++) { if (D.WX_KE[w2] === D.GAN_WX[dg]) { keMeWX = w2; break; } }
    var shiShenWX = D.WX_SHENG[D.GAN_WX[dg]];  // 食伤五行（我生）
    var biJieWX = D.GAN_WX[dg];                 // 比劫五行（同我）
    var yinWX2 = [4,0,1,2,3][D.GAN_WX[dg]];    // 印星五行（生我）
    var isMale = gender === 'male';
    // 子女星：男命官杀，女命食伤
    var childWX = isMale ? keMeWX : shiShenWX;
    // 配偶星：男命财星，女命官杀
    var spouseWX = isMale ? caiWX : keMeWX;
    var years = [];
    for (var age = 1; age <= maxAge; age++) {
      var off = age - 1;
      var lg = (yearG + off) % 10;
      var lz = (yearZ + off) % 12;
      var lw = D.GAN_WX[lg];
      var zw = D.ZHI_WX[lz];
      var shen = shiShen(dg, lg);
      // 喜忌
      var fit = ys.yong.indexOf(lw) >= 0 ? '喜'
              : ys.ji.indexOf(lw) >= 0 ? '忌' : '平';
      var zFit = ys.yong.indexOf(zw) >= 0 ? '喜'
               : ys.ji.indexOf(zw) >= 0 ? '忌' : '平';
      // 所属大运
      var dyStep = null;
      for (var di = 0; di < dy.list.length; di++) {
        if (age >= dy.list[di].ageStart && age < dy.list[di].ageEnd) { dyStep = dy.list[di]; break; }
      }
      // 流年与原局+大运的刑冲合害
      var events = [];
      var allPillars = P.slice();
      if (dyStep) allPillars.push({ g: dyStep.g, z: dyStep.z });
      // 天干合
      for (var pi = 0; pi < allPillars.length; pi++) {
        var pg = allPillars[pi].g;
        var key = [Math.min(lg, pg), Math.max(lg, pg)].join(',');
        if (D.GAN_HE[key] !== undefined) {
          events.push({ type: 'ganHe', desc: '流年天干' + D.GAN[lg] + '与' + D.GAN[pg] + '合' });
        }
      }
      // 天干冲
      for (var pi2 = 0; pi2 < allPillars.length; pi2++) {
        var pg2 = allPillars[pi2].g;
        for (var ci = 0; ci < D.GAN_CHONG.length; ci++) {
          if ((D.GAN_CHONG[ci][0] === lg && D.GAN_CHONG[ci][1] === pg2) ||
              (D.GAN_CHONG[ci][1] === lg && D.GAN_CHONG[ci][0] === pg2)) {
            var posName = pi2 < 4 ? ['年','月','日','时'][pi2] : '运';
            events.push({ type: 'ganChong', desc: '流年天干' + D.GAN[lg] + '冲' + posName + '干' + D.GAN[pg2] });
          }
        }
      }
      // 地支冲
      for (var pi3 = 0; pi3 < allPillars.length; pi3++) {
        var pz = allPillars[pi3].z;
        for (var ci2 = 0; ci2 < D.ZHI_CHONG.length; ci2++) {
          if ((D.ZHI_CHONG[ci2][0] === lz && D.ZHI_CHONG[ci2][1] === pz) ||
              (D.ZHI_CHONG[ci2][1] === lz && D.ZHI_CHONG[ci2][0] === pz)) {
            var posName3 = pi3 < 4 ? ['年','月','日','时'][pi3] : '运';
            events.push({ type: 'zhiChong', desc: '流年地支' + D.ZHI[lz] + '冲' + posName3 + '支' + D.ZHI[pz] });
          }
        }
      }
      // 地支合
      for (var pi4 = 0; pi4 < allPillars.length; pi4++) {
        var pz2 = allPillars[pi4].z;
        var key2 = [Math.min(lz, pz2), Math.max(lz, pz2)].join(',');
        if (D.ZHI_LIUHE[key2] !== undefined) {
          var posName4 = pi4 < 4 ? ['年','月','日','时'][pi4] : '运';
          events.push({ type: 'zhiHe', desc: '流年地支' + D.ZHI[lz] + '合' + posName4 + '支' + D.ZHI[pz2] });
        }
      }
      // 三合/三会检测（流年支加入）
      var zhiArr = [P[0].z, P[1].z, P[2].z, P[3].z, lz];
      if (dyStep) zhiArr.push(dyStep.z);
      for (var si = 0; si < D.SANHE.length; si++) {
        var tri = D.SANHE[si][0], hit = 0;
        for (var sj = 0; sj < 3; sj++) { if (zhiArr.indexOf(tri[sj]) >= 0) hit++; }
        if (hit >= 3) events.push({ type: 'sanhe', desc: '流年合' + D.WUXING[D.SANHE[si][1]] + '局' });
      }
      for (var si2 = 0; si2 < D.SANHUI.length; si2++) {
        var tri2 = D.SANHUI[si2][0], hit2 = 0;
        for (var sj2 = 0; sj2 < 3; sj2++) { if (zhiArr.indexOf(tri2[sj2]) >= 0) hit2++; }
        if (hit2 >= 3) events.push({ type: 'sanhui', desc: '流年会' + D.WUXING[D.SANHUI[si2][1]] + '方' });
      }
      // 刑
      for (var pi5 = 0; pi5 < allPillars.length; pi5++) {
        var pz3 = allPillars[pi5].z;
        // 三刑
        for (var xi = 0; xi < D.XING_GROUP.length; xi++) {
          if (D.XING_GROUP[xi].indexOf(lz) >= 0 && D.XING_GROUP[xi].indexOf(pz3) >= 0 && lz !== pz3) {
            events.push({ type: 'xing', desc: '流年地支' + D.ZHI[lz] + '刑' + D.ZHI[pz3] });
          }
        }
        // 子卯相刑
        if (D.XING_PAIR[0][0] === lz && D.XING_PAIR[0][1] === pz3 ||
            D.XING_PAIR[0][1] === lz && D.XING_PAIR[0][0] === pz3) {
          events.push({ type: 'xing', desc: '流年子卯相刑' });
        }
      }
      // 自刑
      if (D.ZI_XING.indexOf(lz) >= 0) {
        for (var pi6 = 0; pi6 < allPillars.length; pi6++) {
          if (allPillars[pi6].z === lz) {
            events.push({ type: 'xing', desc: '流年自刑' + D.ZHI[lz] });
          }
        }
      }
      // 害
      for (var pi7 = 0; pi7 < allPillars.length; pi7++) {
        var pz4 = allPillars[pi7].z;
        for (var hi = 0; hi < D.HAI.length; hi++) {
          if ((D.HAI[hi][0] === lz && D.HAI[hi][1] === pz4) ||
              (D.HAI[hi][1] === lz && D.HAI[hi][0] === pz4)) {
            events.push({ type: 'hai', desc: '流年' + D.ZHI[lz] + '害' + D.ZHI[pz4] });
          }
        }
      }
      // ===== 事件推断 =====
      var predictions = [];
      var shenName = shen.name;
      var isGanYong = ys.yong.indexOf(lw) >= 0;
      var isGanJi = ys.ji.indexOf(lw) >= 0;
      var isZhiYong = ys.yong.indexOf(zw) >= 0;
      var isZhiJi = ys.ji.indexOf(zw) >= 0;
      var hasChong = events.some(function (e) { return e.type === 'zhiChong' || e.type === 'ganChong'; });
      var hasHe = events.some(function (e) { return e.type === 'zhiHe' || e.type === 'ganHe' || e.type === 'sanhe' || e.type === 'sanhui'; });
      var hasXing = events.some(function (e) { return e.type === 'xing'; });
      var chongDay = false;
      events.forEach(function (e) {
        if (e.desc.indexOf('冲日') >= 0) chongDay = true;
      });

      // 1. 疾病灾祸
      if (shenName === '七杀' && isGanJi) {
        predictions.push({ cat: '灾', desc: '七杀攻身为忌，防疾病伤灾、官非口舌' });
      }
      if (shenName === '伤官' && isGanJi) {
        predictions.push({ cat: '灾', desc: '伤官见官为忌，防官非是非、冲动行事' });
      }
      if (chongDay) {
        predictions.push({ cat: '灾', desc: '流年冲日柱，身体不安或家宅变动' });
      }
      if (hasXing && (isGanJi || isZhiJi)) {
        predictions.push({ cat: '灾', desc: '流年逢刑且为忌，防纠纷刑罚、身体损伤' });
      }
      // 羊刃年
      var isYangRen = false;
      A.shensha.forEach(function (s) {
        if (s.name === '羊刃') isYangRen = true;
      });
      if (lw === D.GAN_WX[dg] && D.GAN_YY[lg] === 1 && hasChong) {
        predictions.push({ cat: '灾', desc: '比肩羊刃逢冲，防血光破财' });
      }
      // 2. 财运
      if ((shenName === '正财' || shenName === '偏财') && isGanYong) {
        predictions.push({ cat: '财', desc: '财星流年为喜用，有进财之机，利求财投资' });
      }
      if ((shenName === '正财' || shenName === '偏财') && isGanJi && hasHe) {
        predictions.push({ cat: '财', desc: '财星合身但为忌，财来而有损，防因财生灾' });
      }
      if (shenName === '比肩' && isGanJi && age > 15) {
        predictions.push({ cat: '财', desc: '比劫夺财为忌，防破财耗损、投资失利' });
      }
      // 3. 婚姻感情
      if (shenName === (isMale ? '正财' : '正官') && (isGanYong || age >= 20 && age <= 35)) {
        predictions.push({ cat: '婚', desc: '配偶星流年显现，' + (isGanYong ? '姻缘将至，利婚嫁' : '有感情际遇') });
      }
      if (shenName === (isMale ? '偏财' : '七杀') && age >= 18 && age <= 35) {
        predictions.push({ cat: '婚', desc: '偏缘星现，有感情波动或非正式姻缘' });
      }
      // 桃花
      var yearZhiGroup = -1;
      for (var tg = 0; tg < D.SHEN_SHA.taohua.group.length; tg++) {
        if (D.SHEN_SHA.taohua.group[tg].indexOf(P[0].z) >= 0) { yearZhiGroup = tg; break; }
      }
      if (yearZhiGroup >= 0 && D.SHEN_SHA.taohua.group[yearZhiGroup].indexOf(lz) >= 0 && lz !== P[0].z) {
        if (age >= 16 && age <= 40) predictions.push({ cat: '婚', desc: '桃花流年，异性缘旺，有感情际遇' });
      }
      // 4. 子女
      if (lw === childWX && (isGanYong || (age >= 22 && age <= 40))) {
        predictions.push({ cat: '子', desc: '子女星流年显现，' + (isGanYong ? '利生育添丁' : '有子女方面际遇') });
      }
      // 5. 学业事业
      if ((shenName === '正印' || shenName === '偏印') && isGanYong) {
        if (age >= 6 && age <= 25) predictions.push({ cat: '学', desc: '印星为喜，利读书考试、学业进步' });
        else predictions.push({ cat: '业', desc: '印星为喜，利置业、学习进修、长辈助力' });
      }
      if ((shenName === '正官' || shenName === '七杀') && isGanYong && age > 20) {
        predictions.push({ cat: '业', desc: '官星为喜，利升职掌权、事业拓展' });
      }
      // 文昌
      if (D.SHEN_SHA.wenchang.map[dg] === lz && age >= 6 && age <= 25) {
        predictions.push({ cat: '学', desc: '文昌星照命，利科考学业' });
      }
      // 6. 贵人喜事
      var tianyi = D.SHEN_SHA.tianyi.map[dg] || [];
      if (tianyi.indexOf(lz) >= 0) {
        predictions.push({ cat: '贵', desc: '天乙贵人照命，逢凶化吉，有贵人相助' });
      }
      if (isGanYong && isZhiYong && !hasChong) {
        predictions.push({ cat: '吉', desc: '干支皆为喜用，流年顺利，万事如意' });
      }
      if (isGanJi && isZhiJi && hasChong) {
        predictions.push({ cat: '凶', desc: '干支皆忌且逢冲，此年多艰，宜守不宜进' });
      }
      // 大运喜忌叠加
      var dyFit = null;
      if (dyStep) {
        var dyw = D.GAN_WX[dyStep.g];
        dyFit = ys.yong.indexOf(dyw) >= 0 ? '喜' : ys.ji.indexOf(dyw) >= 0 ? '忌' : '平';
      }
      years.push({
        age: age, g: lg, z: lz, ganzhi: D.GAN[lg] + D.ZHI[lz],
        shen: shenName, fit: fit, zFit: zFit,
        dyGz: dyStep ? D.GAN[dyStep.g] + D.ZHI[dyStep.z] : null,
        dyFit: dyFit,
        events: events, predictions: predictions
      });
    }
    return years;
  }

  /* ============ 角色卡生成 ============ */
  // 基于命理知识规则，生成完整的虚拟角色设定
  function charaCard(A, chart, gender, birthYear) {
    var P = A.pillars, dg = A.dayGan, dw = D.GAN_WX[dg], ys = A.yongshen, dy = A.dayun;
    var isMale = gender === 'male';
    var ln = liuNian(A, chart, 80, gender);
    var fw = familyWealth(A);

    var SHENGXIAO = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

    /* 十神性格大白话 */
    var shenMood = {
      '正官': '循规蹈矩、有责任心、重名誉，做事按部就班',
      '七杀': '刚毅果断、好胜心强、有魄力但脾气急',
      '正印': '心地善良、包容力强、乐于付出，但依赖心也较强',
      '偏印': '思维独特、才华出众，但性格内向多疑、不善表达',
      '比肩': '独立自主、自尊心强、好竞争',
      '劫财': '热情仗义、固执冲动，花钱容易大手大脚',
      '食神': '温和厚道、有艺术天赋、知足常乐',
      '伤官': '聪明机敏、口才出众，但傲气不服输',
      '正财': '勤俭踏实、守本分、重视物质保障',
      '偏财': '慷慨大方、善交际、灵活多变'
    };
    /* 旺衰→性格大白话 */
    var stageMood = {
      '偏旺': '性格强势，精力充沛，做事有魄力',
      '太旺': '性格极度刚强，容易走极端',
      '旺极': '性格偏执，不易接受他人意见',
      '中和': '性格平和稳重，进退有度，适应性较强',
      '偏弱': '性格偏柔和内敛，做事谨慎',
      '太弱': '性格优柔寡断，缺乏主见',
      '弱极': '性格随和，容易随波逐流'
    };
    /* 日主五行→性格底色 */
    var wxMood = ['正直向上，有进取心', '热情外向，急躁冲动', '诚实厚道，保守稳重', '刚毅果断，重义气', '聪明灵活，善变多谋'];

    /* ---------- 1. 基本信息 ---------- */
    var shengxiao = SHENGXIAO[chart.year.z];
    var stageText = stageMood[A.cls.stage] || '性格平和';
    var basicDesc = stageText + '，本质上' + wxMood[dw] + '。';
    var basicNote = '日主' + D.GAN[dg] + D.WUXING[dw] + '，旺衰：' + A.cls.stage + '，格局：' + A.cls.geju;

    /* ---------- 2. 外貌体型 ---------- */
    var bodyTypes = [
      { build: '瘦长挺拔', face: '长脸，眉目清秀', height: '偏高', skin: '偏白或偏青' },
      { build: '上尖下阔，肩宽背厚', face: '上尖下圆，面色红润', height: '中等偏高', skin: '红润' },
      { build: '敦实厚重，肩宽背厚', face: '方圆脸，鼻大口方', height: '偏矮或中等', skin: '偏黄' },
      { build: '方正结实，骨感强', face: '方脸，棱角分明', height: '中等', skin: '白皙' },
      { build: '圆胖丰腴，肩宽背厚', face: '圆脸，面皮较黑', height: '偏矮或中等', skin: '偏黑' }
    ];
    var buildDesc = bodyTypes[dw].build;
    if (A.cls.stage.indexOf('旺') >= 0) buildDesc += '，体型饱满';
    else if (A.cls.stage.indexOf('弱') >= 0) buildDesc += '，体型偏瘦';
    var appearNote = '日主属' + D.WUXING[dw] + '，旺衰' + A.cls.stage;

    /* ---------- 3. 性格 ---------- */
    var maxScore = 0, maxWX = dw;
    for (var w = 0; w < 5; w++) { if (A.scores[w] > maxScore) { maxScore = A.scores[w]; maxWX = w; } }
    var mainShenName = shiShen(dg, maxWX * 2).name;
    var persoDesc = '骨子里' + wxMood[dw] + '。' + stageText + '。身上最突出的性格特质是：' + shenMood[mainShenName] + '。';
    var persoNote = '日主' + D.WUXING[dw] + '，最旺十神：' + mainShenName + '，旺衰：' + A.cls.stage;

    /* ---------- 4. 事业职业 ---------- */
    var industryByWX = [
      '文化教育、木材家具、园艺种植、医药卫生、出版传媒',
      '电子电器、能源化工、餐饮娱乐、互联网、美容化妆',
      '房地产建筑、农业矿业、陶瓷水泥、仓储物流、中介服务',
      '五金机械、金融证券、汽车交通、军警司法、医疗器械',
      '水产养殖、水利运输、旅游贸易、物流、咨询策划'
    ];
    var industryBadByWX = [
      '过度的文化教育或木材相关行业',
      '过度的电子能源或餐饮娱乐行业',
      '过度的房地产或农业相关行业',
      '过度的金融机械或军警行业',
      '过度的水产水利或旅游贸易行业'
    ];
    var yongWX = ys.yong[0];
    var jiWX = ys.ji[0];
    var careerDesc = '适合从事' + industryByWX[yongWX] + '等方面的工作。在' + industryBadByWX[jiWX] + '方面容易遇到阻碍，不宜过多投入。';
    var careerNote = '用神属' + D.WUXING[yongWX] + '，忌神属' + D.WUXING[jiWX];

    /* ---------- 5. 配偶情况 ---------- */
    var caiWX = D.WX_KE[dw];
    var guanWX = -1;
    for (var wwx = 0; wwx < 5; wwx++) { if (D.WX_KE[wwx] === dw) { guanWX = wwx; break; } }
    var spouseWX = isMale ? caiWX : guanWX;

    // 伴侣外貌
    var dayZ = P[2].z;
    var prettyZhi = [0, 3, 6, 9];
    var midZhi = [2, 5, 8, 11];
    var spouseLooksLv = '';
    if (prettyZhi.indexOf(dayZ) >= 0) spouseLooksLv = '漂亮端庄，有能力';
    else if (midZhi.indexOf(dayZ) >= 0) spouseLooksLv = '相貌一般，热情聪明，好说';
    else spouseLooksLv = '朴素敦厚，相貌较一般';
    var wxLooks = ['身材高挑，发秀端庄', '亮丽面红润', '敦厚结实，个矮较丑', '白皙端庄', '微胖圆活，面黑机灵，相貌一般'];
    var spouseLooksDesc = '伴侣' + spouseLooksLv + '，' + wxLooks[spouseWX] + '。';
    var spouseLooksNote = '日支' + D.ZHI[dayZ] + '，配偶星属' + D.WUXING[spouseWX];

    // 伴侣距离
    var pillarIdx = -1;
    if (isMale) {
      for (var spi = 0; spi < 4; spi++) {
        if (D.GAN_WX[P[spi].g] === caiWX || D.ZHI_WX[P[spi].z] === caiWX) { pillarIdx = spi; break; }
      }
    } else {
      for (var spj = 0; spj < 4; spj++) {
        if (D.GAN_WX[P[spj].g] === guanWX || D.ZHI_WX[P[spj].z] === guanWX) { pillarIdx = spj; break; }
      }
    }
    var spouseDistDesc = '';
    if (pillarIdx === 2) spouseDistDesc = '伴侣多半是同乡、同学或同事，距离很近';
    else if (pillarIdx === 1 || pillarIdx === 3) spouseDistDesc = '伴侣多半在同镇或同区域，距离中等';
    else if (pillarIdx === 0) spouseDistDesc = '伴侣多半来自远方、外镇外县，距离较远';
    else spouseDistDesc = '伴侣出现的位置不固定，缘分来的方向不确定';
    var spouseDistNote = pillarIdx >= 0 ? '配偶星在' + ['年柱','月柱','日柱','时柱'][pillarIdx] : '配偶星不显';

    // 年龄差距
    var yinWX2 = [4, 0, 1, 2, 3][dw];
    var guanYinScore = A.scores[guanWX] + A.scores[yinWX2];
    var shiCaiScore = A.scores[D.WX_SHENG[dw]] + A.scores[caiWX];
    var ageGapDesc = '';
    if (guanYinScore > shiCaiScore * 1.5) ageGapDesc = '伴侣年龄比自己大，差距较大（3岁以上）';
    else if (guanYinScore > shiCaiScore * 1.1) ageGapDesc = '伴侣年龄略大或相仿（1-3岁）';
    else if (shiCaiScore > guanYinScore * 1.5) ageGapDesc = '伴侣年龄比自己小，差距较大（3岁以上）';
    else if (shiCaiScore > guanYinScore * 1.1) ageGapDesc = '伴侣年龄略小或相仿（1-3岁）';
    else ageGapDesc = '伴侣年龄与自己相仿';

    // 夫妻感情
    var dayGanWX = dw, dayZhiWX = D.ZHI_WX[dayZ];
    var dayRelationDesc = '';
    if (dayGanWX === dayZhiWX) dayRelationDesc = '双方性格相近，互不相让';
    else if (D.WX_SHENG[dayGanWX] === dayZhiWX) dayRelationDesc = '自己对伴侣付出较多，主动照顾对方';
    else if (D.WX_SHENG[dayZhiWX] === dayGanWX) dayRelationDesc = '伴侣对自己付出较多，对方更主动';
    else if (D.WX_KE[dayGanWX] === dayZhiWX) dayRelationDesc = '自己在家里比较强势，管着对方';
    else dayRelationDesc = '伴侣比较强势，在家里说一不二';
    var spouseIsYong = ys.yong.indexOf(spouseWX) >= 0;
    var marriageDesc = '两人相处模式：' + dayRelationDesc + '。';
    marriageDesc += spouseIsYong ? '两人性格比较合拍，感情基础较好。' : '两人性格不太合拍，容易产生矛盾摩擦。';
    var dayHe = false;
    A.relations.forEach(function (r) {
      if (r.type === '六合' && (r.a === 2 || r.b === 2)) dayHe = true;
    });
    if (dayHe) marriageDesc += '伴侣可能有外遇或私情，需留意感情危机。';
    var dayChong = false;
    A.relations.forEach(function (r) {
      if (r.type === '六冲' && (r.a === 2 || r.b === 2)) dayChong = true;
    });
    if (dayChong) marriageDesc += '婚姻关系不太稳定，可能面临分居或离异的风险。';
    var spouseNote = '配偶星' + (spouseIsYong ? '为喜用' : '为忌神');
    if (dayHe) spouseNote += '，日支逢合';
    if (dayChong) spouseNote += '，日支逢冲';

    /* ---------- 6. 身世背景 ---------- */
    var parentsRelationDesc = '';
    var yearMonthChong = false;
    A.relations.forEach(function (r) {
      if (r.type === '六冲' || r.type === '天干冲') {
        if ((r.a === 0 && r.b === 1) || (r.a === 1 && r.b === 0)) yearMonthChong = true;
      }
    });
    if (yearMonthChong) parentsRelationDesc = '父母经常争吵，感情不太和睦，甚至可能分居或离异';
    else if (D.GAN_WX[P[0].g] === D.GAN_WX[P[1].g]) parentsRelationDesc = '父母关系平淡但稳定，很少大吵大闹';
    else parentsRelationDesc = '父母感情尚可，家庭关系比较平稳';

    // 家境大白话
    var wealthDesc = '';
    if (fw.level === '富裕') wealthDesc = '家境优渥，出身富足之家，祖业殷实';
    else if (fw.level === '小康偏上') wealthDesc = '家境中等偏上，父母勤恳持家，衣食无忧';
    else if (fw.level === '书香门第') wealthDesc = '出身书香门第，虽未必大富但重视教育，有文化底蕴';
    else if (fw.level === '小康') wealthDesc = '家境平稳小康，父母有一定能力，虽非大富亦无冻馁之虞';
    else if (fw.level === '起伏不定') wealthDesc = '家境变动较大，早年可能多次搬迁，家道有起落';
    else if (fw.level === '财多压身') wealthDesc = '家境表面可能富裕但内部压力大，长辈劳碌';
    else wealthDesc = '家境平凡，父母为普通人家，需靠自身努力白手起家';

    // 父亲健康
    var fatherWX = D.GAN_WX[P[0].g];
    var keFatherWX = -1;
    for (var kf = 0; kf < 5; kf++) { if (D.WX_KE[kf] === fatherWX) { keFatherWX = kf; break; } }
    var fatherHealthDesc = '';
    if (A.scores[keFatherWX] > 150) fatherHealthDesc = '父亲身体偏弱，易有肝胆或筋骨方面的疾病';
    else fatherHealthDesc = '父亲身体尚可';
    // 母亲健康
    var yinWX3 = [4, 0, 1, 2, 3][dw];
    var keYinWX = -1;
    for (var km = 0; km < 5; km++) { if (D.WX_KE[km] === yinWX3) { keYinWX = km; break; } }
    var motherHealthDesc = '';
    if (A.scores[keYinWX] > 150) motherHealthDesc = '母亲身体偏弱，易有脾胃或消化方面的疾病';
    else motherHealthDesc = '母亲身体尚可';
    var familyNote = '年月' + (yearMonthChong ? '相冲' : '无冲') + '，家境判定：' + fw.level;

    /* ---------- 7. 子女情况 ---------- */
    var childWX = isMale ? guanWX : D.WX_SHENG[dw];
    var childCount = 0;
    var childScore = A.scores[childWX];
    if (childScore > 200) childCount = 3;
    else if (childScore > 150) childCount = 2;
    else if (childScore > 80) childCount = 1;
    else childCount = 0;
    var childDesc = '';
    if (childCount === 0) childDesc = '子女缘分较薄，可能没有孩子或孩子很少';
    else childDesc = '预计可能有' + childCount + '个孩子';
    var hourZhi = P[3].z;
    var hourCangGan0 = D.CANG_GAN[hourZhi][0][0];
    var hourShenName = shiShen(dg, hourCangGan0).name;
    var hourShenDesc = '';
    if (hourShenName === '正官' || hourShenName === '七杀') hourShenDesc = '孩子将来比较有出息，有主见';
    else if (hourShenName === '正印' || hourShenName === '偏印') hourShenDesc = '孩子比较内向，但读书不错';
    else if (hourShenName === '食神' || hourShenName === '伤官') hourShenDesc = '孩子聪明活泼，有才艺';
    else if (hourShenName === '正财' || hourShenName === '偏财') hourShenDesc = '孩子将来经济条件不错';
    else hourShenDesc = '孩子性格独立，有主见';
    childDesc += '。' + hourShenDesc + '。';
    var childNote = '子女星属' + D.WUXING[childWX] + '，得分' + childScore.toFixed(1) + '，时柱' + D.GAN[P[3].g] + D.ZHI[hourZhi];

    /* ---------- 8. 寿命健康 ---------- */
    var dangerYears = [];
    ln.forEach(function (yr) {
      var hasDanger = yr.predictions.some(function (p) { return p.cat === '凶' || p.cat === '灾'; });
      if (hasDanger && yr.age > 40) dangerYears.push(yr.age + '岁（' + (birthYear + yr.age - 1) + '年）');
    });
    var lifespanDesc = '需要特别注意的年份：' + (dangerYears.length ? dangerYears.slice(0, 5).join('、') : '暂无明显风险年份') + '。';
    lifespanDesc += '（寿命长短的精确推断方法尚缺，以上仅为风险年份提示）';
    var minWX = 0, minScore = 999;
    for (var mw = 0; mw < 5; mw++) { if (A.scores[mw] < minScore) { minScore = A.scores[mw]; minWX = mw; } }
    var wxBody = ['肝胆、筋骨、四肢', '心脏、小肠、血脉', '脾胃、消化、肌肉', '肺、大肠、呼吸系统', '肾、膀胱、生殖泌尿系统'];
    var healthDesc = wxBody[minWX] + '方面需要多加注意，容易出问题。';
    var healthNote = '最弱五行：' + D.WUXING[minWX] + '（' + minScore.toFixed(1) + '）';

    /* ---------- 9. 人生阶段划分 ---------- */
    var stages = [];
    var startAge = Math.floor(dy.years);
    var stageNames = ['少年求学', '青年探索', '青年奋斗', '中年事业', '中年收获', '晚年时期'];

    // 辅助：推断极端年份事件（纯大白话，不含命理术语）
    function extremeYearEvents(ageFrom, ageTo) {
      var events = [];
      for (var li = 0; li < ln.length; li++) {
        var yr = ln[li];
        if (yr.age < ageFrom || yr.age >= ageTo) continue;
        var yearAD = birthYear + yr.age - 1;
        var sentence = '';
        var extremeType = '';

        var evTypes = yr.events.map(function (e) { return e.type; });
        var yp = yearAD + '年（' + yr.age + '岁时）';

        for (var pi = 0; pi < yr.predictions.length; pi++) {
          var pred = yr.predictions[pi];
          var cat = pred.cat;

          if ((cat === '凶' || cat === '灾' || cat === '牢') && yr.fit === '忌') {
            extremeType = 'bad';
            var hasPunish = evTypes.indexOf('xing') >= 0;
            var hasHarm = evTypes.indexOf('hai') >= 0;
            var hasHeavy = evTypes.indexOf('ganChong') >= 0 || evTypes.indexOf('zhiChong') >= 0;
            if (cat === '灾' && hasHeavy) {
              sentence = yp + '运势很差，尤其是农历五月或十一月前后，交通安全需格外注意，容易遭遇车祸、外伤或手术，建议避免长途驾驶';
            } else if (cat === '灾' && hasPunish) {
              sentence = yp + '运势很差，尤其是农历三月或九月前后，容易涉及纠纷或法律问题，需谨言慎行、避免与人争执';
            } else if (cat === '灾' && hasHarm) {
              sentence = yp + '运势很差，尤其是农历六月或十二月前后，健康方面需要注意，易有小病小灾，特别是肝胆或心血管方面';
            } else {
              sentence = yp + '运势很差，各方面都不顺，工作压力大，财运也差，宜守不宜进';
            }
            break;
          }
          if ((cat === '吉' || cat === '贵') && yr.fit === '喜') {
            extremeType = 'good';
            if (cat === '贵') {
              sentence = yp + '运势很好，尤其是农历二月或八月前后，会遇到贵人相助，可能是领导、长辈或有能力的朋友，能帮你解决难题';
            } else {
              sentence = yp + '运势很好，工作顺利、财运亨通、家庭和睦，做什么都比较顺心';
            }
            break;
          }
          if ((cat === '婚') && yr.age >= 18 && yr.age <= 40 && yr.fit !== '忌') {
            extremeType = 'romance';
            var romanticPlaces = ['工作场所', '学校或培训班', '朋友聚会', '社交或应酬场合', '出差或旅途中', '身边的圈子'];
            var placeIdx = (yearAD + yr.age) % romanticPlaces.length;
            var wxLooks2 = ['身材高挑、气质佳', '活泼开朗、热情外向', '敦厚可靠、踏实稳重', '理性干练、相貌出众', '聪明灵动、温柔可人'];
            var spouseWX2 = isMale ? caiWX : guanWX;
            sentence = yp + '感情方面会有重要变化，尤其是农历四月或十月前后，可能在' + romanticPlaces[placeIdx] + '遇到心动的人，对方多半是' + wxLooks2[spouseWX2] + '，感情进展较快';
            break;
          }
          if ((cat === '婚') && yr.age >= 22 && yr.fit === '忌') {
            extremeType = 'marriage_bad';
            sentence = yp + '感情方面容易出问题，关系可能出现裂痕，容易因为小事争吵，需多沟通多包容';
            break;
          }
          if ((cat === '业') && yr.fit === '喜' && yr.age >= 22 && yr.age <= 60) {
            extremeType = 'career';
            sentence = yp + '事业上有重要突破，尤其是农历正月或七月前后，可能升职加薪、获得重要项目，或开辟新的事业方向';
            break;
          }
          if ((cat === '财') && yr.fit === '喜' && yr.age >= 18) {
            extremeType = 'wealth';
            sentence = yp + '财运不错，有额外收入或投资获利的机会，但也需注意不要冲动消费';
            break;
          }
          if ((cat === '财') && yr.fit === '忌' && yr.age >= 18) {
            extremeType = 'wealth_bad';
            sentence = yp + '容易破财，花钱的地方多，投资容易失利，不宜做大额决策';
            break;
          }
          if ((cat === '学') && yr.fit === '喜' && yr.age >= 6 && yr.age <= 30) {
            extremeType = 'study';
            sentence = yp + '学业表现突出，考试顺利，能取得好成绩，有机会获得表彰或重要资格';
            break;
          }
        }
        if (sentence) {
          events.push({ age: yr.age, yearAD: yearAD, type: extremeType, sentence: sentence });
        }
      }
      events.sort(function (a, b) { return a.age - b.age; });
      return events;
    }

    // 幼年
    stages.push({
      from: 1, to: startAge,
      title: '幼年时期',
      desc: '出生至' + startAge + '岁，' + wealthDesc + '。此阶段身体发育受家庭环境影响较大。',
      note: '起运前，家境：' + fw.level
    });

    for (var si = 0; si < Math.min(6, dy.list.length); si++) {
      var step = dy.list[si];
      var stepW = D.GAN_WX[step.g];
      var stepIsYong = ys.yong.indexOf(stepW) >= 0;
      var stepIsJi = ys.ji.indexOf(stepW) >= 0;
      var stepShen = shiShen(dg, step.g).name;
      var ageFrom = Math.floor(step.ageStart);
      var ageTo = Math.floor(step.ageEnd);
      var yearFrom = birthYear + ageFrom - 1;
      var yearTo = birthYear + ageTo - 1;
      var stepDesc = ageFrom + '岁至' + ageTo + '岁（约' + yearFrom + '至' + yearTo + '年），';
      var stepNote = D.GAN[step.g] + D.ZHI[step.z] + '运，' + stepShen + '，' + (stepIsYong ? '喜用' : (stepIsJi ? '忌神' : '平'));

      if (si === 0 || si === 1) {
        if (stepIsYong && (stepShen === '正印' || stepShen === '偏印')) {
          stepDesc += '学习能力强，读书顺利，有长辈帮衬，升学有望。';
        } else if (stepIsJi && (stepShen === '正印' || stepShen === '偏印')) {
          stepDesc += '学业压力较大，读书比较吃力，家庭经济可能有一定困难。';
        } else if (stepShen === '比肩' || stepShen === '劫财') {
          stepDesc += '交友广泛，人缘好，但容易因朋友破财或遭遇竞争。';
        } else if (stepIsYong) {
          stepDesc += '整体比较顺利，学业和生活没有大的波折。';
        } else {
          stepDesc += '这段时间多有挫折，需要忍耐和积累，不宜冒进。';
        }
      } else if (si === 2 || si === 3) {
        if (stepShen === '正财' || stepShen === '偏财') {
          stepDesc += '有赚钱的机会出现，适合创业或投资';
          if (stepIsYong) stepDesc += '，财来得比较稳，能存得住。';
          else stepDesc += '，但钱来得快去得也快，需注意理财。';
        } else if ((stepShen === '正官' || stepShen === '七杀') && stepIsYong) {
          stepDesc += '事业上升期，有望升职掌权，有贵人提携，工作顺利。';
        } else if ((stepShen === '正官' || stepShen === '七杀') && stepIsJi) {
          stepDesc += '工作压力比较大，容易遇到是非纠纷，需要谨慎行事，避免口舌。';
        } else if (stepShen === '正印' || stepShen === '偏印') {
          if (stepIsYong) stepDesc += '适合学习深造或考证，有长辈贵人相助。';
          else stepDesc += '想法多但难落地，容易陷入空想，事业进展缓慢。';
        } else if (stepShen === '食神' || stepShen === '伤官') {
          stepDesc += '才华发挥期，适合从事创意、技术类工作，但注意别太傲气得罪人。';
        } else if (stepShen === '比肩' || stepShen === '劫财') {
          stepDesc += '竞争激烈，容易破财，但人脉广，可合伙做事。';
        } else if (stepIsYong) {
          stepDesc += '事业稳步上升，家庭和事业都比较顺。';
        } else {
          stepDesc += '事业多遇阻碍，感情可能有变动或跳槽之事。';
        }
      } else {
        if (stepIsYong) {
          stepDesc += '事业稳固，生活安逸，可以享受子女的福气，晚年平稳。';
        } else if (stepShen === '七杀' || stepShen === '伤官') {
          stepDesc += '容易有意外或健康问题，宜守不宜进，注意身体。';
        } else {
          stepDesc += '宜守不宜进，以身体健康为重，不宜大动作投资或变动。';
        }
      }

      // 追加极端流年事件，用分号衔接成一段话
      var yrEvents = extremeYearEvents(ageFrom, ageTo);
      if (yrEvents.length > 0) {
        var sentences = yrEvents.map(function (e) { return e.sentence; });
        stepDesc += '期间几件要事：' + sentences.join('；') + '。';
      }

      stages.push({
        from: ageFrom, to: ageTo,
        title: stageNames[si] || ('阶段' + (si + 1)),
        desc: stepDesc,
        note: stepNote
      });
    }

    /* ---------- 组装返回 ---------- */
    return {
      basic: {
        gender: isMale ? '男' : '女',
        birthYear: birthYear,
        shengxiao: shengxiao,
        desc: basicDesc,
        note: basicNote
      },
      appearance: {
        build: buildDesc,
        face: bodyTypes[dw].face,
        height: bodyTypes[dw].height,
        skin: bodyTypes[dw].skin,
        note: appearNote
      },
      personality: {
        desc: persoDesc,
        note: persoNote
      },
      career: {
        desc: careerDesc,
        note: careerNote
      },
      spouse: {
        looks: spouseLooksDesc,
        distance: spouseDistDesc,
        ageGap: ageGapDesc,
        marriage: marriageDesc,
        note: spouseLooksNote + '；' + spouseDistNote + '；' + spouseNote
      },
      family: {
        wealth: wealthDesc,
        parentsRelation: parentsRelationDesc,
        fatherHealth: fatherHealthDesc,
        motherHealth: motherHealthDesc,
        note: familyNote
      },
      children: {
        desc: childDesc,
        count: childCount,
        note: childNote
      },
      health: {
        desc: healthDesc,
        lifespan: lifespanDesc,
        note: healthNote
      },
      stages: stages,
      missing: [
        '寿命长短的精确推断方法',
        '子女具体数量的精确推断方法',
        '判断父母是否有外遇的方法'
      ]
    };
  }

  return {
    shiShen: shiShen, shenSha: shenSha, taiYuan: taiYuan, daYun: daYun,
    detectRelations: detectRelations, scoreChart: scoreChart,
    stageOf: stageOf, classify: classify, quYongShen: quYongShen,
    analyze: analyze, gzStr: gzStr, gzIndex: gzIndex,
    familyWealth: familyWealth, liuNian: liuNian, charaCard: charaCard
  };
});
