import { useEffect, useState } from "react";

import AppLayout from "./components/layout/AppLayout";
import SplashScreen from "./components/SplashScreen";
import AuthLogin from "./pages/AuthLogin";
import EmployeeLoginManagement from "./pages/EmployeeLoginManagement";
import {
  clearMetalWorxSession,
  getMetalWorxSessionStatus,
  isMetalWorxSessionValid,
  supabase,
} from "./lib/supabase";

import Dashboard from "./pages/Dashboard";
import ActionCenter from "./pages/ActionCenter";
import Callbacks from "./pages/Callbacks";
import InternalChat from "./pages/InternalChat";
import Reports from "./pages/Reports";
import Procurement from "./pages/Procurement";

import InventoryDashboard from "./pages/InventoryDashboard";
import InventoryItems from "./pages/InventoryItems";
import NewInventoryItem from "./pages/NewInventoryItem";
import InventoryScanner from "./pages/InventoryScanner";
import InventoryItemDetails from "./pages/InventoryItemDetails";
import InventoryQuantityAdjustment from "./pages/InventoryQuantityAdjustment";
import InventoryReceiving from "./pages/InventoryReceiving";
import InventoryStorageLocations from "./pages/InventoryStorageLocations";
import InventoryLabelPrinting from "./pages/InventoryLabelPrinting";
import InventoryHistory from "./pages/InventoryHistory";
import InventoryCountMode from "./pages/InventoryCountMode";
import InventoryImportWizard from "./pages/InventoryImportWizard";
import QuickTurnaroundDashboard from "./pages/QuickTurnaroundDashboard";

import NewJob from "./pages/NewJob";
import JobQueue from "./pages/JobQueue";
import ProductionBoard from "./pages/ProductionBoard";
import ProductionControlCenter from "./pages/ProductionControlCenter";
import ProductionJobs from "./pages/ProductionJobs";
import ProductionJobDetails from "./pages/ProductionJobDetails";
import DepartmentQueue from "./pages/DepartmentQueue";
import JobDetails from "./pages/JobDetails";

import ProductTemplates from "./pages/ProductTemplates";
import NewProductTemplate from "./pages/NewProductTemplate";
import WorkflowTemplates from "./pages/WorkflowTemplates";

import Customers from "./pages/Customers";
import CustomerOrders from "./pages/CustomerOrders";
import OrderBuilder from "./pages/OrderBuilder";
import CustomerDetails from "./pages/CustomerDetails";
import CustomerOrderDetails from "./pages/CustomerOrderDetails";
import DesignQueue from "./pages/DesignQueue";

import Projects from "./pages/Projects";
import NewProject from "./pages/NewProject";
import ProjectDetails from "./pages/ProjectDetails";
import EditProject from "./pages/EditProject";
import FieldSchedule from "./pages/FieldSchedule";
import QuoteBuilder from "./pages/QuoteBuilder";
import QuotePreview from "./pages/QuotePreview";
import QuoteCenter from "./pages/QuoteCenter";
import PilotFeedback from "./pages/PilotFeedback";
import KnowledgeCenter from "./pages/KnowledgeCenter";

import "./App.css";

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSession, setAuthSession] = useState(null);
  const [authenticatedProfile, setAuthenticatedProfile] = useState(null);
  const [authError, setAuthError] = useState("");

  const [showSplash, setShowSplash] = useState(() => {
    return sessionStorage.getItem("mwSplashPlayed") !== "true";
  });

  const [page, setPage] = useState("dashboard");

  const [activeUser, setActiveUser] = useState("");

  const [actionCenterFilter, setActionCenterFilter] = useState("All");

  const [selectedJob, setSelectedJob] = useState(null);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [selectedCustomerOrder, setSelectedCustomerOrder] = useState(null);

  const [selectedProductionJob, setSelectedProductionJob] = useState(null);

  const [selectedDepartment, setSelectedDepartment] = useState("Design");

  const [selectedProject, setSelectedProject] = useState(null);

  const [selectedQuote, setSelectedQuote] = useState(null);

  const [selectedCallbackId, setSelectedCallbackId] = useState(null);

  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  const [selectedInventoryBin, setSelectedInventoryBin] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function applyAuthenticatedSession(nextSession, allowSignInGrace = false) {
      if (!mounted) return;

      if (!nextSession?.user) {
        setAuthSession(null);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError("");
        setAuthLoading(false);
        return;
      }

      if (allowSignInGrace && !isMetalWorxSessionValid()) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }

      const sessionStatus = getMetalWorxSessionStatus();
      if (!sessionStatus.valid) {
        clearMetalWorxSession();
        await supabase.auth.signOut({ scope: "local" });

        if (!mounted) return;
        setAuthSession(null);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(
          sessionStatus.mode === "expired"
            ? "Your 24-hour Metal Worx session expired. Sign in again."
            : "",
        );
        setAuthLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("employee_profiles")
        .select(
          "id,display_name,profile_type,role_title,department,is_active,auth_user_id,email,access_level",
        )
        .eq("auth_user_id", nextSession.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        setAuthSession(nextSession);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(profileError.message);
        setAuthLoading(false);
        return;
      }

      if (!profile) {
        setAuthSession(nextSession);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(
          "This login is not linked to a Metal Worx employee profile.",
        );
        setAuthLoading(false);
        return;
      }

      if (!profile.is_active) {
        setAuthSession(nextSession);
        setAuthenticatedProfile(null);
        setActiveUser("");
        setAuthError(
          "This Metal Worx employee login has been deactivated.",
        );
        setAuthLoading(false);
        return;
      }

      setAuthSession(nextSession);
      setAuthenticatedProfile({
        ...profile,
        access_level: "Employee",
      });
      setActiveUser(profile.display_name);
      setAuthError("");
      setAuthLoading(false);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }

      applyAuthenticatedSession(data?.session || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      window.setTimeout(() => {
        applyAuthenticatedSession(nextSession, event === "SIGNED_IN");
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authSession) return undefined;

    async function enforceSessionExpiration() {
      if (isMetalWorxSessionValid()) return;

      clearMetalWorxSession();
      await supabase.auth.signOut({ scope: "local" });
      setAuthSession(null);
      setAuthenticatedProfile(null);
      setActiveUser("");
      setAuthError("Your Metal Worx session expired. Sign in again.");
      setPage("dashboard");
      sessionStorage.removeItem("mwSplashPlayed");
      setShowSplash(true);
    }

    const timer = window.setInterval(enforceSessionExpiration, 60000);

    function checkWhenVisible() {
      if (document.visibilityState === "visible") {
        enforceSessionExpiration();
      }
    }

    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [authSession]);

  async function handleSignOut() {
    clearMetalWorxSession();
    sessionStorage.removeItem("mwSplashPlayed");

    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      setAuthSession(null);
      setAuthenticatedProfile(null);
      setActiveUser("");
      setAuthError("");
      setPage("dashboard");
      setShowSplash(true);
    }
  }

  useEffect(() => {
    if (!showSplash) {
      return;
    }

    const timer = setTimeout(() => {
      sessionStorage.setItem("mwSplashPlayed", "true");

      setShowSplash(false);
    }, 4200);

    return () => clearTimeout(timer);
  }, [showSplash]);

  function openActionCenter(filter = "All") {
    setActionCenterFilter(filter);
    setPage("actionCenter");
  }

  function openCallback(callbackId = null) {
    setSelectedCallbackId(callbackId);
    setPage("callbacks");
  }

  function openProject(project) {
    setSelectedProject(project);
    setPage("projectDetails");
  }

  function openCustomerOrder(order) {
    setSelectedCustomerOrder(order);
    setPage("customerOrderDetails");
  }

  function openInventoryItem(item) {
    setSelectedInventoryItem(item);
    setPage("inventoryItemDetails");
  }

  function openInventoryBin(bin) {
    setSelectedInventoryBin(bin);
    setPage("inventoryStorage");
  }

  function renderPage() {
    if (page === "dashboard") {
      return (
        <Dashboard
          setPage={setPage}
          openActionCenter={openActionCenter}
          setSelectedProject={setSelectedProject}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
          openProject={openProject}
          openCustomerOrder={openCustomerOrder}
          openCallback={openCallback}
        />
      );
    }

    if (page === "actionCenter") {
      return (
        <ActionCenter
          setPage={setPage}
          selectedFilter={actionCenterFilter}
          setSelectedProject={setSelectedProject}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
          openCallback={openCallback}
        />
      );
    }

    if (page === "callbacks") {
      return (
        <Callbacks
          setPage={setPage}
          selectedCallbackId={selectedCallbackId}
          setSelectedCallbackId={setSelectedCallbackId}
        />
      );
    }

    if (page === "internalChat") {
      return <InternalChat setPage={setPage} activeUser={activeUser} />;
    }

    if (page === "reports") {
      return <Reports setPage={setPage} />;
    }

    if (page === "procurement") {
      return (
        <Procurement
          setPage={setPage}
          setSelectedProject={setSelectedProject}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryDashboard") {
      return (
        <InventoryDashboard
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryItems") {
      return (
        <InventoryItems
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
        />
      );
    }

    if (page === "newInventoryItem") {
      return (
        <NewInventoryItem
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
        />
      );
    }

    if (page === "inventoryScanner") {
      return (
        <InventoryScanner
          setPage={setPage}
          setSelectedInventoryItem={setSelectedInventoryItem}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryItemDetails") {
      return (
        <InventoryItemDetails
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          setSelectedInventoryItem={setSelectedInventoryItem}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryAdjustment") {
      return (
        <InventoryQuantityAdjustment
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          setSelectedInventoryItem={setSelectedInventoryItem}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryReceiving") {
      return (
        <InventoryReceiving
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          setSelectedInventoryItem={setSelectedInventoryItem}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryStorage") {
      return (
        <InventoryStorageLocations
          setPage={setPage}
          setSelectedInventoryBin={setSelectedInventoryBin}
        />
      );
    }

    if (page === "inventoryLabels") {
      return (
        <InventoryLabelPrinting
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
          activeUser={activeUser}
        />
      );
    }

    if (page === "inventoryHistory") {
      return (
        <InventoryHistory
          setPage={setPage}
          selectedInventoryItem={selectedInventoryItem}
        />
      );
    }

    if (page === "inventoryCount") {
      return <InventoryCountMode setPage={setPage} activeUser={activeUser} />;
    }

    if (page === "inventoryImport") {
      return (
        <InventoryImportWizard setPage={setPage} activeUser={activeUser} />
      );
    }

    if (page === "quickTurnaround") {
      return (
        <QuickTurnaroundDashboard setPage={setPage} activeUser={activeUser} />
      );
    }

    if (page === "newJob") {
      return <NewJob setPage={setPage} />;
    }

    if (page === "jobQueue") {
      return <JobQueue setPage={setPage} />;
    }

    if (page === "jobDetails") {
      return <JobDetails selectedJob={selectedJob} setPage={setPage} />;
    }

    if (page === "projects") {
      return (
        <Projects setPage={setPage} setSelectedProject={setSelectedProject} />
      );
    }

    if (page === "newProject") {
      return <NewProject setPage={setPage} />;
    }

    if (page === "editProject") {
      return (
        <EditProject selectedProject={selectedProject} setPage={setPage} />
      );
    }

    if (page === "projectDetails") {
      return (
        <ProjectDetails
          selectedProject={selectedProject}
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
          activeUser={activeUser}
        />
      );
    }

    if (page === "fieldSchedule") {
      return (
        <FieldSchedule
          setPage={setPage}
          setSelectedProject={setSelectedProject}
        />
      );
    }

    if (page === "quoteCenter") {
      return (
        <QuoteCenter
          setPage={setPage}
          setSelectedQuote={setSelectedQuote}
          setSelectedProject={setSelectedProject}
          activeUser={activeUser}
        />
      );
    }

    if (page === "quoteBuilder") {
      return (
        <QuoteBuilder
          selectedProject={selectedProject}
          selectedQuote={selectedQuote}
          setSelectedQuote={setSelectedQuote}
          setPage={setPage}
        />
      );
    }

    if (page === "quotePreview") {
      return (
        <QuotePreview
          selectedProject={selectedProject}
          selectedQuote={selectedQuote}
          setPage={setPage}
        />
      );
    }

    if (page === "productionBoard") {
      return (
        <ProductionBoard setPage={setPage} setSelectedJob={setSelectedJob} />
      );
    }

    if (page === "productionJobs") {
      return (
        <ProductionJobs
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
        />
      );
    }

    if (page === "productionControl") {
      return (
        <ProductionControlCenter
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
          setSelectedProject={setSelectedProject}
          activeUser={activeUser}
        />
      );
    }

    if (page === "departmentQueue") {
      return (
        <DepartmentQueue
          department={selectedDepartment}
          setPage={setPage}
          setSelectedProductionJob={setSelectedProductionJob}
          activeUser={activeUser}
        />
      );
    }

    if (page === "productionJobDetails") {
      return (
        <ProductionJobDetails
          selectedProductionJob={selectedProductionJob}
          setPage={setPage}
        />
      );
    }

    if (page === "productTemplates") {
      return <ProductTemplates setPage={setPage} />;
    }

    if (page === "newProductTemplate") {
      return <NewProductTemplate setPage={setPage} />;
    }

    if (page === "workflowTemplates") {
      return <WorkflowTemplates setPage={setPage} />;
    }

    if (page === "pilotFeedback") {
      return <PilotFeedback />;
    }

    if (page === "knowledgeCenter") {
      return <KnowledgeCenter setPage={setPage} />;
    }

    if (page === "employeeLogins") {
      return <EmployeeLoginManagement setPage={setPage} />;
    }

    if (page === "customers") {
      return (
        <Customers
          setPage={setPage}
          setSelectedCustomer={setSelectedCustomer}
        />
      );
    }

    if (page === "customerOrders") {
      return (
        <CustomerOrders
          setPage={setPage}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
        />
      );
    }

    if (page === "designQueue") {
      return (
        <DesignQueue
          setPage={setPage}
          setSelectedCustomerOrder={setSelectedCustomerOrder}
          setSelectedProductionJob={setSelectedProductionJob}
          activeUser={activeUser}
        />
      );
    }

    if (page === "customerOrderDetails") {
      return (
        <CustomerOrderDetails
          selectedCustomerOrder={selectedCustomerOrder}
          setPage={setPage}
        />
      );
    }

    if (page === "orderBuilder") {
      return (
        <OrderBuilder setPage={setPage} selectedCustomer={selectedCustomer} />
      );
    }

    if (page === "customerDetails") {
      return (
        <CustomerDetails
          selectedCustomer={selectedCustomer}
          setPage={setPage}
        />
      );
    }

    /*
     * Inventory pages still to connect:
     *
     * inventoryItemDetails
     * inventoryAdjustment
     * inventoryReceiving
     * inventoryStorage
     * inventoryScanner
     * inventoryLabels
     * inventoryVendors
     * inventoryHistory
     */

    return (
      <Dashboard
        setPage={setPage}
        openActionCenter={openActionCenter}
        setSelectedProject={setSelectedProject}
        setSelectedCustomerOrder={setSelectedCustomerOrder}
        openProject={openProject}
        openCustomerOrder={openCustomerOrder}
        openCallback={openCallback}
      />
    );
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          color: "#ffffff",
          background: "#030405",
          fontFamily: "Inter, Arial, sans-serif",
          fontWeight: 800,
        }}
      >
        Verifying Metal Worx employee access...
      </div>
    );
  }

  if (!authSession || !authenticatedProfile) {
    return (
      <AuthLogin
        session={authSession}
        errorMessage={authError}
        onSignOut={handleSignOut}
      />
    );
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <AppLayout
      page={page}
      activeUser={activeUser}
      setActiveUser={setActiveUser}
      authenticatedProfile={authenticatedProfile}
      onSignOut={handleSignOut}
      setPage={setPage}
      setSelectedDepartment={setSelectedDepartment}
      openCallback={openCallback}
      selectedInventoryItem={selectedInventoryItem}
      selectedInventoryBin={selectedInventoryBin}
      openInventoryItem={openInventoryItem}
      openInventoryBin={openInventoryBin}
    >
      {renderPage()}
    </AppLayout>
  );
}

export default App;
