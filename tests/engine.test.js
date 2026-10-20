'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const engine = require(path.join(root, 'js', 'engine.js'));
const advisor = require(path.join(root, 'js', 'advisor.js'));
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data', 'demo_districts.json'), 'utf8'));

test('dataset is valid synthetic data', () => {
  assert.deepEqual(engine.validateDataset(dataset), []);
  assert.equal(dataset.dataClass, 'synthetic');
  assert.equal(dataset.districts.length, 4);
  const stores = dataset.districts.flatMap((district) => district.stores);
  assert.equal(stores.length, 42);
  assert.ok(stores.every((store) => store.source === 'synthetic'));
});

test('analysis is deterministic and contains all dimensions', () => {
  const district = dataset.districts[0];
  const first = engine.analyzeDistrict(district);
  const second = engine.analyzeDistrict(district);
  assert.deepEqual(first, second);
  assert.equal(first.focus.total, 4);
  assert.equal(first.focus.core, 2);
  assert.equal(first.competitors.total, 10);
  assert.ok(first.health >= 0 && first.health <= 100);
  assert.deepEqual(Object.keys(first.dimensions).sort(), [
    'competition', 'coverage', 'delivery', 'promotion', 'sales'
  ]);
  assert.ok(first.focus.coreStores.every((store) => engine.distanceKm(store) <= 1));
});

test('comparison ranks and best values are consistent', () => {
  const ids = dataset.districts.map((district) => district.id);
  const comparison = engine.compareDistricts(dataset, ids);
  assert.equal(comparison.items.length, 4);
  const healthValues = comparison.items.map((item) => item.health);
  assert.deepEqual(healthValues, healthValues.slice().sort((a, b) => b - a));
  assert.ok(comparison.best.health);
  assert.equal(comparison.best.health.value, Math.max(...healthValues));
  assert.equal(new Set(comparison.items.map((item) => item.rank)).size, 4);
});

test('import validation rejects unsafe and oversized input', () => {
  const district = dataset.districts[0];
  const unsafe = JSON.parse(JSON.stringify(district));
  unsafe.name = '<script>alert(1)</script>';
  assert.equal(engine.parseImportedDistrict(JSON.stringify({ district: unsafe })).ok, false);

  const oversized = JSON.parse(JSON.stringify(district));
  oversized.stores = Array.from({ length: 51 }, () => district.stores[0]);
  assert.equal(engine.parseImportedDistrict(JSON.stringify({ district: oversized })).ok, false);

  assert.equal(engine.parseImportedDistrict('{bad json').ok, false);
});

test('example import file is accepted', () => {
  const text = fs.readFileSync(path.join(root, 'examples', 'import_example.json'), 'utf8');
  const result = engine.parseImportedDistrict(text);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.district.imported, true);
});

test('advisor returns structured advice and intent-specific evidence', () => {
  const analysis = engine.analyzeDistrict(dataset.districts[0]);
  const advice = advisor.buildAdvice(dataset.districts[0], analysis, 'Is competition intense here?');
  assert.equal(advice.intent, 'competition');
  assert.ok(advice.summary.includes('Competitor pressure'));
  assert.ok(advice.evidence.length >= 5);
  assert.ok(advice.risks.length >= 1);
  assert.ok(advice.recommendations.length >= 1);
  assert.ok(advice.disclaimer.includes('synthetic demonstration data'));
});
