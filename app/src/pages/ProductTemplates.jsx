import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Sidebar from "../components/Sidebar";

function ProductTemplates({ setPage }) {
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const { data, error } = await supabase
      .from("product_templates")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setTemplates(data);
  }

  const filteredTemplates = templates.filter((item) => {
    const text = `${item.name} ${item.category} ${item.default_finish} ${item.default_colors}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="layout">
      <Sidebar />

      <main className="content">
        <header className="page-header">
          <div>
            <h1>Manufacturing Templates</h1>
            <p>Products, repeat builds, stock items, formulas, and online products</p>
          </div>
        </header>

        <div className="actions">
          <button
            className="primary-button"
            onClick={() => setPage("newProductTemplate")}
          >
            ➕ Add Manufacturing Template
          </button>
        </div>

        <input
          className="search-box"
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="template-grid">
          {filteredTemplates.length === 0 && (
            <div className="dashboard-card">
              <p>No product templates found.</p>
            </div>
          )}

          {filteredTemplates.map((item) => (
            <div className="template-card" key={item.id}>
              <div className="template-card-header">
                <div>
                  <span className="template-category">
                    {item.category || "Uncategorized"}
                  </span>
                  <h3>{item.name}</h3>
                </div>

                {item.is_stock_item ? (
                  <span className="stock-badge">Stock</span>
                ) : (
                  <span className="build-badge">Build</span>
                )}
              </div>

              <div className="template-details">
                <p>
                  <strong>Finish</strong>
                  {item.default_finish || "Not set"}
                </p>

                <p>
                  <strong>Colors</strong>
                  {item.default_colors || "Not set"}
                </p>

                <p>
                  <strong>Material</strong>
                  {item.material || "Not set"}
                </p>

                <p>
                  <strong>Size</strong>
                  {item.size || "Not set"}
                </p>
              </div>

              <div className="template-tags">
                {item.is_repeat_item && <span>Repeat Item</span>}
                {item.is_online_product && <span>Online</span>}
                {item.has_design_formula && <span>Design Formula</span>}
                {item.has_etch_formula && <span>Etch Formula</span>}
              </div>

              <div className="template-actions">
                <button>➕ Build</button>
<button>✏ Edit</button>
<button>📄 Copy</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default ProductTemplates;