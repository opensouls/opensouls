import createTag from './createTag.ts';
import stripIndentTransformer from './stripIndentTransformer.ts';
import trimResultTransformer from './trimResultTransformer.ts';

const stripIndent = createTag(
  stripIndentTransformer(),
  trimResultTransformer('smart'),
);

export default stripIndent;
