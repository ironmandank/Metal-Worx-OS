import Sidebar from "../components/Sidebar";
import HighPriority from "../components/HighPriority";
import ShopFlow from "../components/ShopFlow";
import WeeklyProgress from "../components/WeeklyProgress";
import TodaySchedule from "../components/TodaySchedule";

function Dashboard({ setPage }) {
  return (
    <div className="layout">
      <Sidebar />

      <main className="content">
        <header className="page-header">
          <div>
            <h1>Metal Worx OS</h1>
            <p>Command Center</p>
          </div>

          <div className="date-box">
            <span>Today</span>
            <strong>Shop Overview</strong>
          </div>
        </header>

        <input
          className="search-box"
          type="text"
          placeholder="Search customers, orders, jobs, quotes..."
        />

        <div className="actions">
          <button onClick={() => setPage("newJob")}>➕ New Job</button>
          <button onClick={() => setPage("jobQueue")}>📋 Job Queue</button>
          <button onClick={() => setPage("productionBoard")}>
            🏭 Production Board
          </button>
          <button onClick={() => setPage("productTemplates")}>
  📚 Product Templates
</button>
          <button>👥 Customers</button>
        </div>

        <div className="grid">
          <HighPriority />
          <WeeklyProgress />
        </div>

        <ShopFlow />

        <TodaySchedule />
      </main>
    </div>
  );
}

export default Dashboard;