import { createMLflowRoutePath } from '../common/utils/RoutingUtils';
import {generatePath} from "@mlflow/mlflow/src/common/utils/RoutingUtils";

export class RoutePaths {
  static get cloudPipelineRunRoute() {
    return createMLflowRoutePath('/cp/:runId');
  }
  static get cloudPipelineRunModelVersionPage() {
    return createMLflowRoutePath('/cp/:runId/models/:modelName/versions/:version');
  }
  static get cloudPipelineRunPageWithTab() {
    return createMLflowRoutePath('/cp/:runId/experiments/:experimentId/runs/:runUuid/*');
  }
  static get cloudPipelineRunCompareRuns() {
    return createMLflowRoutePath('/cp/:runId/compare-runs');
  }
  // embedded

  static get embeddedCloudPipelineRunRoute() {
    return createMLflowRoutePath('/embedded/cp/:runId');
  }
  static get embeddedCloudPipelineRunCompareRuns() {
    return createMLflowRoutePath('/embedded/cp/:runId/compare-runs');
  }
}

class Routes {
  static get cloudPipelineRunRoute() {
    return RoutePaths.cloudPipelineRunRoute;
  }

  // embedded

  static get embeddedCloudPipelineRunRoute() {
    return RoutePaths.embeddedCloudPipelineRunRoute;
  }

  static getCloudPipelineRunRoute(runId: number, embedded = false) {
    return generatePath(embedded ? RoutePaths.embeddedCloudPipelineRunRoute : RoutePaths.cloudPipelineRunRoute, { runId });
  }
}

export default Routes;
