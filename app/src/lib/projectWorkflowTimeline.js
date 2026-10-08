export const PROJECT_STAGE_ACTIONS = {
  siteVisit: { field: "site_visit_status", completeValue: "Completed" },
  measurements: { field: "measurements_status", completeValue: "Completed" },
  design: { field: "design_status", completeValue: "Completed", startValue: "In Progress" },
  production: { field: "fabrication_status", completeValue: "Completed", startValue: "In Progress" },
  testFit: { field: "test_fit_status", completeValue: "Completed", startValue: "Scheduled" },
  finish: { field: "finish_status", completeValue: "Completed", startValue: "In Progress" },
  assembly: { field: "assembly_status", completeValue: "Completed", startValue: "In Progress" },
  install: { field: "install_status", completeValue: "Completed", startValue: "Needs Scheduling" },
  inspection: { field: "final_inspection_status", completeValue: "Passed", startValue: "Pending" },
};

export function getStageDates(project, stageKey) {
  const recorded = project?.workflow_stage_dates?.[stageKey] || {};

  if (stageKey === "siteVisit") {
    return {
      startedAt: recorded.started_at || project?.site_visit_start || project?.site_visit_date || null,
      completedAt: recorded.completed_at || project?.site_visit_end || null,
      startedBy: recorded.started_by || null,
      completedBy: recorded.completed_by || null,
    };
  }

  if (stageKey === "testFit") {
    return {
      startedAt: recorded.started_at || project?.test_fit_start || null,
      completedAt: recorded.completed_at || project?.test_fit_end || null,
      startedBy: recorded.started_by || null,
      completedBy: recorded.completed_by || null,
    };
  }

  if (stageKey === "install") {
    return {
      startedAt: recorded.started_at || project?.install_start || project?.install_date || null,
      completedAt: recorded.completed_at || project?.install_end || null,
      startedBy: recorded.started_by || null,
      completedBy: recorded.completed_by || null,
    };
  }

  return {
    startedAt: recorded.started_at || null,
    completedAt: recorded.completed_at || null,
    startedBy: recorded.started_by || null,
    completedBy: recorded.completed_by || null,
  };
}

export function findOutOfSequenceStages(stages) {
  const firstIncompleteIndex = stages.findIndex((stage) => !stage.complete);
  if (firstIncompleteIndex < 0) return [];
  return stages.slice(firstIncompleteIndex + 1).filter((stage) => stage.complete);
}

export function buildStageAdvanceUpdates({ project, currentStage, nextStage, actor, now }) {
  const currentAction = PROJECT_STAGE_ACTIONS[currentStage?.key];
  if (!currentAction) return null;

  const timestamp = now || new Date().toISOString();
  const who = actor || "Metal Worx employee";
  const existingDates = project?.workflow_stage_dates || {};
  const currentDates = existingDates[currentStage.key] || {};
  const nextDates = nextStage ? existingDates[nextStage.key] || {} : null;

  const updates = {
    [currentAction.field]: currentAction.completeValue,
    workflow_stage_dates: {
      ...existingDates,
      [currentStage.key]: {
        ...currentDates,
        started_at: currentDates.started_at || timestamp,
        started_by: currentDates.started_by || who,
        completed_at: timestamp,
        completed_by: who,
      },
    },
  };

  if (nextStage) {
    updates.workflow_stage_dates[nextStage.key] = {
      ...nextDates,
      started_at: nextDates.started_at || timestamp,
      started_by: nextDates.started_by || who,
    };

    const nextAction = PROJECT_STAGE_ACTIONS[nextStage.key];
    if (nextAction?.startValue) {
      updates[nextAction.field] = nextAction.startValue;
    }
  }

  return updates;
}
