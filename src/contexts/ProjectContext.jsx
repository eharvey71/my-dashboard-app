import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserProjects } from '../services/firebaseConfig';

const ProjectContext = createContext();

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, user }) => {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  useEffect(() => {
    if (user) {
      getUserProjects(user.uid).then(setProjects);
    }
  }, [user]);

  const addProject = (project) => {
    setProjects([...projects, project]);
  };

  const updateActiveProject = (projectId) => {
    setActiveProject(projectId);
  };

  const updateProjectName = (projectId, newName) => {
    setProjects(projects.map(project => 
      project.id === projectId ? { ...project, name: newName } : project
    ));
  };

  return (
    <ProjectContext.Provider value={{ 
      projects, 
      addProject, 
      activeProject, 
      updateActiveProject,
      updateProjectName 
    }}>
      {children}
    </ProjectContext.Provider>
  );
};