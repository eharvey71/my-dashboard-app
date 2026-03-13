// ProjectContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import {
  getUserProjects,
  getLastAccessedProject,
  setLastAccessedProject,
} from "../services/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

const ProjectContext = createContext();

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectProvider = ({ children, user }) => {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeProjectType, setActiveProjectType] = useState('general');
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (user) {
      // Load projects
      getUserProjects(user.uid).then((fetchedProjects) => {
        setProjects(fetchedProjects);
        getLastAccessedProject(user.uid).then((lastProjectId) => {
          if (
            lastProjectId &&
            fetchedProjects.some((p) => p.id === lastProjectId)
          ) {
            setActiveProject(lastProjectId);
          } else if (fetchedProjects.length > 0) {
            setActiveProject(fetchedProjects[0].id);
            setLastAccessedProject(user.uid, fetchedProjects[0].id);
          }
        });
      });

      // Load user display name
      const loadUserData = async () => {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setDisplayName(userDoc.data().displayName || "");
        }
      };
      loadUserData();
    } else {
      setDisplayName("");
    }
  }, [user]);

  // Load active project type when activeProject changes
  useEffect(() => {
    const loadProjectType = async () => {
      if (activeProject) {
        try {
          const projectRef = doc(db, "projects", activeProject);
          const projectDoc = await getDoc(projectRef);
          if (projectDoc.exists()) {
            const projectData = projectDoc.data();
            setActiveProjectType(projectData.projectType || 'general');
          }
        } catch (error) {
          console.error("Error loading project type:", error);
          setActiveProjectType('general');
        }
      } else {
        setActiveProjectType('general');
      }
    };
    loadProjectType();
  }, [activeProject]);

  const updateDisplayName = (newName) => {
    setDisplayName(newName);
  };

  const addProject = (project) => {
    setProjects([...projects, project]);
  };

  const updateActiveProject = async (projectId) => {
    console.log("ProjectContext: Setting active project:", projectId);
    setActiveProject(projectId);
    if (user) {
      console.log(
        "ProjectContext: Updating last accessed project in Firestore"
      );
      await setLastAccessedProject(user.uid, projectId);
      console.log("ProjectContext: Last accessed project updated");
    }
  };

  const updateProjectName = (projectId, newName) => {
    setProjects(
      projects.map((project) =>
        project.id === projectId ? { ...project, name: newName } : project
      )
    );
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        addProject,
        activeProject,
        activeProjectType,
        updateActiveProject,
        updateProjectName,
        displayName,
        updateDisplayName,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
