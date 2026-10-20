/* District Health Studio - deterministic analysis engine.
 * Runs in the browser and in Node (for tests). No network access.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HealthEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CHANNELS = ['Marketplace A', 'Marketplace B'];
  var ID_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
  var DIMENSION_WEIGHTS = {
    coverage: 0.20,
    competition: 0.20,
    promotion: 0.20,
    sales: 0.25,
    delivery: 0.15
  };

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function distanceKm(store) {
    return Math.sqrt(store.x * store.x + store.y * store.y);
  }

  function zoneOf(store) {
    return distanceKm(store) <= 1 ? 'core' : 'ring';
  }

  function mean(values) {
    if (!values.length) { return null; }
    var total = 0;
    values.forEach(function (value) { total += value; });
    return total / values.length;
  }

  function round1(value) {
    return value == null ? null : Math.round(value * 10) / 10;
  }

  function channelEntries(store) {
    var out = [];
    CHANNELS.forEach(function (channel) {
      var info = store.channels && store.channels[channel];
      if (info) { out.push(info); }
    });
    return out;
  }

  function feeValues(stores) {
    var out = [];
    stores.forEach(function (store) {
      channelEntries(store).forEach(function (info) {
        if (isFiniteNumber(info.deliveryFee)) { out.push(info.deliveryFee); }
      });
    });
    return out;
  }

  function promoDepthValues(stores) {
    var out = [];
    stores.forEach(function (store) {
      channelEntries(store).forEach(function (info) {
        if (isFiniteNumber(info.promotionPct)) { out.push(info.promotionPct); }
      });
    });
    return out;
  }

  function promoCoverage(stores) {
    if (!stores.length) { return 0; }
    var covered = stores.filter(function (store) {
      return channelEntries(store).some(function (info) { return info.promotionPct > 0; });
    }).length;
    return covered / stores.length;
  }

  function couponCoverage(stores) {
    if (!stores.length) { return 0; }
    var covered = stores.filter(function (store) {
      return channelEntries(store).some(function (info) { return info.couponValue > 0; });
    }).length;
    return covered / stores.length;
  }

  function channelSummary(stores) {
    var out = {};
    CHANNELS.forEach(function (channel) {
      var fees = [];
      var depths = [];
      var promoCount = 0;
      var couponCount = 0;
      stores.forEach(function (store) {
        var info = store.channels && store.channels[channel];
        if (!info) { return; }
        if (isFiniteNumber(info.deliveryFee)) { fees.push(info.deliveryFee); }
        if (isFiniteNumber(info.promotionPct)) {
          depths.push(info.promotionPct);
          if (info.promotionPct > 0) { promoCount++; }
        }
        if (info.couponValue > 0) { couponCount++; }
      });
      out[channel] = {
        avgFee: round1(mean(fees)),
        avgPromotionPct: round1(mean(depths)),
        promotionCoverage: stores.length ? promoCount / stores.length : 0,
        couponCoverage: stores.length ? couponCount / stores.length : 0
      };
    });
    return out;
  }

  function brandStats(stores) {
    var groups = {};
    stores.forEach(function (store) {
      var brand = store.brand;
      if (!groups[brand]) { groups[brand] = { brand: brand, count: 0, orders: 0 }; }
      groups[brand].count++;
      groups[brand].orders += store.monthlyOrders;
    });
    return Object.keys(groups).map(function (brand) {
      var group = groups[brand];
      return {
        brand: brand,
        count: group.count,
        orders: group.orders,
        avgOrders: Math.round(group.orders / group.count),
        share: 0
      };
    }).sort(function (a, b) { return b.orders - a.orders; });
  }

  function healthLabel(score) {
    if (score >= 85) { return 'Strong'; }
    if (score >= 70) { return 'Stable'; }
    if (score >= 55) { return 'Watch'; }
    return 'Weak'; }

  function analyzeDistrict(district) {
    var allStores = district.stores || [];
    var focus = allStores.filter(function (store) { return store.role === 'focus'; });
    var competitors = allStores.filter(function (store) { return store.role === 'competitor'; });
    var core = focus.filter(function (store) { return zoneOf(store) === 'core'; });
    var ring = focus.filter(function (store) { return zoneOf(store) === 'ring'; });

    var focusOrders = focus.reduce(function (sum, store) { return sum + store.monthlyOrders; }, 0);
    var competitorOrders = competitors.reduce(function (sum, store) { return sum + store.monthlyOrders; }, 0);
    var totalOrders = focusOrders + competitorOrders;
    var marketShare = totalOrders ? focusOrders / totalOrders : 0;

    var brands = brandStats(competitors);
    if (totalOrders) {
      brands.forEach(function (item) { item.share = item.orders / totalOrders; });
    }

    var focusFee = mean(feeValues(focus));
    var competitorFee = mean(feeValues(competitors));
    var focusPromoCoverage = promoCoverage(focus);
    var competitorPromoCoverage = promoCoverage(competitors);
    var focusPromoDepth = mean(promoDepthValues(focus));
    var competitorPromoDepth = mean(promoDepthValues(competitors));
    var topBrand = brands[0] || null;

    var coverage = clamp(Math.round(
      30 + focus.length * 14 + core.length * 12 - Math.max(0, competitors.length - focus.length) * 2
    ), 0, 100);
    var competition = clamp(Math.round(
      100 - competitors.length * 5 - (topBrand ? topBrand.count * 6 : 0) + focus.length * 4
    ), 0, 100);
    var promotion = clamp(Math.round(
      55 + (focusPromoCoverage - competitorPromoCoverage) * 70 +
      ((focusPromoDepth || 0) - (competitorPromoDepth || 0)) * 1.2
    ), 0, 100);
    var sales = clamp(Math.round(marketShare * 180), 0, 100);
    var delivery = clamp(Math.round(
      100 - (focusFee || 0) * 10 - Math.max(0, (focusFee || 0) - (competitorFee || 0)) * 10
    ), 0, 100);

    var dimensions = {
      coverage: coverage,
      competition: competition,
      promotion: promotion,
      sales: sales,
      delivery: delivery
    };
    var health = Math.round(
      coverage * DIMENSION_WEIGHTS.coverage +
      competition * DIMENSION_WEIGHTS.competition +
      promotion * DIMENSION_WEIGHTS.promotion +
      sales * DIMENSION_WEIGHTS.sales +
      delivery * DIMENSION_WEIGHTS.delivery
    );

    return {
      districtId: district.id,
      districtName: district.name,
      synthetic: true,
      focus: {
        total: focus.length,
        core: core.length,
        ring: ring.length,
        stores: focus,
        coreStores: core,
        ringStores: ring,
        orders: focusOrders,
        avgOrders: focus.length ? Math.round(focusOrders / focus.length) : 0
      },
      competitors: {
        total: competitors.length,
        stores: competitors,
        brands: brands,
        brandCount: brands.length,
        orders: competitorOrders,
        avgOrders: competitors.length ? Math.round(competitorOrders / competitors.length) : 0,
        topBrand: topBrand
      },
      market: {
        totalOrders: totalOrders,
        focusShare: marketShare
      },
      channels: {
        focus: channelSummary(focus),
        competitors: channelSummary(competitors)
      },
      signals: {
        focusAvgFee: round1(focusFee),
        competitorAvgFee: round1(competitorFee),
        focusPromoCoverage: Math.round(focusPromoCoverage * 100),
        competitorPromoCoverage: Math.round(competitorPromoCoverage * 100),
        focusPromoDepth: round1(focusPromoDepth),
        competitorPromoDepth: round1(competitorPromoDepth),
        focusCouponCoverage: Math.round(couponCoverage(focus) * 100),
        competitorCouponCoverage: Math.round(couponCoverage(competitors) * 100)
      },
      dimensions: dimensions,
      health: health,
      healthLabel: healthLabel(health)
    };
  }

  function compareDistricts(dataset, ids) {
    var selected = [];
    (ids || []).forEach(function (id) {
      var district = (dataset.districts || []).filter(function (item) { return item.id === id; })[0];
      if (district) { selected.push(analyzeDistrict(district)); }
    });
    selected.sort(function (a, b) { return b.health - a.health; });
    selected.forEach(function (item, index) { item.rank = index + 1; });

    function bestOf(key, getter, lowerIsBetter) {
      var best = null;
      selected.forEach(function (item) {
        var value = getter(item);
        if (!isFiniteNumber(value)) { return; }
        if (!best || (lowerIsBetter ? value < best.value : value > best.value)) {
          best = { id: item.districtId, value: value };
        }
      });
      return best;
    }

    return {
      items: selected,
      best: {
        health: bestOf('health', function (item) { return item.health; }, false),
        coverage: bestOf('coverage', function (item) { return item.dimensions.coverage; }, false),
        competition: bestOf('competition', function (item) { return item.dimensions.competition; }, false),
        promotion: bestOf('promotion', function (item) { return item.dimensions.promotion; }, false),
        sales: bestOf('sales', function (item) { return item.dimensions.sales; }, false),
        delivery: bestOf('delivery', function (item) { return item.dimensions.delivery; }, false),
        focusShare: bestOf('focusShare', function (item) { return item.market.focusShare; }, false),
        focusFee: bestOf('focusFee', function (item) { return item.signals.focusAvgFee; }, true)
      }
    };
  }

  function validText(value, maxLength) {
    return typeof value === 'string' && value.trim().length > 0 &&
      value.length <= maxLength && !/[<>\u0000-\u001f]/.test(value);
  }

  function validateStore(store, index, channels) {
    var errors = [];
    var label = 'stores[' + index + ']';
    if (!store || typeof store !== 'object') { return [label + ' must be an object']; }
    if (store.role !== 'focus' && store.role !== 'competitor') {
      errors.push(label + '.role must be focus or competitor');
    }
    if (!validText(store.brand, 60)) { errors.push(label + '.brand is invalid'); }
    if (!validText(store.name, 80)) { errors.push(label + '.name is invalid'); }
    if (store.address != null && !validText(store.address, 120)) {
      errors.push(label + '.address is invalid');
    }
    if (!isFiniteNumber(store.x) || Math.abs(store.x) > 3.1) {
      errors.push(label + '.x must be within -3.1..3.1');
    }
    if (!isFiniteNumber(store.y) || Math.abs(store.y) > 3.1) {
      errors.push(label + '.y must be within -3.1..3.1');
    }
    if (isFiniteNumber(store.x) && isFiniteNumber(store.y) && distanceKm(store) > 3.05) {
      errors.push(label + ' must be inside the 3 km synthetic coverage ring');
    }
    if (!isFiniteNumber(store.monthlyOrders) || store.monthlyOrders < 0 || store.monthlyOrders > 100000) {
      errors.push(label + '.monthlyOrders must be 0..100000');
    }
    if (!store.channels || typeof store.channels !== 'object') {
      errors.push(label + '.channels is required');
      return errors;
    }
    channels.forEach(function (channel) {
      var info = store.channels[channel];
      if (!info || typeof info !== 'object') {
        errors.push(label + '.channels.' + channel + ' is required');
        return;
      }
      if (!isFiniteNumber(info.deliveryFee) || info.deliveryFee < 0 || info.deliveryFee > 30) {
        errors.push(label + '.channels.' + channel + '.deliveryFee must be 0..30');
      }
      if (!isFiniteNumber(info.promotionPct) || info.promotionPct < 0 || info.promotionPct > 60) {
        errors.push(label + '.channels.' + channel + '.promotionPct must be 0..60');
      }
      if (!validText(info.promotionLabel, 80)) {
        errors.push(label + '.channels.' + channel + '.promotionLabel is invalid');
      }
      if (!isFiniteNumber(info.couponValue) || info.couponValue < 0 || info.couponValue > 50) {
        errors.push(label + '.channels.' + channel + '.couponValue must be 0..50');
      }
    });
    return errors;
  }

  function validateDistrict(district, channels) {
    var errors = [];
    if (!district || typeof district !== 'object') { return ['district must be an object']; }
    if (!ID_RE.test(district.id || '')) { errors.push('district.id must be a lowercase slug'); }
    if (!validText(district.name, 60)) { errors.push('district.name is invalid'); }
    if (!validText(district.shortName, 24)) { errors.push('district.shortName is invalid'); }
    if (!validText(district.description, 240)) { errors.push('district.description is invalid'); }
    if (!district.center || !isFiniteNumber(district.center.x) || !isFiniteNumber(district.center.y)) {
      errors.push('district.center must contain numeric x and y');
    }
    if (!isFiniteNumber(district.coverageRadiusKm) || district.coverageRadiusKm !== 3) {
      errors.push('district.coverageRadiusKm must be 3');
    }
    if (!Array.isArray(district.stores) || district.stores.length < 1 || district.stores.length > 50) {
      errors.push('district.stores must contain 1..50 items');
      return errors;
    }
    district.stores.forEach(function (store, index) {
      errors = errors.concat(validateStore(store, index, channels));
    });
    return errors;
  }

  function validateDataset(dataset) {
    var errors = [];
    if (!dataset || typeof dataset !== 'object') { return ['dataset must be an object']; }
    if (dataset.schemaVersion !== 1) { errors.push('schemaVersion must be 1'); }
    if (dataset.dataClass !== 'synthetic') { errors.push('dataClass must be synthetic'); }
    if (!Array.isArray(dataset.channels) || dataset.channels.length !== CHANNELS.length) {
      errors.push('channels must contain exactly ' + CHANNELS.length + ' items');
      return errors;
    }
    if (!Array.isArray(dataset.districts) || dataset.districts.length < 1 || dataset.districts.length > 5) {
      errors.push('districts must contain 1..5 items');
      return errors;
    }
    var ids = {};
    dataset.districts.forEach(function (district, index) {
      var districtErrors = validateDistrict(district, dataset.channels);
      errors = errors.concat(districtErrors.map(function (error) { return 'districts[' + index + ']: ' + error; }));
      if (district && district.id) {
        if (ids[district.id]) { errors.push('duplicate district id: ' + district.id); }
        ids[district.id] = true;
      }
    });
    return errors;
  }

  function parseImportedDistrict(text) {
    if (typeof text !== 'string' || text.length > 60000) {
      return { ok: false, errors: ['Import text must be a string under 60 KB.'] };
    }
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { return { ok: false, errors: ['Invalid JSON.'] }; }
    var candidate = parsed && parsed.district ? parsed.district : parsed;
    var channelList = (parsed && Array.isArray(parsed.channels)) ? parsed.channels : CHANNELS;
    var errors = validateDistrict(candidate, channelList);
    if (errors.length) { return { ok: false, errors: errors.slice(0, 12) }; }
    var copy = JSON.parse(JSON.stringify(candidate));
    copy.id = 'imported-' + String(copy.id).replace(/[^a-z0-9-]/g, '-').slice(0, 28);
    copy.imported = true;
    copy.stores.forEach(function (store) { store.source = 'imported-synthetic'; });
    return { ok: true, district: copy, errors: [] };
  }

  return {
    CHANNELS: CHANNELS.slice(),
    DIMENSION_WEIGHTS: DIMENSION_WEIGHTS,
    distanceKm: distanceKm,
    zoneOf: zoneOf,
    healthLabel: healthLabel,
    analyzeDistrict: analyzeDistrict,
    compareDistricts: compareDistricts,
    validateDataset: validateDataset,
    validateDistrict: validateDistrict,
    parseImportedDistrict: parseImportedDistrict,
    channelSummary: channelSummary
  };
});
