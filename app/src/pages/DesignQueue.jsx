import DepartmentQueue from "./DepartmentQueue";

function DesignQueue({
  setPage,
  setSelectedProductionJob,
  activeUser,
}) {
  return (
    <DepartmentQueue
      department="Design"
      setPage={setPage}
      setSelectedProductionJob={setSelectedProductionJob}
      activeUser={activeUser}
    />
  );
}

export default DesignQueue;
