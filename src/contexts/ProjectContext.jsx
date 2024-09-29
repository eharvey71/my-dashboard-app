import React, { createContext, useState, useContext, useEffect } from 'react';
import { getUserProjects } from '../services/firebaseConfig';

const ProjectContext = createContext();

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, user }) => {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      if (user) {
        const userProjects = await getUserProjects(user.uid);
        setProjects(userProjects);
        if (userProjects.length > 0 && !activeProject) {
          setActiveProject(userProjects[0].id);
        }
      }
    };
    fetchProjects();
  }, [user, activeProject]);

  const addProject = (newProject) => {
    setProjects(prevProjects => [...prevProjects, newProject]);
    setActiveProject(newProject.id);
  };

  const updateActiveProject = (projectId) => {
    setActiveProject(projectId);
  };

  return (
    <ProjectContext.Provider value={{ projects, activeProject, addProject, updateActiveProject }}>
      {children}
    </ProjectContext.Provider>
  );
};