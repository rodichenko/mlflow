import React, { useMemo } from 'react';
import { FormattedMessage } from 'react-intl';
import {
  ExperimentViewHeaderShareButton
} from "@mlflow/mlflow/src/experiment-tracking/components/experiment-page/components/header/ExperimentViewHeaderShareButton";
import {PageHeader} from "@mlflow/mlflow/src/shared/building_blocks/PageHeader";
import {useCloudPipelineRun} from "@mlflow/mlflow/src/common/utils/RoutingUtils";

const breadcrumbs: React.ReactNode[] = [];

/**
 * Header for experiment compare page. Displays title and breadcrumbs.
 */
export const CloudPipelineRunsHeader = React.memo(() => {
  const runId = useCloudPipelineRun();
  const pageTitle = useMemo(
    () => (
      <FormattedMessage
        defaultMessage="Displaying Runs for #{runId} job"
        description="Message shown when displaying runs for cloud pipeline job"
        values={{
          runId,
        }}
      />
    ),
    [runId],
  );

  return (
    <PageHeader title={runId ? pageTitle : undefined} breadcrumbs={breadcrumbs}>
      <ExperimentViewHeaderShareButton />
    </PageHeader>
  );
});
