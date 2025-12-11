SELECT
  usage_metrics.blueprint_name,
  usage_metrics.organization_slug,
  usage_metrics.model,
  sum(usage_metrics.input) AS total_input_tokens,
  sum(usage_metrics.output) AS total_output_tokens,
  sum(usage_metrics.credit_microcents_used) AS total_credit_microcents_used,
  count(*) AS usage_events
FROM
  usage_metrics
GROUP BY
  usage_metrics.blueprint_name,
  usage_metrics.organization_slug,
  usage_metrics.model;