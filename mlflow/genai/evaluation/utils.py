import inspect
import json
from typing import TYPE_CHECKING, Any, Optional, Union

from mlflow.data.evaluation_dataset import EvaluationDataset
from mlflow.entities import Assessment, Trace
from mlflow.exceptions import MlflowException
from mlflow.genai.evaluation.constant import (
    AGENT_EVAL_CUSTOM_EXPECTATION_KEY,
    AgentEvaluationReserverKey,
)
from mlflow.genai.scorers import Scorer
from mlflow.models import EvaluationMetric

try:
    # `pandas` is not required for `mlflow-skinny`.
    import pandas as pd
except ImportError:
    pass

if TYPE_CHECKING:
    try:
        import pyspark.sql.dataframe

        EvaluationDatasetTypes = Union[
            pd.DataFrame, pyspark.sql.dataframe.DataFrame, list[dict], EvaluationDataset
        ]
    except ImportError:
        EvaluationDatasetTypes = Union[pd.DataFrame, list[dict], EvaluationDataset]


def _convert_to_legacy_eval_set(data: "EvaluationDatasetTypes") -> "pd.DataFrame":
    """
    Takes in a dataset in the format that mlflow.genai.evaluate() expects and converts it into
    to the current eval-set schema that Agent Evaluation takes in. The transformed schema should
    be accepted by mlflow.evaluate().
    The expected schema can be found at:
    https://docs.databricks.com/aws/en/generative-ai/agent-evaluation/evaluation-schema
    """
    column_mapping = {
        "inputs": "request",
        "outputs": "response",
    }

    if isinstance(data, list):
        # validate that every item in the list is a dict and has inputs as key
        for item in data:
            if not isinstance(item, dict):
                raise MlflowException.invalid_parameter_value(
                    "Every item in the list must be a dictionary."
                )
        df = pd.DataFrame(data)
    elif isinstance(data, pd.DataFrame):
        # Data is already a pd DataFrame, just copy it
        df = data.copy()
    else:
        try:
            import pyspark.sql.dataframe

            if isinstance(data, pyspark.sql.dataframe.DataFrame):
                df = data.toPandas()
            else:
                raise MlflowException.invalid_parameter_value(
                    "Invalid type for parameter `data`. Expected a list of dictionaries, "
                    f"a pandas DataFrame, or a Spark DataFrame. Got: {type(data)}"
                )
        except ImportError:
            raise ImportError(
                "The `pyspark` package is required to use mlflow.genai.evaluate() "
                "Please install it with `pip install pyspark`."
            )

    # Verify format of the input using the first row
    sample_row = df.iloc[0]
    if "inputs" in sample_row and not isinstance(sample_row["inputs"], dict):
        raise MlflowException.invalid_parameter_value(
            "The 'inputs' column must be a dictionary. If you want to pass a single "
            "argument to the `predict_fn`, use the argument name as the key in the "
            "dictionary. If you don't pass a `predict_fn`, you can use any string "
            "key to wrap the value into a dictionary."
        )

    if not any(col in df.columns for col in ("trace", "inputs")):
        raise MlflowException.invalid_parameter_value(
            "Either `inputs` or `trace` column is required in the dataset. Please provide inputs "
            "for every datapoint or provide a trace."
        )

    return (
        df.rename(columns=column_mapping)
        .pipe(_extract_request_from_trace)
        .pipe(_extract_expectations_from_trace)
        .pipe(_convert_expectations_to_legacy_columns)
    )


def _extract_request_from_trace(df: "pd.DataFrame") -> "pd.DataFrame":
    """
    Add `request` columns to the dataframe if it is not already present.
    This is for compatibility with mlflow.evaluate() that requires `request` column.
    """
    if "trace" not in df.columns:
        return df

    if "request" not in df.columns:
        df["request"] = df["trace"].apply(lambda trace: json.loads(trace.data.request))
    return df


def _extract_expectations_from_trace(df: "pd.DataFrame") -> "pd.DataFrame":
    """
    Add `expectations` columns to the dataframe from assessments
    stored in the traces, if the "expectations" column is not already present.
    """
    if "trace" not in df.columns:
        return df

    expectations_column = []
    for trace in df["trace"]:
        expectations = {}
        for assessment in trace.info.assessments or []:
            if assessment.expectation is not None:
                expectations[assessment.name] = assessment.expectation.value
        expectations_column.append(expectations)
    # If no trace has assessments, not add the column
    if all(len(expectations) == 0 for expectations in expectations_column):
        return df

    df["expectations"] = expectations_column
    return df


def _convert_expectations_to_legacy_columns(df: "pd.DataFrame") -> "pd.DataFrame":
    # expand out expectations into separate columns
    if "expectations" in df.columns:
        for field in [*AgentEvaluationReserverKey.get_all(), AGENT_EVAL_CUSTOM_EXPECTATION_KEY]:
            df[field] = None

        # Process each row individually to handle mixed types
        for idx, value in df["expectations"].items():
            if isinstance(value, dict):
                # Reserved expectation keys is propagated as a new column
                for field in AgentEvaluationReserverKey.get_all():
                    if field in value:
                        df.at[idx, field] = value.pop(field, None)
                # Other columns go to custom_expected
                if value:
                    df.at[idx, AGENT_EVAL_CUSTOM_EXPECTATION_KEY] = value

            elif pd.isna(value):
                # Only some rows in the dataset might have expectations.
                # For those rows, we don't have any expectations, so we skip them.
                continue

            else:
                raise MlflowException.invalid_parameter_value(
                    "Expectations must be a dictionary in the form of [name of expectation]: "
                    '[value], e.g., `{"expectations": {"expected_response": "..."}`'
                )

        df.drop(columns=["expectations"], inplace=True)

    return df


def _convert_scorer_to_legacy_metric(scorer: Scorer) -> EvaluationMetric:
    """
    Takes in a Scorer object and converts it into a legacy MLflow 2.x
    Metric object.
    """
    try:
        from databricks.agents.evals import metric
    except ImportError:
        raise ImportError(
            "The `databricks-agents` package is required to use mlflow.genai.evaluate() "
            "Please install it with `pip install databricks-agents`."
        )

    from mlflow.types.llm import ChatCompletionRequest

    def eval_fn(
        request_id: str,
        request: Union[ChatCompletionRequest, str],
        response: Optional[Any],
        expected_response: Optional[Any],
        trace: Optional[Trace],
        retrieved_context: Optional[list[dict[str, str]]],
        guidelines: Optional[Union[list[str], dict[str, list[str]]]],
        expected_facts: Optional[list[str]],
        expected_retrieved_context: Optional[list[dict[str, str]]],
        custom_expected: Optional[dict[str, Any]],
        custom_inputs: Optional[dict[str, Any]],
        custom_outputs: Optional[dict[str, Any]],
        tool_calls: Optional[list[Any]],
        **kwargs,
    ) -> Union[int, float, bool, str, Assessment, list[Assessment]]:
        # Condense all expectations into a single dict
        expectations = {}
        if expected_response is not None:
            expectations[AgentEvaluationReserverKey.EXPECTED_RESPONSE] = expected_response
        if expected_facts is not None:
            expectations[AgentEvaluationReserverKey.EXPECTED_FACTS] = expected_facts
        if expected_retrieved_context is not None:
            expectations[AgentEvaluationReserverKey.EXPECTED_RETRIEVED_CONTEXT] = (
                expected_retrieved_context
            )
        if guidelines is not None:
            expectations[AgentEvaluationReserverKey.GUIDELINES] = guidelines
        if custom_expected is not None:
            expectations.update(custom_expected)

        # TODO: scorer.aggregations require a refactor on the agents side
        merged = {
            "inputs": request,
            "outputs": response,
            "expectations": expectations,
            "trace": trace,
            "guidelines": guidelines,
            "retrieved_context": retrieved_context,
            "expected_facts": expected_facts,
            "expected_retrieved_context": expected_retrieved_context,
            "custom_expected": custom_expected,
            "custom_inputs": custom_inputs,
            "custom_outputs": custom_outputs,
            "tool_calls": tool_calls,
            **kwargs,
        }
        # Filter to only the parameters the scorer actually expects
        sig = inspect.signature(scorer)
        filtered = {k: v for k, v in merged.items() if k in sig.parameters}
        return scorer(**filtered)

    return metric(
        eval_fn=eval_fn,
        name=scorer.name,
    )
