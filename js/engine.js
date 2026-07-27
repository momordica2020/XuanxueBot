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

  return {
    shiShen: shiShen, shenSha: shenSha, taiYuan: taiYuan, daYun: daYun,
    detectRelations: detectRelations, scoreChart: scoreChart,
    stageOf: stageOf, classify: classify, quYongShen: quYongShen,
    analyze: analyze, gzStr: gzStr, gzIndex: gzIndex
  };
});
