import {
  useCloudPipelineRunExperiments,
  useCreateCpRunExperimentsContext
} from "@mlflow/mlflow/src/cp-run/hooks/cp-run-experiments/hooks";
import {cloudPipelineRunExperimentsContext} from "@mlflow/mlflow/src/cp-run/hooks/cp-run-experiments/context";
import {useDispatch} from "react-redux";
import {type ThunkDispatch} from "@mlflow/mlflow/src/redux-types";
import {useEffect, useRef} from "react";
import {
  getExperimentApi,
  searchExperimentsApi, setCompareExperiments,
  setExperimentTagApi
} from "@mlflow/mlflow/src/experiment-tracking/actions";
import {Spinner, useDesignSystemTheme} from "@databricks/design-system";
import {
  GetExperimentsContextProvider
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/contexts/GetExperimentsContext";
import {NoExperimentView} from "@mlflow/mlflow/src/experiment-tracking/components/NoExperimentView";
import {getUUID} from "@mlflow/mlflow/src/common/utils/ActionUtils";
import RequestStateWrapper from "@mlflow/mlflow/src/common/components/RequestStateWrapper";
import {useIsEmbedded} from "@mlflow/mlflow/src/common/utils/RoutingUtils";
import {CloudPipelineRunExperimentView} from "@mlflow/mlflow/src/cp-run/components/cp-experiment-view";

const getExperimentActions = {
  setExperimentTagApi,
  getExperimentApi,
  setCompareExperiments,
};

const loadingState = (
  <div css={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <Spinner size="large" />
  </div>
);

const CloudPipelineHomePage = () => {
  const isEmbedded = useIsEmbedded();
  const searchRequestId = useRef(getUUID());
  const dispatch = useDispatch<ThunkDispatch>();
  const { theme } = useDesignSystemTheme();
  const { experimentIds } = useCloudPipelineRunExperiments();

  useEffect(() => {
    dispatch(searchExperimentsApi(searchRequestId.current));
  }, [dispatch]);

  return (
    <RequestStateWrapper requestIds={[searchRequestId.current]} customSpinner={loadingState}>
      <div css={{ display: 'flex', height: isEmbedded ? 'calc(100% - 10px)' : 'calc(100% - 60px)' }}>
        <div css={{ height: '100%', flex: 1, ...(isEmbedded ? {padding: 5} : {padding: theme.spacing.md, paddingTop: theme.spacing.lg}) }}>
          <GetExperimentsContextProvider actions={getExperimentActions}>
            {experimentIds.length > 0 ? <CloudPipelineRunExperimentView /> : <NoExperimentView />}
          </GetExperimentsContextProvider>
        </div>
      </div>
    </RequestStateWrapper>
  );
}

const Hoc = () => {
  const ctx = useCreateCpRunExperimentsContext();
  if (ctx.pending) {
    return loadingState;
  }
  return <cloudPipelineRunExperimentsContext.Provider value={ctx}>
    <CloudPipelineHomePage />
  </cloudPipelineRunExperimentsContext.Provider>;
}

export default Hoc;
