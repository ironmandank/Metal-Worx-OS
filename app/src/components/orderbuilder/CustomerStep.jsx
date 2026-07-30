import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function CustomerStep() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setCustomers(data || []);
  }

  const filteredCustomers = customers.filter((customer) => {
    const text = `${customer.first_name || ""} ${customer.last_name || ""} ${
      customer.company_name || ""
    } ${customer.phone || ""} ${customer.email || ""}`.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="dashboard-card">
      <h2>Step 1: Select Customer</h2>

      <input
        className="search-box"
        type="text"
        placeholder="Search customers by name, company, phone, or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ marginTop: "20px" }}>
        <h3>Customers</h3>

        {filteredCustomers.length === 0 && (
          <div className="dashboard-card">No customers found.</div>
        )}

        {filteredCustomers.map((customer) => (
          <div className="customer-select-card" key={customer.id}>
            <strong>
              {customer.company_name ||
                `${customer.first_name || ""} ${customer.last_name || ""}`}
            </strong>

            <p>{customer.phone || "No phone"}</p>
            <p>{customer.email || "No email"}</p>
          </div>
        ))}
      </div>

      <button className="primary-button" style={{ marginTop: "20px" }}>
        + New Customer
      </button>
    </div>
  );
}

export default CustomerStep;