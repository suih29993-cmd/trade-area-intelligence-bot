/* District Health Studio - browser UI.
 * All rendering uses textContent/createElement; no HTML string injection.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'dhs_imports_v1';
  var state = {
    dataset: null,
    imported: {},
    selectedId: null,
    selectedAnalysis: null,
    compareIds: [],
    liveEnabled: false,
    mapDetailEl: null
  };

  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text != null) { node.textContent = text; }
    return node;
  }

  function svgEl(tag, className) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (className) { node.setAttribute('class', className); }
    return node;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function int(value) {
    return Math.round(value || 0).toLocaleString('en-US');
  }

  function pct(value) {
    return Math.round((value || 0) * 100) + '%';
  }

  function money(value) {
    return value == null ? '—' : Number(value).toFixed(1) + ' 元';
  }

  function safeId(value) {
    return String(value || '').replace(/[^a-z0-9-]/g, '-').slice(0, 48);
  }

  function notify(text, kind) {
    var toast = el('div', 'toast ' + (kind || 'info'), text);
    document.body.appendChild(toast);
    window.setTimeout(function () {
      if (toast.parentNode) { toast.parentNode.removeChild(toast); }
    }, 3600);
  }

  function fetchJSON(path, options) {
    return fetch(path, options || {}).then(function (response) {
      if (!response.ok) { throw new Error('HTTP ' + response.status); }
      return response.json();
    });
  }

  function allDistricts() {
    if (!state.dataset) { return []; }
    var list = state.dataset.districts.slice();
    Object.keys(state.imported).forEach(function (id) {
      if (state.imported[id]) { list.push(state.imported[id]); }
    });
    return list;
  }

  function findDistrict(value) {
    var query = String(value || '').trim().toLowerCase();
    if (!query) { return null; }
    var list = allDistricts();
    var exact = list.filter(function (district) {
      return district.id.toLowerCase() === query || district.name.toLowerCase() === query;
    })[0];
    if (exact) { return exact; }
    return list.filter(function (district) {
      return district.name.toLowerCase().indexOf(query) !== -1 ||
        district.shortName.toLowerCase().indexOf(query) !== -1;
    })[0] || null;
  }

  function readImported() {
    var result = {};
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { return result; }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') { return result; }
      Object.keys(parsed).slice(0, 3).forEach(function (id) {
        var district = parsed[id];
        var errors = HealthEngine.validateDistrict(district, HealthEngine.CHANNELS);
        if (!errors.length && district && district.id === id) { result[id] = district; }
      });
    } catch (error) {
      return {};
    }
    return result;
  }

  function saveImported() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.imported));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadDataset() {
    return fetchJSON('api/districts', { cache: 'no-store' }).then(function (dataset) {
      var errors = HealthEngine.validateDataset(dataset);
      if (errors.length) { throw new Error(errors[0]); }
      state.dataset = dataset;
      state.imported = readImported();
      $('datasetCount').textContent = dataset.districts.length + ' 个基础商圈';
      renderChips();
      renderCompareChips();
      var params = new URLSearchParams(window.location.search);
      var initial = params.get('district');
      if (initial && findDistrict(initial)) {
        selectDistrict(findDistrict(initial).id);
      } else {
        greet();
      }
      var compare = params.get('compare');
      if (compare) {
        state.compareIds = compare.split(',').map(function (item) { return item.trim(); })
          .filter(function (id) { return !!findDistrict(id); }).slice(0, 5);
        renderCompareChips();
        renderCompareSelected();
        if (state.compareIds.length >= 2) { renderComparePanel(); }
      }
      if (params.get('tab') === 'compare' || compare) {
        switchTab('compare');
      }
    }).catch(function () {
      clear($('dashboard'));
      var box = el('div', 'empty-state');
      box.appendChild(el('span', 'empty-icon', '!'));
      box.appendChild(el('h2', null, '无法加载合成数据'));
      box.appendChild(el('p', null, '请通过 scripts/run_demo.ps1 启动本地服务后访问页面，不要直接双击打开 index.html。'));
      $('dashboard').appendChild(box);
      notify('数据加载失败：请确认本地服务已启动。', 'error');
    });
  }

  function checkServer() {
    return fetchJSON('api/health', { cache: 'no-store' }).then(function (data) {
      var node = $('serverStatus');
      node.className = 'server-status online';
      clear(node);
      var dot = el('span', 'status-dot');
      dot.setAttribute('aria-hidden', 'true');
      node.appendChild(dot);
      node.appendChild(el('span', null, data.mode === 'demo' ? '服务在线 · 离线演示' : '服务在线'));
      return data;
    }).catch(function () {
      var node = $('serverStatus');
      node.className = 'server-status offline';
      clear(node);
      var dot = el('span', 'status-dot');
      dot.setAttribute('aria-hidden', 'true');
      node.appendChild(dot);
      node.appendChild(el('span', null, '服务未连接'));
      return null;
    });
  }

  function checkLiveStatus() {
    return fetchJSON('api/config', { cache: 'no-store' }).then(function (data) {
      state.liveEnabled = !!data.liveAIEnabled;
      var box = $('liveStatus');
      box.className = 'status-box' + (state.liveEnabled ? ' on' : '');
      box.textContent = state.liveEnabled
        ? '服务端已显式启用实时 AI。对话会调用你自己配置的兼容接口；失败时自动回退本地规则引擎。'
        : '实时 AI 未启用。当前对话完全由浏览器内的本地规则引擎生成。';
    }).catch(function () {
      state.liveEnabled = false;
      var box = $('liveStatus');
      box.className = 'status-box';
      box.textContent = '无法读取服务端配置，已保持本地演示模式。';
    });
  }

  function renderChips() {
    var box = $('districtChips');
    clear(box);
    allDistricts().forEach(function (district) {
      var chip = el('button', 'chip' + (state.selectedId === district.id ? ' sel' : ''), district.name);
      chip.type = 'button';
      chip.addEventListener('click', function () { selectDistrict(district.id); });
      box.appendChild(chip);
    });
  }

  function selectDistrict(id) {
    var district = allDistricts().filter(function (item) { return item.id === id; })[0];
    if (!district) {
      notify('未找到这个虚构商圈。', 'error');
      return;
    }
    state.selectedId = id;
    state.selectedAnalysis = HealthEngine.analyzeDistrict(district);
    renderChips();
    renderDashboard(district, state.selectedAnalysis);
    resetChat(district);
    switchTab('dash');
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.view').forEach(function (view) {
      view.classList.toggle('active', view.id === 'view-' + name);
    });
    if (name === 'compare') {
      renderCompareChips();
      renderCompareSelected();
      if (state.compareIds.length >= 2) { renderComparePanel(); }
    }
  }

  function renderDashboard(district, analysis) {
    var dash = $('dashboard');
    clear(dash);
    dash.appendChild(overviewCard(district, analysis));
    dash.appendChild(mapCard(district, analysis));
    dash.appendChild(focusCard(district, analysis));
    dash.appendChild(competitorCard(district, analysis));
    dash.appendChild(suggestionsCard(district, analysis));
  }

  function gauge(score) {
    var svg = svgEl('svg', 'gauge');
    svg.setAttribute('viewBox', '0 0 90 90');
    var radius = 34;
    var circumference = 2 * Math.PI * radius;
    var bg = svgEl('circle', 'gauge-bg');
    bg.setAttribute('cx', '45'); bg.setAttribute('cy', '45'); bg.setAttribute('r', String(radius));
    svg.appendChild(bg);
    var value = svgEl('circle', 'gauge-val');
    value.setAttribute('cx', '45'); value.setAttribute('cy', '45'); value.setAttribute('r', String(radius));
    value.setAttribute('transform', 'rotate(-90 45 45)');
    value.setAttribute('stroke-dasharray', circumference.toFixed(1));
    value.setAttribute('stroke-dashoffset', (circumference * (1 - score / 100)).toFixed(1));
    svg.appendChild(value);
    var number = svgEl('text', 'gauge-num');
    number.setAttribute('x', '45'); number.setAttribute('y', '43'); number.setAttribute('text-anchor', 'middle');
    number.textContent = String(score);
    svg.appendChild(number);
    var caption = svgEl('text', 'gauge-cap');
    caption.setAttribute('x', '45'); caption.setAttribute('y', '58'); caption.setAttribute('text-anchor', 'middle');
    caption.textContent = '健康度';
    svg.appendChild(caption);
    return svg;
  }

  function metric(value, label) {
    var box = el('div', 'metric');
    box.appendChild(el('div', 'metric-value', value));
    box.appendChild(el('div', 'metric-label', label));
    return box;
  }

  function dimensionRow(label, score) {
    var row = el('div', 'dimension-row');
    row.appendChild(el('span', null, label));
    var bar = svgEl('svg', 'bar-svg');
    bar.setAttribute('viewBox', '0 0 100 6');
    bar.setAttribute('preserveAspectRatio', 'none');
    var bg = svgEl('rect', 'bar-bg');
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0'); bg.setAttribute('width', '100');
    bg.setAttribute('height', '6'); bg.setAttribute('rx', '3');
    bar.appendChild(bg);
    var fill = svgEl('rect', 'bar-fill');
    fill.setAttribute('x', '0'); fill.setAttribute('y', '0'); fill.setAttribute('width', String(Math.max(2, score)));
    fill.setAttribute('height', '6'); fill.setAttribute('rx', '3');
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('span', 'dimension-score', String(score)));
    return row;
  }

  function overviewCard(district, analysis) {
    var card = el('section', 'dash-card');
    var head = el('h3', null, '商圈总览');
    head.appendChild(el('span', 'tag', analysis.synthetic ? '合成数据' : '导入数据'));
    card.appendChild(head);
    var overview = el('div', 'overview');
    overview.appendChild(gauge(analysis.health));
    var info = el('div');
    info.appendChild(el('h3', null, district.name));
    info.appendChild(el('p', 'desc', district.description));
    var tags = el('div', 'tag-row');
    tags.appendChild(el('span', null, '焦点门店 ' + analysis.focus.total + ' 家'));
    tags.appendChild(el('span', null, '核心圈 ' + analysis.focus.core + ' 家'));
    tags.appendChild(el('span', null, '竞品 ' + analysis.competitors.total + ' 家'));
    tags.appendChild(el('span', null, '竞品品牌 ' + analysis.competitors.brandCount + ' 个'));
    info.appendChild(tags);
    var health = el('div', 'health-line');
    health.appendChild(document.createTextNode('综合健康度 '));
    health.appendChild(el('b', null, analysis.health + '/100'));
    health.appendChild(document.createTextNode(' · ' + analysis.healthLabel));
    info.appendChild(health);
    overview.appendChild(info);
    card.appendChild(overview);

    var metrics = el('div', 'metric-grid');
    metrics.appendChild(metric(int(analysis.focus.orders), '焦点月售'));
    metrics.appendChild(metric(pct(analysis.market.focusShare), '模拟份额'));
    metrics.appendChild(metric(money(analysis.signals.focusAvgFee), '平均配送费'));
    metrics.appendChild(metric(analysis.signals.focusPromoCoverage + '%', '活动覆盖'));
    card.appendChild(metrics);

    var dims = el('div', 'dimension-list');
    dims.appendChild(dimensionRow('门店覆盖', analysis.dimensions.coverage));
    dims.appendChild(dimensionRow('低竞对压力', analysis.dimensions.competition));
    dims.appendChild(dimensionRow('活动力度', analysis.dimensions.promotion));
    dims.appendChild(dimensionRow('销售体量', analysis.dimensions.sales));
    dims.appendChild(dimensionRow('配送体验', analysis.dimensions.delivery));
    card.appendChild(dims);
    return card;
  }

  function mapPoint(store) {
    return { x: 320 + store.x * 52, y: 210 - store.y * 52 };
  }

  function mapCard(district, analysis) {
    var card = el('section', 'dash-card');
    var head = el('h3', null, '虚构商圈地图');
    head.appendChild(el('span', 'tag', '3 km 覆盖圈'));
    card.appendChild(head);
    var shell = el('div', 'map-shell');
    var svg = svgEl('svg', 'map-svg');
    svg.setAttribute('viewBox', '0 0 640 420');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', district.name + ' 合成地图');
    svg.id = 'mapBox';

    var background = svgEl('rect');
    background.setAttribute('x', '0'); background.setAttribute('y', '0');
    background.setAttribute('width', '640'); background.setAttribute('height', '420');
    background.setAttribute('fill', '#fbfbfc');
    svg.appendChild(background);

    for (var x = 40; x < 640; x += 40) {
      var vline = svgEl('line', 'map-grid');
      vline.setAttribute('x1', String(x)); vline.setAttribute('x2', String(x));
      vline.setAttribute('y1', '20'); vline.setAttribute('y2', '400');
      svg.appendChild(vline);
    }
    for (var y = 20; y <= 420; y += 40) {
      var hline = svgEl('line', 'map-grid');
      hline.setAttribute('x1', '20'); hline.setAttribute('x2', '620');
      hline.setAttribute('y1', String(y)); hline.setAttribute('y2', String(y));
      svg.appendChild(hline);
    }

    var ring = svgEl('circle', 'map-ring');
    ring.setAttribute('cx', '320'); ring.setAttribute('cy', '210'); ring.setAttribute('r', '156');
    svg.appendChild(ring);
    var crossH = svgEl('line', 'map-cross');
    crossH.setAttribute('x1', '164'); crossH.setAttribute('x2', '476');
    crossH.setAttribute('y1', '210'); crossH.setAttribute('y2', '210');
    svg.appendChild(crossH);
    var crossV = svgEl('line', 'map-cross');
    crossV.setAttribute('x1', '320'); crossV.setAttribute('x2', '320');
    crossV.setAttribute('y1', '54'); crossV.setAttribute('y2', '366');
    svg.appendChild(crossV);

    var center = svgEl('circle', 'map-center');
    center.setAttribute('cx', '320'); center.setAttribute('cy', '210'); center.setAttribute('r', '5');
    svg.appendChild(center);

    analysis.focus.stores.concat(analysis.competitors.stores).forEach(function (store) {
      var point = mapPoint(store);
      var dot = svgEl('circle', 'map-store ' + store.role);
      dot.setAttribute('cx', point.x.toFixed(1));
      dot.setAttribute('cy', point.y.toFixed(1));
      dot.setAttribute('r', store.role === 'focus' ? '6' : '5');
      dot.setAttribute('data-store-id', store.id);
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('role', 'button');
      dot.setAttribute('aria-label', store.name);
      var title = svgEl('title');
      title.textContent = store.name + ' · ' + int(store.monthlyOrders) + ' 单（模拟）';
      dot.appendChild(title);
      svg.appendChild(dot);
    });

    function mapText(x, y, text, className, anchor) {
      var node = svgEl('text', className);
      node.setAttribute('x', String(x)); node.setAttribute('y', String(y));
      if (anchor) { node.setAttribute('text-anchor', anchor); }
      node.textContent = text;
      return node;
    }
    svg.appendChild(mapText(320, 16, 'N', 'map-label', 'middle'));
    svg.appendChild(mapText(486, 208, '3 km', 'map-label', 'start'));
    svg.appendChild(mapText(320, 405, 'SYNTHETIC MAP · LOCAL COORDINATES', 'map-watermark', 'middle'));
    shell.appendChild(svg);
    card.appendChild(shell);

    var legend = el('div', 'map-legend');
    var l1 = el('span'); l1.appendChild(el('i', 'legend-dot')); l1.appendChild(document.createTextNode('焦点品牌门店'));
    var l2 = el('span'); l2.appendChild(el('i', 'legend-dot comp')); l2.appendChild(document.createTextNode('竞品门店'));
    var l3 = el('span'); l3.appendChild(el('i', 'legend-dot center')); l3.appendChild(document.createTextNode('商圈中心'));
    legend.appendChild(l1); legend.appendChild(l2); legend.appendChild(l3);
    card.appendChild(legend);

    state.mapDetailEl = el('div', 'store-detail', '点击地图点位或门店列表，查看单店模拟详情。');
    card.appendChild(state.mapDetailEl);

    function showStore(store) {
      clear(state.mapDetailEl);
      state.mapDetailEl.appendChild(el('b', null, store.name));
      state.mapDetailEl.appendChild(el('div', null, '角色：' + (store.role === 'focus' ? '焦点品牌' : '竞品') +
        ' · 距离中心 ' + store.distanceKm.toFixed(2) + ' km · 模拟月售 ' + int(store.monthlyOrders) + ' 单'));
      state.mapDetailEl.appendChild(el('div', null, store.address));
      HealthEngine.CHANNELS.forEach(function (channel) {
        var info = store.channels[channel];
        state.mapDetailEl.appendChild(el('div', null, channel + '：配送费 ' + money(info.deliveryFee) +
          ' · ' + info.promotionLabel + ' · 红包 ' + info.couponValue + ' 元'));
      });
    }

    svg.addEventListener('click', function (event) {
      var target = event.target.closest('.map-store');
      if (!target) { return; }
      var id = target.getAttribute('data-store-id');
      var store = analysis.focus.stores.concat(analysis.competitors.stores).filter(function (item) {
        return item.id === id;
      })[0];
      if (!store) { return; }
      svg.querySelectorAll('.map-store').forEach(function (node) { node.classList.remove('selected'); });
      target.classList.add('selected');
      showStore(store);
    });
    svg.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    return card;
  }

  function storeRows(stores, onSelect) {
    var list = el('div', 'store-list');
    if (!stores.length) {
      list.appendChild(el('div', 'muted small', '暂无门店'));
      return list;
    }
    stores.forEach(function (store) {
      var row = el('div', 'store-row');
      row.appendChild(el('i', 'store-dot'));
      var mid = el('div');
      mid.appendChild(el('div', 'store-name', store.name));
      var fee = store.channels[HealthEngine.CHANNELS[0]].deliveryFee;
      var promo = store.channels[HealthEngine.CHANNELS[0]].promotionPct;
      mid.appendChild(el('div', 'store-sub', '模拟月售 ' + int(store.monthlyOrders) + ' 单 · 配送费 ' +
        money(fee) + ' · 活动深度 ' + promo + '%'));
      row.appendChild(mid);
      row.addEventListener('click', function () { onSelect(store); });
      list.appendChild(row);
    });
    return list;
  }

  function focusCard(district, analysis) {
    var card = el('section', 'dash-card');
    var head = el('h3', null, '焦点品牌门店');
    head.appendChild(el('span', 'tag', '核心圈 ≤1 km / 3 km'));
    card.appendChild(head);
    var metrics = el('div', 'metric-grid');
    metrics.appendChild(metric(analysis.focus.core + ' / ' + analysis.focus.total, '核心 / 总计'));
    metrics.appendChild(metric(int(analysis.focus.orders), '模拟月售'));
    metrics.appendChild(metric(money(analysis.signals.focusAvgFee), '平均配送费'));
    metrics.appendChild(metric(analysis.signals.focusPromoCoverage + '%', '活动覆盖'));
    card.appendChild(metrics);
    card.appendChild(el('div', 'sub-head', '核心圈（≤1 km）· ' + analysis.focus.core + ' 家'));
    card.appendChild(storeRows(analysis.focus.coreStores, highlightStore));
    card.appendChild(el('div', 'sub-head', '外围（1–3 km）· ' + analysis.focus.ring + ' 家'));
    card.appendChild(storeRows(analysis.focus.ringStores, highlightStore));
    return card;
  }

  function highlightStore(store) {
    var svg = $('mapBox');
    if (!svg) { return; }
    var target = null;
    svg.querySelectorAll('.map-store').forEach(function (node) {
      node.classList.remove('selected');
      if (node.getAttribute('data-store-id') === store.id) { target = node; }
    });
    if (target) {
      target.classList.add('selected');
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }

  function pressureLabel(item) {
    if (item.count >= 3 || item.avgOrders >= 700) { return '高'; }
    if (item.count >= 2 || item.avgOrders >= 500) { return '中'; }
    return '低';
  }

  function competitorCard(district, analysis) {
    var card = el('section', 'dash-card');
    var head = el('h3', null, '竞品结构');
    head.appendChild(el('span', 'tag', '3 km 内'));
    card.appendChild(head);
    var metrics = el('div', 'metric-grid');
    metrics.appendChild(metric(String(analysis.competitors.total), '竞品门店'));
    metrics.appendChild(metric(String(analysis.competitors.brandCount), '竞品品牌'));
    metrics.appendChild(metric(int(analysis.competitors.orders), '竞品月售'));
    metrics.appendChild(metric(money(analysis.signals.competitorAvgFee), '平均配送费'));
    card.appendChild(metrics);

    card.appendChild(el('div', 'sub-head', '品牌模拟月售'));
    var bars = el('div', 'brand-bars');
    var maxOrders = 1;
    analysis.competitors.brands.forEach(function (item) { maxOrders = Math.max(maxOrders, item.orders); });
    analysis.competitors.brands.forEach(function (item) {
      var row = el('div', 'brand-bar-row');
      row.appendChild(el('span', 'name', item.brand));
      var bar = svgEl('svg', 'bar-svg');
      bar.setAttribute('viewBox', '0 0 100 8');
      bar.setAttribute('preserveAspectRatio', 'none');
      var bg = svgEl('rect', 'bar-bg');
      bg.setAttribute('x', '0'); bg.setAttribute('y', '0'); bg.setAttribute('width', '100');
      bg.setAttribute('height', '8'); bg.setAttribute('rx', '4');
      bar.appendChild(bg);
      var fill = svgEl('rect', 'bar-fill');
      fill.setAttribute('x', '0'); fill.setAttribute('y', '0');
      fill.setAttribute('width', String(Math.max(2, item.orders / maxOrders * 100)));
      fill.setAttribute('height', '8'); fill.setAttribute('rx', '4');
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el('span', 'value', int(item.orders)));
      bars.appendChild(row);
    });
    card.appendChild(bars);

    card.appendChild(el('div', 'sub-head', '竞品门店明细（模拟）'));
    var wrap = el('div', 'table-wrap');
    var table = el('table', 'data-table');
    var thead = el('thead');
    var headRow = el('tr');
    ['品牌', '门店', '模拟月售', '活动覆盖', '压力'].forEach(function (label, index) {
      var th = el('th', index === 0 ? 'left' : null, label);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = el('tbody');
    analysis.competitors.brands.forEach(function (item) {
      var brandStores = analysis.competitors.stores.filter(function (store) { return store.brand === item.brand; });
      var promoCount = brandStores.filter(function (store) {
        return HealthEngine.CHANNELS.some(function (channel) {
          return store.channels[channel].promotionPct > 0;
        });
      }).length;
      var tr = el('tr');
      tr.appendChild(el('td', 'left', item.brand));
      tr.appendChild(el('td', null, String(item.count)));
      tr.appendChild(el('td', null, int(item.orders)));
      tr.appendChild(el('td', null, Math.round(promoCount / brandStores.length * 100) + '%'));
      tr.appendChild(el('td', null, pressureLabel(item)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    card.appendChild(wrap);
    return card;
  }

  function suggestionsCard(district, analysis) {
    var card = el('section', 'dash-card span-2');
    var head = el('h3', null, '可执行建议');
    head.appendChild(el('span', 'tag', '规则引擎输出'));
    card.appendChild(head);
    var list = HealthAdvisor.buildRecommendations(analysis);
    list.forEach(function (item) {
      var row = el('div', 'suggestion');
      var label = item.priority === 'high' ? '高优' : item.priority === 'medium' ? '中优' : '低';
      row.appendChild(el('span', 'priority ' + item.priority, label));
      var body = el('div');
      body.appendChild(el('b', null, item.title));
      body.appendChild(el('span', null, item.detail));
      row.appendChild(body);
      card.appendChild(row);
    });
    card.appendChild(el('div', 'disclaimer', HealthAdvisor.DISCLAIMER));
    return card;
  }

  function addMessage(role, node) {
    var wrap = el('div', 'msg ' + role);
    var bubble = el('div', 'bubble');
    bubble.appendChild(node);
    wrap.appendChild(bubble);
    $('chatMsgs').appendChild(wrap);
    $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
  }

  function addBotText(text) {
    addMessage('bot', el('div', 'txt', text));
  }

  function addUserText(text) {
    addMessage('user', el('div', 'txt', text));
  }

  function addTyping() {
    var message = el('div', 'msg bot');
    var bubble = el('div', 'bubble');
    bubble.appendChild(el('div', 'txt', '本地规则引擎计算中…'));
    message.appendChild(bubble);
    $('chatMsgs').appendChild(message);
    $('chatMsgs').scrollTop = $('chatMsgs').scrollHeight;
    return message;
  }

  function greet() {
    resetChat(null);
  }

  function resetChat(district) {
    var box = $('chatMsgs');
    clear(box);
    addBotText('你好，我是本地诊断助手。所有分析都基于合成数据，不会访问外部地图、搜索或 AI 服务。');
    var quick = el('div', 'advice-block');
    quick.appendChild(el('h4', null, '可以这样问'));
    var list = el('div', 'quick-questions');
    ['这个商圈竞争激烈吗？', '活动力度够不够？', '门店覆盖有什么缺口？', '配送费是否偏高？'].forEach(function (question) {
      var button = el('button', 'chip', question);
      button.type = 'button';
      button.addEventListener('click', function () { ask(question); });
      list.appendChild(button);
    });
    quick.appendChild(list);
    addMessage('bot', quick);
    if (!district) {
      addBotText('请先选择或搜索一个虚构商圈，然后我会给出结构化诊断。');
    }
  }

  function ask(message) {
    var text = String(message || '').trim();
    if (!text) { return; }
    if (!state.selectedId) {
      addBotText('请先选择或搜索一个虚构商圈。');
      return;
    }
    addUserText(text);
    var typing = addTyping();
    window.setTimeout(function () {
      if (typing.parentNode) { typing.parentNode.removeChild(typing); }
      var district = allDistricts().filter(function (item) { return item.id === state.selectedId; })[0];
      if (!district) { return; }
      var analysis = HealthEngine.analyzeDistrict(district);
      if (state.liveEnabled && !district.imported) {
        fetchJSON('api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, districtId: district.id })
        }).then(function (data) {
          if (!data.ok || !data.reply) { throw new Error('live unavailable'); }
          addBotText(data.reply);
          addBotText('实时 AI 回复已返回。若需完全离线，请在服务端关闭实时模式。');
        }).catch(function () {
          renderAdvice(HealthAdvisor.buildAdvice(district, analysis, text), '实时 AI 不可用，已回退到本地规则引擎。');
        });
      } else {
        renderAdvice(HealthAdvisor.buildAdvice(district, analysis, text));
      }
    }, 240);
  }

  function adviceBlock(title, items) {
    var block = el('div', 'advice-block');
    block.appendChild(el('h4', null, title));
    if (typeof items === 'string') {
      block.appendChild(el('p', null, items));
    } else {
      var list = el('ul');
      items.forEach(function (item) { list.appendChild(el('li', null, item)); });
      block.appendChild(list);
    }
    return block;
  }

  function renderAdvice(advice, prefix) {
    var bubble = el('div');
    if (prefix) { bubble.appendChild(el('div', 'txt', prefix)); }
    bubble.appendChild(el('div', 'txt', advice.summary));
    bubble.appendChild(adviceBlock('证据 / Evidence', advice.evidence));
    bubble.appendChild(adviceBlock('风险 / Risks', advice.risks));
    var recBlock = el('div', 'advice-block');
    recBlock.appendChild(el('h4', null, '建议 / Recommended actions'));
    advice.recommendations.forEach(function (item) {
      var rec = el('div', 'recommendation');
      var priority = item.priority === 'high' ? '高优' : item.priority === 'medium' ? '中优' : '低';
      rec.appendChild(el('b', null, '[' + priority + '] ' + item.title));
      rec.appendChild(el('span', null, item.detail));
      recBlock.appendChild(rec);
    });
    bubble.appendChild(recBlock);
    bubble.appendChild(el('div', 'disclaimer', advice.disclaimer));
    addMessage('bot', bubble);
  }

  function renderCompareChips() {
    var box = $('cmpChips');
    clear(box);
    allDistricts().forEach(function (district) {
      var selected = state.compareIds.indexOf(district.id) !== -1;
      var chip = el('button', 'chip' + (selected ? ' sel' : ''), district.name);
      chip.type = 'button';
      chip.addEventListener('click', function () { toggleCompare(district.id); });
      box.appendChild(chip);
    });
  }

  function renderCompareSelected() {
    var box = $('cmpSelected');
    clear(box);
    state.compareIds.forEach(function (id) {
      var district = allDistricts().filter(function (item) { return item.id === id; })[0];
      if (!district) { return; }
      var chip = el('span', 'sel-chip', district.name);
      var remove = el('button', null, '✕');
      remove.type = 'button';
      remove.setAttribute('aria-label', '移除 ' + district.name);
      remove.addEventListener('click', function () {
        state.compareIds = state.compareIds.filter(function (item) { return item !== id; });
        renderCompareChips();
        renderCompareSelected();
        if (state.compareIds.length >= 2) { renderComparePanel(); }
      });
      chip.appendChild(remove);
      box.appendChild(chip);
    });
  }

  function toggleCompare(id) {
    var index = state.compareIds.indexOf(id);
    if (index !== -1) {
      state.compareIds.splice(index, 1);
    } else {
      if (state.compareIds.length >= 5) {
        notify('最多对比 5 个商圈。', 'error');
        return;
      }
      state.compareIds.push(id);
    }
    renderCompareChips();
    renderCompareSelected();
    if (state.compareIds.length >= 2) { renderComparePanel(); }
  }

  function renderComparePanel() {
    var panel = $('comparePanel');
    clear(panel);
    if (state.compareIds.length < 2) {
      var empty = el('div', 'empty-state');
      empty.appendChild(el('span', 'empty-icon', '▦'));
      empty.appendChild(el('h2', null, '至少选择 2 个商圈'));
      empty.appendChild(el('p', null, '最多选择 5 个虚构商圈进行对比。'));
      panel.appendChild(empty);
      return;
    }
    var comparison = HealthEngine.compareDistricts(state.dataset, state.compareIds);
    panel.appendChild(compareConclusion(comparison));
    panel.appendChild(compareTable(comparison));
    panel.appendChild(compareRadar(comparison));
    panel.appendChild(compareVolume(comparison));
    panel.appendChild(compareCards(comparison));
  }

  function nameOf(comparison, id) {
    var item = comparison.items.filter(function (entry) { return entry.districtId === id; })[0];
    return item ? item.districtName : '—';
  }

  function compareConclusion(comparison) {
    var card = el('section', 'dash-card span-2');
    card.appendChild(el('h3', null, '对比结论'));
    var text = el('div', 'conclusion');
    var top = comparison.items[0];
    text.appendChild(el('b', null, '健康度最高：' + top.districtName + '（' + top.health + '/100）'));
    text.appendChild(document.createTextNode('。'));
    if (comparison.best.coverage) {
      text.appendChild(document.createTextNode('覆盖最好的是 ' + nameOf(comparison, comparison.best.coverage.id) +
        '（' + comparison.best.coverage.value + ' 分）；'));
    }
    if (comparison.best.competition) {
      text.appendChild(document.createTextNode('竞对压力最低的是 ' + nameOf(comparison, comparison.best.competition.id) +
        '（' + comparison.best.competition.value + ' 分）；'));
    }
    text.appendChild(document.createTextNode('以上排序只反映合成数据的相对关系，不能替代真实市场调研。'));
    card.appendChild(text);
    return card;
  }

  function compareTable(comparison) {
    var card = el('section', 'dash-card span-2');
    card.appendChild(el('h3', null, '对比总览'));
    var wrap = el('div', 'table-wrap');
    var table = el('table', 'data-table');
    var thead = el('thead');
    var headRow = el('tr');
    headRow.appendChild(el('th', 'left', '指标'));
    comparison.items.forEach(function (item) {
      var th = el('th');
      var button = el('button', 'link-button', item.districtName);
      button.type = 'button';
      button.addEventListener('click', function () { selectDistrict(item.districtId); });
      th.appendChild(button);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = el('tbody');

    function row(label, getter, bestId, formatter) {
      var tr = el('tr');
      tr.appendChild(el('td', 'left', label));
      comparison.items.forEach(function (item) {
        var td = el('td', item.districtId === bestId ? 'best' : null, formatter(getter(item)));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }

    row('健康度', function (item) { return item.health; }, comparison.best.health && comparison.best.health.id, function (value) { return String(value); });
    row('门店覆盖', function (item) { return item.dimensions.coverage; }, comparison.best.coverage && comparison.best.coverage.id, function (value) { return String(value); });
    row('低竞对压力', function (item) { return item.dimensions.competition; }, comparison.best.competition && comparison.best.competition.id, function (value) { return String(value); });
    row('活动力度', function (item) { return item.dimensions.promotion; }, comparison.best.promotion && comparison.best.promotion.id, function (value) { return String(value); });
    row('销售体量', function (item) { return item.dimensions.sales; }, comparison.best.sales && comparison.best.sales.id, function (value) { return String(value); });
    row('配送体验', function (item) { return item.dimensions.delivery; }, comparison.best.delivery && comparison.best.delivery.id, function (value) { return String(value); });
    row('模拟份额', function (item) { return item.market.focusShare; }, comparison.best.focusShare && comparison.best.focusShare.id, function (value) { return pct(value); });
    row('焦点平均配送费', function (item) { return item.signals.focusAvgFee; }, comparison.best.focusFee && comparison.best.focusFee.id, function (value) { return money(value); });
    table.appendChild(tbody);
    wrap.appendChild(table);
    card.appendChild(wrap);
    return card;
  }

  function compareRadar(comparison) {
    var card = el('section', 'dash-card');
    card.appendChild(el('h3', null, '健康度雷达'));
    var dims = [
      ['健康度', function (item) { return item.health; }],
      ['覆盖', function (item) { return item.dimensions.coverage; }],
      ['低竞对压力', function (item) { return item.dimensions.competition; }],
      ['活动', function (item) { return item.dimensions.promotion; }],
      ['销售', function (item) { return item.dimensions.sales; }],
      ['配送', function (item) { return item.dimensions.delivery; }]
    ];
    var width = 420, height = 340, cx = 210, cy = 165, radius = 116;
    var svg = svgEl('svg', 'radar');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    function point(index, value) {
      var angle = -Math.PI / 2 + index * 2 * Math.PI / dims.length;
      var r = radius * value / 100;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    }
    [25, 50, 75, 100].forEach(function (level) {
      var ring = svgEl('polygon', 'radar-ring');
      var points = dims.map(function (_, index) { return point(index, level).join(','); }).join(' ');
      ring.setAttribute('points', points);
      svg.appendChild(ring);
    });
    dims.forEach(function (dim, index) {
      var axis = svgEl('line', 'radar-axis');
      var end = point(index, 100);
      axis.setAttribute('x1', String(cx)); axis.setAttribute('y1', String(cy));
      axis.setAttribute('x2', String(end[0])); axis.setAttribute('y2', String(end[1]));
      svg.appendChild(axis);
      var labelPoint = point(index, 122);
      var label = svgEl('text', 'radar-label');
      label.setAttribute('x', String(labelPoint[0]));
      label.setAttribute('y', String(labelPoint[1]));
      label.setAttribute('text-anchor', 'middle');
      label.textContent = dim[0];
      svg.appendChild(label);
    });
    comparison.items.forEach(function (item, seriesIndex) {
      var polygon = svgEl('polygon', 'radar-series s' + (seriesIndex % 5));
      var points = dims.map(function (dim, index) { return point(index, dim[1](item)).join(','); }).join(' ');
      polygon.setAttribute('points', points);
      svg.appendChild(polygon);
    });
    var wrap = el('div', 'radar-wrap');
    wrap.appendChild(svg);
    card.appendChild(wrap);
    var legend = el('div', 'map-legend');
    comparison.items.forEach(function (item, index) {
      var span = el('span');
      span.appendChild(el('i', 'series-dot s' + (index % 5)));
      span.appendChild(document.createTextNode(item.districtName));
      legend.appendChild(span);
    });
    card.appendChild(legend);
    return card;
  }

  function compareVolume(comparison) {
    var card = el('section', 'dash-card');
    card.appendChild(el('h3', null, '模拟订单体量'));
    var width = 520, rowHeight = 34, top = 24;
    var height = top + comparison.items.length * rowHeight + 8;
    var svg = svgEl('svg', 'radar');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    var max = 1;
    comparison.items.forEach(function (item) {
      max = Math.max(max, item.focus.orders, item.competitors.orders);
    });
    comparison.items.forEach(function (item, index) {
      var y = top + index * rowHeight;
      var label = svgEl('text', 'radar-label');
      label.setAttribute('x', '4'); label.setAttribute('y', String(y + 8));
      label.textContent = item.districtName;
      svg.appendChild(label);
      var focusWidth = Math.max(2, item.focus.orders / max * 260);
      var compWidth = Math.max(2, item.competitors.orders / max * 260);
      var focusBar = svgEl('rect', 'volume-focus');
      focusBar.setAttribute('x', '150'); focusBar.setAttribute('y', String(y));
      focusBar.setAttribute('width', String(focusWidth)); focusBar.setAttribute('height', '8');
      focusBar.setAttribute('rx', '4');
      svg.appendChild(focusBar);
      var compBar = svgEl('rect', 'volume-comp');
      compBar.setAttribute('x', '150'); compBar.setAttribute('y', String(y + 12));
      compBar.setAttribute('width', String(compWidth)); compBar.setAttribute('height', '8');
      compBar.setAttribute('rx', '4');
      svg.appendChild(compBar);
      var value = svgEl('text', 'radar-label');
      value.setAttribute('x', '420'); value.setAttribute('y', String(y + 8));
      value.textContent = int(item.focus.orders) + ' / ' + int(item.competitors.orders);
      svg.appendChild(value);
    });
    card.appendChild(svg);
    var legend = el('div', 'map-legend');
    var focus = el('span'); focus.appendChild(el('i', 'legend-dot')); focus.appendChild(document.createTextNode('焦点品牌'));
    var comp = el('span'); comp.appendChild(el('i', 'legend-dot comp')); comp.appendChild(document.createTextNode('竞品'));
    legend.appendChild(focus); legend.appendChild(comp);
    card.appendChild(legend);
    return card;
  }

  function compareCards(comparison) {
    var card = el('section', 'dash-card span-2');
    card.appendChild(el('h3', null, '单商圈快捷入口'));
    var grid = el('div', 'cmp-cards');
    comparison.items.forEach(function (item) {
      var button = el('button', 'cmp-card');
      button.type = 'button';
      var top = el('div', 'cmp-card-top');
      top.appendChild(el('span', null, item.districtName));
      top.appendChild(el('b', null, String(item.health)));
      button.appendChild(top);
      button.appendChild(el('div', 'cmp-card-sub', '覆盖 ' + item.dimensions.coverage +
        ' · 竞对 ' + item.dimensions.competition + ' · 活动 ' + item.dimensions.promotion));
      button.appendChild(el('div', 'cmp-card-sub', '模拟份额 ' + pct(item.market.focusShare) +
        ' · 配送 ' + money(item.signals.focusAvgFee)));
      button.addEventListener('click', function () { selectDistrict(item.districtId); });
      grid.appendChild(button);
    });
    card.appendChild(grid);
    return card;
  }

  function setImportFeedback(text, kind) {
    var box = $('importFeedback');
    box.className = 'feedback ' + (kind || '');
    box.textContent = text;
  }

  function importText(text) {
    var result = HealthEngine.parseImportedDistrict(text);
    if (!result.ok) {
      setImportFeedback('导入失败：' + result.errors.join('；'), 'error');
      return;
    }
    var district = result.district;
    if (state.dataset.districts.some(function (item) { return item.id === district.id; })) {
      setImportFeedback('导入失败：ID 与内置合成商圈冲突。', 'error');
      return;
    }
    if (Object.keys(state.imported).length >= 3 && !state.imported[district.id]) {
      setImportFeedback('最多保留 3 个本地导入商圈，请先清除旧导入。', 'error');
      return;
    }
    state.imported[district.id] = district;
    if (!saveImported()) {
      setImportFeedback('浏览器存储不可用，导入只在当前页面会话内有效。', 'error');
      return;
    }
    setImportFeedback('导入成功：' + district.name + '（' + district.stores.length + ' 家合成门店）。', 'ok');
    renderChips();
    renderCompareChips();
    selectDistrict(district.id);
  }

  function exportCurrent() {
    var district = allDistricts().filter(function (item) { return item.id === state.selectedId; })[0];
    if (!district) {
      notify('请先选择要导出的商圈。', 'error');
      return;
    }
    var payload = {
      dataClass: 'synthetic',
      note: 'Synthetic demonstration data. Not real business data.',
      district: district
    };
    var blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = safeId(district.id) + '-synthetic.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setImportFeedback('已导出当前商圈合成数据。', 'ok');
  }

  function resetImported() {
    if (!window.confirm('确认清除浏览器中保存的所有导入商圈？')) { return; }
    state.imported = {};
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    setImportFeedback('已清除本地导入数据。', 'ok');
    renderChips();
    renderCompareChips();
    renderCompareSelected();
    if (state.selectedId && !findDistrict(state.selectedId)) {
      state.selectedId = null;
      state.selectedAnalysis = null;
      clear($('dashboard'));
      var empty = el('div', 'empty-state');
      empty.appendChild(el('span', 'empty-icon', '◇'));
      empty.appendChild(el('h2', null, '选择一个虚构商圈开始'));
      empty.appendChild(el('p', null, '右侧会展示合成地图、门店覆盖、竞品结构、活动力度与健康度拆解。'));
      $('dashboard').appendChild(empty);
      greet();
    }
  }

  function bindEvents() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchTab(tab.getAttribute('data-tab')); });
    });
    $('btnSearch').addEventListener('click', function () {
      var value = $('searchInput').value.trim();
      var district = findDistrict(value);
      if (district) { selectDistrict(district.id); }
      else { notify('没有找到「' + value + '」这个虚构商圈。', 'error'); }
    });
    $('searchInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { $('btnSearch').click(); }
    });
    $('chatForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('chatInput');
      ask(input.value);
      input.value = '';
    });
    $('btnCompare').addEventListener('click', function () {
      if (state.compareIds.length < 2) { notify('请至少选择 2 个商圈。', 'error'); return; }
      renderComparePanel();
    });
    $('btnCompareClear').addEventListener('click', function () {
      state.compareIds = [];
      renderCompareChips();
      renderCompareSelected();
      renderComparePanel();
    });
    $('btnImport').addEventListener('click', function () {
      var text = $('importBox').value.trim();
      if (!text) { setImportFeedback('请先粘贴 JSON。', 'error'); return; }
      importText(text);
    });
    $('importFile').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) { return; }
      if (file.size > 60000) { setImportFeedback('文件超过 60 KB 限制。', 'error'); return; }
      var reader = new FileReader();
      reader.onload = function () { importText(String(reader.result || '')); };
      reader.onerror = function () { setImportFeedback('文件读取失败。', 'error'); };
      reader.readAsText(file, 'utf-8');
      event.target.value = '';
    });
    $('btnExport').addEventListener('click', exportCurrent);
    $('btnReset').addEventListener('click', resetImported);
    $('btnLiveCheck').addEventListener('click', checkLiveStatus);
  }

  function init() {
    bindEvents();
    checkServer();
    checkLiveStatus();
    loadDataset();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
