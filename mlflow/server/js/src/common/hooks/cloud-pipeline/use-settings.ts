import {CloudPipelineSettings, fetchCloudPipelineSettings} from "@mlflow/mlflow/src/common/utils/FetchUtils";
import {useEffect, useState} from "react";

export function useSettings(): CloudPipelineSettings {
  const [settings, setSettings] = useState<CloudPipelineSettings>({});
  useEffect(() => {
    fetchCloudPipelineSettings().then(setSettings);
  }, [setSettings]);
  return settings;
}
