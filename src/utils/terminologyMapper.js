/**
 * Terminology Mapper for Education Mode
 * Maps standard application terms to education-specific terminology
 */

const terminologyMap = {
  // Core entities
  project: {
    standard: "Space",
    education: "Space",
  },
  projects: {
    standard: "Spaces",
    education: "Spaces",
  },
  // Tasks - context-aware based on space type
  task: {
    standard: "Task",
    education: {
      course: "Assignment",
      research: "Milestone",
      thesis: "Objective",
      "study-group": "Task",
      general: "Task",
    },
  },
  tasks: {
    standard: "Tasks",
    education: {
      course: "Assignments",
      research: "Milestones",
      thesis: "Objectives",
      "study-group": "Tasks",
      general: "Tasks",
    },
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
    education: "Bookmark",
  },
  bookmarks: {
    standard: "Bookmarks",
    education: "Bookmarks",
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
    standard: "Create Space",
    education: "Create Space",
  },
  projectList: {
    standard: "Spaces",
    education: "Spaces",
  },
  projectManagement: {
    standard: "Space Management",
    education: "Space Management",
  },
  addTask: {
    standard: "Add Task",
    education: {
      course: "Add Assignment",
      research: "Add Milestone",
      thesis: "Add Objective",
      "study-group": "Add Task",
      general: "Add Task",
    },
  },
  taskList: {
    standard: "Task List",
    education: {
      course: "Assignments",
      research: "Milestones",
      thesis: "Objectives",
      "study-group": "Tasks",
      general: "Tasks",
    },
  },
  completedTasks: {
    standard: "Completed Tasks",
    education: {
      course: "Completed Assignments",
      research: "Completed Milestones",
      thesis: "Completed Objectives",
      "study-group": "Completed Tasks",
      general: "Completed Tasks",
    },
  },
  viewAllTasks: {
    standard: "View All Tasks",
    education: {
      course: "View All Assignments",
      research: "View All Milestones",
      thesis: "View All Objectives",
      "study-group": "View All Tasks",
      general: "View All Tasks",
    },
  },
  addBookmark: {
    standard: "Add Bookmark",
    education: "Add Bookmark",
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
 * Get the appropriate term based on the current mode and project type
 * @param {string} key - The terminology key
 * @param {boolean} educationMode - Whether education mode is active
 * @param {string} projectType - The type of project (course, research, thesis, etc.)
 * @returns {string} - The appropriate term
 */
export const getTerm = (key, educationMode = false, projectType = 'general') => {
  if (!terminologyMap[key]) {
    console.warn(`Terminology key "${key}" not found in terminologyMap`);
    return key;
  }

  const termData = terminologyMap[key];

  if (educationMode) {
    // Check if education value is an object (context-aware)
    if (typeof termData.education === 'object' && !Array.isArray(termData.education)) {
      // Return the term for the specific project type, fallback to general
      return termData.education[projectType] || termData.education.general || termData.standard;
    }
    // Simple education mode term
    return termData.education || termData.standard;
  }

  // Standard mode
  return termData.standard;
};

/**
 * React hook for using terminology in components
 * @param {boolean} educationMode - Whether education mode is active
 * @param {string} projectType - The type of project
 * @returns {function} - Function to get terms
 */
export const useTerminology = (educationMode = false, projectType = 'general') => {
  return (key) => getTerm(key, educationMode, projectType);
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
 * @param {string} projectType - The type of project
 * @returns {Object} - Object with keys mapped to appropriate terms
 */
export const getTerms = (keys, educationMode = false, projectType = 'general') => {
  return keys.reduce((acc, key) => {
    acc[key] = getTerm(key, educationMode, projectType);
    return acc;
  }, {});
};

export default {
  getTerm,
  useTerminology,
  getAvailableKeys,
  getTerms,
};
