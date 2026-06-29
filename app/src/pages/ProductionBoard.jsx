import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Sidebar from "../components/Sidebar";

function ProductionBoard({ setPage, setSelectedJob }) {
  const [jobs, setJobs] = useState([]);

  const stations = [
  "Needs Estimate",
  "Scheduled Site Visit",
  "Needs Design",
  "Customer Approval",
  "Ready for Production",
  "Design",
  "Laser",
  "Prep",
  "Paint",
  "Powder Coat",
  "QC",
  "Showroom",
  "Shipping",
  "Completed",
  "On Hold",
];

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
      <Sidebar />

      <main className="content">
        <header className="page-header">
          <div>
            <h1>Production Board</h1>
            <p>Live shop workflow by station</p>
          </div>
        </header>

        <div className="production-board">
          {stations.map((station) => (
            <section className="station-column" key={station}>
              <h2>{station}</h2>

              {jobs
                .filter((job) => job.current_station === station)
                .map((job) => (
                  <div
  className="production-card"
  key={job.id}
  onClick={() => {
    setSelectedJob(job);
    setPage("jobDetails");
  }}
>
                    <strong>{job.job_name}</strong>
                    <span>{job.customer_name}</span>
                    <small>{job.priority}</small>
                  </div>
                ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

export default ProductionBoard;