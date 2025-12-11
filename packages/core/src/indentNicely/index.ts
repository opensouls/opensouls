import createTag from './createTag.ts';
import stripIndent from './stripIndent.ts';
import inlineArrayTransformer from './inlineArrayTransformer.ts';
import splitStringTransformer from './splitStringTransformer.ts';
import removeNonPrintingValuesTransformer from './removeNonPrintingValuesTransformer.ts';

/**
 * This code is a subset of https://www.npmjs.com/package/common-tags (their codeBlock / html function)
 */

const indentNicely = createTag(
  splitStringTransformer('\n'),
  removeNonPrintingValuesTransformer(),
  inlineArrayTransformer(),
  stripIndent,
);

export default indentNicely;
