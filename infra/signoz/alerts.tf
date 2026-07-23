terraform {
  required_version = ">= 1.5.0"

  required_providers {
    signoz = {
      source  = "SigNoz/signoz"
      version = "= 0.0.17"
    }
  }
}

provider "signoz" {}

locals {
  agent_alerts = {
    tool_failures = {
      alert            = "AgentScope: tool failures detected"
      severity         = "critical"
      metric           = "agentscope.tool.calls"
      filter           = "status = 'error'"
      time_aggregation = "latest"
      aggregation      = "sum"
      operator         = "above"
      threshold        = 0
      unit             = "none"
      summary          = "An AI-agent tool call failed"
      description      = "Open the Sidekick run, pivot to its trace ID, and inspect execute_tool search_docs plus the correlated ERROR log."
    }
    token_budget = {
      alert            = "AgentScope: token budget exceeded"
      severity         = "warning"
      metric           = "agentscope.agent.tokens_per_run.max"
      filter           = ""
      time_aggregation = "latest"
      aggregation      = "max"
      operator         = "above"
      threshold        = 10000
      unit             = "none"
      summary          = "An AI-agent run exceeded the token budget"
      description      = "Inspect gen_ai usage attributes and reduce prompt context or add a per-run token guardrail."
    }
    retrieval_quality = {
      alert            = "AgentScope: retrieval quality degraded"
      severity         = "warning"
      metric           = "agentscope.retrieval.score.min"
      filter           = ""
      time_aggregation = "latest"
      aggregation      = "min"
      operator         = "below"
      threshold        = 0.3
      unit             = "none"
      summary          = "Minimum retrieval confidence is below 0.3"
      description      = "Inspect query knowledge_chunks spans, source diversity, results used, and query filters."
    }
    latency_budget = {
      alert            = "AgentScope: agent latency above budget"
      severity         = "warning"
      metric           = "agentscope.agent.duration.max"
      filter           = ""
      time_aggregation = "latest"
      aggregation      = "max"
      operator         = "above"
      threshold        = 10000
      unit             = "ms"
      summary          = "AI-agent peak latency is above 10 seconds"
      description      = "Compare retrieval, tool, and LLM child-span duration to locate the bottleneck."
    }
  }
}

resource "signoz_rule" "agent" {
  for_each = local.agent_alerts

  alert          = each.value.alert
  alert_type     = "METRIC_BASED_ALERT"
  rule_type      = "threshold_rule"
  schema_version = "v2alpha1"
  description    = each.value.description
  disabled       = false

  annotations = {
    summary = each.value.summary
  }

  labels = {
    severity = each.value.severity
    project  = "agentscope-sidekick"
    track    = "ai-agent-observability"
  }

  condition = {
    composite_query = {
      panel_type = "graph"
      query_type = "builder"
      unit       = each.value.unit

      queries = [{
        builder_query = {
          type = "builder_query"
          spec = {
            metrics = {
              name   = "A"
              signal = "metrics"

              aggregations = [{
                metric_name       = each.value.metric
                time_aggregation  = each.value.time_aggregation
                space_aggregation = each.value.aggregation
              }]

              filter = {
                expression = each.value.filter
              }

              group_by      = []
              step_interval = "60"
            }
          }
        }
      }]
    }

    selected_query_name = "A"

    thresholds = {
      basic = {
        kind = "basic"
        spec = [{
          channels    = []
          match_type  = "at_least_once"
          name        = each.value.severity
          op          = each.value.operator
          target      = each.value.threshold
          target_unit = each.value.unit
        }]
      }
    }
  }

  evaluation = {
    rolling = {
      kind = "rolling"
      spec = {
        eval_window = "5m"
        frequency   = "1m"
      }
    }
  }

  notification_settings = {
    group_by   = ["alertname"]
    use_policy = true
    renotify = {
      interval     = "30m"
      alert_states = ["firing"]
      enabled      = true
    }
  }
}
