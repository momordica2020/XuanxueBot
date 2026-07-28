/* ============================================================
 * app.js — 页面装配：输入 → 排盘 → 圆盘 → 角色卡
 * ============================================================ */
(function () {
  var D = BAZI_DATA, CAL = BAZI_CALENDAR, ENG = BAZI_ENGINE;
  var PILLAR_NAME = ['年柱', '月柱', '日柱', '时柱'];
  var diskCtl = null;

  function wxSpan(wx, txt) { return '<span class="wx-' + wx + '">' + txt + '</span>'; }

  function render(A, chart, gender, birthYear) {
    document.getElementById('result').style.display = 'block';
    var ew = document.getElementById('edgeWarn');
    if (chart.edge) { ew.textContent = '⚠ ' + chart.edge + '，结果可能存在临界偏差'; ew.style.display = 'block'; }
    else ew.style.display = 'none';

    /* ---- 1. 基础排盘 ---- */
    var rows = ['<tr><th></th>' + PILLAR_NAME.map(function (n) { return '<th>' + n + '</th>'; }).join('') + '</tr>'];
    var ganRow = '<tr><td>天干</td>', zhiRow = '<tr><td>地支</td>', shenRow = '<tr><td>十神</td>',
        cangRow = '<tr><td>藏干</td>';
    A.pillars.forEach(function (p, i) {
      var gwx = D.GAN_WX[p.g], zwx = D.ZHI_WX[p.z];
      ganRow += '<td class="gz">' + wxSpan(gwx, D.GAN[p.g]) + '</td>';
      zhiRow += '<td class="gz">' + wxSpan(zwx, D.ZHI[p.z]) + '</td>';
      shenRow += '<td class="shen">' + (i === 2 ? '日主（元）' : A.shiShenOf(p.g).name) + '<br>' +
                 A.shiShenOf(D.CANG_GAN[p.z][0][0]).name + '（本气）</td>';
      cangRow += '<td class="cang">' + D.CANG_GAN[p.z].map(function (cg) {
        return D.GAN[cg[0]] + A.shiShenOf(cg[0]).name + cg[1];
      }).join('<br>') + '</td>';
    });
    rows.push(ganRow + '</tr>', zhiRow + '</tr>', shenRow + '</tr>', cangRow + '</tr>');
    document.getElementById('tblSizhu').innerHTML = rows.join('');
    document.getElementById('divTaiyuan').innerHTML =
      '胎元：<b>' + wxSpan(D.GAN_WX[A.taiyuan.g], D.GAN[A.taiyuan.g]) + wxSpan(D.ZHI_WX[A.taiyuan.z], D.ZHI[A.taiyuan.z]) + '</b>' +
      '　日主：' + D.GAN[A.dayGan] + D.WUXING[A.cls.dayWX] + '（' + (gender === 'male' ? '乾造' : '坤造') + '）　旺衰：' + A.cls.stage + '　格局：' + A.cls.geju;

    /* ---- 2. 圆盘 ---- */
    if (diskCtl) diskCtl.redraw();
    diskCtl = BAZI_DISK.mount(document.getElementById('diskBox'), A);

    /* ---- 3. 角色卡 ---- */
    var cc = ENG.charaCard(A, chart, gender, birthYear);
    renderCharaCard(cc);
  }

  function renderCharaCard(cc) {
    var html = '';

    // 辅助：命理备注折叠
    function note(noteText) {
      if (!noteText) return '';
      return '<details class="chara-note"><summary>命理依据</summary><span>' + noteText + '</span></details>';
    }

    // 基本信息
    html += '<div class="chara-section">';
    html += '<h3>基本信息</h3>';
    html += '<div class="chara-grid">';
    html += '<div class="chara-item"><span class="chara-label">性别</span><span class="chara-val">' + cc.basic.gender + '</span></div>';
    html += '<div class="chara-item"><span class="chara-label">生肖</span><span class="chara-val">' + cc.basic.shengxiao + '</span></div>';
    html += '<div class="chara-item chara-full"><span class="chara-label">性格底色</span><span class="chara-val">' + cc.basic.desc + '</span></div>';
    html += '</div>';
    html += note(cc.basic.note);
    html += '</div>';

    // 外貌体型
    html += '<div class="chara-section">';
    html += '<h3>外貌体型</h3>';
    html += '<div class="chara-grid">';
    html += '<div class="chara-item chara-full"><span class="chara-label">体型</span><span class="chara-val">' + cc.appearance.build + '</span></div>';
    html += '<div class="chara-item chara-full"><span class="chara-label">面型</span><span class="chara-val">' + cc.appearance.face + '</span></div>';
    html += '<div class="chara-item"><span class="chara-label">身高</span><span class="chara-val">' + cc.appearance.height + '</span></div>';
    html += '<div class="chara-item"><span class="chara-label">肤色</span><span class="chara-val">' + cc.appearance.skin + '</span></div>';
    html += '</div>';
    html += note(cc.appearance.note);
    html += '</div>';

    // 性格
    html += '<div class="chara-section">';
    html += '<h3>性格心性</h3>';
    html += '<p>' + cc.personality.desc + '</p>';
    html += note(cc.personality.note);
    html += '</div>';

    // 事业职业
    html += '<div class="chara-section">';
    html += '<h3>事业与职业</h3>';
    html += '<p>' + cc.career.desc + '</p>';
    html += note(cc.career.note);
    html += '</div>';

    // 配偶
    html += '<div class="chara-section">';
    html += '<h3>配偶情况</h3>';
    html += '<p><b>相貌：</b>' + cc.spouse.looks + '</p>';
    html += '<p><b>来源远近：</b>' + cc.spouse.distance + '</p>';
    html += '<p><b>年龄差距：</b>' + cc.spouse.ageGap + '</p>';
    html += '<p><b>感情状况：</b>' + cc.spouse.marriage + '</p>';
    html += note(cc.spouse.note);
    html += '</div>';

    // 家庭背景
    html += '<div class="chara-section">';
    html += '<h3>身世背景</h3>';
    html += '<p><b>家境：</b>' + cc.family.wealth + '</p>';
    html += '<p><b>父母感情：</b>' + cc.family.parentsRelation + '</p>';
    html += '<p><b>父亲健康：</b>' + cc.family.fatherHealth + '</p>';
    html += '<p><b>母亲健康：</b>' + cc.family.motherHealth + '</p>';
    html += note(cc.family.note);
    html += '</div>';

    // 子女
    html += '<div class="chara-section">';
    html += '<h3>子女情况</h3>';
    html += '<p>' + cc.children.desc + '</p>';
    html += note(cc.children.note);
    html += '</div>';

    // 健康
    html += '<div class="chara-section">';
    html += '<h3>健康与寿命</h3>';
    html += '<p><b>健康隐患：</b>' + cc.health.desc + '</p>';
    html += '<p><b>寿命提示：</b>' + cc.health.lifespan + '</p>';
    html += note(cc.health.note);
    html += '</div>';

    // 人生经历阶段
    html += '<div class="chara-section">';
    html += '<h3>人生经历阶段</h3>';
    cc.stages.forEach(function (st, idx) {
      html += '<div class="chara-stage">';
      html += '<h4>' + (idx + 1) + '. ' + st.title + '（' + st.from + '~' + st.to + '岁）</h4>';
      html += '<p>' + st.desc + '</p>';
      html += note(st.note);
      html += '</div>';
    });
    html += '</div>';

    // 缺失知识提示
    if (cc.missing && cc.missing.length) {
      html += '<div class="chara-section chara-missing">';
      html += '<h4>以下方面缺少专门知识，推断为粗略估计</h4>';
      html += '<ul>';
      cc.missing.forEach(function (m) { html += '<li>' + m + '</li>'; });
      html += '</ul></div>';
    }

    document.getElementById('charaBox').innerHTML = html;
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
