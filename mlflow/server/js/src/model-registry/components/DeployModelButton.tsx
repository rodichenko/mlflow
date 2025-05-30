import { Button, Modal, Alert } from '@databricks/design-system';
import { FormattedMessage } from 'react-intl';
import type {
  ModelVersionInfoEntity, RunInfoEntity,
} from '../../experiment-tracking/types';
import {useCallback, useEffect, useRef, useState} from 'react';
import {cloudPipelinePostJson, CloudPipelineSettings, fetchCloudPipelineSettings} from '../../common/utils/FetchUtils';
import { Link } from '../../common/utils/RoutingUtils'
import {useSettings} from "@mlflow/mlflow/src/common/hooks/cloud-pipeline/use-settings";


type DeployModelButtonImplProps = {
  runInfo: RunInfoEntity;
  modelVersion: ModelVersionInfoEntity;
};

type CallbackReturn = (() => void) | void;

function useIntervalEffect(callback: () => CallbackReturn | Promise<CallbackReturn>, dependencies: unknown[], interval = 5000) {
  useEffect(() => {
    // eslint-disable-next-line callback-return
    let clear: CallbackReturn | undefined;
    let s: ReturnType<typeof setTimeout> | undefined;
    const c = () => {
      if (s) {
        clearTimeout(s);
      }
      try {
        if (typeof clear === 'function') {
          clear();
        }
        // eslint-disable-next-line callback-return
        const o = callback();
        if (o && 'then' in o) {
          (async () => {
            clear = await o;
            s = setTimeout(c, interval);
          })();
        } else {
          clear = o;
          s = setTimeout(c, interval);
        }
      } catch (e) {
        // eslint-disable-next-line
        console.log(e);
        s = setTimeout(c, interval);
      }
    };
    c();
    return () => {
      if (typeof clear === 'function') {
        clear();
      }
      if (s) {
        clearInterval(s);
      }
    };
  }, [...dependencies, interval]);
}

type CloudPipelineRun = {
  id: number;
  status: string;
};

function useCloudPipelineRun(runInfo: RunInfoEntity): CloudPipelineRun | undefined {
  const settings = useSettings();
  const [cpRun, setCpRun] = useState<CloudPipelineRun | undefined>();
  const {
    runUuid, experimentId,
  } = runInfo;
  useIntervalEffect(async () => {
    const {
      cloud_pipeline_url,
      cp_mlflow_experiment_id_tag_name = 'CP_MLFLOW_EXPERIMENT_ID',
      cp_mlflow_run_uuid_tag_name = 'CP_MLFLOW_RUN_UUID',
      check_run_status,
    } = settings;
    if (cloud_pipeline_url && runUuid && experimentId && !cpRun && check_run_status) {
      const payload = {
        tags: {
          [cp_mlflow_experiment_id_tag_name]: experimentId,
          [cp_mlflow_run_uuid_tag_name]: runUuid,
        },
        page: 1,
        pageSize: 1,
      };
      const res = await cloudPipelinePostJson({
        relativeUrl: 'run/filter',
        data: payload,
      });
      const {
        elements = [],
      } = res as Record<any, any>;
      if (elements.length > 0) {
        setCpRun(elements[0]);
      }
    }
  }, [runUuid, experimentId, settings, cpRun, setCpRun]);
  return cpRun;
}

async function deployModel(runInfo: RunInfoEntity, modelUri: string): Promise<number> {
  const {run_payload, model_uri_parameter = 'CP_MLFLOW_MODEL_URI'} = await fetchCloudPipelineSettings();
  if (!run_payload) {
    throw new Error('Run payload not specified');
  }
  const {
    params = {},
    ...rest
  } = run_payload;
  const payload = {
    ...rest,
    params: {
      ...(params as Record<string, unknown>),
      [model_uri_parameter]: {value: modelUri, type: 'string'},
    },
  }
  const r = await cloudPipelinePostJson({
    relativeUrl: 'run',
    data: payload,
  });
  const {
    id,
  } = r as Record<string, undefined>;
  if (id && !Number.isNaN(Number(id))) {
    return id;
  }
  throw new Error('Error launching job');
}

const CloudPipelineRunLink = ({runId}: {runId: number;}) => {
  const {cloud_pipeline_url: base} = useSettings();
  if (!base) {
    return <span>#{runId}</span>;
  }
  const url = base.endsWith('/') ? base + `#/run/${runId}` : base + `/#/run/${runId}`;
  return <Link to={url} target="_blank">#{runId}</Link>
};

type DeployResult = {
  runId?: number;
  error?: string;
}

let uniqueId = 1;

function generateUniqueId(): string {
  uniqueId += 1;
  return `${uniqueId}-${(new Date()).toISOString()}`;
}

export const DeployModelButton = (props: DeployModelButtonImplProps) => {
  const { modelVersion, runInfo  } = props;
  const { check_run_status, run_payload } = useSettings();
  const uriModel = `models:/${modelVersion.name}/${modelVersion.version}`;
  const confirmationRef = useRef('');
  const [deployConfirmation, setDeployConfirmation] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | undefined>(undefined);
  const run = useCloudPipelineRun(runInfo);
  const onDeploy = useCallback(async () => {
    let opener: Window | undefined = window.parent || window.opener;
    if (opener === window) {
      opener = undefined;
    }
    try {
      setDeployResult(undefined);
      setDeploying(true);
      const id = await deployModel(runInfo, uriModel);
      if (opener) {
        (opener as Window).postMessage({
          messageType: 'model-deployed',
          runId: id,
        }, '*');
      } else {
        setDeployResult({
          runId: id,
        });
      }
    } catch (error) {
      // eslint-disable-next-line
      console.log(error);
      if (opener) {
        (opener as Window).postMessage({
          messageType: 'model-deploy-error',
          error: error instanceof Error ? error.message: undefined
        }, '*');
      } else {
        setDeployResult({
          error: error instanceof Error ? `Error deploying model: ${error.message}` : 'Error deploying model',
        });
      }
    } finally {
      setDeploying(false);
    }
  }, [setDeploying, runInfo, uriModel, setDeployResult]);
  const onDeployClick = useCallback(async () => {
    let opener: Window | undefined = window.parent || window.opener;
    if (opener === window) {
      opener = undefined;
    }
    try {
      if (opener) {
        confirmationRef.current = generateUniqueId();
        (opener as Window).postMessage({
          messageType: 'model-deploy-confirm',
          confirmation: {id: confirmationRef.current},
        }, '*');
      } else {
        setDeployConfirmation(true);
      }
    } catch {
      // noop
    } finally {
    }
  }, [setDeployConfirmation, confirmationRef]);
  useEffect(() => {
    const abortController = new AbortController();
    window.addEventListener('message', (event) => {
      const { data } = event;
      if (data && typeof data === 'object') {
        const {
          messageType,
          confirmation
        } = data as Record<string, unknown>;
        if (messageType && typeof messageType === 'string') {
          if (
            messageType === 'model-deploy-confirm-done' &&
            confirmation &&
            typeof confirmation === 'object' &&
            'id' in confirmation &&
            confirmationRef.current === confirmation.id) {
            void onDeploy();
          }
        }
      }
    }, {signal: abortController.signal});
    return () => {
      abortController.abort();
    };
  }, [confirmationRef, onDeploy]);
  const onClose = useCallback(() => setDeployResult(undefined), [setDeployResult]);
  const onCloseConfirmation = useCallback(() => setDeployConfirmation(false), [setDeployConfirmation]);
  const onConfirm = useCallback(() => {
    setDeployConfirmation(false);
    void onDeploy();
  }, [setDeployConfirmation, onDeploy]);
  if (!run_payload || (check_run_status && (!run || !/^SUCCESS$/i.test(run.status)))) {
    return null;
  }
  return (
    <div className="promote-model-btn-wrapper">
      <Button
        componentId="codegen_mlflow_app_src_model-registry_components_deploymodelbutton.tsx_165"
        className="deploy-model-btn"
        type="primary"
        onClick={onDeployClick}
        loading={deploying}
      >
        <FormattedMessage
          defaultMessage="Deploy model"
          description="Button text to deploy the model"
        />
      </Button>
      <Modal
        componentId="codegen_mlflow_app_src_model-registry_components_deploymodelresult.tsx_165"
        visible={deployResult !== undefined}
        onCancel={onClose}
        title={deployResult && deployResult.error ? 'Model deployment error' : 'Model deployment has been started'}
        footer={(
          <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-end'}}>
            <Button
              componentId="codegen_mlflow_app_src_model-registry_components_deploymodelresultbutton.tsx_165"
              className="deploy-model-result-btn"
              type="primary"
              onClick={onClose}
            >
              OK
            </Button>
          </div>
        )}
      >
        {deployResult && deployResult.error ? (
          <Alert
            componentId="codegen_mlflow_app_src_model-registry_components_deploymodelresultalert.tsx_165"
            type="error"
            message={deployResult.error}
            closable={false}
          />
        ) : (
          <>
            {deployResult && deployResult.runId && (
              <div>
                Deployment ID: <CloudPipelineRunLink runId={deployResult.runId}/>
              </div>
            )}
          </>
        )}
      </Modal>
      <Modal
        componentId="codegen_mlflow_app_src_model-registry_components_deploymodelconfirmation.tsx_165"
        visible={deployConfirmation}
        onCancel={onCloseConfirmation}
        footer={(
          <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-end'}}>
            <Button
              componentId="codegen_mlflow_app_src_model-registry_components_deploymodelconfirmationcancelbutton.tsx_165"
              className="deploy-model-confirmation-cancel-btn"
              onClick={onCloseConfirmation}
            >
              CANCEL
            </Button>
            <Button
              componentId="codegen_mlflow_app_src_model-registry_components_deploymodelconfirmationcancelbutton.tsx_165"
              className="deploy-model-confirmation-cancel-btn"
              onClick={onConfirm}
              type="primary"
            >
              DEPLOY
            </Button>
          </div>
        )}
      >
        <b style={{fontSize: 'large'}}>
          Are you sure you want to deploy this model?
        </b>
      </Modal>
    </div>
  );
};
