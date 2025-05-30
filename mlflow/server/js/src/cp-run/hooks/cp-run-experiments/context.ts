import {createContext} from "react";
import {CloudPipelineRunExperimentsContext} from "@mlflow/mlflow/src/cp-run/hooks/cp-run-experiments/types";

export const cloudPipelineRunExperimentsContext = createContext<CloudPipelineRunExperimentsContext>({
  pending: false,
  error: undefined,
  run: undefined,
  experimentIds: [],
});
