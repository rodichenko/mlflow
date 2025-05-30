import {useCloudPipelineRun} from "@mlflow/mlflow/src/common/utils/RoutingUtils";
import {
  CloudPipelineRun,
  CloudPipelineRunExperimentsContext
} from "@mlflow/mlflow/src/cp-run/hooks/cp-run-experiments/types";
import {useContext, useEffect, useMemo, useRef, useState} from "react";
import {cloudPipelineRunExperimentsContext} from "@mlflow/mlflow/src/cp-run/hooks/cp-run-experiments/context";
import {useSettings} from "@mlflow/mlflow/src/common/hooks/cloud-pipeline/use-settings";
import {cloudPipelineGetJson} from "@mlflow/mlflow/src/common/utils/FetchUtils";

export function useCreateCpRunExperimentsContext(): CloudPipelineRunExperimentsContext {
  const id = useCloudPipelineRun();
  const { cp_mlflow_experiment_id_tag_name = 'CP_MLFLOW_EXPERIMENT_ID' } = useSettings();
  const [state, setState] = useState<CloudPipelineRunExperimentsContext>({
    pending: false,
    error: undefined,
    run: id ? { id } : undefined,
    experimentIds: [],
  });
  const token = useRef({});
  useEffect(() => {
    const abortController = new AbortController();
    token.current = {};
    const { current } = token;
    const commit = async (o: Partial<CloudPipelineRunExperimentsContext>) => {
      return new Promise<void>((resolve) => {
      if (current === token.current) {
        setState((c) => ({
          ...c,
          ...o,
        }));
        resolve();
      }
      });
    };
    (async () => {
      if (id !== undefined) {
        await commit({pending: true, error: undefined, run: {id}});
        try {
          const run = await cloudPipelineGetJson({
            relativeUrl: `run/${id}`,
          }) as CloudPipelineRun;
          if (!run) {
            throw new Error(`Job #${id} not found`);
          }
          const {
            tags = {},
          } = run as CloudPipelineRun;
          const {
            [cp_mlflow_experiment_id_tag_name]: experimentsRaw = '',
          } = tags;
          const experimentIds: string[] = (experimentsRaw as string).split(',')
            .map((i) => i.trim())
            .filter((i) => i.length > 0);
          console.log(`Run #${id} tag value: "${experimentsRaw}"`);
          console.log(`Run #${id} experiments:`, experimentIds);
          await commit({ run, experimentIds });
        } catch (error) {
          await commit({error: error instanceof Error ? error.message : 'Error loading Cloud Pipeline run experiments'});
        } finally {
          await commit({pending: false});
        }
      } else {
        await commit({ pending: false, error: undefined, run: undefined, experimentIds: [] });
      }
    })();
    return () => {
      abortController.abort();
      token.current = {};
    }
  }, [cp_mlflow_experiment_id_tag_name, id]);
  return state;
}

export function useCloudPipelineRunExperiments(): CloudPipelineRunExperimentsContext {
  return useContext(cloudPipelineRunExperimentsContext);
}
