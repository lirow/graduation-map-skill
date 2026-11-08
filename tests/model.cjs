'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'skills/graduation-map/assets');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const data = read(path.join(root, 'examples/demo-data.json'));
const provinces = read(path.join(assets, 'geo/china-provinces.json'));
const world = read(path.join(assets, 'geo/world.json'));
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(assets, 'runtime/data-model.js'), 'utf8'), context);
const createModel = context.window.createClassMapModel;
const copy = value => JSON.parse(JSON.stringify(value));
const results = [];
function test(name, body) { body(); results.push({name, pass: true}); }

test('demo counts people independently of map points', () => {
  const model = createModel(data, provinces, world);
  assert.equal(model.stats.total, 18);
  assert.equal(model.stats.schoolCount, 9);
  assert.equal(model.stats.locatedSchools, 8);
  assert.equal(model.stats.unlocatedSchools, 1);
  assert.equal(model.stats.located, 15);
  assert.equal(model.stats.overseas, 2);
  assert.equal(model.stats.unknown, 1);
  assert.equal(model.counts.get('四川省'), 3);
  assert.equal(model.counts.get('陕西省'), 1);
  assert.equal(model.counts.get('湖南省'), 1);
  assert.equal(model.students.filter(s => s.schoolId === null).length, 2);
});

test('deleting a sole school member removes its school and region counts', () => {
  const changed = copy(data);
  changed.students = changed.students.filter(s => s.id !== 'demo-14');
  const model = createModel(changed, provinces, world);
  assert.equal(model.stats.total, 17);
  assert.equal(model.stats.schoolCount, 8);
  assert.equal(model.stats.overseas, 1);
  assert.equal(model.counts.has('英国'), false);
  assert.equal(model.activeSchools.some(s => s.id === 'demo-uk'), false);
});

test('new overseas country is inferred without hard-coded names', () => {
  const changed = copy(data);
  changed.schools.push({id: 'extra-school', name: '虚构新增校区', country: '新西兰', province: null, lng: 174.78, lat: -41.29});
  changed.students.push({id: 'extra-person', name: '虚构新增同学', schoolId: 'extra-school'});
  const model = createModel(changed, provinces, world);
  assert.equal(model.stats.total, 19);
  assert.equal(model.stats.overseas, 3);
  assert.equal(model.isOverseas('新西兰'), true);
  assert.ok(model.regionCenter('新西兰').every(Number.isFinite));
});

test('null mother school and unresolved destination do not create fake points', () => {
  const changed = copy(data);
  changed.origin = null;
  changed.students.push({id: 'unknown-person', name: '虚构待补同学', schoolId: null});
  const model = createModel(changed, provinces, world);
  assert.equal(model.stats.unknown, 2);
  assert.equal(model.isLocated(changed.origin), false);
  assert.equal(model.regionCenter('未配置的虚构地区'), null);
  assert.equal(model.activeSchools.some(s => s.id === 'demo-pending'), false);
});

test('empty roster has zero derived counts', () => {
  const changed = copy(data); changed.students = [];
  const model = createModel(changed, provinces, world);
  assert.equal(model.stats.total, 0);
  assert.equal(model.stats.schoolCount, 0);
  assert.equal(model.counts.size, 0);
  assert.equal(model.activeSchools.length, 0);
});

test('data preparation does not mutate any input object', () => {
  const before = JSON.stringify([data, provinces, world]);
  createModel(data, provinces, world);
  assert.equal(JSON.stringify([data, provinces, world]), before);
});

test('duplicate stable IDs are rejected', () => {
  const changed = copy(data); changed.students.push(copy(changed.students[0]));
  assert.throws(() => createModel(changed, provinces, world), /重复 id/);
  const duplicateSchool = copy(data); duplicateSchool.schools.push(copy(duplicateSchool.schools[0]));
  assert.throws(() => createModel(duplicateSchool, provinces, world), /重复 id/);
});

test('invalid coordinates are excluded, and school geography owns enrollment location', () => {
  const changed = copy(data);
  changed.schools[0].lng = 500;
  changed.students[0].province = '江苏省';
  const model = createModel(changed, provinces, world);
  assert.equal(model.activeSchools.some(s => s.id === 'demo-sc'), false);
  assert.equal(model.students[0].province, '四川省');
  assert.equal(model.isCampusConfirmed({campusStatus: 'user_confirmed'}), true);
  assert.equal(model.isCampusConfirmed({coordinateStatus: 'school_reference'}), false);
});

console.log(JSON.stringify(results, null, 2));
