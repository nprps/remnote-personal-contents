const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/utils.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  module: moduleObject, exports: moduleObject.exports,
  require: () => ({ BuiltInPowerupCodes: { Header: 'r' } }),
});
const { generateContents, convertContentsToFlatList, isSmallHeading, expandHighestCollapsedAncestor } = moduleObject.exports;
const plugin = { richText: { toString: async text => text.join('') } };
const rem = (id, size, children = []) => ({
  _id: id, text: [id], getChildrenRem: async () => children,
  hasPowerup: async code => { assert.equal(code, 'r'); return size !== null; },
  getPowerupProperty: async (code, slot) => {
    assert.equal(code, 'r'); assert.equal(slot, 'Size'); return size;
  },
});
const entries = async (root, exclude) => convertContentsToFlatList(await generateContents(root, plugin, exclude));
test('recognises H5/H6 and numeric-string slot values, retaining unknown values', () => {
  for (const value of ['H5', '5', 'h5', 'H6', 'h6', '6', ' H6 ']) assert.equal(isSmallHeading(value), true);
  for (const value of ['H1', 'H4', '16', 'heading6', '', undefined]) assert.equal(isSmallHeading(value), false);
});
test('hides H6, promotes its heading children, preserves order and visual depth', async () => {
  const root = rem('root', null, [rem('A', 'H1', [rem('small', 'H6', [rem('B', 'H2')]), rem('C', 'H3')]), rem('D', 'H2')]);
  const actual = await entries(root, true);
  assert.deepEqual(Array.from(actual, e => [e.id, e.depth]), [['A', 1], ['B', 2], ['C', 2], ['D', 1]]);
});
test('turning the setting off restores upstream H6 entries', async () => {
  const actual = await entries(rem('root', null, [rem('small', 'H6', [rem('B', 'H2')])]), false);
  assert.deepEqual(Array.from(actual, e => [e.id, e.depth]), [['small', 1], ['B', 2]]);
});
test('headings under ordinary notes are included in document order', async () => {
  const actual = await entries(rem('root', null, [rem('ordinary', null, [rem('nested', 'H1')]), rem('visible', 'H1')]), true);
  assert.deepEqual(Array.from(actual, e => [e.id, e.depth]), [['nested', 1], ['visible', 1]]);
});
test('unknown heading size remains visible rather than silently losing headings', async () => {
  assert.equal((await entries(rem('root', null, [rem('unknown', '')]), true))[0].id, 'unknown');
});
test('actual heading level survives filtering and is independent of nesting depth', async () => {
  const root = rem('root', null, [rem('h1', 'H1'), rem('small', 'H5', [rem('h4', 'H4')]), rem('h2', 'H2')]);
  const actual = await entries(root, true);
  assert.deepEqual(Array.from(actual, e => [e.id, e.depth, e.level]), [['h1', 1, 1], ['h4', 1, 4], ['h2', 1, 2]]);
});
test('cycles through excluded headings terminate', async () => {
  const children = []; const h6 = rem('cycle', 'H6', children); children.push(h6);
  assert.equal((await entries(rem('root', null, [h6]), true)).length, 0);
});
test('nested headings are not truncated after four displayed levels', async () => {
  let child = rem('8', 'H4'); for (let i = 7; i >= 1; i--) child = rem(String(i), 'H1', [child]);
  assert.deepEqual(Array.from(await entries(rem('root', null, [child]), true), e => [e.id, e.depth]), Array.from({length:8}, (_,i)=>[String(i+1), i+1]));
});

test('ordinary notes and hidden headings do not add outline indentation', async () => {
  const root = rem('root', null, [rem('A', 'H1', [rem('note', null, [rem('small', 'H5', [rem('note2', null, [rem('B', 'H3')])])])])]);
  assert.deepEqual(Array.from(await entries(root, true), e => [e.id, e.depth, e.level]), [['A',1,1], ['B',2,3]]);
});

test('ordinary-note cycles back to the root terminate without including the root', async () => {
  const children = []; const root = rem('root', 'H1', children);
  children.push(rem('note', null, [root, rem('visible','H2')]));
  assert.deepEqual(Array.from(await entries(root,true), e=>e.id), ['visible']);
});
test('navigation does not look up an undefined ancestor when nothing is collapsed', async () => {
  const lookedUp = [];
  const root = { _id: 'root', parent: null };
  const child = { _id: 'child', parent: 'root', isCollapsed: async () => false };
  await expandHighestCollapsedAncestor('child', {
    window: { getFocusedPaneId: async () => 'pane', getOpenPaneRemId: async () => 'root' },
    rem: { findOne: async id => { assert.ok(id); lookedUp.push(id); return id === 'root' ? root : child; } },
  });
  assert.deepEqual(lookedUp, ['child', 'root']);
});
test('navigation expands only ancestors, without recursively expanding the target subtree', async () => {
  const expanded = [];
  const nodes = {
    root: { _id: 'root', parent: null },
    outer: { _id: 'outer', parent: 'root', isCollapsed: async () => true, expand: async (...args) => expanded.push(['outer', ...args]) },
    parent: { _id: 'parent', parent: 'outer', isCollapsed: async () => true, expand: async (...args) => expanded.push(['parent', ...args]) },
    child: { _id: 'child', parent: 'parent', isCollapsed: async () => true, expand: async (...args) => expanded.push(['child', ...args]) },
  };
  await expandHighestCollapsedAncestor('child', {
    window: { getFocusedPaneId: async () => 'pane', getOpenPaneRemId: async () => 'root' },
    rem: { findOne: async id => nodes[id] },
  });
  assert.deepEqual(expanded, [['outer', 'root', false], ['parent', 'root', false]]);
});
