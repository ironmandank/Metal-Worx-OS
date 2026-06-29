import { useState } from "react";
import { supabase } from "../lib/supabase";
import Sidebar from "../components/Sidebar";

function NewProductTemplate({ setPage }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "Flag",
    default_finish: "",
    default_colors: "",
    default_quantity: 1,
    layer_count: "",
    material: "",
    material_thickness: "",
    size: "",
    is_stock_item: false,
    stock_quantity: 0,
    reorder_quantity: 0,
    is_repeat_item: false,
    has_design_formula: false,
    design_formula_notes: "",
    has_etch_formula: false,
    etch_formula_notes: "",
    default_workflow_name: "",
    is_online_product: false,
    online_sku: "",
    website_product_url: "",
    online_price: "",
    notes: "",
    is_active: true,
  });

  const [message, setMessage] = useState("");

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const { error } = await supabase.from("product_templates").insert([
      {
        ...formData,
        default_quantity: Number(formData.default_quantity),
        layer_count: formData.layer_count ? Number(formData.layer_count) : null,
        stock_quantity: Number(formData.stock_quantity),
        reorder_quantity: Number(formData.reorder_quantity),
        online_price: formData.online_price ? Number(formData.online_price) : null,
      },
    ]);

    if (error) {
      console.error(error);
      setMessage("❌ Error saving product template.");
      return;
    }

    setMessage("✅ Product template saved.");
  }

  return (
    <div className="layout">
      <Sidebar />

      <main className="content">
        <header className="page-header">
          <div>
            <h1>New Product Template</h1>
            <p>Create a reusable manufacturing template</p>
          </div>
        </header>

        <form className="dashboard-card" onSubmit={handleSubmit}>
          <label>Product Name</label>
          <input
            className="form-input"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder='24" JSOC Patina Flag'
          />

          <label>Category</label>
          <select
            className="form-input"
            name="category"
            value={formData.category}
            onChange={handleChange}
          >
            <option>Flag</option>
            <option>Custom Art</option>
            <option>Sign</option>
            <option>Gate</option>
            <option>Hand Rail</option>
            <option>Fence</option>
            <option>Repair</option>
            <option>Powder Coat</option>
            <option>Sandblasting</option>
            <option>Laser Cutting</option>
          </select>

          <label>Size</label>
          <input
            className="form-input"
            name="size"
            value={formData.size}
            onChange={handleChange}
            placeholder='24 inch'
          />

          <label>Material</label>
          <input
            className="form-input"
            name="material"
            value={formData.material}
            onChange={handleChange}
            placeholder="Steel"
          />

          <label>Material Thickness</label>
          <input
            className="form-input"
            name="material_thickness"
            value={formData.material_thickness}
            onChange={handleChange}
            placeholder="14 gauge"
          />

          <label>Layer Count</label>
          <input
            className="form-input"
            name="layer_count"
            type="number"
            value={formData.layer_count}
            onChange={handleChange}
          />

          <label>Default Finish</label>
          <input
            className="form-input"
            name="default_finish"
            value={formData.default_finish}
            onChange={handleChange}
            placeholder="Patina"
          />

          <label>Default Colors</label>
          <input
            className="form-input"
            name="default_colors"
            value={formData.default_colors}
            onChange={handleChange}
            placeholder="Copper, black, clear coat"
          />

          <label>Default Workflow Name</label>
          <input
            className="form-input"
            name="default_workflow_name"
            value={formData.default_workflow_name}
            onChange={handleChange}
            placeholder="Flag Workflow"
          />

          <label>Default Quantity</label>
          <input
            className="form-input"
            name="default_quantity"
            type="number"
            value={formData.default_quantity}
            onChange={handleChange}
          />

          <label>
            <input
              type="checkbox"
              name="is_stock_item"
              checked={formData.is_stock_item}
              onChange={handleChange}
            />
            Stock Item
          </label>

          <label>Stock Quantity</label>
          <input
            className="form-input"
            name="stock_quantity"
            type="number"
            value={formData.stock_quantity}
            onChange={handleChange}
          />

          <label>Reorder Quantity</label>
          <input
            className="form-input"
            name="reorder_quantity"
            type="number"
            value={formData.reorder_quantity}
            onChange={handleChange}
          />

          <label>
            <input
              type="checkbox"
              name="is_repeat_item"
              checked={formData.is_repeat_item}
              onChange={handleChange}
            />
            Repeat Item
          </label>

          <label>
            <input
              type="checkbox"
              name="has_design_formula"
              checked={formData.has_design_formula}
              onChange={handleChange}
            />
            Has Design Formula
          </label>

          <label>Design Formula Notes</label>
          <textarea
            className="form-input"
            name="design_formula_notes"
            value={formData.design_formula_notes}
            onChange={handleChange}
            placeholder="Existing design/template or formula notes"
          />

          <label>
            <input
              type="checkbox"
              name="has_etch_formula"
              checked={formData.has_etch_formula}
              onChange={handleChange}
            />
            Has Etch Formula
          </label>

          <label>Etch Formula Notes</label>
          <textarea
            className="form-input"
            name="etch_formula_notes"
            value={formData.etch_formula_notes}
            onChange={handleChange}
          />

          <label>
            <input
              type="checkbox"
              name="is_online_product"
              checked={formData.is_online_product}
              onChange={handleChange}
            />
            Online Product
          </label>

          <label>Online SKU</label>
          <input
            className="form-input"
            name="online_sku"
            value={formData.online_sku}
            onChange={handleChange}
          />

          <label>Website Product URL</label>
          <input
            className="form-input"
            name="website_product_url"
            value={formData.website_product_url}
            onChange={handleChange}
          />

          <label>Online Price</label>
          <input
            className="form-input"
            name="online_price"
            type="number"
            value={formData.online_price}
            onChange={handleChange}
          />

          <label>Notes</label>
          <textarea
            className="form-input"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
          />

          <button className="primary-button" type="submit">
            Save Product Template
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => setPage("productTemplates")}
          >
            Back to Product Templates
          </button>

          {message && <p className="save-message">{message}</p>}
        </form>
      </main>
    </div>
  );
}

export default NewProductTemplate;