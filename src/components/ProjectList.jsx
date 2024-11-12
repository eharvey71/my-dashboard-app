import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, updateProject } from "../services/firebaseConfig";
import { useProjectContext } from "../contexts/ProjectContext";

const ProjectList = ({ user }) => {
  const [newProjectName, setNewProjectName] = useState("");
  const [error, setError] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const { projects, addProject, updateActiveProject, updateProjectName } =
    useProjectContext();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for context to be ready
    const checkReady = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Give context time to initialize
      setIsReady(true);
    };
    checkReady();
  }, []);

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

      // Add to context first
      console.log("Adding project to context...");
      addProject(newProject);

      // Clear input
      setNewProjectName("");

      // Update active project in context
      console.log("Setting active project:", newProject.id);
      await updateActiveProject(newProject.id);

      // Force a state update cycle to complete
      await new Promise((resolve) => {
        setTimeout(() => {
          console.log("State update cycle completed");
          resolve();
        }, 0);
      });

      // Navigate after state is updated
      console.log("Navigating to new project...");
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

  // Disable the form until ready
  const formDisabled = !isReady;

  return (
    <div className="container mt-5">
      <h2 className="mb-4">My Projects</h2>
      <div className="row">
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
    </div>
  );
};

export default ProjectList;
