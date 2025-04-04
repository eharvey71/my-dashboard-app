import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProject,
  updateProject,
  getTasks,
  deleteTask,
} from "../services/firebaseConfig";
import { useProjectContext } from "../contexts/ProjectContext";
import ProjectTaskItem from "./ProjectTaskItem";
import styles from "./FullPageTasks.module.css";
import projectStyles from "./ProjectTaskItem.module.css";

const ProjectList = ({ user }) => {
  const [newProjectName, setNewProjectName] = useState("");
  const [error, setError] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { projects, addProject, updateActiveProject, updateProjectName } =
    useProjectContext();
  const [sortBy, setSortBy] = useState("priority");
  const navigate = useNavigate();

  useEffect(() => {
    const checkReady = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsReady(true);
    };
    checkReady();
  }, []);

  const sortTasks = (tasks, sortMethod) => {
    return [...tasks].sort((a, b) => {
      if (sortMethod === "project") {
        // Sort by project name first, then by priority
        if (a.projectName !== b.projectName) {
          return a.projectName.localeCompare(b.projectName);
        }
      }

      // Default priority sorting
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.priority === undefined && b.priority === undefined) return 0;
      if (a.priority === undefined) return 1;
      if (b.priority === undefined) return -1;
      return a.priority - b.priority;
    });
  };

  useEffect(() => {
    const fetchAllTasks = async () => {
      if (!user || !projects.length) {
        setLoading(false);
        return;
      }

      try {
        const taskPromises = projects.map((project) =>
          getTasks(user.uid, project.id).then((tasks) =>
            tasks.map((task) => ({
              ...task,
              projectName: project.name,
              projectId: project.id,
            }))
          )
        );

        const projectTasks = await Promise.all(taskPromises);
        const flattenedTasks = projectTasks.flat();
        const sortedTasks = sortTasks(flattenedTasks, sortBy);
        setAllTasks(sortedTasks);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        setLoading(false);
      }
    };

    fetchAllTasks();
  }, [user, projects, sortBy]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError("");

    if (!isReady) {
      console.log("Waiting for context to be ready...");
      return;
    }

    if (!newProjectName.trim()) {
      setError("Project name cannot be empty");
      return;
    }

    try {
      console.log("Creating new project...");
      const newProject = await createProject(user.uid, newProjectName.trim());
      console.log("Project created:", newProject);

      addProject(newProject);
      setNewProjectName("");
      await updateActiveProject(newProject.id);

      await new Promise((resolve) => {
        setTimeout(() => {
          console.log("State update cycle completed");
          resolve();
        }, 0);
      });

      window.location.href = `/project/${newProject.id}`;
    } catch (error) {
      console.error("Error in project creation:", error);
      setError("Failed to create project. Please try again.");
    }
  };

  const handleProjectClick = (projectId) => {
    updateActiveProject(projectId);
    navigate(`/project/${projectId}`);
  };

  const handleEditClick = (project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleEditChange = (e) => {
    setEditingProjectName(e.target.value);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProjectName.trim()) {
      setError("Project name cannot be empty");
      return;
    }
    try {
      await updateProject(editingProjectId, {
        name: editingProjectName.trim(),
      });
      updateProjectName(editingProjectId, editingProjectName.trim());
      setEditingProjectId(null);
      setEditingProjectName("");
      setError("");
    } catch (error) {
      setError("Failed to update project name. Please try again.");
    }
  };

  const handleEditCancel = () => {
    setEditingProjectId(null);
    setEditingProjectName("");
    setError("");
  };

  const handleTaskUpdate = async () => {
    const taskPromises = projects.map((project) =>
      getTasks(user.uid, project.id).then((tasks) =>
        tasks.map((task) => ({
          ...task,
          projectName: project.name,
          projectId: project.id,
        }))
      )
    );

    const projectTasks = await Promise.all(taskPromises);
    const flattenedTasks = projectTasks.flat();
    const sortedTasks = sortTasks(flattenedTasks, sortBy); // Use current sortBy value
    setAllTasks(sortedTasks);
  };
  
  const handleTaskDelete = async (taskId) => {
    try {
      // First delete the task from the database
      await deleteTask(taskId);
      
      // Then update the UI by removing the task from allTasks
      setAllTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const formDisabled = !isReady;

  return (
    <div className="container mt-5">
      <h2 className="mb-4">My Projects</h2>
      <div className="row mb-5">
        {/* Left column: New Project Form */}
        <div className="col-md-5">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title">Create New Project</h3>
              <form onSubmit={handleCreateProject}>
                <div className="mb-3">
                  <label htmlFor="projectName" className="form-label">
                    Project Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="projectName"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    required
                    disabled={formDisabled}
                  />
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formDisabled}
                >
                  {formDisabled ? "Initializing..." : "Create Project"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right column: Project List */}
        <div className="col-md-7">
          {projects.length > 0 ? (
            <div className="card">
              <div className="card-body">
                <h3 className="card-title">Existing Projects</h3>
                <ul className="list-group">
                  {projects.map((project) => (
                    <li
                      key={project.id}
                      className="list-group-item d-flex justify-content-between align-items-center"
                    >
                      {editingProjectId === project.id ? (
                        <form
                          onSubmit={handleEditSubmit}
                          className="d-flex w-100"
                        >
                          <input
                            type="text"
                            className="form-control me-2"
                            value={editingProjectName}
                            onChange={handleEditChange}
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="btn btn-success btn-sm me-1"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleEditCancel}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <a
                            href="#"
                            onClick={() => handleProjectClick(project.id)}
                            className="text-decoration-none flex-grow-1"
                          >
                            {project.name}
                          </a>
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => handleEditClick(project)}
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <p className="card-text">
                  You don't have any projects yet. Create one using the form on
                  the left!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tasks Overview Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">Tasks Across All Projects</h3>
        <div className="d-flex align-items-center">
          <label htmlFor="sortTasks" className="me-2 text-muted d-none d-sm-block">
            View:
          </label>
          <select
            id="sortTasks"
            className="form-select w-auto"
            value={sortBy}
            onChange={handleSortChange}
            style={{ 
              borderColor: "#63b3ed", 
              borderRadius: "6px",
              background: "linear-gradient(to bottom, #ffffff, #f8f9fa)",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
            }}
          >
            <option value="priority">Sort by Priority</option>
            <option value="project">Group by Project</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div>Loading tasks...</div>
          ) : allTasks.length > 0 ? (
            <>
              {sortBy === "project" ? (
                // When sorted by project, group tasks with project headers
                <div>
                  {/* Get unique projects and sort them alphabetically */}
                  {[...new Set(allTasks.map(task => task.projectName))].sort().map(projectName => (
                    <div key={projectName} className={projectStyles.projectSection}>
                      <h4 className={projectStyles.projectHeader}>
                        <span className={projectStyles.projectHeaderName}>{projectName}</span>
                      </h4>
                      <ul className={`list-group ${styles.taskList} ${styles.fullPageTaskGrid}`}>
                        {allTasks
                          .filter(task => task.projectName === projectName)
                          .map(task => (
                            <ProjectTaskItem
                              key={task.id}
                              task={task}
                              projectName={task.projectName}
                              onTaskUpdate={handleTaskUpdate}
                              onTaskDelete={handleTaskDelete}
                            />
                          ))
                        }
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                // When sorted by priority, show all tasks with inline project badges
                <ul className={`list-group ${styles.taskList} ${styles.fullPageTaskGrid}`}>
                  {allTasks.map((task) => (
                    <ProjectTaskItem
                      key={task.id}
                      task={task}
                      projectName={task.projectName}
                      onTaskUpdate={handleTaskUpdate}
                      onTaskDelete={handleTaskDelete}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted mb-0">
                No tasks added yet. Create a project and add some tasks to get
                started!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectList;
