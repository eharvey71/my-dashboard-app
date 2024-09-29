import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { logout } from '../services/firebaseAuth';
import { getUserProjects } from '../services/firebaseConfig';

const NavBar = ({ user, displayName }) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(projectId || '');

  useEffect(() => {
    const fetchProjects = async () => {
      if (user) {
        const userProjects = await getUserProjects(user.uid);
        setProjects(userProjects);
        if (!selectedProject && userProjects.length > 0) {
          setSelectedProject(userProjects[0].id);
        }
      }
    };
    fetchProjects();
  }, [user]);

  useEffect(() => {
    if (projectId) {
      setSelectedProject(projectId);
    }
  }, [projectId]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleProjectChange = (e) => {
    const newProjectId = e.target.value;
    setSelectedProject(newProjectId);
    if (newProjectId) {
      navigate(`/project/${newProjectId}`);
    }
  };

  const appTitle = user && displayName ? `${displayName}'s Cognify` : 'My Cognify';

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/create-project">{appTitle}</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {user ? (
              <>
                <li className="nav-item">
                  <select 
                    className="form-select" 
                    value={selectedProject} 
                    onChange={handleProjectChange}
                  >
                    {projects.length === 0 ? (
                      <option value="">Select Project</option>
                    ) : (
                      projects.map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))
                    )}
                  </select>
                </li>
                {selectedProject && (
                  <>
                    <li className="nav-item">
                      <Link className="nav-link" to={`/project/${selectedProject}`}>Dashboard</Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to={`/project/${selectedProject}/documents`}>Documents</Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to={`/project/${selectedProject}/focus`}>Focus</Link>
                    </li>
                  </>
                )}
                <li className="nav-item">
                  <button className="btn btn-link nav-link" onClick={handleLogout}>Logout</button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/signup">Signup</Link>
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