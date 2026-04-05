# Definition Engine

## Purpose
This folder is the shared home for  evaluation logic used by:

- metric definitions
- alert definitions

The two definition families should share the same evaluator framework, but not the exact same AST.



## Intended Split

### Metric definitions
Metric definitions compute a numeric value.

Examples:

- `stockInQuantity / stockOutQuantity`
- `(criticalCount / totalSku) * 100`

Expected result type:

- number-like output

### Alert definitions
Alert definitions compute a boolean trigger state.

Examples:

- `totalQuantity < 50`
- `outflow_ratio > 70 AND criticalCount > 5`

Expected result type:

- boolean-like output

