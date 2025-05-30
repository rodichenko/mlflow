import { LegacySkeleton } from '@databricks/design-system';
import {useIsEmbedded} from "@mlflow/mlflow/src/common/utils/RoutingUtils";
import {useDispatch} from "react-redux";
import { ThunkDispatch } from '../../redux-types';
import invariant from 'invariant';
import {
  ExperimentQueryParamsSearchFacets,
  useExperimentPageSearchFacets
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/useExperimentPageSearchFacets";
import {
  useExperimentPageViewMode
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/useExperimentPageViewMode";
import {useExperiments} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/useExperiments";
import {
  useFetchExperiments
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/useFetchExperiments";
import React, {useEffect, useMemo} from "react";
import {
  useInitializeUIState
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/useInitializeUIState";
import {
  useSharedExperimentViewState
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/useSharedExperimentViewState";
import {first} from "lodash";
import {
  useExperimentRuns
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/useExperimentRuns";
import {
  isExperimentEvalResultsMonitoringUIEnabled,
  isExperimentLoggedModelsUIEnabled, shouldEnableTracingUI
} from "@mlflow/mlflow/src/common/utils/FeatureUtils";
import {searchDatasetsApi} from "@mlflow/mlflow/src/experiment-tracking/actions";
import Utils from "@mlflow/mlflow/src/common/utils/Utils";
import {
  usePersistExperimentPageViewState
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/hooks/usePersistExperimentPageViewState";
import {ErrorCodes} from "@mlflow/mlflow/src/common/constants";
import {PermissionDeniedView} from "@mlflow/mlflow/src/experiment-tracking/components/PermissionDeniedView";
import NotFoundPage from "@mlflow/mlflow/src/experiment-tracking/components/NotFoundPage";
import {
  ExperimentViewTraces
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/components/ExperimentViewTraces";
import {
  ExperimentViewRuns
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/components/runs/ExperimentViewRuns";
import {
  ExperimentRunsSelectorResult
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/utils/experimentRuns.selector";
import {
  ExperimentPageUIStateContextProvider
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/contexts/ExperimentPageUIStateContext";
import {useCloudPipelineRunExperiments} from "@mlflow/mlflow/src/cp-run/hooks/cp-run-experiments/hooks";
import {
  createExperimentPageSearchFacetsState
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/models/ExperimentPageSearchFacetsState";
import {CloudPipelineRunsHeader} from "@mlflow/mlflow/src/cp-run/components/header";
import { Navigate } from "../../common/utils/RoutingUtils";
import ExperimentTrackingRoutes from '../../experiment-tracking/routes';
import {useSettings} from "@mlflow/mlflow/src/common/hooks/cloud-pipeline/use-settings";

export const CloudPipelineRunExperimentView = () => {
  const isEmbedded = useIsEmbedded();
  const { cp_run_id_tag = 'CP_RUN_ID' } = useSettings();
  const dispatch = useDispatch<ThunkDispatch>();

  const [searchFacetsOriginal, _, isPreview] = useExperimentPageSearchFacets();

  const { experimentIds, run } = useCloudPipelineRunExperiments();
  const { id: runId } = run ?? {};

  const [viewMode] = useExperimentPageViewMode();

  const experiments = useExperiments(experimentIds);

  const { fetchExperiments, isLoadingExperiment, requestError } = useFetchExperiments();

  // Create new version of the UI state for the experiment page on this level
  const [uiState, setUIState, seedInitialUIState] = useInitializeUIState(experimentIds);

  const { isViewStateShared } = useSharedExperimentViewState(setUIState, first(experiments));

  const searchFacets = useMemo<ExperimentQueryParamsSearchFacets | null>(() => {
    if (runId) {
      return {
        ...(searchFacetsOriginal || createExperimentPageSearchFacetsState()),
        searchFilter: `tags.${cp_run_id_tag}="${runId}"`,
        experimentIds,
      }
    }
    return null;
  }, [runId, experimentIds, searchFacetsOriginal, cp_run_id_tag]);

  const loadingRuns = useExperimentRuns(uiState, searchFacets, experimentIds);

  const {
    isLoadingRuns,
    loadMoreRuns,
    runsData,
    moreRunsAvailable,
    requestError: runsRequestError,
    refreshRuns,
  } = loadingRuns;

  useEffect(() => {
    // If the new tabbed UI is enabled, fetch the experiments only if they are not already loaded.
    // Helps with the smooth page transition.
    if (
      (isExperimentLoggedModelsUIEnabled() || isExperimentEvalResultsMonitoringUIEnabled()) &&
      experimentIds.every((id) => experiments.find((exp) => exp.experimentId === id))
    ) {
      return;
    }
    fetchExperiments(experimentIds);
  }, [fetchExperiments, experimentIds, experiments]);

  useEffect(() => {
    // Seed the initial UI state when the experiments and runs are loaded.
    // Should only run once.
    seedInitialUIState(experiments, runsData);
  }, [seedInitialUIState, experiments, runsData]);

  useEffect(() => {
    const requestAction = searchDatasetsApi(experimentIds);
    dispatch(requestAction).catch((e: unknown) => {
      Utils.logErrorAndNotifyUser(e);
    });
  }, [dispatch, experimentIds]);

  usePersistExperimentPageViewState(uiState, searchFacets, experimentIds, isViewStateShared);

  const isViewInitialized = Boolean(!isLoadingExperiment && experiments[0] && runsData && searchFacets) && !isLoadingRuns;

  if (!isViewInitialized) {
    // In the new view state model, wait for search facets to initialize
    return <LegacySkeleton />;
  }

  if (requestError && requestError.getErrorCode() === ErrorCodes.PERMISSION_DENIED) {
    return <PermissionDeniedView errorMessage={requestError.getMessageField()} />;
  }

  if (requestError && requestError.getErrorCode() === ErrorCodes.RESOURCE_DOES_NOT_EXIST) {
    return <NotFoundPage />;
  }

  if (runsData.runInfos.length === 1) {
    const first = runsData.runInfos[0];
    return <Navigate
      to={ExperimentTrackingRoutes.getRunPageTabRoute(
        first.experimentId,
        first.runUuid,
        undefined,
        {runId, embedded: isEmbedded}
      )}
      replace />;
  }

  invariant(searchFacets, 'searchFacets should be initialized at this point');

  const isLoading = isLoadingExperiment || !experiments[0];

  const getRenderedView = () => {
    if (shouldEnableTracingUI() && viewMode === 'TRACES') {
      return <ExperimentViewTraces experimentIds={experimentIds} />;
    }

    return (
      <ExperimentViewRuns
        isLoading={false}
        experiments={experiments}
        isLoadingRuns={isLoadingRuns}
        runsData={runsData as ExperimentRunsSelectorResult}
        searchFacetsState={searchFacets}
        loadMoreRuns={loadMoreRuns}
        moreRunsAvailable={moreRunsAvailable}
        requestError={runsRequestError}
        refreshRuns={refreshRuns}
        uiState={uiState}
      />
    );
  };

  return (
    <ExperimentPageUIStateContextProvider setUIState={setUIState}>
      <div css={styles.experimentViewWrapper}>
        {
          !isEmbedded && (
            <>
              {isLoading ? (
                <LegacySkeleton title paragraph={false} active />
              ) : (
                <CloudPipelineRunsHeader />
              )}
            </>
          )
        }
        {getRenderedView()}
      </div>
    </ExperimentPageUIStateContextProvider>
  );
};

const styles = {
  experimentViewWrapper: { height: '100%', display: 'flex', flexDirection: 'column' as const },
};
