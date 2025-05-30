import {createMLflowRoutePath, generatePath, normalizeRouteOptions, RouteOptions} from '../common/utils/RoutingUtils';
import { RoutePaths as CpRunRoutePaths } from '../cp-run/routes'

// Route path definitions (used in defining route elements)
export class ModelRegistryRoutePaths {
  static get modelListPage() {
    return createMLflowRoutePath('/models');
  }
  static get modelPage() {
    return createMLflowRoutePath('/models/:modelName');
  }
  static get modelSubpage() {
    return createMLflowRoutePath('/models/:modelName/:subpage');
  }
  static get modelSubpageRouteWithName() {
    return createMLflowRoutePath('/models/:modelName/:subpage/:name');
  }
  static get modelVersionPage() {
    return createMLflowRoutePath('/models/:modelName/versions/:version');
  }
  static get compareModelVersionsPage() {
    return createMLflowRoutePath('/compare-model-versions');
  }
  static get createModel() {
    return createMLflowRoutePath('/createModel');
  }
  static get embeddedModelVersionPage() {
    return createMLflowRoutePath('/embedded/models/:modelName/versions/:version');
  }
  static get embeddedCloudPipelineRunModelVersionPage() {
    return createMLflowRoutePath('/embedded/cp/:runId/models/:modelName/versions/:version');
  }
}

// Concrete routes and functions for generating parametrized paths
export class ModelRegistryRoutes {
  static get modelListPageRoute() {
    return ModelRegistryRoutePaths.modelListPage;
  }
  static getModelPageRoute(modelName: string) {
    return generatePath(ModelRegistryRoutePaths.modelPage, {
      modelName: encodeURIComponent(modelName),
    });
  }
  static getModelPageServingRoute(modelName: string) {
    return generatePath(ModelRegistryRoutePaths.modelSubpage, {
      modelName: encodeURIComponent(modelName),
      subpage: PANES.SERVING,
    });
  }
  static getModelVersionPageRoute(modelName: string, version: string, opts: RouteOptions = false) {
    const { embedded, runId } = normalizeRouteOptions(opts);
    if (runId) {
      return generatePath(
        embedded
          ? ModelRegistryRoutePaths.embeddedCloudPipelineRunModelVersionPage
          : CpRunRoutePaths.cloudPipelineRunModelVersionPage, {
          modelName: encodeURIComponent(modelName),
          version,
          runId,
        });
    }
    return generatePath(
      embedded ? ModelRegistryRoutePaths.embeddedModelVersionPage : ModelRegistryRoutePaths.modelVersionPage, {
      modelName: encodeURIComponent(modelName),
      version,
    });
  }
  static getCompareModelVersionsPageRoute(modelName: string, runsToVersions: Record<string, string>) {
    const path = generatePath(ModelRegistryRoutePaths.compareModelVersionsPage);
    const query =
      `?name=${JSON.stringify(encodeURIComponent(modelName))}` +
      `&runs=${JSON.stringify(runsToVersions, (_, v) => (v === undefined ? null : v))}`;

    return [path, query].join('');
  }
}

const PANES = Object.freeze({
  DETAILS: 'details',
  SERVING: 'serving',
});
