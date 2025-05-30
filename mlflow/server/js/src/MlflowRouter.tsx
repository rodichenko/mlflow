import React, {useEffect, useMemo, useRef} from 'react';
import { LegacySkeleton } from '@databricks/design-system';

import ErrorModal from './experiment-tracking/components/modals/ErrorModal';
import AppErrorBoundary from './common/components/error-boundaries/AppErrorBoundary';
import {
  HashRouter,
  Route,
  Outlet,
  Routes,
  createLazyRouteElement,
  useIsEmbedded
} from './common/utils/RoutingUtils';
import { MlflowHeader } from './common/components/MlflowHeader';

// Route definition imports:
import {
  getEmbeddedRouteDefs as getEmbeddedExperimentTrackingRouteDefs,
  getRouteDefs as getExperimentTrackingRouteDefs,
} from './experiment-tracking/route-defs';
import {
  getEmbeddedRouteDefs as getEmbeddedModelRegistryRouteDefs,
  getRouteDefs as getModelRegistryRouteDefs,
} from './model-registry/route-defs';
import {
  getRouteDefs as getCloudPipelineRouteDefs,
  getEmbeddedRouteDefs as getEmbeddedCloudPipelineRouteDefs,
} from './cp-run/route-defs';
import { getRouteDefs as getCommonRouteDefs } from './common/route-defs';
import { useInitializeExperimentRunColors } from './experiment-tracking/components/experiment-page/hooks/useExperimentRunColor';

/**
 * This is the MLflow default entry/landing route.
 */
const landingRoute = {
  path: '/',
  element: createLazyRouteElement(() => import('./experiment-tracking/components/HomePage')),
  pageId: 'mlflow.experiments.list',
};

const MlflowDefaultLayout = ({
  isDarkTheme,
  setIsDarkTheme
}: {
  isDarkTheme?: boolean;
  setIsDarkTheme?: (isDarkTheme: boolean) => void;
}) => (
  <>
    <MlflowHeader isDarkTheme={isDarkTheme} setIsDarkTheme={setIsDarkTheme} />
    <React.Suspense fallback={<LegacySkeleton />}>
      <Outlet />
    </React.Suspense>
  </>
);

const MlflowEmbeddedLayout = (
  {
    isDarkTheme,
    setIsDarkTheme,
  }: {
  isDarkTheme?: boolean;
  setIsDarkTheme?: (isDarkTheme: boolean) => void;
}) => {
  const themeModified = useRef(false);
  const embedded = useIsEmbedded();
  useEffect(() => {
    if (embedded && isDarkTheme && setIsDarkTheme && !themeModified.current) {
      setIsDarkTheme(false);
    }
  }, [setIsDarkTheme, isDarkTheme, embedded]);
  useEffect(() => {
    const abortController = new AbortController();
    window.addEventListener('message', (msg) => {
      if (typeof msg.data === 'object') {
        const {
          messageType,
          dark
        } = msg.data as Record<string, unknown>;
        if (typeof messageType === 'string' && messageType === 'set-theme') {
          if (setIsDarkTheme) {
            themeModified.current = true;
            setIsDarkTheme(typeof dark === 'boolean' ? dark : Boolean(dark));
          }
        }
      }
    }, { signal: abortController.signal });
    return () => {
      abortController.abort();
    }
  }, [setIsDarkTheme]);
  return (
    <React.Suspense fallback={<LegacySkeleton />}>
      <Outlet />
    </React.Suspense>
  );
};

export const MlflowRouter = ({
  isDarkTheme,
  setIsDarkTheme,
}: {
  isDarkTheme?: boolean;
  setIsDarkTheme?: (isDarkTheme: boolean) => void;
}) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useInitializeExperimentRunColors();

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const routes = useMemo(
    () => [...getExperimentTrackingRouteDefs(), ...getModelRegistryRouteDefs(), landingRoute, ...getCommonRouteDefs()],
    [],
  );
  const embeddedRoutes = useMemo(
    () => [...getEmbeddedExperimentTrackingRouteDefs(), ...getEmbeddedCloudPipelineRouteDefs(), ...getEmbeddedModelRegistryRouteDefs()],
    []);
  const cpRoutes = useMemo(() => getCloudPipelineRouteDefs(), []);
  return (
    <>
      <ErrorModal />
      <HashRouter>
        <AppErrorBoundary>
          <Routes>
            <Route key="index-route" element={<MlflowDefaultLayout isDarkTheme={isDarkTheme} setIsDarkTheme={setIsDarkTheme} />}>
              {routes.map(({ element, pageId, path }) => (
                <Route key={pageId} path={path} element={element} />
              ))}
            </Route>
            <Route key="embedded" path="/embedded" element={<MlflowEmbeddedLayout isDarkTheme={isDarkTheme} setIsDarkTheme={setIsDarkTheme} />}>
              {
                embeddedRoutes.map(({ element, pageId, path }) => (
                  <Route key={pageId} path={path} element={element} />
                ))
              }
            </Route>
            <Route key="cloud-pipeline" path="/cp" element={<MlflowDefaultLayout isDarkTheme={isDarkTheme} setIsDarkTheme={setIsDarkTheme} /> }>
              {
                cpRoutes.map(({ element, pageId, path }) => (
                  <Route key={pageId} path={path} element={element} />
                ))
              }
            </Route>
          </Routes>
        </AppErrorBoundary>
      </HashRouter>
    </>
  );
};
