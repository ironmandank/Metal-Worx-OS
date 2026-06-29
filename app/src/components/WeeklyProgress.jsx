function WeeklyProgress() {
  const stats = [
    { label: "Completed This Week", value: 34 },
    { label: "New Orders", value: 18 },
    { label: "Open Jobs", value: 42 },
    { label: "Jobs On Hold", value: 4 },
  ];

  return (
    <div className="dashboard-card">
      <h2>📊 Weekly Progress</h2>

      <div className="progress-grid">
        {stats.map((stat) => (
          <div className="progress-box" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeeklyProgress;