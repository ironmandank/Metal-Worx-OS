import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function JobDetails({ selectedJob, setPage }) {
  const [history, setHistory] = useState([]);

  const workflows = {
    Flag: [
      "Needs Design",
      "Design",
      "Laser",
      "Prep",
      "Paint",
      "QC",
      "Showroom",
      "Completed",
    ],
    "Custom Art": [
      "Needs Design",
      "Design",
      "Laser",
      "Prep",
      "Paint",
      "QC",
      "Showroom",
      "Completed",
    ],
    "Hand Rail": [
      "Needs Estimate",
      "Scheduled Site Visit",
      "Customer Approval",
      "Ready for Production",
      "Welding",
      "Prep",
      "Sandblast",
      "Powder Coat",
      "QC",
      "Installation",
      "Completed",
    ],
    Gate: [
      "Needs Estimate",
      "Scheduled Site Visit",
      "Customer Approval",
      "Ready for Production",
      "Welding",
      "Prep",
      "Sandblast",
      "Powder Coat",
      "QC",
      "Installation",
      "Completed",
    ],
    Repair: [
      "Needs Estimate",
      "Ready for Production",
      "Welding",
      "Prep",
      "QC",
      "Completed",
    ],
    "Powder Coat": [
      "Ready for Production",
      "Prep",
      "Sandblast",
      "Powder Coat",
      "QC",
      "Showroom",
      "Completed",
    ],
    "Laser Cutting": [
      "Ready for Production",
      "Laser",
      "QC",
      "Showroom",
      "Completed",
    ],
  };

  const stationOrder =
    workflows[selectedJob?.category] || workflows.Flag;

  useEffect(() => {
    if (selectedJob) {
      loadHistory();
    }
  }, [selectedJob]);

  async function loadHistory() {
    const { data, error } = await supabase
      .from("job_history")
      .select("*")
      .eq("job_id", selectedJob.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setHistory(data);
  }

  async function moveToNextStation() {
    const currentIndex = stationOrder.indexOf(selectedJob.current_station);

    if (currentIndex === -1) {
      alert("Current station is not part of this job workflow.");
      return;
    }

    if (currentIndex >= stationOrder.length - 1) {
      alert("This job is already completed.");
      return;
    }

    const nextStation = stationOrder[currentIndex + 1];

    const { error: updateError } = await supabase
      .from("jobs")
      .update({ current_station: nextStation })
      .eq("id", selectedJob.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    await supabase.from("job_history").insert([
      {
        job_id: selectedJob.id,
        moved_by: "Dan",
        notes: `Moved from ${selectedJob.current_station} to ${nextStation}`,
      },
    ]);

    alert(`Job moved to ${nextStation}`);
    setPage("productionBoard");
  }

  function printTraveler() {
    window.print();
  }

  if (!selectedJob) {
    return (
      <div className="layout">
        <main className="content">
          <h1>No Job Selected</h1>
          <button
            className="primary-button"
            onClick={() => setPage("productionBoard")}
          >
            Back to Production Board
          </button>
        </main>
      </div>
    );
  }

  const currentIndex = stationOrder.indexOf(selectedJob.current_station);

  return (
    <div className="layout">
      <main className="content">
        <header className="traveler-header">
          <div>
            <span className="eyebrow">Job Traveler</span>
            <h1>{selectedJob.job_name}</h1>
            <p>{selectedJob.customer_name}</p>
          </div>

          <div className="station-badge">
            <span>Current Station</span>
            <strong>{selectedJob.current_station}</strong>
          </div>
        </header>

        <section className="traveler-grid">
          <div className="traveler-main">
            <div className="dashboard-card">
              <h2>Workflow Progress</h2>

              <div className="workflow-list">
                {stationOrder.map((station, index) => (
                  <div
                    className={
                      index < currentIndex
                        ? "workflow-step complete"
                        : index === currentIndex
                        ? "workflow-step current"
                        : "workflow-step"
                    }
                    key={station}
                  >
                    <span>
                      {index < currentIndex
                        ? "✓"
                        : index === currentIndex
                        ? "●"
                        : "○"}
                    </span>
                    <strong>{station}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-card">
              <h2>Job Information</h2>

              <div className="info-grid">
                <p>
                  <strong>Category</strong>
                  {selectedJob.category || "Not set"}
                </p>
                <p>
                  <strong>Priority</strong>
                  {selectedJob.priority || "Normal"}
                </p>
                <p>
                  <strong>Due Date</strong>
                  {selectedJob.due_date || "Not set"}
                </p>
                <p>
                  <strong>Quantity</strong>
                  {selectedJob.quantity || 1}
                </p>
                <p>
                  <strong>Finish</strong>
                  {selectedJob.finish_type || "Not set"}
                </p>
                <p>
                  <strong>Paint Colors</strong>
                  {selectedJob.paint_colors || "Not set"}
                </p>
              </div>
            </div>

            <div className="dashboard-card">
              <h2>Notes</h2>
              <p>{selectedJob.notes || "No notes added."}</p>
            </div>

            <div className="dashboard-card">
              <h2>Job History</h2>

              {history.length === 0 && (
                <p>No history has been recorded yet.</p>
              )}

              {history.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <strong>{item.notes}</strong>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="traveler-side">
            <div className="dashboard-card">
              <h2>Reference Image</h2>

              {selectedJob.reference_image ? (
                <img
                  className="reference-preview"
                  src={selectedJob.reference_image}
                  alt="Reference"
                />
              ) : (
                <div className="empty-image">No image added</div>
              )}
            </div>

            <div className="dashboard-card">
              <h2>Actions</h2>

              <button className="primary-button" onClick={moveToNextStation}>
                Move to Next Station
              </button>

              <button className="secondary-button" onClick={printTraveler}>
                Export / Print PDF
              </button>

              <button
                className="secondary-button"
                onClick={() => setPage("productionBoard")}
              >
                Back to Board
              </button>

              <button className="danger-button">Report Issue</button>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default JobDetails;