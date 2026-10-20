/* Local, deterministic advisory engine for the public demo.
 * It never calls an external service and never reads a credential.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HealthAdvisor = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DISCLAIMER = '以下结论仅基于本项目的合成演示数据，不代表任何真实门店或真实经营结果。';

  function pct(value) {
    return Math.round(value * 100) + '%';
  }

  function int(value) {
    return Math.round(value).toLocaleString('en-US');
  }

  function money(value) {
    return value == null ? '—' : Number(value).toFixed(1);
  }

  function detectIntent(message) {
    var text = String(message || '').toLowerCase();
    if (/竞争|竞对|对手|品牌|compet/.test(text)) { return 'competition'; }
    if (/活动|优惠|促销|折扣|promo|coupon|券/.test(text)) { return 'promotion'; }
    if (/门店|覆盖|选址|布点|store|coverage/.test(text)) { return 'coverage'; }
    if (/配送|运费|履约|delivery|fee/.test(text)) { return 'delivery'; }
    if (/销售|月售|订单|份额|sales|order|share/.test(text)) { return 'sales'; }
    return 'overview';
  }

  function buildRecommendations(analysis) {
    var recommendations = [];
    var focus = analysis.focus;
    var competitors = analysis.competitors;
    var signals = analysis.signals;

    if (focus.core === 0) {
      recommendations.push({
        priority: 'high',
        title: '核心圈覆盖缺口',
        detail: '1 km 核心圈内没有焦点品牌门店。优先评估快闪、联营柜位或小型外送点，而不是直接开设大店。'
      });
    } else if (focus.total <= 2) {
      recommendations.push({
        priority: 'high',
        title: '门店密度偏低',
        detail: '3 km 内仅 ' + focus.total + ' 家焦点品牌门店，建议用订单热区与配送半径做补点测算。'
      });
    }

    if (competitors.total >= 10 || (competitors.topBrand && competitors.topBrand.count >= 3)) {
      recommendations.push({
        priority: 'high',
        title: '竞对密度预警',
        detail: '3 km 内共有 ' + competitors.total + ' 家竞品门店，头部竞品 ' +
          (competitors.topBrand ? competitors.topBrand.brand : '—') + ' 已有 ' +
          (competitors.topBrand ? competitors.topBrand.count : 0) + ' 家。建议先做差异化产品与时段运营，避免直接价格战。'
      });
    }

    if (analysis.market.focusShare < 0.35) {
      recommendations.push({
        priority: 'medium',
        title: '模拟订单份额偏低',
        detail: '焦点品牌模拟订单份额为 ' + pct(analysis.market.focusShare) +
          '。可优先检查核心 SKU 曝光、起送价与高峰时段履约，而不是全量降价。'
      });
    }

    if (signals.focusPromoCoverage + 10 < signals.competitorPromoCoverage) {
      recommendations.push({
        priority: 'medium',
        title: '活动覆盖存在差距',
        detail: '焦点品牌活动覆盖率 ' + signals.focusPromoCoverage + '%，竞品为 ' +
          signals.competitorPromoCoverage + '%。建议只对高潜门店补齐活动，不做无差别补贴。'
      });
    }

    if (signals.focusAvgFee != null && signals.competitorAvgFee != null &&
        signals.focusAvgFee > signals.competitorAvgFee + 0.5) {
      recommendations.push({
        priority: 'medium',
        title: '配送费高于竞品',
        detail: '焦点品牌模拟平均配送费 ' + money(signals.focusAvgFee) + ' 元，竞品为 ' +
          money(signals.competitorAvgFee) + ' 元。可测试配送费立减或满额免配。'
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        priority: 'low',
        title: '维持并持续监测',
        detail: '当前模拟指标没有触发高优先级信号。建议继续跟踪竞品活动和核心圈订单变化。'
      });
    }
    return recommendations;
  }

  function buildRisks(analysis) {
    var risks = [];
    var signals = analysis.signals;
    if (analysis.focus.core === 0) { risks.push('核心圈覆盖为空，高峰期可能被竞品截流。'); }
    if (analysis.competitors.total >= 10) { risks.push('竞品门店密度高，单纯依赖自然流量不稳定。'); }
    if (analysis.market.focusShare < 0.35) { risks.push('模拟订单份额低于 35%，需要验证曝光与转化环节。'); }
    if (signals.focusPromoCoverage + 10 < signals.competitorPromoCoverage) {
      risks.push('活动覆盖落后，可能影响新客试用与复购。');
    }
    if (signals.focusAvgFee != null && signals.competitorAvgFee != null &&
        signals.focusAvgFee > signals.competitorAvgFee + 0.5) {
      risks.push('配送费高于竞品，低客单订单的转化可能承压。');
    }
    if (!risks.length) { risks.push('当前模拟数据未触发明显风险信号，但仍需用真实业务数据复核。'); }
    return risks;
  }

  function intentSummary(intent, analysis) {
    var focus = analysis.focus;
    var competitors = analysis.competitors;
    var signals = analysis.signals;
    if (intent === 'competition') {
      return '竞对压力：3 km 内 ' + competitors.total + ' 家竞品、' + competitors.brandCount +
        ' 个品牌；头部品牌为 ' + (competitors.topBrand ? competitors.topBrand.brand : '—') +
        '。竞对压力维度得分 ' + analysis.dimensions.competition + '/100（越高表示压力越低）。';
    }
    if (intent === 'promotion') {
      return '活动力度：焦点品牌活动覆盖率 ' + signals.focusPromoCoverage + '%，竞品 ' +
        signals.competitorPromoCoverage + '%；平均活动深度 ' + money(signals.focusPromoDepth) +
        '% 对 ' + money(signals.competitorPromoDepth) + '%。活动维度得分 ' +
        analysis.dimensions.promotion + '/100。';
    }
    if (intent === 'coverage') {
      return '门店覆盖：焦点品牌 3 km 内 ' + focus.total + ' 家，其中核心圈 ' + focus.core +
        ' 家、外围 ' + focus.ring + ' 家；覆盖维度得分 ' + analysis.dimensions.coverage + '/100。';
    }
    if (intent === 'delivery') {
      return '配送体验：焦点品牌模拟平均配送费 ' + money(signals.focusAvgFee) + ' 元，竞品 ' +
        money(signals.competitorAvgFee) + ' 元；配送维度得分 ' + analysis.dimensions.delivery + '/100。';
    }
    if (intent === 'sales') {
      return '销售体量：焦点品牌模拟月售 ' + int(focus.orders) + ' 单，竞品 ' +
        int(competitors.orders) + ' 单；模拟份额 ' + pct(analysis.market.focusShare) +
        '，销售维度得分 ' + analysis.dimensions.sales + '/100。';
    }
    return '综合健康度 ' + analysis.health + '/100（' + analysis.healthLabel + '）。' +
      '焦点品牌 ' + focus.total + ' 家门店、' + int(focus.orders) + ' 单模拟月售；竞品 ' +
      competitors.total + ' 家、' + competitors.brandCount + ' 个品牌。';
  }

  function buildAdvice(district, analysis, message) {
    var intent = detectIntent(message);
    var recommendations = buildRecommendations(analysis);
    var evidence = [
      '商圈：' + district.name + '（虚构演示商圈，3 km 覆盖圈）',
      '焦点品牌门店：' + analysis.focus.total + ' 家（核心圈 ' + analysis.focus.core +
        ' 家 / 外围 ' + analysis.focus.ring + ' 家）',
      '竞品门店：' + analysis.competitors.total + ' 家 / ' + analysis.competitors.brandCount + ' 个品牌',
      '模拟月售：焦点品牌 ' + int(analysis.focus.orders) + ' 单，竞品 ' + int(analysis.competitors.orders) +
        ' 单，焦点份额 ' + pct(analysis.market.focusShare),
      '模拟平均配送费：焦点品牌 ' + money(analysis.signals.focusAvgFee) + ' 元，竞品 ' +
        money(analysis.signals.competitorAvgFee) + ' 元',
      '健康度维度：覆盖 ' + analysis.dimensions.coverage + ' / 竞对 ' +
        analysis.dimensions.competition + ' / 活动 ' + analysis.dimensions.promotion +
        ' / 销售 ' + analysis.dimensions.sales + ' / 配送 ' + analysis.dimensions.delivery
    ];

    return {
      intent: intent,
      title: district.name + ' · 结构化诊断',
      summary: intentSummary(intent, analysis),
      evidence: evidence,
      risks: buildRisks(analysis),
      recommendations: recommendations,
      disclaimer: DISCLAIMER
    };
  }

  return {
    DISCLAIMER: DISCLAIMER,
    detectIntent: detectIntent,
    buildAdvice: buildAdvice,
    buildRecommendations: buildRecommendations
  };
});
