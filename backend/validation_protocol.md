# GeoMiner validation protocol

GeoMiner's current weighted model is an exploration-screening baseline. A
machine-learning model may be released only after completing this protocol.

## Input data contract

Known occurrences must be supplied as GeoJSON features with `site_id`,
`district_id`, `commodity`, `deposit_type`, `label`, `source`, `source_date`,
and `confidence`. Labels are `positive`, `background`, or `excluded`.
Background is unlabelled comparison ground; it is never described as proven
barren ground. Occurrences in the same district, camp, or discovery cluster
must share a `district_id`.

## Spatial validation

Use nested spatial validation. In the outer loop, hold out one complete mineral
district (or a pre-defined occurrence cluster). In the inner loop, use spatial
blocks within the remaining districts for model tuning. Fit feature scaling,
imputation, background sampling, class weights, feature selection and
calibration only inside the relevant training fold. Apply an exclusion buffer
around occurrences before sampling background points.

Never randomly split pixels. Thousands of neighbouring pixels do not represent
thousands of independent geological examples.

## Required reporting

For every held-out district report recall at 1%, 5% and 10% of ranked area,
precision-recall AUC, success-rate curves, usable-area coverage, and district
bootstrap confidence intervals. Publish failures as well as successes. Compare
every ML model against the fixed expert-weighted baseline.

Only call an output a probability after calibration against independent test
data with defensible negative labels. Otherwise label it a prospectivity or
ranking score.
