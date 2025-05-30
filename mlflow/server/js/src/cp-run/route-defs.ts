import { createLazyRouteElement } from '../common/utils/RoutingUtils';
import {RoutePaths} from "./routes";
import {ModelRegistryRoutePaths} from "@mlflow/mlflow/src/model-registry/routes";

export const getRouteDefs = () => ([
  {
    path: RoutePaths.cloudPipelineRunRoute,
    element: createLazyRouteElement(() => import('./pages/home-page')),
    pageId: 'mlflow.cp.run',
  },
  {
    path: RoutePaths.cloudPipelineRunPageWithTab,
    element: createLazyRouteElement(() => import('../experiment-tracking/components/run-page/RunPage')),
    pageId: 'mlflow.cp.experiment.run.details',
  },
  {
    path: RoutePaths.cloudPipelineRunModelVersionPage,
    element: createLazyRouteElement(() => import('../model-registry/components/ModelVersionPage')),
    pageId: 'mlflow.cp.model-registry.model-version-page',
  },
  {
    path: RoutePaths.cloudPipelineRunCompareRuns,
    element: createLazyRouteElement(() => import('../experiment-tracking/components/CompareRunPage')),
    pageId: 'mlflow.cp.experiment.run.compare',
  },
])

export const getEmbeddedRouteDefs = () => ([
  {
    path: RoutePaths.embeddedCloudPipelineRunRoute,
    element: createLazyRouteElement(() => import('./pages/home-page')),
    pageId: 'mlflow.embedded.cloud-pipeline.run',
  },
  {
    path: RoutePaths.embeddedCloudPipelineRunCompareRuns,
    element: createLazyRouteElement(() => import('../experiment-tracking/components/CompareRunPage')),
    pageId: 'mlflow.embedded.cp.experiment.run.compare',
  },
]);
