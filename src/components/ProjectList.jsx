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
import { 
  Folder, PlusCircle, LayoutDashboard, Settings, 
  ListTodo, SortAsc, SortDesc, PanelLeftClose
} from "lucide-react";
import moduleStyles from "./ProjectModule.module.css";
import styles from "./ProjectTaskItem.module.css";

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
    <div className="container mt-4">
      <h1 className={moduleStyles.title}>My Projects</h1>
      
      <div className="row mt-4 mb-5">
        {/* Left column: New Project Form */}
        <div className="col-md-5">
          <div className={moduleStyles.container}>
            <h2 className={moduleStyles.subtitle}>
              <PlusCircle size={20} />
              <span>Create New Project</span>
            </h2>
            <form onSubmit={handleCreateProject}>
              <div className={moduleStyles.formGroup}>
                <label htmlFor="projectName" className={moduleStyles.label}>
                  Project Name
                </label>
                <input
                  type="text"
                  className={moduleStyles.input}
                  id="projectName"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  disabled={formDisabled}
                  placeholder="Enter project name"
                />
              </div>
              {error && <div className={`${moduleStyles.alert} ${moduleStyles.alertDanger}`}>{error}</div>}
              <button
                type="submit"
                className={`${moduleStyles.button} ${moduleStyles.primaryButton}`}
                disabled={formDisabled}
              >
                {formDisabled ? "Initializing..." : "Create Project"}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Project List */}
        <div className="col-md-7">
          <div className={moduleStyles.container}>
            <h2 className={moduleStyles.subtitle}>
              <Folder size={20} />
              <span>My Projects</span>
            </h2>
            
            {projects.length > 0 ? (
              <ul className={moduleStyles.list}>
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className={moduleStyles.listItem}
                  >
                    {editingProjectId === project.id ? (
                      <form
                        onSubmit={handleEditSubmit}
                        className="d-flex w-100"
                      >
                        <input
                          type="text"
                          className={moduleStyles.input}
                          value={editingProjectName}
                          onChange={handleEditChange}
                          autoFocus
                          style={{ marginRight: '0.5rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="submit"
                            className={`${moduleStyles.button} ${moduleStyles.primaryButton}`}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={`${moduleStyles.button} ${moduleStyles.secondaryButton}`}
                            onClick={handleEditCancel}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <a
                          href="#"
                          onClick={() => handleProjectClick(project.id)}
                          className={moduleStyles.listItemLink}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <LayoutDashboard size={16} />
                            <span>{project.name}</span>
                          </div>
                        </a>
                        <div className={moduleStyles.listItemActions}>
                          <button
                            className={`${moduleStyles.iconButton}`}
                            onClick={() => handleEditClick(project)}
                            title="Edit project"
                          >
                            <Settings size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={moduleStyles.emptyState}>
                <p>You don't have any projects yet. Create one using the form on the left!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tasks Overview Section */}
      <div className={moduleStyles.container}>
        <div className={moduleStyles.header}>
          <h2 className={moduleStyles.subtitle}>
            <ListTodo size={20} />
            <span>Tasks Across All Projects</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="sortTasks" className="text-muted d-none d-sm-block" style={{ fontSize: '0.875rem', marginBottom: 0 }}>
              View:
            </label>
            <select
              id="sortTasks"
              className={moduleStyles.input}
              value={sortBy}
              onChange={handleSortChange}
              style={{ width: 'auto', marginBottom: 0 }}
            >
              <option value="priority">Sort by Priority</option>
              <option value="project">Group by Project</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className={moduleStyles.loading}>Loading tasks...</div>
        ) : allTasks.length > 0 ? (
          <>
            {sortBy === "project" ? (
              // When sorted by project, group tasks with project headers
              <div>
                {/* Get unique projects and sort them alphabetically */}
                {[...new Set(allTasks.map(task => task.projectName))].sort().map(projectName => (
                  <div key={projectName} className={styles.projectSection}>
                    <h4 className={styles.projectHeader}>
                      <span className={styles.projectHeaderName}>
                        <Folder size={16} />
                        {projectName}
                      </span>
                    </h4>
                    <ul className={`list-group ${styles.taskList}`}>
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
              <ul className={`list-group ${styles.taskList}`}>
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
          <div className={moduleStyles.emptyState}>
            <p>No tasks added yet. Create a project and add some tasks to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectList;