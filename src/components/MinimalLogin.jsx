// MinimalLogin.jsx
import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './AuthForms.css';

const MinimalLogin = () => (
  <div className="auth-container">
    <h2>Login</h2>
    <form>
      <div className="form-group">
        <label htmlFor="testEmail">Email:</label>
        <input type="email" id="testEmail" className="form-control" />
      </div>
      <div className="form-group">
        <label htmlFor="testPassword">Password:</label>
        <input type="password" id="testPassword" className="form-control" />
      </div>
      <button type="submit" className="btn btn-primary">Login</button>
    </form>
  </div>
);

export default MinimalLogin;
