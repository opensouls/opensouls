import flat from './utils/flat.ts';

const tagTransformersSymbol = 'COMMON_TAGS_TAG_TRANSFORMERS_SYMBOL';

export interface Transformer {
  onString?: (str: string, context: any) => string;
  onSubstitution?: (substitution: any, resultSoFar: string, context: any) => string;
  onEndResult?: (endResult: string, context: any) => string;
  getInitialContext?: () => any;
}

export interface TagFunction {
  (strings: TemplateStringsArray, ...expressions: any[]): string;
  [tagTransformersSymbol]: Transformer[];
}

function isTag(fn: any): fn is TagFunction {
  return typeof fn === 'function' && fn[tagTransformersSymbol];
}

function cleanTransformers(transformers: (Transformer | TagFunction)[]): Transformer[] {
  return flat(transformers as any).reduce<Transformer[]>(
    (transformers, transformer) =>
      isTag(transformer)
        ? [...transformers, ...transformer[tagTransformersSymbol]]
        : [...transformers, transformer as Transformer],
    [],
  );
}

/**
 * An intermediary template tag that receives a template tag and passes the result of calling the template with the received
 * template tag to our own template tag.
 * @param  {TagFunction}        nextTag          - The received template tag
 * @param  {Array<String>}   template         - The template to process
 * @param  {...*}            ...substitutions - `substitutions` is an array of all substitutions in the template
 * @return {*}                                - The final processed value
 */
function getInterimTag(originalTag: TagFunction, extraTag: TagFunction): string {
  const interimTag: TagFunction = function tag(strings: TemplateStringsArray, ...expressions: any[]): string {
    return originalTag(['', ''] as any, extraTag(strings, ...expressions));
  };
  interimTag[tagTransformersSymbol] = [...originalTag[tagTransformersSymbol], ...extraTag[tagTransformersSymbol]];
  return interimTag as unknown as string;
}

function getTagCallInfo(transformers: Transformer[]): { transformers: Transformer[], context: any[] } {
  return {
    transformers,
    context: transformers.map((transformer) =>
      transformer.getInitialContext ? transformer.getInitialContext() : {},
    ),
  };
}

/**
 * Iterate through each transformer, calling the transformer's specified hook.
 * @param {Array<Function>} transformers - The transformer functions
 * @param {String} hookName              - The name of the hook
 * @param {String} initialString         - The input string
 * @return {String}                      - The final results of applying each transformer
 */
function applyHook0({ transformers, context }: ReturnType<typeof getTagCallInfo>, hookName: 'onString' | 'onEndResult', initialString: string): string {
  return transformers.reduce(
    (result, transformer, index) =>
      transformer[hookName]
        ? (transformer[hookName] as any)(result, context[index])
        : result,
    initialString,
  );
}

/**
 * Iterate through each transformer, calling the transformer's specified hook.
 * @param {Array<Function>} transformers - The transformer functions
 * @param {String} hookName              - The name of the hook
 * @param {String} initialString         - The input string
 * @param {*} arg1                       - An additional argument passed to the hook
 * @return {String}                      - The final results of applying each transformer
 */
function applyHook1({ transformers, context }: ReturnType<typeof getTagCallInfo>, hookName: 'onSubstitution', initialString: any, arg1: string): string {
  return transformers.reduce(
    (result, transformer, index) =>
      transformer[hookName]
        ? (transformer[hookName] as any)(result, arg1, context[index])
        : result,
    initialString,
  );
}

/**
 * Consumes a pipeline of composable transformer plugins and produces a template tag.
 * @param  {...Object} [...rawTransformers] - An array or arguments list of transformers
 * @return {Function}                       - A template tag
 */
export default function createTag(...rawTransformers: (Transformer | TagFunction)[]): TagFunction {
  const transformers = cleanTransformers(rawTransformers);

  function tag(strings: TemplateStringsArray | Function, ...expressions: any[]): string {
    if (typeof strings === 'function') {
      // Cast the result to string to match the return type
      return getInterimTag(tag, strings as TagFunction) as unknown as string;
    }

    if (!Array.isArray(strings)) {
      return tag([strings] as any);
    }

    const tagCallInfo = getTagCallInfo(transformers);

    // if the first argument is an array, return a transformed end result of processing the template with our tag
    const processedTemplate = strings
      .map((string) => applyHook0(tagCallInfo, 'onString', string))
      .reduce((result, string, index) =>
        ''.concat(
          result,
          applyHook1(
            tagCallInfo,
            'onSubstitution',
            expressions[index - 1],
            result,
          ),
          string,
        ),
      );

    return applyHook0(tagCallInfo, 'onEndResult', processedTemplate);
  }

  tag[tagTransformersSymbol] = transformers;

  return tag;
}
