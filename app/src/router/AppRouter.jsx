import { Routes, Route } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";
import Dashboard from "../pages/Dashboard";
import Customers from "../pages/Customers";
import CustomerOrders from "../pages/CustomerOrders";
import ProductTemplates from "../pages/ProductTemplates";
import WorkflowTemplates from "../pages/WorkflowTemplates";

function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
      />

      <Route
        path="/customers"
        element={
          <AppLayout>
            <Customers />
          </AppLayout>
        }
      />

      <Route
        path="/orders"
        element={
          <AppLayout>
            <CustomerOrders />
          </AppLayout>
        }
      />

      <Route
        path="/templates"
        element={
          <AppLayout>
            <ProductTemplates />
          </AppLayout>
        }
      />

      <Route
        path="/workflows"
        element={
          <AppLayout>
            <WorkflowTemplates />
          </AppLayout>
        }
      />
    </Routes>
  );
}

export default AppRouter;