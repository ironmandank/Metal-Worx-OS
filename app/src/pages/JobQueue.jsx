import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function JobQueue() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setJobs(data);
  }

  return (
    <div className="layout">
      <main className="content">
        <header className="page-header">
          <div>
            <h1>Job Queue</h1>
            <p>Live production jobs from Supabase</p>
          </div>
        </header>

        <div className="dashboard-card">
          {jobs.length === 0 && <p>No jobs found.</p>}

          {jobs.map((job) => (
            <div className="job-card" key={job.id}>
              <div>
                <h3>{job.job_name}</h3>
                <p>{job.customer_name}</p>
              </div>

              <div>
                <strong>{job.current_station}</strong>
                <p>{job.priority}</p>
              </div>

              <div>
                <span>Due: {job.due_date || "Not set"}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default JobQueue;