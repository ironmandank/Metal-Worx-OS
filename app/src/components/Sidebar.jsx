function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo-area">
        <h2>Metal Worx</h2>
        <p>Operations System</p>
      </div>

      <nav>
        <ul>
          <li>🏠 Dashboard</li>
          <li>👥 Customers</li>
          <li>💲 Quotes</li>
          <li>📋 Orders</li>
          <li>🎨 Design</li>
          <li>🔥 Laser</li>
          <li>🔧 Prep</li>
          <li>🖌 Paint</li>
          <li>✅ QC / Showroom</li>
          <li>📦 Shipping</li>
          <li>📅 Calendar</li>
          <li>📊 Reports</li>
          <li>⚙ Settings</li>
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;