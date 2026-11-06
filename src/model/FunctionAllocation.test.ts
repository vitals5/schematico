import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import { ArticleEditPlan } from './ArticleEdit';
import { ArticleFunctionPlan } from './ArticleFunctions';
import { articleCompatibility } from './ArticleCompatibility';
import { setArticleAssignment } from './ArticleAssignments';
import { validateCatalogArticle } from './CatalogRecord';
const p = fixture(),
  a = add(p, 'a', 'contactor_coil'),
  b = add(p, 'b', 'contactor_coil');
a.bmk = b.bmk = '-K1';
const record = validateCatalogArticle({
  articleNumber: '001',
  manufacturer: 'M',
  variant: '',
  description: '',
  origin: 'user',
  verification: 'user_checked',
  functions: [
    { id: 'coil', type: 'relay_coil', pins: ['A1', 'A2'], required: true },
    { id: 'aux', type: 'contact_no', pins: ['13', '14'] },
  ],
});
setArticleAssignment(a, [
  {
    articleNumber: '001',
    manufacturer: 'M',
    variant: '',
    quantity: 1,
    role: 'main',
    snapshot: record,
  },
]);
const linked = new ArticleEditPlan(p, {
  kind: 'link',
  targets: [
    { pageId: 'p', componentId: 'a' },
    { pageId: 'p', componentId: 'b' },
  ],
  main: { pageId: 'p', componentId: 'a' },
}).apply(p);
const address = { pageId: 'p', componentId: 'a' },
  secondary = { pageId: 'p', componentId: 'b' };
assert(
  articleCompatibility(linked, address).issues.some(
    (i) => i.code === 'function_slot_reused',
  ),
);
const mapped = new ArticleFunctionPlan(linked, [address, secondary]).apply(
  linked,
  [
    { address, functionId: 'coil' },
    { address: secondary, functionId: 'coil', sameFunctionAs: address },
  ],
);
assert.equal(articleCompatibility(mapped, address).status, 'compatible');
assert.equal(
  mapped.pages[0].components[1].articleFunctionRepresentation?.primary
    .componentId,
  'a',
);
assert.throws(
  () =>
    new ArticleFunctionPlan(linked, [secondary]).apply(linked, [
      { address: secondary, functionId: 'coil', sameFunctionAs: secondary },
    ]),
  /functionRepresentationInvalid/,
);
const required = structuredClone(mapped);
required.pages[0].components[0].articleAssignment!.items[0].snapshot!.functions![1].required = true;
assert(
  articleCompatibility(required, address).issues.some(
    (i) => i.code === 'required_function_missing' && i.expected === 'aux',
  ),
);
const broken = structuredClone(mapped);
broken.pages[0].components[1].articleFunctionRepresentation!.primary.componentId =
  'elsewhere';
assert(
  articleCompatibility(broken, address).issues.some(
    (i) => i.code === 'function_representation_invalid',
  ),
);
const cycles = structuredClone(mapped);
cycles.pages[0].components[0].articleFunctionRepresentation = {
  primary: secondary,
};
assert(
  articleCompatibility(cycles, address).issues.some(
    (i) => i.code === 'function_representation_invalid',
  ),
);
assert.throws(() =>
  validateCatalogArticle({
    ...record,
    functions: [
      { id: 'bad', type: 'relay_coil', pins: ['A1', 'A2'], required: 'yes' },
    ],
  }),
);
console.log(
  '✓ Device function allocation: required views, unconfirmed duplicate slots, explicit repeated representations, reserve functions and invalid/cyclic/cross-device links',
);
