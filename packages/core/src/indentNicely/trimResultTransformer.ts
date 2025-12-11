const supportedSides = ['', 'start', 'left', 'end', 'right', 'smart'] as const;
type SupportedSide = typeof supportedSides[number];

/**
 * TemplateTag transformer that trims whitespace on the end result of a tagged template
 * @param  {SupportedSide} side - The side of the string to trim. Can be 'start' or 'end' (alternatively 'left' or 'right')
 * @return {Object}             - a TemplateTag transformer
 */
const trimResultTransformer = (side: SupportedSide = '') => {
  if (!supportedSides.includes(side)) {
    throw new Error(`Side not supported: ${side}`);
  }

  return {
    onEndResult(endResult: string): string {
      switch (side) {
        case '':
          return endResult.trim();

        case 'start':
        case 'left':
          return endResult.replace(/^\s*/, '');

        case 'end':
        case 'right':
          return endResult.replace(/\s*$/, '');

        case 'smart':
          return endResult.replace(/[^\S\n]+$/gm, '').replace(/^\n/, '');
      }
    },
  };
};

export default trimResultTransformer;
