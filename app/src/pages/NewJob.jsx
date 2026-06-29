import { useState } from "react";
import { supabase } from "../lib/supabase";

function NewJob() {
  const [formData, setFormData] = useState({
    customer_name: "",
    job_name: "",
    category: "Flag",
    priority: "Normal",
    date_ordered: "",
    due_date: "",
    quantity: 1,
    finish_type: "",
    paint_colors: "",
    reference_image: "",
    notes: "",
  });

  const [message, setMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const { error } = await supabase.from("jobs").insert([
      {
        ...formData,
        current_station: "Design",
        status: "In Progress",
        is_complete: false,
      },
    ]);

    if (error) {
      console.error(error);
      setMessage("❌ Error saving job.");
      return;
    }

    setMessage("✅ Job saved successfully.");

    setFormData({
      customer_name: "",
      job_name: "",
      category: "Flag",
      priority: "Normal",
      date_ordered: "",
      due_date: "",
      quantity: 1,
      finish_type: "",
      paint_colors: "",
      reference_image: "",
      notes: "",
    });
  }

  return (
    <div className="layout">
      <main className="content">
        <header className="page-header">
          <div>
            <h1>New Job</h1>
            <p>Create a new Metal Worx production job</p>
          </div>
        </header>

        <form className="dashboard-card" onSubmit={handleSubmit}>
          <label>Customer Name</label>
          <input
            className="form-input"
            name="customer_name"
            type="text"
            value={formData.customer_name}
            onChange={handleChange}
            placeholder="John Smith"
          />

          <label>Job Name</label>
          <input
            className="form-input"
            name="job_name"
            type="text"
            value={formData.job_name}
            onChange={handleChange}
            placeholder="24 inch Army Retirement Flag"
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
            <option>Hand Rail</option>
            <option>Gate</option>
            <option>Repair</option>
            <option>Powder Coat</option>
            <option>Laser Cutting</option>
          </select>

          <label>Priority</label>
          <select
            className="form-input"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
          >
            <option>Normal</option>
            <option>Rush</option>
            <option>Emergency</option>
          </select>

          <label>Date Ordered</label>
          <input
            className="form-input"
            name="date_ordered"
            type="date"
            value={formData.date_ordered}
            onChange={handleChange}
          />

          <label>Due Date</label>
          <input
            className="form-input"
            name="due_date"
            type="date"
            value={formData.due_date}
            onChange={handleChange}
          />

          <label>Quantity</label>
          <input
            className="form-input"
            name="quantity"
            type="number"
            value={formData.quantity}
            onChange={handleChange}
          />

          <label>Finish Type</label>
          <select
            className="form-input"
            name="finish_type"
            value={formData.finish_type}
            onChange={handleChange}
          >
            <option value="">Select finish type</option>
            <option>Paint</option>
            <option>Powder Coat</option>
            <option>Patina</option>
            <option>Raw Steel</option>
            <option>Clear Coat</option>
            <option>Customer Finish</option>
          </select>

          <label>Paint Colors</label>
          <input
            className="form-input"
            name="paint_colors"
            type="text"
            value={formData.paint_colors}
            onChange={handleChange}
            placeholder="Flat black, candy red, white stars"
          />

          <label>Reference Image</label>
          <input
            className="form-input"
            name="reference_image"
            type="text"
            value={formData.reference_image}
            onChange={handleChange}
            placeholder="Image link for now"
          />

          <label>Notes</label>
          <textarea
            className="form-input"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Special instructions, plaque wording, customer notes, etc."
          />

          <button className="primary-button" type="submit">
            Save Job
          </button>

          {message && <p className="save-message">{message}</p>}
        </form>
      </main>
    </div>
  );
}

export default NewJob;