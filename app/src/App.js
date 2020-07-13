import React from "react";
import {
  BrowserRouter as Router,
  Route,
  useLocation,
} from "react-router-dom";
import './App.css';

function App() {
  return (
      <Router>
        <Home />
      </Router>
  );
}

// A custom hook that builds on useLocation to parse
// the query string for you.
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Home() {
  let query = useQuery();

  return (
      <div>
        <h3>
          The <code>value</code> in the query string token is &quot;{query.get("token")}
          &quot;
        </h3>
      </div>
  );
}

export default App;
