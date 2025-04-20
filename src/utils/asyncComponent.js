import React, { lazy } from 'react';

/**
 * A wrapper function for React.lazy that ensures compatibility with bundlers
 * @param {Function} importFunction - A function that returns a Promise that resolves to a module with a default export
 * @returns {React.LazyExoticComponent} - A React component
 */
export const asyncComponent = (importFunction) => {
  return lazy(() => 
    importFunction().then(module => {
      if (module.default) {
        return module;
      } else {
        // If for some reason the default export is missing, wrap the module
        return { default: () => React.createElement('div', null, 'Component failed to load') };
      }
    }).catch(error => {
      console.error('Error loading component:', error);
      return { default: () => React.createElement('div', null, 'Component failed to load') };
    })
  );
};

export default asyncComponent;