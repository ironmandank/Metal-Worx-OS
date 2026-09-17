import { useState } from "react";

import DepartmentQueue from "./DepartmentQueue";
import DesignIntakeModal from "../components/design/DesignIntakeModal";

function DesignQueue({
  setPage,
  setSelectedProductionJob,
  activeUser,
  accessLevel,
}) {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <DepartmentQueue
        department="Design"
        setPage={setPage}
        setSelectedProductionJob={setSelectedProductionJob}
        activeUser={activeUser}
        accessLevel={accessLevel}
        refreshKey={refreshKey}
        onCreateDesign={() => setIntakeOpen(true)}
      />
      <DesignIntakeModal
        opened={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        activeUser={activeUser}
        onCreated={() => setRefreshKey((value) => value + 1)}
      />
    </>
  );
}

export default DesignQueue;
