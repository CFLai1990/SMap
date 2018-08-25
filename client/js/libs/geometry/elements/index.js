define([
  './point',
  './edge'
], function (Point, Edge) {
  let geometryElements = {
    Point: Point,
    Edge: Edge
  }
  return geometryElements
})
