define([
  './point',
  './edge',
  './path',
  './methods'
], function (Point, Edge, Path, Methods) {
  let geometryElements = {
    Point: Point,
    Edge: Edge,
    Path: Path,
    Methods: Methods
  }
  return geometryElements
})
