/* ============================================================
 * app.js — 页面装配：输入 → 排盘 → 各区块渲染
 * ============================================================ */
(function () {
  var D = BAZI_DATA, CAL = BAZI_CALENDAR, ENG = BAZI_ENGINE, RPT = BAZI_REPORT;
  var PILLAR_NAME = ['年柱', '月柱', '日柱', '时柱'];
  var diskCtl = null;

  function wxSpan(wx, txt) { return '<span class="wx-' + wx + '">' + txt + '</span>'; }

  function render(A, chart, gender, birthYear) {
    document.getElementById('result').style.display = 'block';
    // 临界提示
    var ew = document.getElementById('edgeWarn');
    if (chart.edge) { ew.textContent = '⚠ ' + chart.edge + '，结果可能存在临界偏差'; ew.style.display = 'block'; }
    else ew.style.display = 'none';

    /* ---- 四柱表 ---- */
    var rows = ['<tr><th></th>' + PILLAR_NAME.map(function (n) { return '<th>' + n + '</th>'; }).join('') + '</tr>'];
    var ganRow = '<tr><td>天干</td>', zhiRow = '<tr><td>地支</td>', shenRow = '<tr><td>十神</td>',
        cangRow = '<tr><td>藏干</td>', adjRow = '<tr><td>单柱损益</td>';
    A.pillars.forEach(function (p, i) {
      var gwx = D.GAN_WX[p.g], zwx = D.ZHI_WX[p.z];
      ganRow += '<td class="gz">' + wxSpan(gwx, D.GAN[p.g]) + '</td>';
      zhiRow += '<td class="gz">' + wxSpan(zwx, D.ZHI[p.z]) + '</td>';
      shenRow += '<td class="shen">' + (i === 2 ? '日主（元）' : A.shiShenOf(p.g).name) + '<br>' +
                 A.shiShenOf(D.CANG_GAN[p.z][0][0]).name + '（本气）</td>';
      cangRow += '<td class="cang">' + D.CANG_GAN[p.z].map(function (cg) {
        return D.GAN[cg[0]] + A.shiShenOf(cg[0]).name + cg[1];
      }).join('<br>') + '</td>';
      var adj = D.PILLAR_ADJ[D.GAN[p.g] + D.ZHI[p.z]] || [0, 0];
      adjRow += '<td class="shen">干' + (adj[0] >= 0 ? '+' : '') + adj[0] + ' 支' + (adj[1] >= 0 ? '+' : '') + adj[1] + '</td>';
    });
    rows.push(ganRow + '</tr>', zhiRow + '</tr>', shenRow + '</tr>', cangRow + '</tr>', adjRow + '</tr>');
    document.getElementById('tblSizhu').innerHTML = rows.join('');
    document.getElementById('divTaiyuan').innerHTML =
      '胎元：<b>' + wxSpan(D.GAN_WX[A.taiyuan.g], D.GAN[A.taiyuan.g]) + wxSpan(D.ZHI_WX[A.taiyuan.z], D.ZHI[A.taiyuan.z]) + '</b>' +
      '（月柱干支各顺进一位，主先天禀赋）　　日主：' + D.GAN[A.dayGan] + D.WUXING[A.cls.dayWX] + '（' + (gender === 'male' ? '乾造' : '坤造') + '）';

    /* ---- 圆盘 ---- */
    if (diskCtl) diskCtl.redraw(); // 容器复用时先清
    diskCtl = BAZI_DISK.mount(document.getElementById('diskBox'), A);

    /* ---- 五行分值条 ---- */
    var bars = [], maxS = Math.max.apply(null, A.scores.concat([1]));
    A.scores.forEach(function (sc, w) {
      var pct = Math.min(100, sc / 544 * 100 * 2.5); // 视觉拉伸
      bars.push('<div class="bar-row"><span class="name">' + wxSpan(w, D.WUXING[w]) +
        (w === A.cls.dayWX ? '（日主）' : '') + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + D.WX_COLOR[w] + '"></div></div>' +
        '<span class="bar-val">' + sc.toFixed(1) + '分 · ' + A.cls.stages[w] + '</span></div>');
    });
    document.getElementById('scoreBars').innerHTML = bars.join('');
    document.getElementById('scoreDetail').innerHTML =
      '全局总分544，中和值≈109。干/支来源明细：' +
      A.scoreDetail.map(function (d) { return D.WUXING[d.wx] + '(干' + d.gan.toFixed(1) + '+支' + d.zhi.toFixed(1) + ')'; }).join('　') +
      (A.huaInfo.length ? '<br>合化：' + A.huaInfo.join('；') : '');

    /* ---- 定性 ---- */
    var c = A.cls, y = A.yongshen;
    document.getElementById('clsBox').innerHTML =
      '<span class="stage-tag">日主' + c.stage + '</span><span class="geju-tag">' + c.geju + '</span>' +
      (c.nearNeutral ? '<span class="geju-tag" style="background:#1a237e">接近中和</span>' : '') +
      '<p>日主' + D.GAN[A.dayGan] + D.WUXING[c.dayWX] + '，旺衰得分 <b>' + c.dayScore.toFixed(1) + '</b>。</p>' +
      '<p><span class="yong">用神：' + y.yong.map(function (w) { return D.WUXING[w]; }).join('、') + '</span>　' +
      '<span class="ji">忌神：' + y.ji.map(function (w) { return D.WUXING[w]; }).join('、') + '</span></p>' +
      '<p>' + y.note + '</p>' + (y.tiaohou ? '<p>' + y.tiaohou + '</p>' : '');

    /* ---- 刑冲合害 ---- */
    var rl = document.getElementById('relList');
    if (A.relations.length) {
      rl.innerHTML = A.relations.map(function (r) {
        var cls2 = r.type.indexOf('冲') >= 0 ? 'chong' : (r.type.indexOf('合') >= 0 ? 'he' : (r.type.indexOf('刑') >= 0 ? 'xing' : ''));
        return '<li class="' + cls2 + '">' + r.type + '：' + r.detail + '</li>';
      }).join('');
    } else rl.innerHTML = '<li class="empty">原局无明显刑冲合害</li>';

    /* ---- 神煞 ---- */
    var sl = document.getElementById('shaList');
    sl.innerHTML = A.shensha.length ? A.shensha.map(function (s) {
      return '<li class="sha">' + s.name + '（' + PILLAR_NAME[s.pillar] + D.ZHI[s.zhi] + '）</li>';
    }).join('') : '<li class="empty">无主要神煞</li>';

    /* ---- 大运 ---- */
    var dy = A.dayun;
    document.getElementById('dayunInfo').innerHTML =
      (dy.forward ? '阳年生' + (gender === 'male' ? '男' : '女') + '，顺排' : '阴年生' + (gender === 'male' ? '男' : '女') + '，逆排') +
      '；出生后' + dy.days.toFixed(1) + '天交节，3天折1岁，约 <b>' + dy.years.toFixed(1) + '岁</b>起运。';
    var dyRows = ['<tr><th>运序</th>' + dy.list.map(function (y2, i) { return '<th>' + (i + 1) + '运</th>'; }).join('') + '</tr>',
      '<tr><td>干支</td>' + dy.list.map(function (y2) {
        return '<td class="gz">' + wxSpan(D.GAN_WX[y2.g], D.GAN[y2.g]) + wxSpan(D.ZHI_WX[y2.z], D.ZHI[y2.z]) + '</td>';
      }).join('') + '</tr>',
      '<tr><td>十神</td>' + dy.list.map(function (y2) {
        return '<td>' + A.shiShenOf(y2.g).name + '</td>';
      }).join('') + '</tr>',
      '<tr><td>年龄</td>' + dy.list.map(function (y2) {
        return '<td>' + y2.ageStart.toFixed(0) + '~' + y2.ageEnd.toFixed(0) + '岁</td>';
      }).join('') + '</tr>',
      '<tr><td>喜忌</td>' + dy.list.map(function (y2) {
        var w = D.GAN_WX[y2.g];
        var t = y.yong.indexOf(w) >= 0 ? '喜' : (y.ji.indexOf(w) >= 0 ? '忌' : '平');
        return '<td class="' + (t === '喜' ? 'yong' : (t === '忌' ? 'ji' : '')) + '" style="' +
          (t === '喜' ? 'color:#00838f' : (t === '忌' ? 'color:#c62828' : 'color:#8d6e63')) + '">' + t + '</td>';
      }).join('') + '</tr>'];
    document.getElementById('tblDayun').innerHTML = dyRows.join('');

    /* ---- 家境 ---- */
    var fw = ENG.familyWealth(A);
    A.famWealth = fw;

    /* ---- 流年编年史 ---- */
    var maxAge = 80;
    var ln = ENG.liuNian(A, chart, maxAge, gender);
    // 生成编年史摘要短文（挑关键事件）
    var chronicleParts = [];
    ln.forEach(function (yr) {
      yr.predictions.forEach(function (p) {
        chronicleParts.push(yr.age + '岁' + p.desc);
      });
    });
    if (chronicleParts.length > 0) {
      var summary = chronicleParts.slice(0, 20).join('；');
      if (chronicleParts.length > 20) summary += '……（详见编年史表）';
      A.chronicle = '流年编年提要：' + summary + '。';
    }

    /* ---- 短文（含家境、编年史摘要） ---- */
    var rep = RPT.generate(A, gender);
    document.getElementById('reportBox').innerHTML = rep.paragraphs.map(function (p) { return '<p>' + p + '</p>'; }).join('');

    // 渲染家境
    document.getElementById('famBox').innerHTML =
      '<div class="fam-level">' + fw.level + '</div>' +
      '<p>' + fw.desc + '</p>';

    // 只显示有事件的年份
    var lnHtml = '<table class="liunian"><thead><tr>' +
      '<th>虚岁</th><th>公元</th><th>流年</th><th>十神</th><th>喜忌</th><th>大运</th><th>运喜忌</th><th>事件推断</th>' +
      '</tr></thead><tbody>';
    ln.forEach(function (yr) {
      if (yr.predictions.length === 0 && yr.events.length === 0) return;
      var gregYear = birthYear + yr.age - 1;
      var catIcons = { '灾':'⚠️', '财':'💰', '婚':'💕', '子':'👶', '学':'📖', '业':'📈', '贵':'👑', '吉':'✨', '凶':'❌' };
      var predStr = yr.predictions.map(function (p) {
        return '<span class="ln-cat ln-' + p.cat + '">' + (catIcons[p.cat] || '') + ' ' + p.desc + '</span>';
      }).join('<br>');
      var evtStr = yr.events.length > 0
        ? '<span class="ln-evt">' + yr.events.map(function (e) { return e.desc; }).join('；') + '</span>'
        : '';
      var fitCls = yr.fit === '喜' ? 'yong' : (yr.fit === '忌' ? 'ji' : '');
      var dyCls = yr.dyFit === '喜' ? 'yong' : (yr.dyFit === '忌' ? 'ji' : '');
      // 根据当年整体情况判定行背景色
      var cats = yr.predictions.map(function (p) { return p.cat; });
      var hasJi = cats.indexOf('吉') >= 0 || cats.indexOf('贵') >= 0;
      var hasXiong = cats.indexOf('凶') >= 0;
      var hasZai = cats.indexOf('灾') >= 0;
      var hasCai = cats.indexOf('财') >= 0;
      var hasYe = cats.indexOf('业') >= 0;
      var hasHun = cats.indexOf('婚') >= 0;
      var hasXue = cats.indexOf('学') >= 0;
      var rowCls = '';
      if (hasXiong || (hasZai && yr.fit === '忌')) rowCls = 'ln-row-danger';
      else if (hasCai && hasYe) rowCls = 'ln-row-gold';
      else if (hasCai) rowCls = 'ln-row-wealth';
      else if (hasYe) rowCls = 'ln-row-career';
      else if (hasHun) rowCls = 'ln-row-romance';
      else if (hasXue) rowCls = 'ln-row-study';
      else if (hasJi) rowCls = 'ln-row-lucky';
      else if (yr.fit === '忌') rowCls = 'ln-row-bad';
      else if (yr.fit === '喜') rowCls = 'ln-row-good';
      lnHtml += '<tr class="' + rowCls + '">' +
        '<td>' + yr.age + '</td>' +
        '<td>' + gregYear + '</td>' +
        '<td class="gz">' + wxSpan(D.GAN_WX[yr.g], yr.ganzhi) + '</td>' +
        '<td>' + yr.shen + '</td>' +
        '<td class="' + fitCls + '">' + yr.fit + '</td>' +
        '<td>' + (yr.dyGz || '—') + '</td>' +
        '<td class="' + dyCls + '">' + (yr.dyFit || '—') + '</td>' +
        '<td class="ln-pred">' + predStr + (evtStr ? '<br>' + evtStr : '') + '</td>' +
        '</tr>';
    });
    lnHtml += '</tbody></table>';
    document.getElementById('lnBox').innerHTML = lnHtml;
  }

  function calc() {
    var y = +document.getElementById('inY').value,
        m = +document.getElementById('inM').value,
        d = +document.getElementById('inD').value,
        hh = +document.getElementById('inH').value,
        mm = +document.getElementById('inMin').value;
    var gender = document.querySelector('input[name=gender]:checked').value;
    if (!y || !m || !d) { alert('请输入完整日期'); return; }
    var chart = CAL.siZhu(y, m, d, hh, mm);
    var A = ENG.analyze(chart, gender);
    render(A, chart, gender, y);
    document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('btnCalc').addEventListener('click', calc);
})();
