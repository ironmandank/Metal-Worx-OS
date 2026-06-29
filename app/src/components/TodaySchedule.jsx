function TodaySchedule() {
  const schedule = [
    {
      time: "8:00 AM",
      task: "Smith Rail - Laser",
    },
    {
      time: "10:00 AM",
      task: "Jones Flag Pickup",
    },
    {
      time: "1:00 PM",
      task: "Fort Bragg Repair",
    },
    {
      time: "3:30 PM",
      task: "Install Hand Rail",
    },
  ];

  return (
    <div className="dashboard-card">
      <h2>📅 Today's Schedule</h2>

      {schedule.map((item, index) => (
        <div className="status-row" key={index}>
          <span>{item.time}</span>
          <strong>{item.task}</strong>
        </div>
      ))}
    </div>
  );
}

export default TodaySchedule;