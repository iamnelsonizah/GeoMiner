# Local-first project-data policy

GeoMiner's first private-data mode is local-first: project data remain on the
user's GeoMiner instance and are not used to train a shared model. No private
dataset may be reused in another project without an explicit, recorded owner
consent.

## Before accepting confidential data in a hosted deployment

Implement authenticated accounts, project-level authorization, encrypted
storage, audit logs, deletion/export controls, retention settings, signed data
provenance, and a clear owner-consent workflow. Until then, confidential assays,
drillholes, licences and proprietary interpretations must not be uploaded to a
public instance.

## Dataset classes

- **Reference data:** public map and occurrence sources; retain URL, licence,
  download date, scale/resolution and source version.
- **Project evidence:** geology, geochemistry, geophysics, drillholes and field
  observations; retain owner, project, source date and confidence.
- **Training labels:** vetted occurrences, background and exclusion features;
  retain `site_id`, `district_id`, commodity, deposit type, source and
  confidence. Background is not described as proven barren ground.
