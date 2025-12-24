/**
 * Terminology Mapper for Education Mode
 * Maps standard application terms to education-specific terminology
 */

const terminologyMap = {
  // Core entities
  project: {
    standard: "Project",
    education: "Course",
  },
  projects: {
    standard: "Projects",
    education: "Courses",
  },
  task: {
    standard: "Task",
    education: "Assignment",
  },
  tasks: {
    standard: "Tasks",
    education: "Assignments",
  },
  note: {
    standard: "Note",
    education: "Note",
  },
  notes: {
    standard: "Notes",
    education: "Notes",
  },
  bookmark: {
    standard: "Bookmark",
    education: "Resource",
  },
  bookmarks: {
    standard: "Bookmarks",
    education: "Resources",
  },
  document: {
    standard: "Document",
    education: "Document",
  },
  documents: {
    standard: "Documents",
    education: "Documents",
  },
  synapse: {
    standard: "Synapse",
    education: "Study Set",
  },
  synapses: {
    standard: "Synapses",
    education: "Study Sets",
  },

  // Actions and UI elements
  createProject: {
    standard: "Create Project",
    education: "Add Course",
  },
  projectList: {
    standard: "Project List",
    education: "My Courses",
  },
  projectManagement: {
    standard: "Project Management",
    education: "Course Overview",
  },
  addTask: {
    standard: "Add Task",
    education: "Add Assignment",
  },
  taskList: {
    standard: "Task List",
    education: "Assignments",
  },
  completedTasks: {
    standard: "Completed Tasks",
    education: "Completed Assignments",
  },
  viewAllTasks: {
    standard: "View All Tasks",
    education: "View All Assignments",
  },
  addBookmark: {
    standard: "Add Bookmark",
    education: "Add Resource",
  },
  createSynapse: {
    standard: "Create Synapse",
    education: "Create Study Set",
  },
  analyzeSynapse: {
    standard: "Analyze Synapse",
    education: "Analyze Study Set",
  },

  // Dashboard sections
  quickNotes: {
    standard: "Quick Notes",
    education: "Quick Notes",
  },
  recentDocuments: {
    standard: "Recent Documents",
    education: "Recent Documents",
  },

  // Priority/importance
  priority: {
    standard: "Priority",
    education: "Importance",
  },
  highPriority: {
    standard: "High Priority",
    education: "High Importance",
  },

  // Time management
  focusTimer: {
    standard: "Focus Timer",
    education: "Study Timer",
  },
  pomodoro: {
    standard: "Pomodoro",
    education: "Study Session",
  },
};

/**
 * Get the appropriate term based on the current mode
 * @param {string} key - The terminology key
 * @param {boolean} educationMode - Whether education mode is active
 * @returns {string} - The appropriate term
 */
export const getTerm = (key, educationMode = false) => {
  const mode = educationMode ? "education" : "standard";

  if (!terminologyMap[key]) {
    console.warn(`Terminology key "${key}" not found in terminologyMap`);
    return key;
  }

  return terminologyMap[key][mode] || terminologyMap[key].standard;
};

/**
 * React hook for using terminology in components
 * @param {boolean} educationMode - Whether education mode is active
 * @returns {function} - Function to get terms
 */
export const useTerminology = (educationMode = false) => {
  return (key) => getTerm(key, educationMode);
};

/**
 * Get all available terminology keys
 * @returns {string[]} - Array of available keys
 */
export const getAvailableKeys = () => {
  return Object.keys(terminologyMap);
};

/**
 * Batch get multiple terms
 * @param {string[]} keys - Array of terminology keys
 * @param {boolean} educationMode - Whether education mode is active
 * @returns {Object} - Object with keys mapped to appropriate terms
 */
export const getTerms = (keys, educationMode = false) => {
  return keys.reduce((acc, key) => {
    acc[key] = getTerm(key, educationMode);
    return acc;
  }, {});
};

export default {
  getTerm,
  useTerminology,
  getAvailableKeys,
  getTerms,
};
