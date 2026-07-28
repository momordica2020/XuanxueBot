/* ============================================================
 * report.js — 阶段6 命格描述短文生成
 * 依据：第十一章十神信息之象（心性正/负面按喜忌取舍）、
 *      第四/五/六章旺衰格局断语、日干五行心性（L1116）
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.BAZI_REPORT = factory(root.BAZI_DATA);
})(typeof self !== 'undefined' ? self : this, function (D) {

  /* ---------- 日干五行心性（L1116） ---------- */
  var WX_XINXING = [
    { pos: '木主仁慈，有恻隐之心，为人正直有同情心', neg: '固执不易变通，遇事不知回转' },
    { pos: '火主礼，为人谦和有礼，热情明快，积极向上', neg: '性急脾气暴燥，易冲动少耐性' },
    { pos: '土主信，为人宽厚实诚，守信用，稳重能容', neg: '偏于固执守旧，反应迟缓少变通' },
    { pos: '金主义，仗义豪爽，果断有魄力，重然诺', neg: '好斗好胜，锋芒过露易伤人' },
    { pos: '水主智，足智多谋，思维灵动，善于变化', neg: '好变少定性，易流于圆滑' }
  ];

  /* ---------- 十神心性（正/负面） ---------- */
  var SHEN_XINXING = {
    '正官': { pos: '循规蹈矩，责任心强，办事认真，光明磊落，守信用，有名誉感', neg: '性格懦弱，胆小怕事，唯唯诺诺，缺乏开拓精神' },
    '七杀': { pos: '精明果断，有魄力，有管理才能与开拓精神，行事有担当', neg: '霸道蛮横，好猜疑，行事独断专行，易招小人仇怨' },
    '正财': { pos: '勤俭务实，对钱财重视，爱情专一，重视家庭，有传统观念', neg: '吝啬计较，患得患失，过于现实而疏于精神追求' },
    '偏财': { pos: '慷慨大方，人缘好，处事圆滑能联络人，多才多艺有专长', neg: '花钱无度，重财不理财，感情不专一，易起投机之心' },
    '食神': { pos: '温和厚道，度量宽宏，乐观人缘好，有口福，才华能发挥', neg: '偏于安逸，进取心不足，容易满足现状' },
    '伤官': { pos: '思想开放，能言善辩，有才华有创造力，敢打破陈规', neg: '好胜逞强，不服管制，口无遮拦，易得罪人招口舌' },
    '正印': { pos: '任劳任怨，有奉献精神，稳重理智，逻辑思维强，守秘密', neg: '思想保守守旧，依赖心大，优柔寡断，不喜运动' },
    '偏印': { pos: '思维灵活，领悟力强，精明有心计，易在偏门学问上有成就', neg: '冷淡寡情，固执傲慢，我行我素，不善交际' },
    '比肩': { pos: '自尊自立，有主见，能得兄弟朋友之助，宜合作', neg: '固执己见，好面子喜争胜，不利聚财' },
    '劫财': { pos: '热情豪爽，行动力强，敢作敢为', neg: '好惹是非，不讲信用，蛮不讲理，易有官非口舌' }
  };

  /* ---------- 五行宜忌 ---------- */
  var WX_ADVICE = [
    { color: '青绿色系', dir: '东方', industry: '木器家具、文化教育、出版印刷、园林花木、纺织布艺' },
    { color: '红紫色系', dir: '南方', industry: '能源电力、餐饮照明、电子电器、演艺传媒、化工' },
    { color: '黄咖色系', dir: '本地/中部', industry: '房地产建筑、农业畜牧、陶瓷矿产、仓储中介' },
    { color: '白金色系', dir: '西方', industry: '五金机械、金融证券、汽车交通、军警司法、医疗器械' },
    { color: '黑蓝色系', dir: '北方', industry: '水产航运、旅游物流、酒水饮品、信息网络、贸易' }
  ];

  /* ---------- 神煞断语 ---------- */
  var SHA_TEXT = {
    '天乙贵人': '一生多贵人扶持，遇难呈祥',
    '禄神': '衣食俸禄丰厚，福气随身',
    '羊刃': '性刚果决有魄力，亦需防刚愎招灾',
    '文昌': '聪明好学，利文途考试与文职',
    '驿马': '好动多变，利远行迁移与动中求财',
    '桃花': '人缘佳、有魅力，亦须防情感纷扰',
    '华盖': '聪明好学、有艺术玄学天赋，性情偏孤高',
    '金舆': '富贵之征，利婚姻与车舆之福'
  };

  function stageDesc(stage) {
    var map = {
      '偏旺': '日主偏旺，精力充沛，主观能动性强，能担财官',
      '太旺': '日主太旺，气盛易刚愎，最忌犯怒，宜顺势化泄',
      '旺极': '日主一气专旺，其气可顺不可逆，格局清奇',
      '偏弱': '日主偏弱，底气稍欠，宜生扶帮身以壮根本',
      '太弱': '日主太弱，帮扶无力，格局近于假从，宜顺势安排',
      '弱极': '日主弱极无依，从其旺势，反成格局'
    };
    return map[stage] || '';
  }

  /**
   * 生成命格短文
   * A: engine.analyze 结果；gender: 'male'|'female'
   * 返回 { paragraphs: [...], summary: '...' }
   */
  function generate(A, gender) {
    var P = A.pillars, cls = A.cls, ys = A.yongshen;
    var dayGan = A.dayGan, dayWX = cls.dayWX;
    var paras = [];

    /* ① 日主五行心性 + 旺衰修饰 */
    var xx = WX_XINXING[dayWX];
    var strong = cls.stage === '偏旺' || cls.stage === '太旺' || cls.stage === '旺极';
    var weak = cls.stage === '偏弱' || cls.stage === '太弱' || cls.stage === '弱极';
    var p1 = '日主' + D.GAN[dayGan] + D.WUXING[dayWX] + '，' + xx.pos;
    if (strong) p1 += '；日主旺相，此心性体现充分';
    else if (weak) p1 += '；日主偏弱，此心性体现不足，反显' + xx.neg;
    else p1 += '，旺衰得宜，心性平和';
    p1 += '。旺衰评定：' + cls.stage + '（五行分' + A.scores[dayWX].toFixed(1) + '），' + stageDesc(cls.stage) + '。';
    paras.push(p1);

    /* ② 最旺十神心性（按喜忌定正负面）+ 贴日主十神 */
    var maxWX = 0;
    for (var w = 1; w < 5; w++) if (A.scores[w] > A.scores[maxWX]) maxWX = w;
    // 最旺五行对应的十神类（取任意同五行阳干查十神名）
    var repGan = maxWX * 2; // 阳干代表
    var maxShen = A.shiShenOf(repGan).name;
    var isYong = ys.yong.indexOf(maxWX) >= 0;
    var sx = SHEN_XINXING[maxShen];
    var p2 = '命局以' + D.WUXING[maxWX] + '（' + maxShen + '）最旺（' + A.scores[maxWX].toFixed(1) + '分），';
    p2 += isYong ? '此五行恰为用神，体现正面心性：' + sx.pos + '。'
                 : '此五行为忌，易显负面心性：' + sx.neg + '。';
    // 贴日主十神（月干/时干/日支藏干本气）
    var near = [];
    var mShen = A.shiShenOf(P[1].g).name;
    var hShen = A.shiShenOf(P[3].g).name;
    var dzCang = D.CANG_GAN[P[2].z][0][0];
    var dzShen = A.shiShenOf(dzCang).name;
    near.push('月干' + D.GAN[P[1].g] + mShen, '时干' + D.GAN[P[3].g] + hShen, '日支本气' + dzShen);
    var firstTrait = {}, traits = [];
    [mShen, hShen, dzShen].forEach(function (n) {
      if (firstTrait[n]) return; firstTrait[n] = 1;
      traits.push(SHEN_XINXING[n].pos.split('，')[0]);
    });
    p2 += '贴近日主的' + near.join('、') + '，对日主影响最直接，其心性（' + traits.join('、') + '）日常最易显现。';
    paras.push(p2);

    /* ③ 格局定性 + 评述 */
    var p3 = '格局判定为' + cls.geju + '。';
    if (cls.nearNeutral) p3 += '日主接近中和，五行力量相对均衡，属平稳之命，吉凶多随大运流转而定，所谓"有病方为贵，无伤不是奇"，此造病轻药轻，一生起伏相对和缓。';
    else if (cls.special === '专旺') p3 += '全局气势专一，顺其势则发越非常，逆其势则灾祸立至，行运最忌财官逆势。';
    else if (cls.special === '从格') p3 += '日主无依而顺势，所从之势得力则富贵可期，忌印比帮身逆局破局。';
    else if (cls.special === '印比同旺') p3 += '印比两旺为病，取泄为用，格局成败全在食伤一字。';
    else p3 += '旺衰有偏，恰以用神为药，药到病除则格局可观。';
    if (A.huaInfo.length) p3 += '局中有' + A.huaInfo.join('、') + '，合化改气，五行力量由此重排，为看命关键所在。';
    paras.push(p3);

    /* ④ 用神/忌神 + 宜忌建议 */
    var p4 = '用神取' + ys.yong.map(function (w) { return D.WUXING[w]; }).join('、') + '，忌' +
      ys.ji.map(function (w) { return D.WUXING[w]; }).join('、') + '。' + ys.note;
    var adv = WX_ADVICE[ys.yong[0]];
    p4 += '日常生活中宜多近' + D.WUXING[ys.yong[0]] + '性事物：颜色宜' + adv.color + '，方位利' + adv.dir +
      '，从业宜' + adv.industry + '等属' + D.WUXING[ys.yong[0]] + '之行业。';
    if (ys.tiaohou) p4 += ys.tiaohou;
    paras.push(p4);

    /* ⑤ 大运节奏 */
    var dy = A.dayun;
    var p5 = '大运' + (dy.forward ? '顺' : '逆') + '排，' + dy.years.toFixed(1) + '岁起运。';
    var dyDesc = dy.list.slice(0, 6).map(function (y) {
      var yw = D.GAN_WX[y.g];
      var fit = ys.yong.indexOf(yw) >= 0 ? '吉' : (ys.ji.indexOf(yw) >= 0 ? '忌' : '平');
      return D.GAN[y.g] + D.ZHI[y.z] + '(' + y.ageStart.toFixed(0) + '~' + y.ageEnd.toFixed(0) + '岁' + fit + ')';
    }).join('，');
    p5 += '前六步大运与喜忌对照：' + dyDesc + '。';
    var firstGood = ys.yong.indexOf(D.GAN_WX[dy.list[0].g]) >= 0;
    p5 += firstGood ? '开局即逢喜用，早年根基较顺。' : '开局非喜用之地，早年需多磨砺，待喜用之运方展其才。';
    paras.push(p5);

    /* ⑥ 神煞点缀 */
    if (A.shensha.length) {
      var seen = {}, ssList = [];
      A.shensha.forEach(function (s) {
        if (seen[s.name]) return; seen[s.name] = 1;
        var loc = ['年柱', '月柱', '日柱', '时柱'][s.pillar];
        ssList.push(s.name + '落' + loc + '（' + (SHA_TEXT[s.name] || '') + '）');
      });
      paras.push('神煞方面：' + ssList.join('；') + '。');
    }

    /* ⑦ 家境推断 */
    if (A.famWealth) {
      paras.push('家境方面：' + A.famWealth.desc);
    }

    /* ⑧ 编年史摘要 */
    if (A.chronicle) {
      paras.push(A.chronicle);
    }

    return { paragraphs: paras, summary: p1 };
  }

  return { generate: generate, WX_XINXING: WX_XINXING, SHEN_XINXING: SHEN_XINXING, WX_ADVICE: WX_ADVICE, SHA_TEXT: SHA_TEXT };
});
