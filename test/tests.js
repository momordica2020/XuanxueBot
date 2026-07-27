/* ============================================================
 * tests.js — 阶段8 自动化测试（书中测例基准对照）
 * 运行：node test/tests.js
 * ============================================================ */
var D = require('../js/data.js');
var CAL = require('../js/calendar.js');
var ENG = require('../js/engine.js');

var pass = 0, fail = 0, fails = [];
function ok(cond, name, got, want) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name); console.log('  ✗ ' + name + '  期望:' + want + '  实际:' + got); }
}
function gz(g, z) { return D.GAN[g] + D.ZHI[z]; }
function chartGZ(ch) { return [ch.year, ch.month, ch.day, ch.hour].map(function (p) { return gz(p.g, p.z); }).join('/'); }
function dyGZ(A, n) { return A.dayun.list.slice(0, n).map(function (y) { return gz(y.g, y.z); }).join(''); }

/* ================= T1 历法锚点 ================= */
console.log('\n【T1 历法锚点】');
(function () {
  function dayGanZhi(y, m, d) { var ch = CAL.siZhu(y, m, d, 12, 0); return gz(ch.day.g, ch.day.z); }
  ok(dayGanZhi(2000, 1, 1) === '戊午', '2000-01-01 = 戊午日', dayGanZhi(2000, 1, 1), '戊午');
  ok(dayGanZhi(1949, 10, 1) === '甲子', '1949-10-01 = 甲子日', dayGanZhi(1949, 10, 1), '甲子');
  ok(dayGanZhi(2024, 1, 1) === '甲子', '2024-01-01 = 甲子日', dayGanZhi(2024, 1, 1), '甲子');

  function termStr(y, lon) { var t = CAL.fromJD(CAL.termJD(y, lon)); return t.y + '-' + t.m + '-' + t.d + ' ' + t.hh + ':' + (t.mm < 10 ? '0' : '') + t.mm; }
  function termMin(y, lon) { var t = CAL.fromJD(CAL.termJD(y, lon)); return t.hh * 60 + t.mm; }
  var lc24 = termStr(2024, 315); ok(Math.abs(termMin(2024, 315) - (16 * 60 + 27)) <= 20 && lc24.indexOf('2024-2-4') === 0, '2024立春 2024-02-04 16:27±20m', lc24, '2024-2-4 16:27');
  var lc25 = termStr(2025, 315); ok(Math.abs(termMin(2025, 315) - (22 * 60 + 10)) <= 20 && lc25.indexOf('2025-2-3') === 0, '2025立春 2025-02-03 22:10±20m', lc25, '2025-2-3 22:10');
  var dz24 = termStr(2024, 270); ok(Math.abs(termMin(2024, 270) - (17 * 60 + 21)) <= 20 && dz24.indexOf('2024-12-21') === 0, '2024冬至 2024-12-21 17:21±20m', dz24, '2024-12-21 17:21');

  var before = CAL.siZhu(2024, 2, 4, 16, 0), after = CAL.siZhu(2024, 2, 4, 17, 0);
  ok(gz(before.year.g, before.year.z) === '癸卯' && gz(after.year.g, after.year.z) === '甲辰',
    '立春前后年柱 癸卯→甲辰', gz(before.year.g, before.year.z) + '→' + gz(after.year.g, after.year.z), '癸卯→甲辰');
  ok(gz(before.month.g, before.month.z) === '乙丑' && gz(after.month.g, after.month.z) === '丙寅',
    '立春前后月柱 乙丑→丙寅', gz(before.month.g, before.month.z) + '→' + gz(after.month.g, after.month.z), '乙丑→丙寅');
})();

/* ================= T2 书中命例四柱+大运 ================= */
console.log('\n【T2 书中命例 四柱+大运】');
var CASES = [
  { name: '命例一 农历1968-5-5=公历1968-06-01 丑时男', y: 1968, m: 6, d: 1, h: 2, g: 'male', sz: '戊申/丁巳/辛丑/己丑', dy: '戊午己未庚申辛酉壬戌癸亥', dyN: 6, qiYun: 2 },
  { name: '命例二 1963-10-06 申时男', y: 1963, m: 10, d: 6, h: 16, g: 'male', sz: '癸卯/辛酉/壬午/戊申', dy: '庚申己未戊午丁巳丙辰乙卯甲寅', dyN: 7, qiYun: 9 },
  { name: '命例三 1967-09-05 辰时女', y: 1967, m: 9, d: 5, h: 8, g: 'female', sz: '丁未/戊申/壬申/甲辰', dy: '己酉庚戌辛亥壬子癸丑甲寅', dyN: 6, qiYun: 1 }
];
CASES.forEach(function (c) {
  var ch = CAL.siZhu(c.y, c.m, c.d, c.h, 0);
  var got = chartGZ(ch);
  ok(got === c.sz, c.name + ' 四柱=' + c.sz, got, c.sz);
  var A = ENG.analyze(ch, c.g);
  var gotDy = dyGZ(A, c.dyN);
  ok(gotDy === c.dy, c.name + ' 大运=' + c.dy, gotDy, c.dy);
  ok(Math.abs(A.dayun.years - c.qiYun) <= 1.2, c.name + ' 起运≈' + c.qiYun + '岁', A.dayun.years.toFixed(1), c.qiYun);
});

/* ================= T3 打分法锚点 ================= */
console.log('\n【T3 打分法锚点（±10内，档位必须一致）】');
var SCORE_CASES = [
  { name: '第五章例一', sz: '乙未/壬午/壬子/癸卯', dayScore: 193.6, stage: '偏旺' },
  { name: '第五章例二', sz: '己卯/庚午/己丑/癸酉', dayScore: 165.6, stage: '偏旺' },
  { name: '第五章例三', sz: '壬寅/庚戌/辛巳/庚寅', dayScore: 119.2, stage: '偏旺', extra: { wx: 1, min: 109, label: '官杀火偏旺' } },
  { name: '第五章例四', sz: '癸丑/甲寅/甲午/乙亥', dayScore: 216, stage: '太旺', special: '印比同旺' }
];
function pillarsOf(szStr) {
  return szStr.split('/').map(function (s) { return { g: D.GAN.indexOf(s[0]), z: D.ZHI.indexOf(s[1]) }; });
}
SCORE_CASES.forEach(function (c) {
  var P = pillarsOf(c.sz);
  var rels = ENG.detectRelations(P);
  var sc = ENG.scoreChart(P, rels);
  var cls = ENG.classify(P, sc.scores);
  var dayWX = D.GAN_WX[P[2].g];
  var got = sc.scores[dayWX];
  ok(Math.abs(got - c.dayScore) <= 10, c.name + ' 日主分≈' + c.dayScore + '（' + c.sz + '）', got.toFixed(1), c.dayScore);
  ok(cls.stage === c.stage, c.name + ' 档位=' + c.stage, cls.stage, c.stage);
  if (c.special) ok(cls.special === c.special, c.name + ' 特殊=' + c.special, cls.special, c.special);
  if (c.extra) ok(sc.scores[c.extra.wx] >= c.extra.min, c.name + ' ' + c.extra.label, sc.scores[c.extra.wx].toFixed(1), '>=' + c.extra.min);
});

/* ================= T4 合化综合 ================= */
console.log('\n【T4 合化综合（第六章例）】');
(function () {
  var P = pillarsOf('戊申/癸亥/甲辰/甲子');
  var rels = ENG.detectRelations(P);
  var has3 = rels.some(function (r) { return r.type === '三合局'; });
  ok(has3, '申子辰三合局检出', has3, true);
  var sc = ENG.scoreChart(P, rels);
  ok(sc.huaInfo.length > 0 && sc.huaInfo[0].indexOf('水') >= 0, '合化水成功判定', sc.huaInfo.join('；'), '化水成功');
  var cls = ENG.classify(P, sc.scores);
  ok(sc.scores[4] >= 272, '水≥272 太旺', sc.scores[4].toFixed(1), '>=272');
  ok(sc.scores[0] < 109, '木<109 偏弱（日主甲偏弱）', sc.scores[0].toFixed(1), '<109');
  ok(cls.stage === '偏弱', '日主甲 档位=偏弱', cls.stage, '偏弱');
})();

/* ================= T5 定性抽查 ================= */
console.log('\n【T5 定性抽查（第十八章命例书中断语）】');
var QUAL = [
  { name: '例一 戊申/丁巳/辛丑/己丑', desc: '日主偏弱，印枭偏旺', test: function (sc, cls) { return sc.scores[3] < 109 && sc.scores[2] > 109; } },
  { name: '例二 癸卯/辛酉/壬午/戊申', desc: '日主中和偏弱，印旺', test: function (sc, cls) { return sc.scores[4] <= 109 && sc.scores[3] > 109; } },
  { name: '例三 丁未/戊申/壬申/甲辰', desc: '日主中和', test: function (sc, cls) { return sc.scores[4] >= 89 && sc.scores[4] <= 129; } }
];
QUAL.forEach(function (c) {
  var P = pillarsOf(c.name.split(' ')[1]);
  var rels = ENG.detectRelations(P);
  var sc = ENG.scoreChart(P, rels);
  var cls = ENG.classify(P, sc.scores);
  ok(c.test(sc, cls), c.name + ' → ' + c.desc, '五行分[' + sc.scores.map(function (s) { return s.toFixed(1); }).join(',') + ']', c.desc);
});

/* ================= 汇总 ================= */
console.log('\n========================================');
console.log('通过 ' + pass + ' / ' + (pass + fail));
if (fail) { console.log('未通过：' + fails.join('；')); process.exit(1); }
else console.log('全部测例通过 ✓');
