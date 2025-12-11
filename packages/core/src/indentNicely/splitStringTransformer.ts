const splitStringTransformer = (splitBy: any) => {
  if (typeof splitBy !== 'string') {
    throw new Error('You need to specify a string character to split by.');
  }

  return {
    onSubstitution(substitution: any) {
      if (typeof substitution === 'string' && substitution.includes(splitBy)) {
        return substitution.split(splitBy);
      }
      return substitution;
    },
  };
};

export default splitStringTransformer;
