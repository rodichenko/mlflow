export type CloudPipelineRun = {
  id: number;
  tags?: Record<string, unknown>;
}

export type CloudPipelineRunExperimentsContext = {
  pending: boolean;
  error: string | undefined;
  run?: CloudPipelineRun;
  experimentIds: string[];
}
