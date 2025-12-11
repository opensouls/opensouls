import React from 'react';

// Simple title renderer that strips the internal prefix but no longer gates content.
const CustomNavigation = ({ title }) => {
  if (title.startsWith('[I]')) {
    return <>{title.slice(3)}</>;
  }
  return <>{title}</>;
};

export default CustomNavigation;