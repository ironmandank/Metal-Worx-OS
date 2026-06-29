import { useState } from "react";

import Dashboard from "./pages/Dashboard";
import NewJob from "./pages/NewJob";
import JobQueue from "./pages/JobQueue";
import ProductionBoard from "./pages/ProductionBoard";
import JobDetails from "./pages/JobDetails";
import ProductTemplates from "./pages/ProductTemplates";
import NewProductTemplate from "./pages/NewProductTemplate";

import "./App.css";

function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedJob, setSelectedJob] = useState(null);

  if (page === "newJob") {
    return <NewJob setPage={setPage} />;
  }

  if (page === "jobQueue") {
    return <JobQueue setPage={setPage} />;
  }

  if (page === "productionBoard") {
    return (
      <ProductionBoard
        setPage={setPage}
        setSelectedJob={setSelectedJob}
      />
    );
  }

  if (page === "jobDetails") {
    return (
      <JobDetails
        selectedJob={selectedJob}
        setPage={setPage}
      />
    );
  }

  if (page === "productTemplates") {
    return <ProductTemplates setPage={setPage} />;
  }

  if (page === "newProductTemplate") {
    return <NewProductTemplate setPage={setPage} />;
  }

  return <Dashboard setPage={setPage} />;
}

export default App;