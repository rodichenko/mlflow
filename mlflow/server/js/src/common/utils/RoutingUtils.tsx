/**
 * This file is the only one that should directly import from 'react-router-dom' module
 */
/* eslint-disable no-restricted-imports */

/**
 * Import React Router V6 parts
 */
import {
  BrowserRouter,
  MemoryRouter,
  HashRouter,
  matchPath,
  generatePath,
  Navigate,
  Route,
  UNSAFE_NavigationContext,
  NavLink,
  Link as LinkDirect,
  useNavigate as useNavigateDirect,
  useLocation as useLocationDirect,
  useParams as useParamsDirect,
  useMatch as useMatchDirect,
  useSearchParams as useSearchParamsDirect,
  Routes,
  Outlet,
  type To,
  type NavigateOptions,
  type Location,
  type NavigateFunction,
  type Params,
  type LinkProps,
} from 'react-router-dom';

/**
 * Import React Router V5 parts
 */
import { HashRouter as HashRouterV5, Link as LinkV5, NavLink as NavLinkV5 } from 'react-router-dom';
import React, {ComponentProps, useMemo} from 'react';

const useLocation = useLocationDirect;

const useSearchParams = useSearchParamsDirect;

const useParams = useParamsDirect;

const useNavigate = useNavigateDirect;

const useMatch = useMatchDirect;

const Link = LinkDirect;

function useIsEmbedded(): boolean {
  const embeddedRoute = useMatchDirect('/embedded/*');
  return Boolean(embeddedRoute);
}

function useCloudPipelineRun(): number | undefined {
  const cpRoute1 = useMatchDirect('/cp/:runId');
  const cpRoute2 = useMatchDirect('/cp/:runId/*');
  const cpRoute3 = useMatchDirect('/embedded/cp/:runId');
  const cpRoute4 = useMatchDirect('/embedded/cp/:runId/*');
  const runId = cpRoute1?.params?.runId
    ?? cpRoute2?.params?.runId
    ?? cpRoute3?.params?.runId
    ?? cpRoute4?.params?.runId;
  return useMemo(() => runId !== undefined && !Number.isNaN(Number(runId)) ? Number(runId) : undefined, [runId]);
}

type RouteOptionsDefined = {
  embedded: boolean;
  runId: number | undefined;
};

type RouteOptions = boolean | Partial<RouteOptionsDefined>;

function normalizeRouteOptions(opts: RouteOptions | undefined = false): RouteOptionsDefined {
  if (typeof opts === 'boolean') {
    return {
      embedded: opts,
      runId: undefined,
    };
  }
  const {
    embedded = false,
    runId,
  } = opts;
  return {
    embedded,
    runId,
  };
}

function useRouteOptions(): RouteOptions | undefined {
  const embedded = useIsEmbedded();
  const runId = useCloudPipelineRun();
  return useMemo(() => {
    if (runId || embedded) {
      return {
        embedded,
        runId,
      };
    }
    return undefined;
  }, [embedded, runId]);
}

const EmbeddedLink = (props: LinkProps) => {
  const { target, ...rest} = props;
  const isEmbedded = useIsEmbedded();
  const runId = useCloudPipelineRun();
  return <Link {...rest} target={isEmbedded || runId ? '_blank' : target} />
}

type RoutingViewProps = {
  embedded: boolean;
  runId: number | undefined;
}

function withEmbeddedView<P>(
  WrappedComponent: React.Component<P & RoutingViewProps> | React.FC<P & RoutingViewProps>,
): React.FunctionComponent<P> {
  return function HOC(props: P) {
    const embedded = useIsEmbedded();
    const runId = useCloudPipelineRun();
    // @ts-expect-error ....
    return <WrappedComponent {...props} embedded={embedded} runId={runId} />;
  };
}


export const createMLflowRoutePath = (routePath: string) => {
  return routePath;
};

export {
  // React Router V6 API exports
  BrowserRouter,
  MemoryRouter,
  HashRouter,
  Link,
  EmbeddedLink,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  useMatch,
  useIsEmbedded,
  useCloudPipelineRun,
  useRouteOptions,
  generatePath,
  matchPath,
  Navigate,
  Route,
  Routes,
  Outlet,

  withEmbeddedView,
  type RoutingViewProps,
  type RouteOptions,
  type RouteOptionsDefined,
  normalizeRouteOptions,

  // Unsafe navigation context, will be improved after full migration to react-router v6
  UNSAFE_NavigationContext,
};

export const createLazyRouteElement = (
  // Load the module's default export and turn it into React Element
  componentLoader: () => Promise<{ default: React.ComponentType<any> }>,
) => React.createElement(React.lazy(componentLoader));
export const createRouteElement = (component: React.ComponentType<any>) => React.createElement(component);

export type { Location, NavigateFunction, Params, To, NavigateOptions };
