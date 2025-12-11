const isValidValue = (x: any) =>
  x != null && !Number.isNaN(x) && typeof x !== 'boolean';

const removeNonPrintingValuesTransformer = () => ({
  onSubstitution<T>(substitution: T): T | string {
    if (Array.isArray(substitution)) {
      return substitution.filter(isValidValue) as T;
    }
    if (isValidValue(substitution)) {
      return substitution;
    }
    return '';
  },
});

export default removeNonPrintingValuesTransformer;
