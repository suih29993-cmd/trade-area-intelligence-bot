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

  var DISCLAIMER = 'These conclusions are based only on this project\'s synthetic demonstration data and do not represent any real store or business result.';

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
    if (/compet|rival|brand|pressure|market/.test(text)) { return 'competition'; }
    if (/promo|coupon|discount|offer|deal/.test(text)) { return 'promotion'; }
    if (/store|coverage|location|footprint|site/.test(text)) { return 'coverage'; }
    if (/delivery|fee|fulfill|shipping/.test(text)) { return 'delivery'; }
    if (/sales|order|revenue|share|volume/.test(text)) { return 'sales'; }
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
        title: 'Core-ring coverage gap',
        detail: 'No focus-brand store is in the 1 km core ring. Evaluate a pop-up, shared counter, or small delivery-only site before committing to a large store.'
      });
    } else if (focus.total <= 2) {
      recommendations.push({
        priority: 'high',
        title: 'Low store density',
        detail: 'Only ' + focus.total + ' focus-brand stores are within 3 km. Use order hotspots and delivery radius to size a potential new location.'
      });
    }

    if (competitors.total >= 10 || (competitors.topBrand && competitors.topBrand.count >= 3)) {
      recommendations.push({
        priority: 'high',
        title: 'Competitor-density warning',
        detail: 'There are ' + competitors.total + ' competitor stores within 3 km. The leading competitor, ' +
          (competitors.topBrand ? competitors.topBrand.brand : '—') + ', already has ' +
          (competitors.topBrand ? competitors.topBrand.count : 0) + ' stores. Prioritize product differentiation and daypart operations over a direct price war.'
      });
    }

    if (analysis.market.focusShare < 0.35) {
      recommendations.push({
        priority: 'medium',
        title: 'Low simulated order share',
        detail: 'The focus brand has a simulated order share of ' + pct(analysis.market.focusShare) +
          '. First inspect core-SKU visibility, minimum order value, and peak-hour fulfillment instead of broadly cutting prices.'
      });
    }

    if (signals.focusPromoCoverage + 10 < signals.competitorPromoCoverage) {
      recommendations.push({
        priority: 'medium',
        title: 'Promotion coverage gap',
        detail: 'Focus-brand promotion coverage is ' + signals.focusPromoCoverage + '%, versus ' +
          signals.competitorPromoCoverage + '% for competitors. Extend offers only at high-potential stores rather than applying broad subsidies.'
      });
    }

    if (signals.focusAvgFee != null && signals.competitorAvgFee != null &&
        signals.focusAvgFee > signals.competitorAvgFee + 0.5) {
      recommendations.push({
        priority: 'medium',
        title: 'Delivery fee above competitors',
        detail: 'The focus-brand simulated average delivery fee is ' + money(signals.focusAvgFee) + ' CNY, versus ' +
          money(signals.competitorAvgFee) + ' CNY for competitors. Test a delivery-fee discount or a free-delivery threshold.'
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        priority: 'low',
        title: 'Maintain and monitor',
        detail: 'The current synthetic metrics do not trigger a high-priority signal. Continue tracking competitor promotions and core-ring order changes.'
      });
    }
    return recommendations;
  }

  function buildRisks(analysis) {
    var risks = [];
    var signals = analysis.signals;
    if (analysis.focus.core === 0) { risks.push('Core-ring coverage is empty, so competitors may capture peak-hour demand.'); }
    if (analysis.competitors.total >= 10) { risks.push('Competitor store density is high; organic traffic alone may be unstable.'); }
    if (analysis.market.focusShare < 0.35) { risks.push('Simulated order share is below 35%; visibility and conversion need validation.'); }
    if (signals.focusPromoCoverage + 10 < signals.competitorPromoCoverage) {
      risks.push('Promotion coverage trails competitors and may limit new-customer trial and repeat purchase.');
    }
    if (signals.focusAvgFee != null && signals.competitorAvgFee != null &&
        signals.focusAvgFee > signals.competitorAvgFee + 0.5) {
      risks.push('Delivery fees are above competitors, which may pressure conversion on low-ticket orders.');
    }
    if (!risks.length) { risks.push('The synthetic data does not trigger a clear risk signal, but any real-world use would require validation with actual business data.'); }
    return risks;
  }

  function intentSummary(intent, analysis) {
    var focus = analysis.focus;
    var competitors = analysis.competitors;
    var signals = analysis.signals;
    if (intent === 'competition') {
      return 'Competitor pressure: ' + competitors.total + ' competitor stores and ' + competitors.brandCount +
        ' brands within 3 km. The leading brand is ' + (competitors.topBrand ? competitors.topBrand.brand : '—') +
        '. The competitor-pressure score is ' + analysis.dimensions.competition + '/100 (higher means lower pressure).';
    }
    if (intent === 'promotion') {
      return 'Promotion intensity: focus-brand promotion coverage is ' + signals.focusPromoCoverage + '% versus ' +
        signals.competitorPromoCoverage + '% for competitors; average promotion depth is ' + money(signals.focusPromoDepth) +
        '% versus ' + money(signals.competitorPromoDepth) + '%. The promotion score is ' +
        analysis.dimensions.promotion + '/100.';
    }
    if (intent === 'coverage') {
      return 'Store coverage: the focus brand has ' + focus.total + ' stores within 3 km, including ' + focus.core +
        ' in the core ring and ' + focus.ring + ' in the outer ring. The coverage score is ' + analysis.dimensions.coverage + '/100.';
    }
    if (intent === 'delivery') {
      return 'Delivery experience: the focus-brand simulated average delivery fee is ' + money(signals.focusAvgFee) + ' CNY versus ' +
        money(signals.competitorAvgFee) + ' CNY for competitors. The delivery score is ' + analysis.dimensions.delivery + '/100.';
    }
    if (intent === 'sales') {
      return 'Sales volume: the focus brand has ' + int(focus.orders) + ' simulated monthly orders versus ' +
        int(competitors.orders) + ' for competitors; simulated share is ' + pct(analysis.market.focusShare) +
        '. The sales score is ' + analysis.dimensions.sales + '/100.';
    }
    return 'Overall health is ' + analysis.health + '/100 (' + analysis.healthLabel + '). ' +
      'The focus brand has ' + focus.total + ' stores and ' + int(focus.orders) + ' simulated monthly orders; competitors have ' +
      competitors.total + ' stores across ' + competitors.brandCount + ' brands.';
  }

  function buildAdvice(district, analysis, message) {
    var intent = detectIntent(message);
    var recommendations = buildRecommendations(analysis);
    var evidence = [
      'District: ' + district.name + ' (fictional demonstration district, 3 km coverage ring)',
      'Focus-brand stores: ' + analysis.focus.total + ' (core ring ' + analysis.focus.core +
        ' / outer ring ' + analysis.focus.ring + ')',
      'Competitor stores: ' + analysis.competitors.total + ' / ' + analysis.competitors.brandCount + ' brands',
      'Simulated monthly orders: focus brand ' + int(analysis.focus.orders) + ', competitors ' + int(analysis.competitors.orders) +
        ', focus share ' + pct(analysis.market.focusShare),
      'Simulated average delivery fee: focus brand ' + money(analysis.signals.focusAvgFee) + ' CNY, competitors ' +
        money(analysis.signals.competitorAvgFee) + ' CNY',
      'Health dimensions: coverage ' + analysis.dimensions.coverage + ' / competition ' +
        analysis.dimensions.competition + ' / promotion ' + analysis.dimensions.promotion +
        ' / sales ' + analysis.dimensions.sales + ' / delivery ' + analysis.dimensions.delivery
    ];

    return {
      intent: intent,
      title: district.name + ' · Structured diagnosis',
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
