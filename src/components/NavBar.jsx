import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../services/firebaseAuth";
import { useProjectContext } from "../contexts/ProjectContext";
import LogoutButton from "./LogoutButton";
import WeatherWidget from "./WeatherWidget";
import TimeWidget from "./TimeWidget";
import {
  ChevronDown,
  Layout,
  Brain,
  Sparkles,
  Timer,
  Menu,
  FileText,
  CheckSquare,
  StickyNote,
  Bookmark,
} from "lucide-react";
import styles from "./NavBar.module.css";

const NavBar = ({ user }) => {
  const navigate = useNavigate();
  const { projects, activeProject, updateActiveProject, displayName } =
    useProjectContext();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);

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

  const handleToolsClick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    setIsToolsOpen(!isToolsOpen);
    if (window.innerWidth <= 991.98) {
      // On mobile, close other menus when opening tools
      setIsAccountOpen(false);
      setIsCollectionsOpen(false);
    }
  };

  const handleCollectionsClick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    setIsCollectionsOpen(!isCollectionsOpen);
    if (window.innerWidth <= 991.98) {
      // On mobile, close other menus when opening collections
      setIsAccountOpen(false);
      setIsToolsOpen(false);
    }
  };

  const handleAccountClick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    setIsAccountOpen(!isAccountOpen);
    if (window.innerWidth <= 991.98) {
      // On mobile, close other menus when opening account
      setIsToolsOpen(false);
      setIsCollectionsOpen(false);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      // Only handle desktop click-outside behavior
      if (window.innerWidth > 991.98) {
        if (!event.target.closest(`.${styles.toolsDropdown}`)) {
          setIsToolsOpen(false);
        }
        if (!event.target.closest(`.${styles.collectionsDropdown}`)) {
          setIsCollectionsOpen(false);
        }
        if (!event.target.closest(`.${styles.accountDropdown}`)) {
          setIsAccountOpen(false);
        }
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Add a handler for the mobile menu to close dropdowns when collapsing
  useEffect(() => {
    if (!isNavExpanded) {
      setIsToolsOpen(false);
      setIsCollectionsOpen(false);
      setIsAccountOpen(false);
    }
  }, [isNavExpanded]);

  return (
    <nav className={`navbar navbar-expand-lg ${styles.customNavbar}`}>
      <div className="container-fluid">
        <Link className={styles.navBrand} to={user ? "/projects" : "/login"}>
          <Layout className={styles.brandIcon} />
          {appTitle}
        </Link>

        <button
          className={`navbar-toggler ${styles.navToggler}`}
          type="button"
          onClick={() => setIsNavExpanded(!isNavExpanded)}
          aria-expanded={isNavExpanded}
          aria-label="Toggle navigation"
        >
          <Menu size={24} />
        </button>

        <div
          className={`collapse navbar-collapse ${isNavExpanded ? "show" : ""}`}
        >
          <ul className={`navbar-nav ms-auto ${styles.navList}`}>
            {user && (
              <>
                <li
                  className={`nav-item ${styles.navItem} ${styles.widgetItem}`}
                >
                  <TimeWidget timezone={user.timezone || "UTC"} />
                </li>
                <li
                  className={`nav-item ${styles.navItem} ${styles.widgetItem}`}
                >
                  {user.city ? (
                    <WeatherWidget
                      key={`${user.city}-${user.unit}`}
                      city={user.city}
                      unit={user.unit || "metric"}
                    />
                  ) : (
                    <Link to="/account" className={styles.navLink}>
                      Set location
                    </Link>
                  )}
                </li>
              </>
            )}
            {user ? (
              <>
                <li className={`nav-item ${styles.navItem}`}>
                  <select
                    className={styles.projectSelect}
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
                    <li className={`nav-item ${styles.navItem}`}>
                      <Link
                        className={styles.navLink}
                        to={`/project/${activeProject}`}
                      >
                        Dashboard
                      </Link>
                    </li>
                    <li
                      className={`nav-item ${styles.navItem} ${styles.collectionsDropdown}`}
                    >
                      <button
                        className={`${styles.navLink} ${styles.dropdownToggle}`}
                        onClick={handleCollectionsClick}
                      >
                        Collections{" "}
                        <ChevronDown
                          size={16}
                          className={styles.dropdownIcon}
                        />
                      </button>
                      <ul
                        className={`${styles.dropdownMenu} ${
                          isCollectionsOpen ? styles.show : ""
                        }`}
                      >
                        <li>
                          <Link
                            to={`/project/${activeProject}/documents`}
                            className={styles.dropdownItem}
                          >
                            <FileText size={16} /> Documents
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={`/project/${activeProject}/tasks`}
                            className={styles.dropdownItem}
                          >
                            <CheckSquare size={16} /> Tasks
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={`/project/${activeProject}/notes`}
                            className={styles.dropdownItem}
                          >
                            <StickyNote size={16} /> Notes
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={`/project/${activeProject}/bookmarks`}
                            className={styles.dropdownItem}
                          >
                            <Bookmark size={16} /> Bookmarks
                          </Link>
                        </li>
                      </ul>
                    </li>
                    <li
                      className={`nav-item ${styles.navItem} ${styles.toolsDropdown}`}
                    >
                      <button
                        className={`${styles.navLink} ${styles.dropdownToggle}`}
                        onClick={handleToolsClick}
                      >
                        Tools{" "}
                        <ChevronDown
                          size={16}
                          className={styles.dropdownIcon}
                        />
                      </button>
                      <ul
                        className={`${styles.dropdownMenu} ${
                          isToolsOpen ? styles.show : ""
                        }`}
                      >
                        <li>
                          <Link
                            to={`/project/${activeProject}/focus`}
                            className={styles.dropdownItem}
                          >
                            <Timer size={16} /> Focus Timer
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={`/project/${activeProject}/ai-assistant`}
                            className={styles.dropdownItem}
                          >
                            <Sparkles size={16} /> AI Assistant
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={`/project/${activeProject}/synapses`}
                            className={styles.dropdownItem}
                          >
                            <Brain size={16} /> Synapses
                          </Link>
                        </li>
                      </ul>
                    </li>
                    <li
                      className={`nav-item ${styles.navItem} ${styles.accountDropdown}`}
                    >
                      <button
                        className={`${styles.navLink} ${styles.dropdownToggle}`}
                        onClick={handleAccountClick}
                      >
                        Account{" "}
                        <ChevronDown
                          size={16}
                          className={styles.dropdownIcon}
                        />
                      </button>
                      <ul
                        className={`${styles.dropdownMenu} ${
                          isAccountOpen ? styles.show : ""
                        }`}
                      >
                        <li>
                          <Link
                            className={styles.dropdownItem}
                            to="/account"
                            onClick={() => setIsAccountOpen(false)}
                          >
                            Profile Settings
                          </Link>
                        </li>
                        <li>
                          <hr className={styles.dropdownDivider} />
                        </li>
                        <li>
                          <button
                            className={styles.dropdownItem}
                            onClick={() => {
                              setIsAccountOpen(false);
                              handleLogout();
                            }}
                          >
                            Logout
                          </button>
                        </li>
                      </ul>
                    </li>
                  </>
                )}
              </>
            ) : (
              <li className={`nav-item ${styles.navItem}`}>
                <Link className={styles.navLink} to="/login">
                  Sign In
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
