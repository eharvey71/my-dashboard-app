import React, { createContext, useContext, useMemo } from "react";
import { getTerm, getTerms } from "../utils/terminologyMapper";

/**
 * Education Context
 * Provides education mode state and terminology helpers throughout the app
 */
const EducationContext = createContext({
  educationMode: false,
  getTerm: (key) => key,
  getTerms: (keys) => keys,
});

/**
 * Education Provider Component
 * Wraps the application to provide education mode context
 */
export const EducationProvider = ({ educationMode = false, children }) => {
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => {
    return {
      educationMode,
      getTerm: (key) => getTerm(key, educationMode),
      getTerms: (keys) => getTerms(keys, educationMode),
    };
  }, [educationMode]);

  return (
    <EducationContext.Provider value={contextValue}>
      {children}
    </EducationContext.Provider>
  );
};

/**
 * Hook to use education context
 * @returns {Object} Education context value
 */
export const useEducation = () => {
  const context = useContext(EducationContext);
  if (!context) {
    throw new Error("useEducation must be used within an EducationProvider");
  }
  return context;
};

/**
 * Hook to get a single term
 * @param {string} key - The terminology key
 * @returns {string} - The appropriate term
 */
export const useTerm = (key) => {
  const { getTerm } = useEducation();
  return getTerm(key);
};

/**
 * Hook to get multiple terms
 * @param {string[]} keys - Array of terminology keys
 * @returns {Object} - Object with keys mapped to appropriate terms
 */
export const useTerms = (keys) => {
  const { getTerms } = useEducation();
  return getTerms(keys);
};

export default EducationContext;
