function HighPriority() {
  const jobs = [
    {
      customer: "Smith Rail",
      reason: "Due Today",
    },
    {
      customer: "Fort Bragg Repair",
      reason: "Customer Waiting",
    },
    {
      customer: "Retirement Flag",
      reason: "Pickup Tomorrow",
    },
  ];

  return (
    <div className="dashboard-card">

      <h2>🔥 High Priority</h2>

      {jobs.map((job, index) => (
        <div className="status-row" key={index}>
          <span>{job.customer}</span>
          <strong>{job.reason}</strong>
        </div>
      ))}

    </div>
  );
}

export default HighPriority;