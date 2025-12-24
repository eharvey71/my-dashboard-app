import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createProject,
  updateProject,
  getTasks,
  deleteTask,
} from "../services/firebaseConfig";
import { useProjectContext } from "../contexts/ProjectContext";
import { useEducation } from "../contexts/EducationContext";
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
  const { getTerm, educationMode } = useEducation();
  const [sortBy, setSortBy] = useState("priority");
  const navigate = useNavigate();

  // Academic metadata fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [projectType, setProjectType] = useState('general');
  const [term, setTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [instructor, setInstructor] = useState('');
  const [credits, setCredits] = useState('');
  const [courseCode, setCourseCode] = useState('');

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
      setError(`${getTerm("project")} name cannot be empty`);
      return;
    }

    try {
      console.log("Creating new project...");

      // Prepare metadata
      const metadata = {
        projectType,
        term: term.trim() || null,
        subject: subject.trim() || null,
        instructor: instructor.trim() || null,
        credits: credits.trim() || null,
        courseCode: courseCode.trim() || null,
      };

      const newProject = await createProject(user.uid, newProjectName.trim(), metadata);
      console.log("Project created:", newProject);

      addProject(newProject);

      // Reset form
      setNewProjectName("");
      setProjectType('general');
      setTerm('');
      setSubject('');
      setInstructor('');
      setCredits('');
      setCourseCode('');
      setShowAdvanced(false);

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
      setError(`Failed to create ${getTerm("project").toLowerCase()}. Please try again.`);
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
      setError(`${getTerm("project")} name cannot be empty`);
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
      setError(`Failed to update ${getTerm("project").toLowerCase()} name. Please try again.`);
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
      <h1 className={moduleStyles.title}>My {getTerm("projects")}</h1>
      
      <div className="row mt-4 mb-5">
        {/* Left column: New Project Form */}
        <div className="col-md-5">
          <div className={moduleStyles.container}>
            <h2 className={moduleStyles.subtitle}>
              <PlusCircle size={20} />
              <span>{getTerm("createProject")}</span>
            </h2>
            <form onSubmit={handleCreateProject}>
              <div className={moduleStyles.formGroup}>
                <label htmlFor="projectName" className={moduleStyles.label}>
                  {getTerm("project")} Name
                </label>
                <input
                  type="text"
                  className={moduleStyles.input}
                  id="projectName"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  disabled={formDisabled}
                  placeholder={`Enter ${getTerm("project").toLowerCase()} name`}
                />
              </div>

              {/* Advanced Options - Show in Education Mode */}
              {educationMode && (
                <>
                  <button
                    type="button"
                    className={`${moduleStyles.button} ${moduleStyles.secondaryButton} mb-3`}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    style={{ width: '100%' }}
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Additional Options
                    <ChevronDown size={16} style={{ marginLeft: '0.5rem', transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>

                  {showAdvanced && (
                    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                      <div className={moduleStyles.formGroup}>
                        <label htmlFor="projectType" className={moduleStyles.label}>
                          Type
                        </label>
                        <select
                          id="projectType"
                          className={moduleStyles.input}
                          value={projectType}
                          onChange={(e) => setProjectType(e.target.value)}
                          disabled={formDisabled}
                        >
                          <option value="general">General</option>
                          <option value="course">Course</option>
                          <option value="research">Research Project</option>
                          <option value="thesis">Thesis/Dissertation</option>
                          <option value="study-group">Study Group</option>
                        </select>
                      </div>

                      <div className={moduleStyles.formGroup}>
                        <label htmlFor="courseCode" className={moduleStyles.label}>
                          Course Code (e.g., CS101)
                        </label>
                        <input
                          type="text"
                          className={moduleStyles.input}
                          id="courseCode"
                          value={courseCode}
                          onChange={(e) => setCourseCode(e.target.value)}
                          disabled={formDisabled}
                          placeholder="Optional"
                        />
                      </div>

                      <div className={moduleStyles.formGroup}>
                        <label htmlFor="term" className={moduleStyles.label}>
                          Term/Semester
                        </label>
                        <input
                          type="text"
                          className={moduleStyles.input}
                          id="term"
                          value={term}
                          onChange={(e) => setTerm(e.target.value)}
                          disabled={formDisabled}
                          placeholder="e.g., Fall 2024"
                        />
                      </div>

                      <div className={moduleStyles.formGroup}>
                        <label htmlFor="subject" className={moduleStyles.label}>
                          Subject/Department
                        </label>
                        <input
                          type="text"
                          className={moduleStyles.input}
                          id="subject"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          disabled={formDisabled}
                          placeholder="e.g., Computer Science"
                        />
                      </div>

                      <div className={moduleStyles.formGroup}>
                        <label htmlFor="instructor" className={moduleStyles.label}>
                          Instructor
                        </label>
                        <input
                          type="text"
                          className={moduleStyles.input}
                          id="instructor"
                          value={instructor}
                          onChange={(e) => setInstructor(e.target.value)}
                          disabled={formDisabled}
                          placeholder="Optional"
                        />
                      </div>

                      <div className={moduleStyles.formGroup}>
                        <label htmlFor="credits" className={moduleStyles.label}>
                          Credits
                        </label>
                        <input
                          type="text"
                          className={moduleStyles.input}
                          id="credits"
                          value={credits}
                          onChange={(e) => setCredits(e.target.value)}
                          disabled={formDisabled}
                          placeholder="e.g., 3"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {error && <div className={`${moduleStyles.alert} ${moduleStyles.alertDanger}`}>{error}</div>}
              <button
                type="submit"
                className={`${moduleStyles.button} ${moduleStyles.primaryButton}`}
                disabled={formDisabled}
              >
                {formDisabled ? "Initializing..." : getTerm("createProject")}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Project List */}
        <div className="col-md-7">
          <div className={moduleStyles.container}>
            <h2 className={moduleStyles.subtitle}>
              <Folder size={20} />
              <span>My {getTerm("projects")}</span>
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
                            title={`Edit ${getTerm("project").toLowerCase()}`}
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
                <p>You don't have any {getTerm("projects").toLowerCase()} yet. Create one using the form on the left!</p>
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
            <span>{getTerm("tasks")} Across All {getTerm("projects")}</span>
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
              <option value="priority">Sort by {getTerm("priority")}</option>
              <option value="project">Group by {getTerm("project")}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className={moduleStyles.loading}>Loading {getTerm("tasks").toLowerCase()}...</div>
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
            <p>No {getTerm("tasks").toLowerCase()} added yet. Create a {getTerm("project").toLowerCase()} and add some {getTerm("tasks").toLowerCase()} to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectList;