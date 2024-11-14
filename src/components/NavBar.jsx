import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../services/firebaseAuth";
import { useProjectContext } from "../contexts/ProjectContext";
import LogoutButton from "./LogoutButton";
import styles from "./NavBar.module.css";

const NavBar = ({ user }) => {
  const navigate = useNavigate();
  const { projects, activeProject, updateActiveProject, displayName } =
    useProjectContext();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleProjectChange = (e) => {
    const newProjectId = e.target.value;
    updateActiveProject(newProjectId);
    navigate(`/project/${newProjectId}`);
  };

  const appTitle =
    user && displayName ? `${displayName}'s Cognify` : "My Cognify";

  return (
    <nav className={`navbar navbar-expand-lg ${styles.customNavbar}`}>
      <div className="container-fluid">
        <Link
          className={`navbar-brand ${styles.navBrand}`}
          to={user ? "/projects" : "/login"}
        >
          {appTitle}
        </Link>
        <button
          className={`navbar-toggler ${styles.navToggler}`}
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {user ? (
              <>
                <li className="nav-item">
                  <select
                    className={`form-select ${styles.projectSelect}`}
                    value={activeProject || ""}
                    onChange={handleProjectChange}
                  >
                    {projects.length === 0 ? (
                      <option value="">Select Project</option>
                    ) : (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))
                    )}
                  </select>
                </li>
                {activeProject && projects.length > 0 && (
                  <>
                    <li className="nav-item">
                      <Link
                        className="nav-link"
                        to={`/project/${activeProject}`}
                      >
                        Dashboard
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        className="nav-link"
                        to={`/project/${activeProject}/documents`}
                      >
                        Documents
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        className="nav-link"
                        to={`/project/${activeProject}/focus`}
                      >
                        Focus
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        className="nav-link"
                        to={`/project/${activeProject}/ai-assistant`}
                      >
                        AI Assistant
                      </Link>
                    </li>
                  </>
                )}
                <li className="nav-item">
                  <LogoutButton />
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">
                    Sign In
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
