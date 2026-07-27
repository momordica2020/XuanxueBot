/* 临时冒烟测试：report + disk */
const CAL = require('../js/calendar.js'), ENG = require('../js/engine.js'),
  RPT = require('../js/report.js'), DISK = require('../js/disk.js');
const c = CAL.siZhu(1968, 6, 1, 2, 0);
const A = ENG.analyze(c, 'male');
const rep = RPT.generate(A, 'male');
console.log('--- 短文段落数:', rep.paragraphs.length);
rep.paragraphs.forEach((p, i) => console.log('[' + (i + 1) + ']', p));
const svg = DISK.renderSVG(A, { selected: 2 });
const segCount = svg.split('class="seg"').length - 1;
console.log('--- 选中态 SVG 长度:', svg.length, '扇形格数:', segCount, '关系弧:', svg.indexOf('marker-end') >= 0, '神煞徽章:', svg.indexOf('<title>') >= 0);
const svg2 = DISK.renderSVG(A, { selected: null });
console.log('--- 未选中态 SVG 长度:', svg2.length, '刻度线:', svg2.indexOf('class="ticks"') >= 0, '阴阳标记:', svg2.indexOf('yy-mark') >= 0);
// 再验一例（坤造）
const c2 = CAL.siZhu(1967, 9, 5, 8, 0);
const A2 = ENG.analyze(c2, 'female');
const rep2 = RPT.generate(A2, 'female');
console.log('--- 坤造短文段落数:', rep2.paragraphs.length, '首段:', rep2.paragraphs[0].slice(0, 60) + '…');
console.log('SMOKE OK');
