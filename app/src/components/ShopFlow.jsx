function ShopFlow() {
  const stations = [
    { name: "Design", count: 3, status: "normal" },
    { name: "Laser", count: 7, status: "warning" },
    { name: "Prep", count: 2, status: "normal" },
    { name: "Paint", count: 5, status: "warning" },
    { name: "Powder", count: 1, status: "normal" },
    { name: "QC", count: 4, status: "normal" },
    { name: "Showroom", count: 6, status: "normal" },
  ];

  return (
    <div className="dashboard-card">
      <h2>🏭 Shop Flow</h2>

      <div className="shop-flow">
        {stations.map((station, index) => (
          <div className="flow-step" key={station.name}>
            <div className={`flow-box ${station.status}`}>
              <span>{station.name}</span>
              <strong>{station.count} Jobs</strong>
            </div>

            {index < stations.length - 1 && (
              <div className="flow-arrow">↓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShopFlow;