# Third-party notices

The workflow, authoring tools and page templates are MIT licensed. Bundled third-party assets retain their own terms:

| Component | Bundled version / source | License |
|---|---|---|
| MapLibre GL JS + CSS | 5.6.2, unpkg distribution | BSD-3-Clause and included dependency notices |
| Leaflet JS + CSS + images | 1.9.4, unpkg distribution and upstream LICENSE | BSD-2-Clause |
| Natural Earth geographic data | Admin-1 10m and countries 110m, simplified | Public domain |

The complete MapLibre distribution notice is retained in `skills/graduation-map/assets/vendor/LICENSE.txt` and embedded in generated HTML. It includes the notices for code derived from earlier Mapbox GL JS and other bundled dependencies.

Leaflet's upstream license is retained in `skills/graduation-map/assets/vendor/leaflet/LICENSE` and embedded in generated HTML. Leaflet provides the independent offline 2D renderer; its JS, CSS and CSS image resources are bundled locally.

Natural Earth sources and processing are documented in `skills/graduation-map/assets/geo/sources.txt`. Country and province outlines are generalized reference geometry, not survey-grade boundaries.

Optional online street maps use OpenFreeMap/OpenMapTiles and OpenStreetMap data. The generated page displays provider attribution when this layer is enabled. Online provider availability and policies are separate from this repository's license.

References:

- https://github.com/maplibre/maplibre-gl-js/tree/v5.6.2
- https://github.com/Leaflet/Leaflet/tree/v1.9.4
- https://www.naturalearthdata.com/about/terms-of-use/
- https://openfreemap.org/
- https://www.openstreetmap.org/copyright
