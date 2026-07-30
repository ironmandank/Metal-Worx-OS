import { releaseCustomerOrder } from "./productionWorkflow";

export async function buildProductionJob(customerOrder, builtBy = "") {
  const customerOrderId = Number(customerOrder?.id);
  if (!Number.isInteger(customerOrderId) || customerOrderId <= 0) {
    throw new Error("A valid customer order is required.");
  }

  return releaseCustomerOrder(
    customerOrderId,
    customerOrder?.status || customerOrder?.starting_department,
    builtBy
  );
}
