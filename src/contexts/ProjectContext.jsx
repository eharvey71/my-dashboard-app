import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserProjects, getLastAccessedProject, setLastAccessedProject } from '../services/firebaseConfig';

const ProjectContext = createContext();

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, user }) => {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  useEffect(() => {
    if (user) {
      getUserProjects(user.uid).then(fetchedProjects => {
        setProjects(fetchedProjects);
        getLastAccessedProject(user.uid).then(lastProjectId => {
          if (lastProjectId && fetchedProjects.some(p => p.id === lastProjectId)) {
            setActiveProject(lastProjectId);
          } else if (fetchedProjects.length > 0) {
            setActiveProject(fetchedProjects[0].id);
            setLastAccessedProject(user.uid, fetchedProjects[0].id);
          }
        });
      });
    }
  }, [user]);

  const addProject = (project) => {
    setProjects([...projects, project]);
  };

  const updateActiveProject = (projectId) => {
    setActiveProject(projectId);
    if (user) {
      setLastAccessedProject(user.uid, projectId);
    }
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