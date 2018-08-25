define([
  './elements/index',
  './polygons/index',
  './layout/index'
], function (GeoElements, GeoPolygons, GeoLayout) {
  let Geometry = {
    elements: GeoElements,
    polygons: GeoPolygons,
    layout: GeoLayout
  }
  return Geometry
})
